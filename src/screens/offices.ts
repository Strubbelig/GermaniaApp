// =============================================================================
// GermaniaApp — Ämter (Sprecher, Fechtwart, Schriftwart) + Übergabe
// Jedes Amt hat eine:n Amtsinhaber:in (mit Admin-Rechten). Übergabe erfolgt in
// beidseitigem Einvernehmen: eine Seite startet, die andere bestätigt. Gegen
// Semesterende erscheint eine Erinnerung, das Amt zu behalten oder zu übergeben.
// =============================================================================
import {
  listOffices,
  listMyOfficeTransfers,
  initiateOfficeTransfer,
  respondOfficeTransfer,
  reclaimOffice,
  getMyMember,
  getDirectory,
} from '../lib/api';
import type { Member, Office, OfficeTransfer } from '../lib/database.types';
import { el, field, toast, clear } from '../lib/ui';

/** Current semester label + this term's end date (WS ends 31 Mar, SS ends 30 Sep). */
function semesterInfo(d = new Date()): { label: string; end: Date } {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const isSS = m >= 4 && m <= 9;
  const yy = (n: number) => String(n).slice(2);
  if (isSS) return { label: `SS ${y}`, end: new Date(y, 8, 30) };
  if (m >= 10) return { label: `WS ${y}/${yy(y + 1)}`, end: new Date(y + 1, 2, 31) };
  return { label: `WS ${y - 1}/${yy(y)}`, end: new Date(y, 2, 31) };
}

export async function mountOffices(root: HTMLElement): Promise<void> {
  clear(root);
  const wrap = el('div', { class: 'profile' }, [el('h1', {}, ['Ämter'])]);
  root.append(wrap);

  const me = await getMyMember().catch(() => null);
  const [offices, dir, transfers] = await Promise.all([
    listOffices().catch(() => [] as Office[]),
    getDirectory().catch(() => []),
    me ? listMyOfficeTransfers(me.id).catch(() => [] as OfficeTransfer[]) : Promise.resolve([] as OfficeTransfer[]),
  ]);
  const nameById = new Map(dir.map((d) => [d.id, `${d.first_name} ${d.last_name}`]));
  const reload = () => mountOffices(root);

  // End-of-semester reminder for officeholders.
  const sem = semesterInfo();
  const daysToEnd = Math.ceil((+sem.end - Date.now()) / 86_400_000);
  const myOffices = me ? offices.filter((o) => o.current_holder_id === me.id) : [];
  const needsReclaim = myOffices.filter((o) => o.term_semester !== sem.label);
  if (me && myOffices.length > 0 && daysToEnd <= 28 && daysToEnd >= 0 && needsReclaim.length > 0) {
    wrap.append(el('div', { class: 'banner' }, [
      `Das Semester endet in ${daysToEnd} Tagen. Bitte bestätige deine Ämter für ${sem.label} oder übergib sie: `
      + needsReclaim.map((o) => o.title).join(', ') + '.',
    ]));
  }

  // Pending transfers involving me.
  for (const t of transfers) {
    const counterparty = t.initiated_by === t.from_member_id ? t.to_member_id : t.from_member_id;
    const office = offices.find((o) => o.id === t.office_id);
    const card = el('div', { class: 'card' }, [
      el('h2', {}, [`Übergabe: ${office?.title ?? 'Amt'}`]),
      el('div', {}, [`${nameById.get(t.from_member_id ?? '') ?? '—'} → ${nameById.get(t.to_member_id) ?? '—'}`]),
    ]);
    if (me && counterparty === me.id) {
      const yes = el('button', { type: 'button', class: 'primary' }, ['Bestätigen']);
      yes.addEventListener('click', () => respond(t.id, true, reload));
      const no = el('button', { type: 'button', class: 'link danger' }, ['Ablehnen']);
      no.addEventListener('click', () => respond(t.id, false, reload));
      card.append(el('div', { class: 'inline' }, [yes, no]));
    } else {
      card.append(el('div', { class: 'muted' }, ['Warten auf Bestätigung der Gegenseite…']));
    }
    wrap.append(card);
  }

  // Offices list.
  for (const o of offices) {
    const mine = me && o.current_holder_id === me.id;
    const card = el('div', { class: 'card' }, [
      el('h2', {}, [o.title]),
      el('div', {}, [`Amtsinhaber:in: ${o.holder_name ?? '— (vakant)'}`]),
      o.term_semester ? el('div', { class: 'pill' }, [o.term_semester]) : el('span', {}, []),
    ]);

    if (me && mine) {
      // Keep the office for the current semester.
      const keep = el('button', { type: 'button' }, [`Behalten (${sem.label})`]);
      keep.addEventListener('click', async () => {
        try { await reclaimOffice(o.id, sem.label); toast('Amt behalten'); reload(); }
        catch (e) { toast((e as Error).message, false); }
      });
      // Hand over to a chosen successor.
      const sel = el('select', {}, [
        el('option', { value: '' }, ['Nachfolger:in wählen…']),
        ...dir.filter((d) => d.id !== me.id).map((d) => el('option', { value: d.id }, [`${d.first_name} ${d.last_name}`])),
      ]);
      const pass = el('button', { type: 'button', class: 'primary' }, ['Übergeben']);
      pass.addEventListener('click', async () => {
        if (!sel.value) return toast('Bitte Nachfolger:in wählen', false);
        try { await initiateOfficeTransfer(o.id, sel.value); toast('Übergabe angefragt — Bestätigung ausstehend'); reload(); }
        catch (e) { toast((e as Error).message, false); }
      });
      card.append(field('An', sel), el('div', { class: 'inline' }, [pass, keep]));
    } else if (me) {
      // Non-holder can request the office.
      const claim = el('button', { type: 'button' }, ['Amt anfragen']);
      claim.addEventListener('click', async () => {
        try { await initiateOfficeTransfer(o.id); toast('Anfrage gesendet — Bestätigung durch aktuelle:n Inhaber:in nötig'); reload(); }
        catch (e) { toast((e as Error).message, false); }
      });
      card.append(claim);
    }
    wrap.append(card);
  }
}

async function respond(id: string, accept: boolean, reload: () => void): Promise<void> {
  try {
    await respondOfficeTransfer(id, accept);
    toast(accept ? 'Übergabe bestätigt' : 'Abgelehnt');
    reload();
  } catch (e) {
    toast((e as Error).message, false);
  }
}
