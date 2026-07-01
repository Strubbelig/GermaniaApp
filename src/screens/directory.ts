// =============================================================================
// GermaniaApp — Directory, search, map & export (vanilla TS)
// Tabs within the screen: Browse | By profession | Near me | Map.
// Results render as cards with email-contact and CSV export.
// =============================================================================
import {
  getDirectory,
  membersByProfession,
  membersNear,
  getMapMarkers,
  listDeceased,
  getMyMember,
  mailtoFor,
  toCsv,
  downloadCsv,
  exportContactsCsv,
} from '../lib/api';
import type { DirectoryEntry, DeceasedEntry, NearbyMember, ProfessionMatch, Member } from '../lib/database.types';
import { el, field, toast, clear } from '../lib/ui';
import { showGanzenModal } from './ganze';

let me: Member | null = null;

// A normalized result row used by the list renderer + export.
interface Row {
  id: string;
  name: string;
  email: string | null;
  profession?: string | null;
  city?: string | null;
  country?: string | null;
  extra?: string;
  charges?: string | null;
  fencing?: number;
  corpStatus?: string | null;
}

const CORP_LABEL: Record<string, string> = { fux: 'Fux', bursch: 'Aktiver Bursch', philister: 'Philister' };

// Two crossed student fencing swords (Schläger).
const SWORDS = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
  stroke-width="1.6" stroke-linecap="round" style="vertical-align:-3px">
  <path d="M4 4l11 11M20 4L9 15"/><path d="M14 15l3 3M10 15l-3 3"/></svg>`;

export async function mountDirectory(root: HTMLElement): Promise<void> {
  clear(root);
  me = await getMyMember().catch(() => null);
  const tabs = el('div', { class: 'tabs' }, [
    tabBtn('Übersicht', true),
    tabBtn('Nach Beruf'),
    tabBtn('In meiner Nähe'),
    tabBtn('Karte'),
    tabBtn('Verstorbene'),
  ]);
  const panel = el('div', { class: 'panel' });
  root.append(el('div', { class: 'profile' }, [el('h1', {}, ['Mitglieder']), tabs, panel]));

  const buttons = Array.from(tabs.querySelectorAll('button'));
  const select = (i: number) => {
    buttons.forEach((b, j) => b.classList.toggle('active', i === j));
    if (i === 0) renderBrowse(panel);
    else if (i === 1) renderByProfession(panel);
    else if (i === 2) renderNearMe(panel);
    else if (i === 3) renderMap(panel);
    else renderDeceased(panel);
  };
  buttons.forEach((b, i) => b.addEventListener('click', () => select(i)));
  select(0);
}

function tabBtn(label: string, active = false): HTMLButtonElement {
  return el('button', { type: 'button', class: `tab ${active ? 'active' : ''}` }, [label]);
}

// --- shared results renderer -------------------------------------------------
function renderResults(host: HTMLElement, rows: Row[]): void {
  const existing = host.querySelector('.results');
  existing?.remove();
  const box = el('div', { class: 'results' });

  const bar = el('div', { class: 'resultbar' }, [
    el('span', { class: 'muted' }, [`${rows.length} Mitglied${rows.length === 1 ? '' : 'er'}`]),
  ]);
  if (rows.length > 0) {
    const emails = rows.map((r) => r.email).filter(Boolean) as string[];
    const mailBtn = el('button', { type: 'button' }, [`Alle per E-Mail (${emails.length})`]);
    mailBtn.addEventListener('click', () => {
      if (emails.length === 0) return toast('Keine sichtbaren E-Mails', false);
      location.href = mailtoFor(emails, { group: true, subject: 'Germania' });
    });
    const csvBtn = el('button', { type: 'button' }, ['CSV exportieren']);
    csvBtn.addEventListener('click', async () => {
      try {
        await exportContactsCsv(rows.map((r) => r.id), 'germania-contacts.csv');
      } catch {
        // Fallback: export what's already on screen (e.g. proximity results).
        downloadCsv('germania-contacts.csv', toCsv(rows));
      }
    });
    bar.append(mailBtn, csvBtn);
  }
  box.append(bar);

  for (const r of rows) {
    const meta = [r.profession, [r.city, r.country].filter(Boolean).join(', '), r.extra]
      .filter(Boolean)
      .join(' · ');
    const nameLine = el('div', { class: 'nameline' }, [el('strong', {}, [r.name])]);
    if (r.corpStatus && CORP_LABEL[r.corpStatus]) {
      nameLine.append(el('span', { class: `corpbadge ${r.corpStatus}` }, [CORP_LABEL[r.corpStatus]]));
    }
    const info = el('div', {}, [nameLine, el('div', { class: 'muted' }, [meta])]);
    if (r.charges) info.append(el('div', { class: 'charges' }, [r.charges]));
    if (r.fencing && r.fencing > 0) {
      const f = el('div', { class: 'fencing' });
      f.innerHTML = `${SWORDS} <span>${r.fencing} Partien</span>`;
      info.append(f);
    }
    const actions = el('div', { class: 'member-actions' }, [
      r.email
        ? el('a', { class: 'mailbtn', href: mailtoFor([r.email]) }, ['E-Mail'])
        : el('span', { class: 'muted' }, ['E-Mail verborgen']),
    ]);
    if (me && r.id !== me.id) {
      const g = el('button', { type: 'button', class: 'ganzbtn' }, ['Ganzen vor!']);
      g.addEventListener('click', () => showGanzenModal({ id: r.id, name: r.name }, me!));
      actions.append(g);
    }
    box.append(el('div', { class: 'member' }, [info, actions]));
  }
  host.append(box);
}

// --- Browse ------------------------------------------------------------------
async function renderBrowse(panel: HTMLElement): Promise<void> {
  clear(panel);
  panel.append(el('p', { class: 'loading' }, ['Mitglieder werden geladen…']));
  try {
    const dir = await getDirectory({ limit: 200 });
    clear(panel);
    renderResults(panel, dir.map(fromDirectory));
  } catch (e) {
    clear(panel);
    panel.append(el('p', { class: 'err' }, [(e as Error).message]));
  }
}

// --- By profession -----------------------------------------------------------
function renderByProfession(panel: HTMLElement): void {
  clear(panel);
  const box = el('input', { type: 'search', placeholder: 'z. B. Anwalt, Urologe, Architekt' });
  const form = el('form', { class: 'inline' }, [box, el('button', { type: 'submit' }, ['Suchen'])]);
  panel.append(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = box.value.trim();
    if (!q) return;
    try {
      const hits = await membersByProfession(q);
      renderResults(panel, hits.map(fromProfession));
    } catch (err) {
      toast((err as Error).message, false);
    }
  });
}

// --- Near me -----------------------------------------------------------------
function renderNearMe(panel: HTMLElement): void {
  clear(panel);
  const radius = el('input', { type: 'number', value: '50', min: '1' });
  const form = el('form', { class: 'inline' }, [
    field('Umkreis (km)', radius),
    el('button', { type: 'submit' }, ['Mitglieder in der Nähe finden']),
  ]);
  panel.append(form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!navigator.geolocation) return toast('Standort wird nicht unterstützt', false);
    toast('Standort wird ermittelt…');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const hits = await membersNear(pos.coords.latitude, pos.coords.longitude, Number(radius.value));
          renderResults(panel, hits.map(fromNearby));
        } catch (err) {
          toast((err as Error).message, false);
        }
      },
      () => toast('Standort konnte nicht ermittelt werden', false),
    );
  });
}

// --- Map (MapLibre, loaded from CDN) ----------------------------------------
async function renderMap(panel: HTMLElement): Promise<void> {
  clear(panel);
  const mapEl = el('div', { class: 'map', id: 'map' });
  panel.append(mapEl);
  try {
    const maplibregl = await loadMapLibre();
    const map = new maplibregl.Map({
      container: mapEl,
      style: rasterStyle(),
      center: [10, 50],
      zoom: 3,
    });
    const markers = await getMapMarkers();
    const bounds = new maplibregl.LngLatBounds();
    for (const m of markers) {
      if (m.longitude == null || m.latitude == null) continue;
      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
        `<strong>${m.first_name} ${m.last_name}</strong><br>${m.profession ?? ''}<br>${m.city ?? ''}`,
      );
      new maplibregl.Marker().setLngLat([m.longitude, m.latitude]).setPopup(popup).addTo(map);
      bounds.extend([m.longitude, m.latitude]);
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, maxZoom: 8 });
  } catch (e) {
    clear(panel);
    panel.append(el('p', { class: 'err' }, [`Karte konnte nicht geladen werden: ${(e as Error).message}`]));
  }
}

// --- Verstorbene (deceased, memorial) ---------------------------------------
async function renderDeceased(panel: HTMLElement): Promise<void> {
  clear(panel);
  panel.append(el('p', { class: 'loading' }, ['Wird geladen…']));
  let rows: DeceasedEntry[] = [];
  try {
    rows = await listDeceased();
  } catch (e) {
    clear(panel);
    panel.append(el('p', { class: 'err' }, [(e as Error).message]));
    return;
  }
  clear(panel);
  if (rows.length === 0) {
    panel.append(el('p', { class: 'muted' }, ['Keine Einträge.']));
    return;
  }
  for (const d of rows) {
    const name = [d.salutation, d.first_name, d.last_name].filter(Boolean).join(' ');
    const life = [d.birth_year, d.death_year].some((x) => x != null)
      ? `${d.birth_year ?? '?'}–${d.death_year ?? '?'}`
      : '';
    const meta = [d.profession, life].filter(Boolean).join(' · ');
    const card = el('div', { class: 'card' }, [
      el('h2', {}, [name]),
      meta ? el('div', { class: 'muted' }, [meta]) : el('span', {}, []),
      d.trivia ? el('p', {}, [d.trivia]) : el('span', { class: 'muted' }, ['Keine Trivia hinterlegt.']),
    ]);
    panel.append(card);
  }
}

// OpenStreetMap raster style — no API key required.
function rasterStyle() {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  } as unknown as Record<string, unknown>;
}

// Lazy-load MapLibre from CDN so it isn't in the main bundle.
async function loadMapLibre(): Promise<any> {
  const w = window as unknown as { maplibregl?: unknown };
  if (w.maplibregl) return w.maplibregl;
  await new Promise<void>((res, rej) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css';
    document.head.append(css);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js';
    s.onload = () => res();
    s.onerror = () => rej(new Error('CDN unreachable'));
    document.head.append(s);
  });
  return (window as unknown as { maplibregl: unknown }).maplibregl;
}

// --- mappers -----------------------------------------------------------------
function fromDirectory(d: DirectoryEntry): Row {
  return {
    id: d.id, name: `${d.first_name} ${d.last_name}`, email: d.show_email ? d.email : null,
    profession: d.profession, city: d.city, country: d.country_code,
    extra: [d.age != null ? `${d.age} Jahre` : null, d.entry_semester ? `seit ${d.entry_semester}` : null]
      .filter(Boolean).join(' · ') || undefined,
    charges: d.charges, fencing: d.fencing_bouts, corpStatus: d.corp_status,
  };
}
function fromProfession(p: ProfessionMatch): Row {
  return {
    id: p.member_id, name: p.full_name, email: p.email,
    profession: p.profession, city: p.city, country: p.country_code,
  };
}
function fromNearby(n: NearbyMember): Row {
  return {
    id: n.member_id, name: n.full_name, email: n.email,
    profession: n.profession, city: n.city, country: n.country_code,
    extra: `${n.distance_km} km`,
  };
}
