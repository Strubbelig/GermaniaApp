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
  deleteMember,
  listProfessionCategories,
  addProfessionCategory,
  deleteProfessionCategory,
} from '../lib/api';
import type { Member, ProfessionCategory, Role } from '../lib/database.types';
import { el, field, toast, clear } from '../lib/ui';

export async function mountAdmin(root: HTMLElement): Promise<void> {
  clear(root);
  const wrap = el('div', { class: 'profile' }, [el('h1', {}, ['Admin'])]);
  root.append(wrap);

  const role = await getMyRole();
  if (role !== 'admin' && role !== 'officer') {
    wrap.append(el('p', { class: 'err' }, ['You do not have access to this area.']));
    return;
  }

  if (role === 'admin') wrap.append(await renderMembers());
  wrap.append(await renderCategories(role));
}

// --- members (admin only) ----------------------------------------------------
async function renderMembers(): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Members & roles'])]);
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
          toast(`${m.first_name} is now ${sel.value}`);
        } catch (e) {
          toast((e as Error).message, false);
        }
      });
      const del = el('button', { class: 'link danger', type: 'button' }, ['Remove']);
      del.addEventListener('click', async () => {
        if (!confirm(`Remove ${m.first_name} ${m.last_name}? This cannot be undone.`)) return;
        try {
          await deleteMember(m.id);
          toast('Member removed');
          await refresh();
        } catch (e) {
          toast((e as Error).message, false);
        }
      });
      list.append(
        el('div', { class: 'row' }, [
          el('span', {}, [`${m.first_name} ${m.last_name}`]),
          el('div', { class: 'inline' }, [sel, del]),
        ]),
      );
    }
  };
  await refresh();
  return card;
}

function roleOpt(value: Role, current: Role): HTMLOptionElement {
  return el('option', { value, ...(value === current ? { selected: true } : {}) }, [value]);
}

// --- profession taxonomy (staff) --------------------------------------------
async function renderCategories(role: Role): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Profession categories'])]);
  const list = el('div', { class: 'list' });
  card.append(list);

  const refresh = async () => {
    clear(list);
    const cats: ProfessionCategory[] = await listProfessionCategories().catch(() => []);
    if (cats.length === 0) list.append(el('p', { class: 'muted' }, ['No categories yet.']));
    for (const c of cats) {
      const del = el('button', { class: 'link danger', type: 'button' }, ['Remove']);
      del.addEventListener('click', async () => {
        try {
          await deleteProfessionCategory(c.id);
          toast('Removed');
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
    field('Slug', el('input', { name: 'slug', required: true, placeholder: 'e.g. cardiology' })),
  ]);
  const btn = el('button', { type: 'submit', class: 'primary' }, ['Add category']);
  form.append(btn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      await addProfessionCategory(String(f.get('name')), String(f.get('slug')).toLowerCase());
      form.reset();
      toast('Category added');
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
