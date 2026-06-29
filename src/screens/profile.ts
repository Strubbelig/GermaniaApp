// =============================================================================
// GermaniaApp — Profile editor (vanilla TS, no framework)
// Renders the logged-in member's own entry and lets them edit everything:
// personal fields, photo, privacy, professions, addresses (geocoded), family.
//
// Mount it with:  mountProfileEditor(document.getElementById('app')!)
// Tiny DOM helpers only — no dependencies, runs on old browsers.
// =============================================================================
import {
  getMyMember,
  createMyMember,
  updateMyMember,
  uploadMyPhoto,
  listProfessionCategories,
  listMyProfessions,
  addMyProfession,
  deleteMyProfession,
  listMyAddresses,
  upsertMyAddress,
  deleteAddress,
  listMyRelatives,
  addRelative,
  deleteRelative,
  ageFromDob,
} from '../lib/api';
import type { Member, ProfessionCategory } from '../lib/database.types';

// --- tiny DOM helpers --------------------------------------------------------
type Attrs = Record<string, string | number | boolean>;
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = String(v);
    else if (k === 'value') (node as HTMLInputElement).value = String(v);
    else if (k === 'checked') (node as HTMLInputElement).checked = Boolean(v);
    else if (typeof v === 'boolean') v && node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  for (const c of children) node.append(c);
  return node;
}
const $ = <T extends HTMLElement>(p: HTMLElement, sel: string) => p.querySelector<T>(sel)!;

function field(label: string, input: HTMLElement): HTMLElement {
  return el('label', { class: 'field' }, [el('span', { class: 'field-label' }, [label]), input]);
}
function input(name: string, value: string | null, type = 'text'): HTMLInputElement {
  return el('input', { name, type, value: value ?? '' });
}
function reqd(node: HTMLInputElement): HTMLInputElement {
  node.required = true;
  return node;
}
function toast(msg: string, ok = true): void {
  const t = el('div', { class: `toast ${ok ? 'ok' : 'err'}` }, [msg]);
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

// =============================================================================
export async function mountProfileEditor(root: HTMLElement): Promise<void> {
  root.innerHTML = '';
  root.append(el('p', { class: 'loading' }, ['Loading your profile…']));

  let member: Member | null = null;
  try {
    member = await getMyMember();
  } catch (e) {
    root.innerHTML = '';
    root.append(el('p', { class: 'err' }, [`Could not load profile: ${(e as Error).message}`]));
    return;
  }

  // First-time member: create a minimal row, then edit it.
  if (!member) {
    root.innerHTML = '';
    root.append(renderFirstRun(root));
    return;
  }

  const categories = await listProfessionCategories().catch(() => [] as ProfessionCategory[]);
  root.innerHTML = '';
  root.append(
    el('div', { class: 'profile' }, [
      el('h1', {}, ['Edit my profile']),
      renderPersonal(member),
      renderPrivacy(member),
      await renderProfessions(member.id, categories),
      await renderAddresses(member.id),
      await renderFamily(member.id),
    ]),
  );
}

// --- first run ---------------------------------------------------------------
function renderFirstRun(root: HTMLElement): HTMLElement {
  const form = el('form', { class: 'card' }, [
    el('h1', {}, ['Welcome — create your entry']),
    field('First name', reqd(input('first_name', ''))),
    field('Last name', reqd(input('last_name', ''))),
    field('Email', reqd(input('email', '', 'email'))),
    field('Date of birth', reqd(input('date_of_birth', '', 'date'))),
    el('button', { type: 'submit', class: 'primary' }, ['Create profile']),
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      await createMyMember({
        first_name: String(f.get('first_name')),
        last_name: String(f.get('last_name')),
        email: String(f.get('email')),
        date_of_birth: String(f.get('date_of_birth')),
        salutation: null, maiden_name: null, gender: null,
        phone: null, website: null, photo_url: null, bio: null, member_since: null,
      });
      toast('Profile created');
      await mountProfileEditor(root);
    } catch (err) {
      toast((err as Error).message, false);
    }
  });
  return form;
}

// --- personal ----------------------------------------------------------------
function renderPersonal(m: Member): HTMLElement {
  const form = el('form', { class: 'card' }, [
    el('h2', {}, ['Personal details']),
    el('div', { class: 'photo-row' }, [
      el('img', { class: 'avatar', src: m.photo_url ?? 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect width=%2280%22 height=%2280%22 fill=%22%23ddd%22/></svg>', alt: 'Photo' }),
      field('Change photo', input('photo', null, 'file')),
    ]),
    el('div', { class: 'grid2' }, [
      field('Salutation', input('salutation', m.salutation)),
      field('Maiden name', input('maiden_name', m.maiden_name)),
      field('First name', input('first_name', m.first_name)),
      field('Last name', input('last_name', m.last_name)),
      field('Email', input('email', m.email, 'email')),
      field('Phone', input('phone', m.phone, 'tel')),
      field('Website', input('website', m.website, 'url')),
      field('Date of birth (required)', reqd(input('date_of_birth', m.date_of_birth, 'date'))),
    ]),
    field('Bio', el('textarea', { name: 'bio', rows: 3 }, [m.bio ?? ''])),
    el('button', { type: 'submit', class: 'primary' }, ['Save details']),
  ]);

  $(form, 'input[name=photo]').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const url = await uploadMyPhoto(file);
      ($(form, 'img.avatar') as HTMLImageElement).src = url;
      toast('Photo updated');
    } catch (err) {
      toast((err as Error).message, false);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      await updateMyMember({
        salutation: str(f, 'salutation'),
        maiden_name: str(f, 'maiden_name'),
        first_name: String(f.get('first_name')),
        last_name: String(f.get('last_name')),
        email: String(f.get('email')),
        phone: str(f, 'phone'),
        website: str(f, 'website'),
        date_of_birth: str(f, 'date_of_birth'),
        bio: str(f, 'bio'),
      });
      toast('Saved');
    } catch (err) {
      toast((err as Error).message, false);
    }
  });
  return form;
}

// --- privacy -----------------------------------------------------------------
function renderPrivacy(m: Member): HTMLElement {
  const sel = el('select', { name: 'visibility' }, [
    opt('members', 'Visible to members', m.visibility),
    opt('officers', 'Officers only', m.visibility),
    opt('private', 'Private', m.visibility),
  ]);
  const form = el('form', { class: 'card' }, [
    el('h2', {}, ['Privacy']),
    field('Profile visibility', sel),
    toggle('show_email', 'Show my email to other members', m.show_email),
    toggle('show_address', 'Show my address', m.show_address),
    toggle('show_family', 'Show my family', m.show_family),
    el('button', { type: 'submit', class: 'primary' }, ['Save privacy']),
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      await updateMyMember({
        visibility: sel.value as Member['visibility'],
        show_email: f.get('show_email') === 'on',
        show_address: f.get('show_address') === 'on',
        show_family: f.get('show_family') === 'on',
      });
      toast('Privacy saved');
    } catch (err) {
      toast((err as Error).message, false);
    }
  });
  return form;
}

// --- professions -------------------------------------------------------------
async function renderProfessions(memberId: string, categories: ProfessionCategory[]): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Professions'])]);
  const list = el('div', { class: 'list' });
  card.append(list);

  const refresh = async () => {
    list.innerHTML = '';
    const items = await listMyProfessions(memberId);
    if (items.length === 0) list.append(el('p', { class: 'muted' }, ['No professions yet.']));
    for (const p of items) {
      const row = el('div', { class: 'row' }, [
        el('span', {}, [p.title + (p.organization ? ` — ${p.organization}` : '')]),
        el('button', { class: 'link danger', type: 'button' }, ['Remove']),
      ]);
      $(row, 'button').addEventListener('click', async () => {
        await deleteMyProfession(p.id);
        toast('Removed');
        await refresh();
      });
      list.append(row);
    }
  };

  const catSel = el('select', { name: 'category_id' }, [
    el('option', { value: '' }, ['(category, optional)']),
    ...categories.map((c) => el('option', { value: c.id }, [c.name])),
  ]);
  const form = el('form', { class: 'inline' }, [
    input('title', '', 'text'),
    catSel,
    input('organization', '', 'text'),
    el('button', { type: 'submit', class: 'primary' }, ['Add']),
  ]);
  $(form, 'input[name=title]').setAttribute('placeholder', 'Precise title, e.g. Urologist');
  $(form, 'input[name=organization]').setAttribute('placeholder', 'Organization');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const title = String(f.get('title')).trim();
    if (!title) return;
    try {
      await addMyProfession({
        member_id: memberId,
        title,
        category_id: (f.get('category_id') as string) || null,
        organization: str(f, 'organization'),
      });
      form.reset();
      toast('Added');
      await refresh();
    } catch (err) {
      toast((err as Error).message, false);
    }
  });

  card.append(form);
  await refresh();
  return card;
}

// --- addresses ---------------------------------------------------------------
async function renderAddresses(memberId: string): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Addresses'])]);
  const list = el('div', { class: 'list' });
  card.append(list);

  const refresh = async () => {
    list.innerHTML = '';
    const items = await listMyAddresses(memberId);
    if (items.length === 0) list.append(el('p', { class: 'muted' }, ['No addresses yet.']));
    for (const a of items) {
      const text = [a.street, a.postal_code, a.city, a.country_code].filter(Boolean).join(', ');
      const row = el('div', { class: 'row' }, [
        el('span', {}, [`${a.label}: ${text || '(empty)'}${a.geo ? ' 📍' : ''}`]),
        el('button', { class: 'link danger', type: 'button' }, ['Remove']),
      ]);
      $(row, 'button').addEventListener('click', async () => {
        await deleteAddress(a.id);
        toast('Removed');
        await refresh();
      });
      list.append(row);
    }
  };

  const form = el('form', { class: 'grid2' }, [
    field('Street', input('street', '')),
    field('Postal code', input('postal_code', '')),
    field('City', input('city', '')),
    field('Region', input('region', '')),
    field('Country (ISO-2)', input('country_code', '')),
    field('Label', el('select', { name: 'label' }, [
      opt('home', 'home', 'home'), opt('work', 'work', 'home'),
      opt('holiday', 'holiday', 'home'), opt('other', 'other', 'home'),
    ])),
  ]);
  const addBtn = el('button', { type: 'submit', class: 'primary' }, ['Add address (auto-geocoded)']);
  form.append(addBtn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    addBtn.textContent = 'Geocoding…';
    try {
      await upsertMyAddress({
        member_id: memberId,
        label: (f.get('label') as never) || 'home',
        street: str(f, 'street') ?? undefined,
        postal_code: str(f, 'postal_code') ?? undefined,
        city: str(f, 'city') ?? undefined,
        region: str(f, 'region') ?? undefined,
        country_code: str(f, 'country_code') ?? undefined,
      });
      form.reset();
      toast('Address added');
      await refresh();
    } catch (err) {
      toast((err as Error).message, false);
    } finally {
      addBtn.textContent = 'Add address (auto-geocoded)';
    }
  });

  card.append(form);
  await refresh();
  return card;
}

// --- family ------------------------------------------------------------------
async function renderFamily(memberId: string): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Family'])]);
  const list = el('div', { class: 'list' });
  card.append(list);

  const refresh = async () => {
    list.innerHTML = '';
    const items = await listMyRelatives(memberId);
    if (items.length === 0) list.append(el('p', { class: 'muted' }, ['No spouses or children added yet.']));
    for (const r of items) {
      const age = r.age ?? ageFromDob(r.date_of_birth);
      const bits = [`${r.relationship}: ${r.first_name} ${r.last_name ?? ''}`.trim()];
      if (age != null) bits.push(`age ${age}`);
      if (r.full_address) bits.push(r.full_address);
      const row = el('div', { class: 'row' }, [
        el('span', {}, [bits.join(' · ')]),
        el('button', { class: 'link danger', type: 'button' }, ['Remove']),
      ]);
      $(row, 'button').addEventListener('click', async () => {
        await deleteRelative(r.id);
        toast('Removed');
        await refresh();
      });
      list.append(row);
    }
  };

  const form = el('form', { class: 'card-inner' }, [
    el('div', { class: 'grid2' }, [
      field('Relationship', el('select', { name: 'relationship' }, [
        opt('spouse', 'Spouse', 'spouse'), opt('partner', 'Partner', 'spouse'),
        opt('child', 'Child', 'spouse'), opt('other', 'Other', 'spouse'),
      ])),
      field('Date of birth', input('date_of_birth', '', 'date')),
      field('First name', input('first_name', '')),
      field('Last name', input('last_name', '')),
      field('Street', input('street', '')),
      field('Postal code', input('postal_code', '')),
      field('City', input('city', '')),
      field('Country (ISO-2)', input('country_code', '')),
    ]),
    el('button', { type: 'submit', class: 'primary' }, ['Add family member']),
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const first = String(f.get('first_name')).trim();
    if (!first) return;
    try {
      await addRelative({
        member_id: memberId,
        relationship: f.get('relationship') as never,
        first_name: first,
        last_name: str(f, 'last_name'),
        date_of_birth: str(f, 'date_of_birth'),
        street: str(f, 'street'),
        postal_code: str(f, 'postal_code'),
        city: str(f, 'city'),
        country_code: str(f, 'country_code'),
      });
      form.reset();
      toast('Added');
      await refresh();
    } catch (err) {
      toast((err as Error).message, false);
    }
  });

  card.append(form);
  await refresh();
  return card;
}

// --- small builders ----------------------------------------------------------
function opt(value: string, label: string, current: string): HTMLOptionElement {
  return el('option', { value, ...(value === current ? { selected: true } : {}) }, [label]);
}
function toggle(name: string, label: string, checked: boolean): HTMLElement {
  return el('label', { class: 'toggle' }, [
    el('input', { type: 'checkbox', name, ...(checked ? { checked: true } : {}) }),
    el('span', {}, [label]),
  ]);
}
function str(f: FormData, key: string): string | null {
  const v = (f.get(key) as string | null)?.trim();
  return v ? v : null;
}
