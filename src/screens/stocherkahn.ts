// =============================================================================
// GermaniaApp — Stocherkahn (Vereinsboot) — stundenweise Buchung
// Mitglieder buchen den Kahn stundenweise innerhalb des Dämmerungsfensters
// (Morgen- bis Abenddämmerung) und zahlen 1 € pro Stunde via Stripe. Admins
// legen Saison (zu Wasser / aus dem Wasser) und Standort fest.
// =============================================================================
import {
  getActiveSeason,
  saveSeason,
  listBookings,
  listMyBookings,
  createBooking,
  startCheckout,
  cancelBooking,
  getMyMember,
} from '../lib/api';
import { civilDawnDusk } from '../lib/suntimes';
import type { Member, StocherkahnSeason, StocherkahnBooking } from '../lib/database.types';
import { el, field, toast, clear } from '../lib/ui';

const TZ = 'Europe/Berlin';
const hhmm = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const tag = (d: string) => new Date(d).toLocaleDateString('de-DE', { dateStyle: 'medium' });
const ceilHour = (d: Date) => new Date(Math.ceil(d.getTime() / 3_600_000) * 3_600_000);
const floorHour = (d: Date) => new Date(Math.floor(d.getTime() / 3_600_000) * 3_600_000);

export async function mountStocherkahn(root: HTMLElement): Promise<void> {
  clear(root);
  const wrap = el('div', { class: 'profile' }, [el('h1', {}, ['Stocherkahn'])]);
  root.append(wrap);

  const me = await getMyMember().catch(() => null);
  const season = await getActiveSeason().catch(() => null);

  if (!season) {
    wrap.append(el('p', { class: 'muted' }, ['Der Stocherkahn ist derzeit nicht im Wasser (keine aktive Saison).']));
  } else {
    wrap.append(
      el('div', { class: 'card' }, [
        el('h2', {}, [season.name ?? 'Saison']),
        el('div', {}, [`Im Wasser ${tag(season.water_date)} – ${tag(season.withdraw_date)}`]),
        el('div', { class: 'muted' }, ['Stundenweise buchbar · 1 € pro Stunde']),
      ]),
    );
  }

  if (me?.role === 'admin') wrap.append(renderSeasonEditor(season, () => mountStocherkahn(root)));
  if (season && me) {
    wrap.append(await renderBookingForm(season, me, () => mountStocherkahn(root)));
    wrap.append(await renderMyBookings(me, () => mountStocherkahn(root)));
  }
}

// --- Buchungsformular --------------------------------------------------------
async function renderBookingForm(
  season: StocherkahnSeason, me: Member, onChange: () => void,
): Promise<HTMLElement> {
  const allBookings = await listBookings(season.id);

  const card = el('div', { class: 'card' }, [el('h2', {}, ['Stunde buchen'])]);
  const dateInput = el('input', { type: 'date', min: season.water_date, max: season.withdraw_date });
  const windowLine = el('div', { class: 'muted' }, ['Wähle ein Datum, um das Zeitfenster zu sehen.']);
  const startSel = el('select', {}, []);
  const durSel = el('select', {}, []);
  const feeLine = el('div', { class: 'pill' }, ['Gebühr: –']);
  const bookedLine = el('div', { class: 'muted' }, []);
  const book = el('button', { type: 'button', class: 'primary' }, ['Buchen']);
  book.disabled = true;

  let starts: Date[] = []; // candidate start instants (whole hours)
  let dusk: Date | null = null;

  const updateFee = () => {
    const hrs = Number(durSel.value || 0);
    feeLine.textContent = hrs ? `Gebühr: ${hrs} €` : 'Gebühr: –';
    book.textContent = hrs ? `Buchen & ${hrs} € zahlen` : 'Buchen';
  };

  const rebuildDurations = () => {
    clear(durSel);
    const start = new Date(Number(startSel.value));
    if (!dusk) return;
    const maxHours = Math.floor((+dusk - +start) / 3_600_000);
    for (let h = 1; h <= Math.max(1, maxHours); h++) {
      durSel.append(el('option', { value: h }, [`${h} Stunde${h > 1 ? 'n' : ''}`]));
    }
    updateFee();
  };

  dateInput.addEventListener('change', () => {
    const d = dateInput.value;
    clear(startSel); clear(durSel); book.disabled = true; updateFee();
    if (!d) return;
    const sun = civilDawnDusk(d, season.latitude, season.longitude);
    if (!sun.dawn || !sun.dusk) {
      windowLine.textContent = 'An diesem Tag gibt es kein Tageslichtfenster.';
      return;
    }
    dusk = sun.dusk;
    windowLine.textContent = `Dämmerung ${hhmm(sun.dawn)} bis ${hhmm(sun.dusk)} (Ortszeit)`;

    const first = ceilHour(sun.dawn);
    const last = floorHour(sun.dusk);
    starts = [];
    for (let t = +first; t < +last; t += 3_600_000) starts.push(new Date(t));
    if (starts.length === 0) { window.textContent += ' — zu kurz zum Buchen.'; return; }
    for (const s of starts) startSel.append(el('option', { value: +s }, [hhmm(s)]));
    book.disabled = false;
    rebuildDurations();

    const onDay = allBookings.filter((b) => b.booking_date === d);
    bookedLine.textContent = onDay.length
      ? 'Bereits belegt: ' + onDay.map((b) => `${hhmm(b.starts_at)}–${hhmm(b.ends_at)}`).join(', ')
      : '';
  });

  startSel.addEventListener('change', rebuildDurations);
  durSel.addEventListener('change', updateFee);

  book.addEventListener('click', async () => {
    const d = dateInput.value;
    const hrs = Number(durSel.value || 0);
    if (!d || !startSel.value || !hrs) return;
    const s = new Date(Number(startSel.value));
    const e = new Date(+s + hrs * 3_600_000);
    book.disabled = true;
    book.textContent = 'Reserviere…';
    try {
      const booking = await createBooking(me.id, d, s, e);
      const url = await startCheckout(booking.id);
      if (url && url !== location.href) { location.href = url; return; }
      toast('Gebucht');
      onChange();
    } catch (err) {
      toast((err as Error).message, false);
      book.disabled = false;
      updateFee();
    }
  });

  card.append(
    field('Datum', dateInput),
    windowLine,
    el('div', { class: 'grid2' }, [field('Startzeit', startSel), field('Dauer', durSel)]),
    feeLine,
    book,
    bookedLine,
  );
  return card;
}

// --- Meine Buchungen ---------------------------------------------------------
async function renderMyBookings(me: Member, onChange: () => void): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Meine Buchungen'])]);
  const mine = await listMyBookings(me.id);
  if (mine.length === 0) {
    card.append(el('p', { class: 'muted' }, ['Noch keine Buchungen.']));
    return card;
  }
  for (const b of mine) card.append(renderBookingRow(b, onChange));
  return card;
}

function renderBookingRow(b: StocherkahnBooking, onChange: () => void): HTMLElement {
  const paid = b.payment_status === 'paid';
  const cancelled = b.status === 'cancelled';
  const euros = (b.fee_cents / 100).toFixed(0);
  const statusText = cancelled ? 'storniert' : paid ? 'bezahlt ✓' : 'Zahlung offen';
  const tags = [
    el('span', { class: 'pill' }, [tag(b.booking_date)]),
    el('span', { class: 'pill' }, [`${hhmm(b.starts_at)}–${hhmm(b.ends_at)}`]),
    el('span', { class: 'pill' }, [`${euros} €`]),
    el('span', { class: `pill ${paid ? 'ok' : ''}` }, [statusText]),
  ];
  const row = el('div', { class: 'row' }, [el('div', {}, tags)]);
  if (!cancelled) {
    if (!paid) {
      const pay = el('button', { type: 'button' }, ['Bezahlen']);
      pay.addEventListener('click', async () => {
        try {
          const url = await startCheckout(b.id);
          if (url && url !== location.href) location.href = url;
          else onChange();
        } catch (e) { toast((e as Error).message, false); }
      });
      row.append(pay);
    }
    const cancel = el('button', { class: 'link danger', type: 'button' }, ['Stornieren']);
    cancel.addEventListener('click', async () => {
      try { await cancelBooking(b.id); toast('Storniert'); onChange(); }
      catch (e) { toast((e as Error).message, false); }
    });
    row.append(cancel);
  }
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
