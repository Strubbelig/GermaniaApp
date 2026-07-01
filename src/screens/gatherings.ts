// =============================================================================
// GermaniaApp — Termine (Stammtisch & Semesterprogramm)
// Zwei Unterbereiche:
//   • Stammtisch      — wiederkehrend, Ort muss gesetzt werden (keine Vorbelegung)
//   • Semesterprogramm — Einzeltermine je Semester, Ort vorbelegt (Gartenstraße 3)
// Termine anlegen/bearbeiten: nur Vorstand/Admin. iCal-Import: nur Admin.
// Kalender (.ics) herunterladen: alle. RSVP: alle angemeldeten Mitglieder.
// =============================================================================
import {
  listGatherings,
  createGathering,
  listMyRsvps,
  rsvpToGathering,
  getMyMember,
  isAdmin,
} from '../lib/api';
import type { Gathering, GatheringCategory, Member, Rsvp } from '../lib/database.types';
import { nextOccurrences, describeRule } from '../lib/recurrence';
import { parseIcs, buildIcs, downloadIcs } from '../lib/ical';
import { el, field, toast, clear } from '../lib/ui';

const SEM_PREFILL = { venue: 'Haus Germania', street: 'Gartenstraße 3', city: 'Tübingen', cc: 'DE' };
const EMPTY_PREFILL = { venue: '', street: '', city: '', cc: '' };

interface CatCfg {
  label: string;
  recurring: boolean;                 // show RRULE + expand next dates
  prefill: typeof SEM_PREFILL | null; // location prefill
  semester: boolean;                  // show semester field
  requireLocation: boolean;
}
const CATS: Record<'stammtisch' | 'semesterprogramm' | 'pauktag', CatCfg> = {
  stammtisch: { label: 'Stammtisch', recurring: true, prefill: null, semester: false, requireLocation: true },
  semesterprogramm: { label: 'Semesterprogramm', recurring: false, prefill: SEM_PREFILL, semester: true, requireLocation: false },
  pauktag: { label: 'Pauktag', recurring: false, prefill: null, semester: false, requireLocation: false },
};
const catLabel = (c: GatheringCategory) => CATS[c as keyof typeof CATS]?.label ?? 'Termine';

export async function mountGatherings(root: HTMLElement): Promise<void> {
  clear(root);
  const me = await getMyMember().catch(() => null);
  const admin = await isAdmin().catch(() => false);
  const staff = admin;   // events are admin-only

  const tabs = el('div', { class: 'tabs' }, []);
  const panel = el('div', { class: 'panel' });
  const wrap = el('div', { class: 'profile' }, [el('h1', {}, ['Termine']), tabs, panel]);
  root.append(wrap);

  const cats: GatheringCategory[] = ['stammtisch', 'semesterprogramm', 'pauktag'];
  const btns = cats.map((c, i) => {
    const b = el('button', { type: 'button', class: `tab ${i === 0 ? 'active' : ''}` }, [catLabel(c)]);
    b.addEventListener('click', () => {
      btns.forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      renderCategory(panel, c, me, staff, admin);
    });
    return b;
  });
  btns.forEach((b) => tabs.append(b));
  renderCategory(panel, 'stammtisch', me, staff, admin);
}

async function renderCategory(
  panel: HTMLElement, category: GatheringCategory, me: Member | null, staff: boolean, admin: boolean,
): Promise<void> {
  clear(panel);
  const reload = () => renderCategory(panel, category, me, staff, admin);

  // Toolbar: download calendar (all users) + admin ICS import.
  const toolbar = el('div', { class: 'inline' }, []);
  const dl = el('button', { type: 'button' }, ['Kalender herunterladen (.ics)']);
  dl.addEventListener('click', async () => {
    const items = await listGatherings({ category });
    if (items.length === 0) return toast('Keine Termine zum Export', false);
    const ics = buildIcs(items.map((g) => ({
      id: g.id, title: g.title, description: g.description,
      location: [g.venue_name, g.street, g.city].filter(Boolean).join(', ') || null,
      starts_at: g.starts_at, ends_at: g.ends_at, rrule: g.recurrence_rule,
    })), `Germania — ${catLabel(category)}`);
    downloadIcs(`germania-${category}.ics`, ics);
  });
  toolbar.append(dl);
  if (admin) toolbar.append(icsImport(category, me, reload));
  panel.append(toolbar);

  if (staff && me) panel.append(renderCreate(category, me, reload));

  const list = el('div', { class: 'list' });
  panel.append(list);
  list.append(el('p', { class: 'loading' }, ['Wird geladen…']));
  try {
    const [items, myRsvps] = await Promise.all([
      listGatherings({ category, from: new Date().toISOString() }),
      me ? listMyRsvps(me.id) : Promise.resolve([] as { gathering_id: string; rsvp: Rsvp }[]),
    ]);
    const rsvpMap = new Map(myRsvps.map((r) => [r.gathering_id, r.rsvp]));
    clear(list);
    if (items.length === 0) list.append(el('p', { class: 'muted' }, ['Keine bevorstehenden Termine.']));
    for (const g of items) list.append(renderGathering(g, me?.id ?? null, rsvpMap.get(g.id) ?? null));
  } catch (e) {
    clear(list);
    list.append(el('p', { class: 'err' }, [(e as Error).message]));
  }
}

// --- one event ---------------------------------------------------------------
function renderGathering(g: Gathering, myId: string | null, currentRsvp: Rsvp | null): HTMLElement {
  const place = [g.venue_name, g.street, g.city, g.country_code].filter(Boolean).join(', ');
  const card = el('div', { class: 'card' }, [el('h2', {}, [g.title])]);
  if (place) card.append(el('div', { class: 'muted' }, [place]));

  if (CATS[g.category as keyof typeof CATS]?.recurring) {
    const upcoming = nextOccurrences(g.recurrence_rule, g.starts_at, 3);
    const dates = upcoming.length
      ? upcoming.map((d) => d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })).join(' · ')
      : new Date(g.starts_at).toLocaleString('de-DE');
    card.append(el('div', { class: 'pill' }, [describeRule(g.recurrence_rule)]), el('div', {}, [`Nächste: ${dates}`]));
  } else {
    card.append(
      el('div', {}, [new Date(g.starts_at).toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' })]),
      g.semester ? el('div', { class: 'pill' }, [g.semester]) : el('span', {}, []),
    );
  }
  if (g.description) card.append(el('p', {}, [g.description]));

  if (myId) card.append(renderRsvp(g.id, myId, currentRsvp));
  return card;
}

// RSVP bar — the chosen answer is highlighted (green = Zusage, amber = Vielleicht,
// red = Absage).
function renderRsvp(gatheringId: string, myId: string, current: Rsvp | null): HTMLElement {
  const bar = el('div', { class: 'inline rsvpbar' });
  const defs: [string, Rsvp][] = [['Zusage', 'yes'], ['Vielleicht', 'maybe'], ['Absage', 'no']];
  const btns = defs.map(([label, value]) => {
    const b = el('button', {
      type: 'button',
      class: `rsvp rsvp-${value} ${current === value ? 'active' : ''}`,
    }, [label]);
    b.addEventListener('click', async () => {
      try {
        await rsvpToGathering(gatheringId, myId, value);
        btns.forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        toast(`Rückmeldung: ${label}`);
      } catch (e) {
        toast((e as Error).message, false);
      }
    });
    return b;
  });
  bar.append(...btns);
  return bar;
}

// --- create (staff only) -----------------------------------------------------
function renderCreate(category: GatheringCategory, me: Member, onCreated: () => void): HTMLElement {
  const cfg = CATS[category as keyof typeof CATS] ?? CATS.pauktag;
  const card = el('details', { class: 'card' }, [el('summary', {}, [`+ ${cfg.label} anlegen`])]);
  const pf = cfg.prefill ?? EMPTY_PREFILL;

  const fields: HTMLElement[] = [
    field('Titel', el('input', { name: 'title', required: true })),
    el('div', { class: 'grid2' }, [
      field('Beginn', el('input', { name: 'starts_at', type: 'datetime-local', required: true })),
      field('Ort / Lokal', el('input', { name: 'venue_name', value: pf.venue })),
      field('Straße', el('input', { name: 'street', value: pf.street })),
      field('Stadt', el('input', { name: 'city', value: pf.city })),
      field('Land (ISO-2)', el('input', { name: 'country_code', value: pf.cc })),
    ]),
  ];
  if (cfg.semester) fields.push(field('Semester', el('input', { name: 'semester', placeholder: 'z. B. WS 2026/27' })));
  if (cfg.recurring) fields.push(field('Wiederholung (RRULE)', el('input', { name: 'recurrence_rule', placeholder: 'FREQ=WEEKLY;BYDAY=TH' })));
  fields.push(field('Beschreibung', el('textarea', { name: 'description', rows: 2 })));

  const form = el('form', {}, [...fields, el('button', { type: 'submit', class: 'primary' }, ['Anlegen'])]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const venue = (f.get('venue_name') as string) || null;
    const street = (f.get('street') as string) || null;
    const city = (f.get('city') as string) || null;
    if (cfg.requireLocation && !venue && !street && !city) {
      return toast(`Bitte einen Ort für den ${cfg.label} angeben.`, false);
    }
    try {
      await createGathering({
        title: String(f.get('title')),
        description: (f.get('description') as string) || null,
        category,
        semester: cfg.semester ? ((f.get('semester') as string) || null) : null,
        venue_name: venue, street, city,
        region: null, country_code: (f.get('country_code') as string) || null, geo: null,
        starts_at: new Date(String(f.get('starts_at'))).toISOString(),
        ends_at: null, timezone: 'Europe/Berlin',
        recurrence_rule: cfg.recurring ? ((f.get('recurrence_rule') as string) || null) : null,
        host_member_id: me.id,
      });
      form.reset();
      toast('Termin angelegt');
      onCreated();
    } catch (err) {
      toast((err as Error).message, false);
    }
  });
  card.append(form);
  return card;
}

// --- ICS import (admin only) -------------------------------------------------
function icsImport(category: GatheringCategory, me: Member | null, onDone: () => void): HTMLElement {
  const label = el('label', { class: 'importbtn' }, ['iCal importieren']);
  const input = el('input', { type: 'file', accept: '.ics,text/calendar' });
  input.style.display = 'none';
  label.append(input);
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file || !me) return;
    try {
      const events = parseIcs(await file.text());
      if (events.length === 0) return toast('Keine Termine in der Datei gefunden', false);
      let n = 0;
      for (const ev of events) {
        const useSem = category === 'semesterprogramm';
        await createGathering({
          title: ev.title,
          description: ev.description,
          category,
          semester: null,
          venue_name: ev.location ?? (useSem ? SEM_PREFILL.venue : null),
          street: ev.location ? null : (useSem ? SEM_PREFILL.street : null),
          city: ev.location ? null : (useSem ? SEM_PREFILL.city : null),
          region: null,
          country_code: useSem && !ev.location ? SEM_PREFILL.cc : null,
          geo: null,
          starts_at: ev.starts_at,
          ends_at: ev.ends_at,
          timezone: 'Europe/Berlin',
          recurrence_rule: category === 'stammtisch' ? ev.rrule : null,
          host_member_id: me.id,
        });
        n++;
      }
      toast(`${n} Termin${n === 1 ? '' : 'e'} importiert`);
      onDone();
    } catch (e) {
      toast((e as Error).message, false);
    } finally {
      input.value = '';
    }
  });
  return label;
}
