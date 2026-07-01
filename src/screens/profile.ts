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
  claimMyMember,
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
  listMyOfficeHistory,
  addOfficeHistory,
  deleteOfficeHistory,
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
function semesterInput(node: HTMLInputElement): HTMLInputElement {
  node.placeholder = 'z. B. WS 2016/17 oder SS 2018';
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
  root.append(el('p', { class: 'loading' }, ['Profil wird geladen…']));

  let member: Member | null = null;
  try {
    // Link a prefilled (imported) row to this account by verified phone, if any.
    await claimMyMember().catch(() => null);
    member = await getMyMember();
  } catch (e) {
    root.innerHTML = '';
    root.append(el('p', { class: 'err' }, [`Profil konnte nicht geladen werden: ${(e as Error).message}`]));
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
      el('h1', {}, ['Mein Profil bearbeiten']),
      renderPersonal(member),
      renderPrivacy(member),
      await renderOfficeHistory(member.id),
      await renderProfessions(member.id, categories),
      await renderAddresses(member.id),
      await renderFamily(member.id),
    ]),
  );
}

// --- first run ---------------------------------------------------------------
function renderFirstRun(root: HTMLElement): HTMLElement {
  const form = el('form', { class: 'card' }, [
    el('h1', {}, ['Willkommen — Eintrag erstellen']),
    field('Vorname', reqd(input('first_name', ''))),
    field('Nachname', reqd(input('last_name', ''))),
    field('E-Mail', reqd(input('email', '', 'email'))),
    field('Geburtsdatum', reqd(input('date_of_birth', '', 'date'))),
    field('Eintrittssemester', semesterInput(reqd(input('entry_semester', '')))),
    el('button', { type: 'submit', class: 'primary' }, ['Profil erstellen']),
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
        entry_semester: String(f.get('entry_semester')),
        salutation: null, maiden_name: null, gender: null,
        phone: null, website: null, photo_url: null, bio: null, member_since: null,
      });
      toast('Profil erstellt');
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
    el('h2', {}, ['Persönliche Angaben']),
    el('div', { class: 'photo-row' }, [
      el('img', { class: 'avatar', src: m.photo_url ?? 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect width=%2280%22 height=%2280%22 fill=%22%23ddd%22/></svg>', alt: 'Foto' }),
      field('Foto ändern', input('photo', null, 'file')),
    ]),
    el('div', { class: 'grid2' }, [
      field('Anrede', input('salutation', m.salutation)),
      field('Geburtsname', input('maiden_name', m.maiden_name)),
      field('Vorname', input('first_name', m.first_name)),
      field('Nachname', input('last_name', m.last_name)),
      field('E-Mail', input('email', m.email, 'email')),
      field('Telefon', input('phone', m.phone, 'tel')),
      field('Website', input('website', m.website, 'url')),
      field('Geburtsdatum (Pflicht)', reqd(input('date_of_birth', m.date_of_birth, 'date'))),
      field('Eintrittssemester (Pflicht)', semesterInput(reqd(input('entry_semester', m.entry_semester)))),
      field('Fechtpartien', input('fencing_bouts', String(m.fencing_bouts ?? 0), 'number')),
    ]),
    field('Über mich', el('textarea', { name: 'bio', rows: 3 }, [m.bio ?? ''])),
    field('Trivia / Wissenswertes', el('textarea', { name: 'trivia', rows: 3 }, [m.trivia ?? ''])),
    el('button', { type: 'submit', class: 'primary' }, ['Angaben speichern']),
  ]);

  $(form, 'input[name=photo]').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const url = await uploadMyPhoto(file);
      ($(form, 'img.avatar') as HTMLImageElement).src = url;
      toast('Foto aktualisiert');
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
        entry_semester: str(f, 'entry_semester'),
        fencing_bouts: Number(f.get('fencing_bouts') ?? 0) || 0,
        bio: str(f, 'bio'),
        trivia: str(f, 'trivia'),
      });
      toast('Gespeichert');
    } catch (err) {
      toast((err as Error).message, false);
    }
  });
  return form;
}

// --- privacy -----------------------------------------------------------------
function renderPrivacy(m: Member): HTMLElement {
  const sel = el('select', { name: 'visibility' }, [
    opt('members', 'Für Mitglieder sichtbar', m.visibility),
    opt('officers', 'Nur Vorstand', m.visibility),
    opt('private', 'Privat', m.visibility),
  ]);
  const form = el('form', { class: 'card' }, [
    el('h2', {}, ['Privatsphäre']),
    toggle('consented', 'Auf der App sichtbar sein (Opt-in)', m.consented),
    el('p', { class: 'muted' }, ['Ohne dieses Häkchen sehen andere Mitglieder deinen Eintrag nicht.']),
    field('Sichtbarkeit des Profils', sel),
    toggle('show_email', 'Meine E-Mail für Mitglieder zeigen', m.show_email),
    toggle('show_address', 'Meine Adresse zeigen', m.show_address),
    toggle('show_family', 'Meine Familie zeigen', m.show_family),
    el('button', { type: 'submit', class: 'primary' }, ['Privatsphäre speichern']),
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      await updateMyMember({
        visibility: sel.value as Member['visibility'],
        consented: f.get('consented') === 'on',
        show_email: f.get('show_email') === 'on',
        show_address: f.get('show_address') === 'on',
        show_family: f.get('show_family') === 'on',
      });
      toast('Privatsphäre gespeichert');
    } catch (err) {
      toast((err as Error).message, false);
    }
  });
  return form;
}

// --- professions -------------------------------------------------------------
async function renderProfessions(memberId: string, categories: ProfessionCategory[]): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Berufe'])]);
  const list = el('div', { class: 'list' });
  card.append(list);

  const refresh = async () => {
    list.innerHTML = '';
    const items = await listMyProfessions(memberId);
    if (items.length === 0) list.append(el('p', { class: 'muted' }, ['Noch keine Berufe.']));
    for (const p of items) {
      const row = el('div', { class: 'row' }, [
        el('span', {}, [p.title + (p.organization ? ` — ${p.organization}` : '')]),
        el('button', { class: 'link danger', type: 'button' }, ['Entfernen']),
      ]);
      $(row, 'button').addEventListener('click', async () => {
        await deleteMyProfession(p.id);
        toast('Entfernt');
        await refresh();
      });
      list.append(row);
    }
  };

  const catSel = el('select', { name: 'category_id' }, [
    el('option', { value: '' }, ['(Kategorie, optional)']),
    ...categories.map((c) => el('option', { value: c.id }, [c.name])),
  ]);
  const form = el('form', { class: 'inline' }, [
    input('title', '', 'text'),
    catSel,
    input('organization', '', 'text'),
    el('button', { type: 'submit', class: 'primary' }, ['Hinzufügen']),
  ]);
  $(form, 'input[name=title]').setAttribute('placeholder', 'Genaue Bezeichnung, z. B. Urologe');
  $(form, 'input[name=organization]').setAttribute('placeholder', 'Organisation');
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
      toast('Hinzugefügt');
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
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Adressen'])]);
  const list = el('div', { class: 'list' });
  card.append(list);

  const refresh = async () => {
    list.innerHTML = '';
    const items = await listMyAddresses(memberId);
    if (items.length === 0) list.append(el('p', { class: 'muted' }, ['Noch keine Adressen.']));
    for (const a of items) {
      const text = [a.street, a.postal_code, a.city, a.country_code].filter(Boolean).join(', ');
      const row = el('div', { class: 'row' }, [
        el('span', {}, [`${labelDe(a.label)}: ${text || '(leer)'}${a.geo ? ' 📍' : ''}`]),
        el('button', { class: 'link danger', type: 'button' }, ['Entfernen']),
      ]);
      $(row, 'button').addEventListener('click', async () => {
        await deleteAddress(a.id);
        toast('Entfernt');
        await refresh();
      });
      list.append(row);
    }
  };

  const form = el('form', { class: 'grid2' }, [
    field('Straße', input('street', '')),
    field('PLZ', input('postal_code', '')),
    field('Stadt', input('city', '')),
    field('Region', input('region', '')),
    field('Land (ISO-2)', input('country_code', '')),
    field('Art', el('select', { name: 'label' }, [
      opt('home', 'Zuhause', 'home'), opt('work', 'Arbeit', 'home'),
      opt('holiday', 'Urlaub', 'home'), opt('other', 'Sonstige', 'home'),
    ])),
  ]);
  const addBtn = el('button', { type: 'submit', class: 'primary' }, ['Adresse hinzufügen (auto-geocodiert)']);
  form.append(addBtn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    addBtn.textContent = 'Geocodierung…';
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
      toast('Adresse hinzugefügt');
      await refresh();
    } catch (err) {
      toast((err as Error).message, false);
    } finally {
      addBtn.textContent = 'Adresse hinzufügen (auto-geocodiert)';
    }
  });

  card.append(form);
  await refresh();
  return card;
}

// --- family ------------------------------------------------------------------
async function renderFamily(memberId: string): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Familie'])]);
  const list = el('div', { class: 'list' });
  card.append(list);

  const refresh = async () => {
    list.innerHTML = '';
    const items = await listMyRelatives(memberId);
    if (items.length === 0) list.append(el('p', { class: 'muted' }, ['Noch keine Partner oder Kinder hinzugefügt.']));
    for (const r of items) {
      const age = r.age ?? ageFromDob(r.date_of_birth);
      const bits = [`${relDe(r.relationship)}: ${r.first_name} ${r.last_name ?? ''}`.trim()];
      if (age != null) bits.push(`${age} Jahre`);
      if (r.full_address) bits.push(r.full_address);
      const row = el('div', { class: 'row' }, [
        el('span', {}, [bits.join(' · ')]),
        el('button', { class: 'link danger', type: 'button' }, ['Entfernen']),
      ]);
      $(row, 'button').addEventListener('click', async () => {
        await deleteRelative(r.id);
        toast('Entfernt');
        await refresh();
      });
      list.append(row);
    }
  };

  const form = el('form', { class: 'card-inner' }, [
    el('div', { class: 'grid2' }, [
      field('Beziehung', el('select', { name: 'relationship' }, [
        opt('spouse', 'Ehepartner', 'spouse'), opt('partner', 'Partner', 'spouse'),
        opt('child', 'Kind', 'spouse'), opt('other', 'Sonstige', 'spouse'),
      ])),
      field('Geburtsdatum', input('date_of_birth', '', 'date')),
      field('Vorname', input('first_name', '')),
      field('Nachname', input('last_name', '')),
      field('Straße', input('street', '')),
      field('PLZ', input('postal_code', '')),
      field('Stadt', input('city', '')),
      field('Land (ISO-2)', input('country_code', '')),
    ]),
    el('button', { type: 'submit', class: 'primary' }, ['Familienmitglied hinzufügen']),
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
      toast('Hinzugefügt');
      await refresh();
    } catch (err) {
      toast((err as Error).message, false);
    }
  });

  card.append(form);
  await refresh();
  return card;
}

// --- office history (Chargen) ------------------------------------------------
async function renderOfficeHistory(memberId: string): Promise<HTMLElement> {
  const card = el('div', { class: 'card' }, [el('h2', {}, ['Chargen (Ämtergeschichte)'])]);
  const list = el('div', { class: 'list' });
  card.append(list);
  const abbr = (c: string) => (c === 'sprecher' ? 'x' : c === 'fechtwart' ? 'xx' : 'xxx');

  const refresh = async () => {
    list.innerHTML = '';
    const items = await listMyOfficeHistory(memberId);
    if (items.length === 0) list.append(el('p', { class: 'muted' }, ['Noch keine Chargen eingetragen.']));
    for (const h of items) {
      const row = el('div', { class: 'row' }, [
        el('span', {}, [`${abbr(h.office_code)} · ${h.semester ?? ''}`.trim()]),
        el('button', { class: 'link danger', type: 'button' }, ['Entfernen']),
      ]);
      $(row, 'button').addEventListener('click', async () => {
        await deleteOfficeHistory(h.id);
        toast('Entfernt');
        await refresh();
      });
      list.append(row);
    }
  };

  const form = el('form', { class: 'inline' }, [
    el('select', { name: 'office_code' }, [
      opt('sprecher', 'x (Sprecher)', 'sprecher'),
      opt('fechtwart', 'xx (Fechtwart)', 'sprecher'),
      opt('schriftwart', 'xxx (Schriftwart)', 'sprecher'),
    ]),
    input('semester', '', 'text'),
    el('button', { type: 'submit', class: 'primary' }, ['Hinzufügen']),
  ]);
  $(form, 'input[name=semester]').setAttribute('placeholder', 'Semester, z. B. WS 2019/20');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      await addOfficeHistory({
        member_id: memberId,
        office_code: f.get('office_code') as never,
        semester: str(f, 'semester'),
      });
      form.reset();
      toast('Hinzugefügt');
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
function labelDe(label: string): string {
  return { home: 'Zuhause', work: 'Arbeit', holiday: 'Urlaub', other: 'Sonstige' }[label] ?? label;
}
function relDe(rel: string): string {
  return { spouse: 'Ehepartner', partner: 'Partner', child: 'Kind', other: 'Sonstige' }[rel] ?? rel;
}
