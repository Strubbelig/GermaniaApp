// =============================================================================
// GermaniaApp — Admin screen (vanilla TS)
// Staff-only. Admins manage member roles and remove members; staff (officer or
// admin) manage the profession taxonomy. All actions are also enforced by RLS,
// so the UI gate is convenience, not the security boundary.
// =============================================================================
import {
  getMyRole,
  listAllMembers,
  setMemberRole,
  adminAddMember,
  listProfessionCategories,
  addProfessionCategory,
  deleteProfessionCategory,
} from '../lib/api';
import type { Member, ProfessionCategory, Role } from '../lib/database.types';
import { el, field, toast, clear } from '../lib/ui';

export async function mountAdmin(root: HTMLElement): Promise<void> {
  clear(root);
  const wrap = el('div', { class: 'profile' }, [el('h1', {}, ['Verwaltung'])]);
  root.append(wrap);

  const role = await getMyRole();
  if (role !== 'admin') {
    wrap.append(el('p', { class: 'err' }, ['Du hast keinen Zugriff auf diesen Bereich.']));
    return;
  }

  wrap.append(await renderMembers());
  wrap.append(await renderCategories(role));
}

// --- members (admin only) ----------------------------------------------------
async function renderMembers(): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Mitglieder & Rollen'])]);
  const list = el('div', { class: 'list' });
  card.append(list);

  const refresh = async () => {
    clear(list);
    let members: Member[] = [];
    try {
      members = await listAllMembers();
    } catch (e) {
      list.append(el('p', { class: 'err' }, [(e as Error).message]));
      return;
    }
    for (const m of members) {
      const sel = el('select', {}, [
        roleOpt('member', m.role), roleOpt('officer', m.role), roleOpt('admin', m.role),
      ]);
      sel.addEventListener('change', async () => {
        try {
          await setMemberRole(m.id, sel.value as Role);
          toast(`${m.first_name} ist jetzt ${roleDe(sel.value as Role)}`);
        } catch (e) {
          toast((e as Error).message, false);
        }
      });
      list.append(
        el('div', { class: 'row' }, [
          el('span', {}, [`${m.first_name} ${m.last_name}`]),
          sel,
        ]),
      );
    }
  };

  // Add a new (unclaimed) member.
  const addForm = el('form', { class: 'grid2' }, [
    field('Vorname', el('input', { name: 'first_name', required: true })),
    field('Nachname', el('input', { name: 'last_name', required: true })),
    field('E-Mail', el('input', { name: 'email', type: 'email', required: true })),
    field('Telefon', el('input', { name: 'phone', type: 'tel' })),
  ]);
  addForm.append(el('button', { type: 'submit', class: 'primary' }, ['Mitglied hinzufügen']));
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(addForm);
    try {
      await adminAddMember({
        first_name: String(f.get('first_name')),
        last_name: String(f.get('last_name')),
        email: String(f.get('email')),
        phone: (f.get('phone') as string) || null,
      });
      addForm.reset();
      toast('Mitglied hinzugefügt');
      await refresh();
    } catch (err) {
      toast((err as Error).message, false);
    }
  });

  card.append(el('h3', {}, ['Neues Mitglied']), addForm);
  await refresh();
  return card;
}

function roleDe(role: Role): string {
  return { member: 'Mitglied', officer: 'Vorstand', admin: 'Admin' }[role] ?? role;
}
function roleOpt(value: Role, current: Role): HTMLOptionElement {
  return el('option', { value, ...(value === current ? { selected: true } : {}) }, [roleDe(value)]);
}

// --- profession taxonomy (staff) --------------------------------------------
async function renderCategories(role: Role): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Berufskategorien'])]);
  const list = el('div', { class: 'list' });
  card.append(list);

  const refresh = async () => {
    clear(list);
    const cats: ProfessionCategory[] = await listProfessionCategories().catch(() => []);
    if (cats.length === 0) list.append(el('p', { class: 'muted' }, ['Noch keine Kategorien.']));
    for (const c of cats) {
      const del = el('button', { class: 'link danger', type: 'button' }, ['Entfernen']);
      del.addEventListener('click', async () => {
        try {
          await deleteProfessionCategory(c.id);
          toast('Entfernt');
          await refresh();
        } catch (e) {
          toast((e as Error).message, false);
        }
      });
      list.append(el('div', { class: 'row' }, [el('span', {}, [`${c.name}  (${c.slug})`]), del]));
    }
  };

  const form = el('form', { class: 'grid2' }, [
    field('Name', el('input', { name: 'name', required: true })),
    field('Kürzel (Slug)', el('input', { name: 'slug', required: true, placeholder: 'z. B. kardiologie' })),
  ]);
  const btn = el('button', { type: 'submit', class: 'primary' }, ['Kategorie hinzufügen']);
  form.append(btn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      await addProfessionCategory(String(f.get('name')), String(f.get('slug')).toLowerCase());
      form.reset();
      toast('Kategorie hinzugefügt');
      await refresh();
    } catch (err) {
      toast((err as Error).message, false);
    }
  });

  void role;
  await refresh();
  card.append(form);
  return card;
}
