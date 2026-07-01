// =============================================================================
// GermaniaApp — Stocherkahn (Vereinsboot) — stundenweise Buchung (kostenlos)
// Buchung dawn→dusk-Fenster, ohne Bezahlung. Eine browsebare Belegung zeigt
// visuell, wer den Kahn wann und wie lange hat. Admins legen die Saison fest.
// =============================================================================
import {
  getActiveSeason,
  saveSeason,
  listBookings,
  listMyBookings,
  listSchedule,
  createBooking,
  cancelBooking,
  getMyMember,
} from '../lib/api';
import { civilDawnDusk } from '../lib/suntimes';
import type { Member, StocherkahnSeason, StocherkahnBooking } from '../lib/database.types';
import { el, field, toast, clear } from '../lib/ui';

const TZ = 'Europe/Berlin';
const hhmm = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const tag = (d: string | Date) => new Date(d).toLocaleDateString('de-DE', { dateStyle: 'medium' });
const ceilHour = (d: Date) => new Date(Math.ceil(d.getTime() / 3_600_000) * 3_600_000);
const floorHour = (d: Date) => new Date(Math.floor(d.getTime() / 3_600_000) * 3_600_000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function mountStocherkahn(root: HTMLElement): Promise<void> {
  clear(root);
  const wrap = el('div', { class: 'profile' }, [el('h1', {}, ['Stocherkahn'])]);
  root.append(wrap);

  const me = await getMyMember().catch(() => null);
  const season = await getActiveSeason().catch(() => null);

  if (!season) {
    wrap.append(el('p', { class: 'muted' }, ['Der Stocherkahn ist derzeit nicht im Wasser (keine aktive Saison).']));
  } else {
    wrap.append(el('div', { class: 'card' }, [
      el('h2', {}, [season.name ?? 'Saison']),
      el('div', {}, [`Im Wasser ${tag(season.water_date)} – ${tag(season.withdraw_date)}`]),
      el('div', { class: 'muted' }, ['Stundenweise buchbar · kostenlos']),
    ]));
  }

  if (me?.role === 'admin') wrap.append(renderSeasonEditor(season, () => mountStocherkahn(root)));
  if (season) wrap.append(await renderSchedule(season));
  if (season && me) {
    wrap.append(await renderBookingForm(season, me, () => mountStocherkahn(root)));
    wrap.append(await renderMyBookings(me, () => mountStocherkahn(root)));
  }
}

// --- Belegung (browsable day schedule) --------------------------------------
async function renderSchedule(season: StocherkahnSeason): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Belegung'])]);
  let day = new Date();
  const min = new Date(season.water_date);
  const max = new Date(season.withdraw_date);
  if (day < min) day = min;

  const dateInput = el('input', { type: 'date', value: iso(day), min: season.water_date, max: season.withdraw_date });
  const prev = el('button', { type: 'button' }, ['‹']);
  const next = el('button', { type: 'button' }, ['›']);
  const nav = el('div', { class: 'inline schednav' }, [prev, dateInput, next]);
  const body = el('div', { class: 'sched' });
  card.append(nav, body);

  const render = async () => {
    clear(body);
    body.append(el('p', { class: 'loading' }, ['Wird geladen…']));
    let rows;
    try {
      rows = await listSchedule(dateInput.value);
    } catch (e) {
      clear(body); body.append(el('p', { class: 'err' }, [(e as Error).message])); return;
    }
    clear(body);
    if (rows.length === 0) { body.append(el('p', { class: 'muted' }, ['Frei — keine Buchung an diesem Tag.'])); return; }
    // day window (dawn–dusk) to scale the bars
    const sun = civilDawnDusk(dateInput.value, season.latitude, season.longitude);
    const dayStart = sun.dawn ? +floorHour(sun.dawn) : +new Date(`${dateInput.value}T06:00:00`);
    const dayEnd = sun.dusk ? +ceilHour(sun.dusk) : +new Date(`${dateInput.value}T22:00:00`);
    const span = Math.max(1, dayEnd - dayStart);
    for (const r of rows) {
      const s = +new Date(r.starts_at), e = +new Date(r.ends_at);
      const left = Math.max(0, Math.min(100, ((s - dayStart) / span) * 100));
      const width = Math.max(4, Math.min(100 - left, ((e - s) / span) * 100));
      const hours = Math.round((e - s) / 3_600_000);
      const rowEl = el('div', { class: 'schedrow' }, [
        el('div', { class: 'schedmeta' }, [
          el('strong', {}, [r.member_name]),
          el('span', { class: 'muted' }, [` ${hhmm(r.starts_at)}–${hhmm(r.ends_at)} · ${hours} Std`]),
        ]),
        el('div', { class: 'schedtrack' }, [
          el('div', { class: 'schedbar', style: `left:${left}%;width:${width}%` }, []),
        ]),
      ]);
      body.append(rowEl);
    }
  };

  const shift = (days: number) => {
    const d = new Date(dateInput.value); d.setDate(d.getDate() + days);
    if (d >= min && d <= max) { dateInput.value = iso(d); render(); }
  };
  prev.addEventListener('click', () => shift(-1));
  next.addEventListener('click', () => shift(1));
  dateInput.addEventListener('change', render);
  await render();
  return card;
}

// --- Buchungsformular (kostenlos) -------------------------------------------
async function renderBookingForm(
  season: StocherkahnSeason, me: Member, onChange: () => void,
): Promise<HTMLElement> {
  const allBookings = await listBookings(season.id);

  const card = el('div', { class: 'card' }, [el('h2', {}, ['Stunde buchen'])]);
  const dateInput = el('input', { type: 'date', min: season.water_date, max: season.withdraw_date });
  const windowLine = el('div', { class: 'muted' }, ['Wähle ein Datum, um das Zeitfenster zu sehen.']);
  const startSel = el('select', {}, []);
  const durSel = el('select', {}, []);
  const bookedLine = el('div', { class: 'muted' }, []);
  const book = el('button', { type: 'button', class: 'primary' }, ['Buchen']);
  book.disabled = true;

  let dusk: Date | null = null;

  const rebuildDurations = () => {
    clear(durSel);
    const start = new Date(Number(startSel.value));
    if (!dusk) return;
    const maxHours = Math.floor((+dusk - +start) / 3_600_000);
    for (let h = 1; h <= Math.max(1, maxHours); h++) {
      durSel.append(el('option', { value: h }, [`${h} Stunde${h > 1 ? 'n' : ''}`]));
    }
  };

  dateInput.addEventListener('change', () => {
    const d = dateInput.value;
    clear(startSel); clear(durSel); book.disabled = true;
    if (!d) return;
    const sun = civilDawnDusk(d, season.latitude, season.longitude);
    if (!sun.dawn || !sun.dusk) { windowLine.textContent = 'An diesem Tag gibt es kein Tageslichtfenster.'; return; }
    dusk = sun.dusk;
    windowLine.textContent = `Dämmerung ${hhmm(sun.dawn)} bis ${hhmm(sun.dusk)} (Ortszeit)`;
    const first = ceilHour(sun.dawn), last = floorHour(sun.dusk);
    const starts: Date[] = [];
    for (let t = +first; t < +last; t += 3_600_000) starts.push(new Date(t));
    if (starts.length === 0) { windowLine.textContent += ' — zu kurz zum Buchen.'; return; }
    for (const s of starts) startSel.append(el('option', { value: +s }, [hhmm(s)]));
    book.disabled = false;
    rebuildDurations();
    const onDay = allBookings.filter((b) => b.booking_date === d);
    bookedLine.textContent = onDay.length
      ? 'Bereits belegt: ' + onDay.map((b) => `${hhmm(b.starts_at)}–${hhmm(b.ends_at)}`).join(', ')
      : '';
  });
  startSel.addEventListener('change', rebuildDurations);

  book.addEventListener('click', async () => {
    const d = dateInput.value;
    const hrs = Number(durSel.value || 0);
    if (!d || !startSel.value || !hrs) return;
    const s = new Date(Number(startSel.value));
    const e = new Date(+s + hrs * 3_600_000);
    book.disabled = true;
    book.textContent = 'Buche…';
    try {
      await createBooking(me.id, d, s, e);
      toast('Gebucht');
      onChange();
    } catch (err) {
      toast((err as Error).message, false);
      book.disabled = false;
      book.textContent = 'Buchen';
    }
  });

  card.append(
    field('Datum', dateInput),
    windowLine,
    el('div', { class: 'grid2' }, [field('Startzeit', startSel), field('Dauer', durSel)]),
    book,
    bookedLine,
  );
  return card;
}

// --- Meine Buchungen ---------------------------------------------------------
async function renderMyBookings(me: Member, onChange: () => void): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Meine Buchungen'])]);
  const mine = await listMyBookings(me.id);
  const upcoming = mine.filter((b) => b.status !== 'cancelled');
  if (upcoming.length === 0) {
    card.append(el('p', { class: 'muted' }, ['Noch keine Buchungen.']));
    return card;
  }
  for (const b of upcoming) card.append(renderBookingRow(b, onChange));
  return card;
}

function renderBookingRow(b: StocherkahnBooking, onChange: () => void): HTMLElement {
  const row = el('div', { class: 'row' }, [
    el('div', {}, [
      el('span', { class: 'pill' }, [tag(b.booking_date)]),
      el('span', { class: 'pill' }, [`${hhmm(b.starts_at)}–${hhmm(b.ends_at)}`]),
    ]),
  ]);
  const cancel = el('button', { class: 'link danger', type: 'button' }, ['Stornieren']);
  cancel.addEventListener('click', async () => {
    try { await cancelBooking(b.id); toast('Storniert'); onChange(); }
    catch (e) { toast((e as Error).message, false); }
  });
  row.append(cancel);
  return row;
}

// --- Admin: Saison festlegen -------------------------------------------------
function renderSeasonEditor(season: StocherkahnSeason | null, onSaved: () => void): HTMLElement {
  const card = el('details', { class: 'card' }, [el('summary', {}, ['Admin: Saison & Standort festlegen'])]);
  const form = el('form', {}, [
    field('Name', el('input', { name: 'name', value: season?.name ?? '' })),
    el('div', { class: 'grid2' }, [
      field('Zu Wasser (Beginn)', el('input', { name: 'water_date', type: 'date', required: true, value: season?.water_date ?? '' })),
      field('Aus dem Wasser (Ende)', el('input', { name: 'withdraw_date', type: 'date', required: true, value: season?.withdraw_date ?? '' })),
      field('Breitengrad', el('input', { name: 'latitude', type: 'number', step: 'any', value: String(season?.latitude ?? 48.5216) })),
      field('Längengrad', el('input', { name: 'longitude', type: 'number', step: 'any', value: String(season?.longitude ?? 9.0576) })),
    ]),
    el('button', { type: 'submit', class: 'primary' }, ['Saison speichern']),
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      await saveSeason({
        name: (f.get('name') as string) || null,
        water_date: String(f.get('water_date')),
        withdraw_date: String(f.get('withdraw_date')),
        latitude: Number(f.get('latitude')),
        longitude: Number(f.get('longitude')),
      });
      toast('Saison gespeichert');
      onSaved();
    } catch (err) {
      toast((err as Error).message, false);
    }
  });
  card.append(form);
  return card;
}
