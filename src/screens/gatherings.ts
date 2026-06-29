// =============================================================================
// GermaniaApp — Gatherings (vanilla TS)
// Lists upcoming gatherings (expanding recurrence), lets a member create one and
// RSVP. Recurrence is shown human-readably with the next dates.
// =============================================================================
import {
  listGatherings,
  createGathering,
  rsvpToGathering,
  getMyMember,
} from '../lib/api';
import type { Gathering, Rsvp } from '../lib/database.types';
import { nextOccurrences, describeRule } from '../lib/recurrence';
import { el, field, toast, clear } from '../lib/ui';

export async function mountGatherings(root: HTMLElement): Promise<void> {
  clear(root);
  const wrap = el('div', { class: 'profile' }, [el('h1', {}, ['Gatherings'])]);
  root.append(wrap);

  const me = await getMyMember().catch(() => null);
  const list = el('div', { class: 'list' });
  wrap.append(await renderCreate(me?.id ?? null, () => refresh()), list);

  const refresh = async () => {
    clear(list);
    list.append(el('p', { class: 'loading' }, ['Loading…']));
    try {
      const items = await listGatherings({ from: new Date().toISOString() });
      clear(list);
      if (items.length === 0) list.append(el('p', { class: 'muted' }, ['No upcoming gatherings.']));
      for (const g of items) list.append(renderGathering(g, me?.id ?? null));
    } catch (e) {
      clear(list);
      list.append(el('p', { class: 'err' }, [(e as Error).message]));
    }
  };
  await refresh();
}

function renderGathering(g: Gathering, myId: string | null): HTMLElement {
  const upcoming = nextOccurrences(g.recurrence_rule, g.starts_at, 3);
  const dates = upcoming.length
    ? upcoming.map((d) => d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })).join(' · ')
    : new Date(g.starts_at).toLocaleString();

  const card = el('div', { class: 'card' }, [
    el('h2', {}, [g.title]),
    el('div', { class: 'muted' }, [`${[g.venue_name, g.city, g.country_code].filter(Boolean).join(', ')}`]),
    el('div', { class: 'pill' }, [describeRule(g.recurrence_rule)]),
    el('div', {}, [`Next: ${dates}`]),
    g.description ? el('p', {}, [g.description]) : el('span', {}, []),
  ]);

  if (myId) {
    const bar = el('div', { class: 'inline' }, [
      rsvpBtn('Going', 'yes', g.id, myId),
      rsvpBtn('Maybe', 'maybe', g.id, myId),
      rsvpBtn("Can't", 'no', g.id, myId),
    ]);
    card.append(bar);
  }
  return card;
}

function rsvpBtn(label: string, value: Rsvp, gatheringId: string, myId: string): HTMLButtonElement {
  const b = el('button', { type: 'button' }, [label]);
  b.addEventListener('click', async () => {
    try {
      await rsvpToGathering(gatheringId, myId, value);
      toast(`RSVP: ${label}`);
    } catch (e) {
      toast((e as Error).message, false);
    }
  });
  return b;
}

async function renderCreate(myId: string | null, onCreated: () => void): Promise<HTMLElement> {
  const card = el('details', { class: 'card' }, [el('summary', {}, ['+ Create a gathering'])]);
  if (!myId) {
    card.append(el('p', { class: 'muted' }, ['Sign in to create gatherings.']));
    return card;
  }
  const form = el('form', {}, [
    field('Title', el('input', { name: 'title', required: true })),
    el('div', { class: 'grid2' }, [
      field('City', el('input', { name: 'city' })),
      field('Country (ISO-2)', el('input', { name: 'country_code' })),
      field('Venue', el('input', { name: 'venue_name' })),
      field('Starts at', el('input', { name: 'starts_at', type: 'datetime-local', required: true })),
    ]),
    field('Recurrence (RRULE, optional)', el('input', {
      name: 'recurrence_rule', placeholder: 'FREQ=MONTHLY;BYDAY=1FR',
    })),
    field('Description', el('textarea', { name: 'description', rows: 2 })),
    el('button', { type: 'submit', class: 'primary' }, ['Create']),
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      await createGathering({
        title: String(f.get('title')),
        description: (f.get('description') as string) || null,
        venue_name: (f.get('venue_name') as string) || null,
        street: null, region: null, geo: null, ends_at: null, timezone: null,
        city: (f.get('city') as string) || null,
        country_code: (f.get('country_code') as string) || null,
        starts_at: new Date(String(f.get('starts_at'))).toISOString(),
        recurrence_rule: (f.get('recurrence_rule') as string) || null,
        host_member_id: myId,
      });
      form.reset();
      toast('Gathering created');
      onCreated();
    } catch (err) {
      toast((err as Error).message, false);
    }
  });
  card.append(form);
  return card;
}
