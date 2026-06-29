// =============================================================================
// GermaniaApp — entry point + tiny router with auth gate
// No session → sign-in screen. Signed in → app shell with bottom nav.
// =============================================================================
import './styles.css';
import { DEMO, hasSession, onAuthChange, signOut, isStaff } from './lib/api';
import { mountAuth } from './screens/auth';
import { mountProfileEditor } from './screens/profile';
import { mountDirectory } from './screens/directory';
import { mountGatherings } from './screens/gatherings';
import { mountStocherkahn } from './screens/stocherkahn';
import { mountAdmin } from './screens/admin';
import { el, clear, toast } from './lib/ui';

const app = document.getElementById('app')!;
let staff = false; // is the signed-in member officer/admin? (controls Admin tab)

type Route = 'members' | 'profile' | 'gatherings' | 'boat' | 'admin';
const screens: Record<Route, (root: HTMLElement) => void | Promise<void>> = {
  members: mountDirectory,
  profile: mountProfileEditor,
  gatherings: mountGatherings,
  boat: mountStocherkahn,
  admin: mountAdmin,
};

function renderApp(route: Route): void {
  clear(app);
  const body = el('div', { class: 'screen' });
  const items = [
    navBtn('Members', 'members', route),
    navBtn('Profile', 'profile', route),
    navBtn('Events', 'gatherings', route),
    navBtn('Boat', 'boat', route),
  ];
  if (staff) items.push(navBtn('Admin', 'admin', route));
  items.push(signOutBtn());
  const nav = el('nav', { class: 'bottomnav' }, items);
  app.append(body, nav);
  screens[route](body);
}

function navBtn(label: string, route: Route, current: Route): HTMLButtonElement {
  const b = el('button', { type: 'button', class: `navitem ${route === current ? 'active' : ''}` }, [label]);
  b.addEventListener('click', () => renderApp(route));
  return b;
}
function signOutBtn(): HTMLButtonElement {
  const b = el('button', { type: 'button', class: 'navitem' }, ['Sign out']);
  b.addEventListener('click', async () => { await signOut(); });
  return b;
}

async function showSignedIn(): Promise<void> {
  staff = await isStaff().catch(() => false);
  renderApp('members');
}

async function boot(): Promise<void> {
  if (await hasSession()) await showSignedIn();
  else mountAuth(app);
  if (DEMO) setTimeout(() => toast('Demo mode — sample data, changes reset on refresh'), 400);
}

// React to sign-in / sign-out anywhere in the app.
onAuthChange((signedIn) => {
  if (signedIn) showSignedIn();
  else { staff = false; mountAuth(app); }
});

boot().catch((e) => {
  app.innerHTML = `<p class="err">${(e as Error).message}</p>`;
});

// PWA service worker (registered relative to the deploy base, e.g. /repo/ on
// GitHub Pages). Disabled in dev. Failures are non-fatal.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
  });
}
