// =============================================================================
// GermaniaApp — "Ganzen vor!" (Bier-Gamification)
// showGanzenModal: Disclaimer + Vorher/Nachher-Foto → sendet den Ganzen an XX.
// mountGanze: Postfach, Bestenliste, Trinkpartner, Verlauf.
// =============================================================================
import {
  sendGanzen,
  uploadGanzePhoto,
  listMyGanzenInbox,
  acknowledgeGanzen,
  declineGanzen,
  ganzeHighscore,
  myGanzePartners,
  listGanzeFeed,
  getMyMember,
} from '../lib/api';
import type { Member } from '../lib/database.types';
import { el, field, toast } from '../lib/ui';

const fullName = (m: Member) => `${m.first_name} ${m.last_name}`;

// --- the "Ganzen vor!" modal -------------------------------------------------
export function showGanzenModal(target: { id: string; name: string }, me: Member, onDone?: () => void): void {
  const overlay = el('div', { class: 'modal-overlay' });
  const beforeIn = el('input', { type: 'file', accept: 'image/*', capture: 'environment' });
  const afterIn = el('input', { type: 'file', accept: 'image/*', capture: 'environment' });

  const card = el('div', { class: 'modal card' }, [
    el('h2', {}, ['Ganzen vor!']),
    el('p', {}, [`Du trinkst Bundesbruder ${target.name} einen Ganzen zuvor.`]),
    el('div', { class: 'banner' }, [
      'Achtung: Du musst jetzt einen Ganzen — ein ganzes Glas Bier — austrinken, bevor du fortfährst. '
      + 'Nur für Volljährige, freiwillig und verantwortungsvoll.',
    ]),
    field('Foto vorher (volles Glas)', beforeIn),
    field('Foto nachher (leeres Glas)', afterIn),
  ]);

  const send = el('button', { type: 'button', class: 'primary' }, ['Ganzen getrunken – senden']);
  send.addEventListener('click', async () => {
    const bf = beforeIn.files?.[0];
    const af = afterIn.files?.[0];
    if (!bf || !af) return toast('Bitte Vorher- und Nachher-Foto hinzufügen', false);
    send.disabled = true;
    send.textContent = 'Sende…';
    try {
      const [beforeUrl, afterUrl] = await Promise.all([
        uploadGanzePhoto(bf, 'before'),
        uploadGanzePhoto(af, 'after'),
      ]);
      await sendGanzen({
        from_member_id: me.id,
        to_member_id: target.id,
        message: `Lieber Bundesbruder ${target.name}, ich trinke Dir einen Ganzen zuvor! Dein Bundesbruder ${fullName(me)}!`,
        before_photo_url: beforeUrl,
        after_photo_url: afterUrl,
      });
      toast('Ganzen gesendet — Prost!');
      overlay.remove();
      onDone?.();
    } catch (e) {
      toast((e as Error).message, false);
      send.disabled = false;
      send.textContent = 'Ganzen getrunken – senden';
    }
  });

  const decline = el('button', { type: 'button', class: 'link' }, ['Ich bin phrittig und kann nichts am Glas!']);
  decline.addEventListener('click', () => overlay.remove());

  card.append(el('div', { class: 'inline' }, [send, decline]));
  overlay.append(card);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.append(overlay);
}

// --- the Ganze screen (tabs) -------------------------------------------------
export async function mountGanze(root: HTMLElement): Promise<void> {
  root.innerHTML = '';
  const me = await getMyMember().catch(() => null);
  const tabs = el('div', { class: 'tabs' }, []);
  const panel = el('div', { class: 'panel' });
  root.append(el('div', { class: 'profile' }, [el('h1', {}, ['Ganze']), tabs, panel]));

  const views: [string, () => Promise<void>][] = [
    ['Postfach', () => renderInbox(panel, me)],
    ['Bestenliste', () => renderHighscore(panel)],
    ['Trinkpartner', () => renderPartners(panel, me)],
    ['Verlauf', () => renderFeed(panel)],
  ];
  const btns = views.map(([label, fn], i) => {
    const b = el('button', { type: 'button', class: `tab ${i === 0 ? 'active' : ''}` }, [label]);
    b.addEventListener('click', () => { btns.forEach((x) => x.classList.remove('active')); b.classList.add('active'); fn(); });
    return b;
  });
  btns.forEach((b) => tabs.append(b));
  renderInbox(panel, me);
}

function photoRow(before: string | null, after: string | null): HTMLElement | null {
  if (!before && !after) return null;
  const row = el('div', { class: 'photos' });
  if (before) row.append(el('img', { src: before, alt: 'vorher' }));
  if (after) row.append(el('img', { src: after, alt: 'nachher' }));
  return row;
}

async function renderInbox(panel: HTMLElement, me: Member | null): Promise<void> {
  panel.innerHTML = '';
  if (!me) { panel.append(el('p', { class: 'muted' }, ['Bitte anmelden.'])); return; }
  const items = await listMyGanzenInbox(me.id).catch(() => []);
  if (items.length === 0) { panel.append(el('p', { class: 'muted' }, ['Noch keine Ganze erhalten.'])); return; }
  for (const g of items) {
    const card = el('div', { class: 'card' }, [el('p', {}, [g.message ?? ''])]);
    const pr = photoRow(g.before_photo_url, g.after_photo_url);
    if (pr) card.append(pr);
    card.append(el('span', { class: `pill ${g.status === 'declined' ? '' : 'ok'}` }, [statusDe(g.status)]));
    if (g.status === 'open') {
      const ack = el('button', { type: 'button', class: 'primary' }, ['Bescheid getan!']);
      ack.addEventListener('click', async () => { await acknowledgeGanzen(g.id); toast('Prost!'); renderInbox(panel, me); });
      const dec = el('button', { type: 'button', class: 'link' }, ['Ich bin phrittig und kann nichts am Glas!']);
      dec.addEventListener('click', async () => { await declineGanzen(g.id); toast('Abgemeldet'); renderInbox(panel, me); });
      card.append(el('div', { class: 'inline' }, [ack, dec]));
    }
    panel.append(card);
  }
}

async function renderHighscore(panel: HTMLElement): Promise<void> {
  panel.innerHTML = '';
  const rows = await ganzeHighscore().catch(() => []);
  if (rows.length === 0) { panel.append(el('p', { class: 'muted' }, ['Noch keine Ganze.'])); return; }
  const list = el('div', { class: 'card' }, [el('h2', {}, ['Bestenliste'])]);
  rows.forEach((r, i) => list.append(el('div', { class: 'row' }, [
    el('span', {}, [`${i + 1}. ${r.name}`]),
    el('span', { class: 'pill ok' }, [`${r.ganze} Ganze`]),
  ])));
  panel.append(list);
}

async function renderPartners(panel: HTMLElement, me: Member | null): Promise<void> {
  panel.innerHTML = '';
  if (!me) { panel.append(el('p', { class: 'muted' }, ['Bitte anmelden.'])); return; }
  const rows = await myGanzePartners(me.id).catch(() => []);
  if (rows.length === 0) { panel.append(el('p', { class: 'muted' }, ['Noch keine gemeinsamen Ganze.'])); return; }
  const list = el('div', { class: 'card' }, [el('h2', {}, ['Mit wem ich am meisten getrunken habe'])]);
  rows.forEach((r) => list.append(el('div', { class: 'row' }, [
    el('span', {}, [r.partner_name]),
    el('span', { class: 'pill ok' }, [`${r.together}×`]),
  ])));
  panel.append(list);
}

async function renderFeed(panel: HTMLElement): Promise<void> {
  panel.innerHTML = '';
  const rows = await listGanzeFeed().catch(() => []);
  if (rows.length === 0) { panel.append(el('p', { class: 'muted' }, ['Noch keine Aktivität.'])); return; }
  for (const g of rows) {
    const when = new Date(g.created_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    const card = el('div', { class: 'card' }, [
      el('div', {}, [el('strong', {}, [`${g.from_name} → ${g.to_name}`])]),
      el('div', { class: 'muted' }, [when]),
    ]);
    const pr = photoRow(g.before_photo_url, g.after_photo_url);
    if (pr) card.append(pr);
    panel.append(card);
  }
}

function statusDe(s: string): string {
  return { open: 'offen', acknowledged: 'Bescheid getan', reciprocated: 'erwidert', declined: 'phrittig' }[s] ?? s;
}
