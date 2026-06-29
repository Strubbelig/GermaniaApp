// =============================================================================
// GermaniaApp — Stocherkahn (society punt boat) booking (vanilla TS)
// Shows the season, lets a member book one day (dawn→dusk, auto-computed) and
// pay the €1 fee via Stripe, lists their bookings, and lets admins set the
// season dates + location.
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
  new Date(iso).toLocaleTimeString([], { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const day = (d: string) => new Date(d).toLocaleDateString([], { dateStyle: 'medium' });

export async function mountStocherkahn(root: HTMLElement): Promise<void> {
  clear(root);
  const wrap = el('div', { class: 'profile' }, [el('h1', {}, ['Stocherkahn'])]);
  root.append(wrap);

  const me = await getMyMember().catch(() => null);
  const season = await getActiveSeason().catch(() => null);

  if (!season) {
    wrap.append(el('p', { class: 'muted' }, ['The boat is not currently in the water (no active season).']));
  } else {
    wrap.append(
      el('div', { class: 'card' }, [
        el('h2', {}, [season.name ?? 'Season']),
        el('div', {}, [`In the water ${day(season.water_date)} → ${day(season.withdraw_date)}`]),
        el('div', { class: 'muted' }, [`Bookings run dawn→dusk · €1 reservation fee`]),
      ]),
    );
  }

  if (me?.role === 'admin') wrap.append(renderSeasonEditor(season, () => mountStocherkahn(root)));
  if (season && me) {
    wrap.append(await renderBookingForm(season, me, () => mountStocherkahn(root)));
    wrap.append(await renderMyBookings(me, () => mountStocherkahn(root)));
  }
}

// --- booking form ------------------------------------------------------------
async function renderBookingForm(
  season: StocherkahnSeason, me: Member, onChange: () => void,
): Promise<HTMLElement> {
  const taken = new Set((await listBookings(season.id)).map((b) => b.booking_date));

  const card = el('div', { class: 'card' }, [el('h2', {}, ['Book a day'])]);
  const dateInput = el('input', {
    type: 'date', min: season.water_date, max: season.withdraw_date,
  });
  const preview = el('div', { class: 'muted' }, ['Pick a date to see the dawn–dusk window.']);
  const book = el('button', { type: 'button', class: 'primary' }, ['Book & pay €1']);
  book.disabled = true;

  dateInput.addEventListener('change', () => {
    const d = dateInput.value;
    if (!d) return;
    if (taken.has(d)) {
      preview.textContent = 'That day is already booked — choose another.';
      book.disabled = true;
      return;
    }
    const { dawn, dusk } = civilDawnDusk(d, season.latitude, season.longitude);
    preview.textContent = dawn && dusk
      ? `Dawn ${hhmm(dawn)} → dusk ${hhmm(dusk)} (${TZ})`
      : 'No daylight window for that date.';
    book.disabled = !(dawn && dusk);
  });

  book.addEventListener('click', async () => {
    const d = dateInput.value;
    if (!d) return;
    book.disabled = true;
    book.textContent = 'Reserving…';
    try {
      const booking = await createBooking(me.id, d);
      const url = await startCheckout(booking.id);
      if (url && url !== location.href) {
        location.href = url; // real Stripe checkout
        return;
      }
      toast('Booked');
      onChange();
    } catch (e) {
      toast((e as Error).message, false);
      book.disabled = false;
      book.textContent = 'Book & pay €1';
    }
  });

  card.append(field('Date', dateInput), preview, book);
  if (taken.size > 0) {
    card.append(el('div', { class: 'muted', style: 'margin-top:10px' }, [
      'Already booked: ' + [...taken].sort().map(day).join(', '),
    ]));
  }
  return card;
}

// --- my bookings -------------------------------------------------------------
async function renderMyBookings(me: Member, onChange: () => void): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['My bookings'])]);
  const mine = await listMyBookings(me.id);
  if (mine.length === 0) {
    card.append(el('p', { class: 'muted' }, ['No bookings yet.']));
    return card;
  }
  for (const b of mine) card.append(renderBookingRow(b, onChange));
  return card;
}

function renderBookingRow(b: StocherkahnBooking, onChange: () => void): HTMLElement {
  const paid = b.payment_status === 'paid';
  const cancelled = b.status === 'cancelled';
  const tags = [
    el('span', { class: 'pill' }, [day(b.booking_date)]),
    el('span', { class: 'pill' }, [`${hhmm(b.starts_at)}–${hhmm(b.ends_at)}`]),
    el('span', { class: 'pill' }, [cancelled ? 'cancelled' : paid ? 'paid ✓' : 'payment due']),
  ];
  const row = el('div', { class: 'row' }, [el('div', {}, tags)]);
  if (!cancelled) {
    if (!paid) {
      const pay = el('button', { type: 'button' }, ['Pay €1']);
      pay.addEventListener('click', async () => {
        try {
          const url = await startCheckout(b.id);
          if (url && url !== location.href) location.href = url;
          else onChange();
        } catch (e) { toast((e as Error).message, false); }
      });
      row.append(pay);
    }
    const cancel = el('button', { class: 'link danger', type: 'button' }, ['Cancel']);
    cancel.addEventListener('click', async () => {
      try { await cancelBooking(b.id); toast('Cancelled'); onChange(); }
      catch (e) { toast((e as Error).message, false); }
    });
    row.append(cancel);
  }
  return row;
}

// --- admin season editor -----------------------------------------------------
function renderSeasonEditor(season: StocherkahnSeason | null, onSaved: () => void): HTMLElement {
  const card = el('details', { class: 'card' }, [el('summary', {}, ['Admin: set season dates & location'])]);
  const form = el('form', {}, [
    field('Name', el('input', { name: 'name', value: season?.name ?? '' })),
    el('div', { class: 'grid2' }, [
      field('Watered (start)', el('input', { name: 'water_date', type: 'date', required: true, value: season?.water_date ?? '' })),
      field('Withdrawn (end)', el('input', { name: 'withdraw_date', type: 'date', required: true, value: season?.withdraw_date ?? '' })),
      field('Latitude', el('input', { name: 'latitude', type: 'number', step: 'any', value: String(season?.latitude ?? 48.5216) })),
      field('Longitude', el('input', { name: 'longitude', type: 'number', step: 'any', value: String(season?.longitude ?? 9.0576) })),
    ]),
    el('button', { type: 'submit', class: 'primary' }, ['Save season']),
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
      toast('Season saved');
      onSaved();
    } catch (err) {
      toast((err as Error).message, false);
    }
  });
  card.append(form);
  return card;
}
