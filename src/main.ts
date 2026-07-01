// =============================================================================
// GermaniaApp — Einstiegspunkt + kleiner Router mit Auth-Gate
// Keine Sitzung → Anmeldung. Angemeldet → App mit Kopfzeile (Wappen) + Tab-Leiste.
// =============================================================================
import './styles.css';
import { DEMO, hasSession, onAuthChange, signOut, isStaff } from './lib/api';
import { mountAuth } from './screens/auth';
import { mountProfileEditor } from './screens/profile';
import { mountDirectory } from './screens/directory';
import { mountGatherings } from './screens/gatherings';
import { mountStocherkahn } from './screens/stocherkahn';
import { mountOffices } from './screens/offices';
import { mountAdmin } from './screens/admin';
import { showFeedback } from './screens/feedback';
import { el, clear, toast } from './lib/ui';
import { crestSvg } from './lib/crest';

const app = document.getElementById('app')!;
let staff = false;

type Route = 'members' | 'profile' | 'gatherings' | 'boat' | 'offices' | 'admin';
const screens: Record<Route, (root: HTMLElement) => void | Promise<void>> = {
  members: mountDirectory,
  profile: mountProfileEditor,
  gatherings: mountGatherings,
  boat: mountStocherkahn,
  offices: mountOffices,
  admin: mountAdmin,
};

// --- nav icons (inline SVG, stroke = currentColor) ---------------------------
const ICONS: Record<Route, string> = {
  members: '<path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 9v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1m18 0v-1a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  gatherings: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  boat: '<path d="M3 14h18l-2 5H5l-2-5Z"/><path d="M12 3v7M12 3l5 4-5 1"/>',
  offices: '<path d="M12 3l2.5 5 5 .5-3.75 3.4L16 17l-4-2.5L8 17l1.25-5.1L5.5 8.5l5-.5Z"/>',
  admin: '<path d="M12 3l8 4v5c0 5-4 8-8 9-4-1-8-4-8-9V7l8-4Z"/>',
};

function header(): HTMLElement {
  const h = el('header', { class: 'appbar' });
  h.innerHTML = `
    <div class="brand">
      <span class="crest">${crestSvg(34)}</span>
      <span class="brandtext"><strong>Germania</strong><small>gegr. 1816</small></span>
    </div>`;
  const actions = el('div', { class: 'appbar-actions' });
  const fb = el('button', { type: 'button', class: 'ghost' }, ['Feedback']);
  fb.addEventListener('click', () => showFeedback());
  const out = el('button', { type: 'button', class: 'ghost' }, ['Abmelden']);
  out.addEventListener('click', async () => { await signOut(); });
  actions.append(fb, out);
  h.append(actions);
  return h;
}

function renderApp(route: Route): void {
  clear(app);
  const body = el('div', { class: 'screen' });
  const labels: Record<Route, string> = {
    members: 'Mitglieder', profile: 'Profil', gatherings: 'Termine', boat: 'Kahn', offices: 'Ämter', admin: 'Admin',
  };
  const routes: Route[] = ['members', 'profile', 'gatherings', 'boat', 'offices'];
  if (staff) routes.push('admin');
  const nav = el('nav', { class: 'bottomnav' }, routes.map((r) => navBtn(labels[r], r, route)));
  app.append(header(), body, nav);
  screens[route](body);
}

function navBtn(label: string, route: Route, current: Route): HTMLButtonElement {
  const b = el('button', { type: 'button', class: `navitem ${route === current ? 'active' : ''}` });
  b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" width="22" height="22">${ICONS[route]}</svg>
    <span>${label}</span>`;
  b.addEventListener('click', () => renderApp(route));
  return b;
}

async function showSignedIn(): Promise<void> {
  staff = await isStaff().catch(() => false);
  renderApp('members');
}

async function boot(): Promise<void> {
  if (await hasSession()) await showSignedIn();
  else mountAuth(app);
  if (DEMO) setTimeout(() => toast('Demo-Modus — Beispieldaten, Änderungen werden beim Neuladen zurückgesetzt'), 400);
}

onAuthChange((signedIn) => {
  if (signedIn) showSignedIn();
  else { staff = false; mountAuth(app); }
});

boot().catch((e) => {
  app.innerHTML = `<p class="err">${(e as Error).message}</p>`;
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
  });
}
