// =============================================================================
// GermaniaApp — entry point + tiny router with auth gate
// No session → sign-in screen. Signed in → app shell with bottom nav.
// =============================================================================
import './styles.css';
import { DEMO, hasSession, onAuthChange, signOut } from './lib/api';
import { mountAuth } from './screens/auth';
import { mountProfileEditor } from './screens/profile';
import { mountDirectory } from './screens/directory';
import { mountGatherings } from './screens/gatherings';
import { el, clear, toast } from './lib/ui';

const app = document.getElementById('app')!;

type Route = 'members' | 'profile' | 'gatherings';
const screens: Record<Route, (root: HTMLElement) => void | Promise<void>> = {
  members: mountDirectory,
  profile: mountProfileEditor,
  gatherings: mountGatherings,
};

function renderApp(route: Route): void {
  clear(app);
  const body = el('div', { class: 'screen' });
  const nav = el('nav', { class: 'bottomnav' }, [
    navBtn('Members', 'members', route),
    navBtn('My profile', 'profile', route),
    navBtn('Gatherings', 'gatherings', route),
    signOutBtn(),
  ]);
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

async function boot(): Promise<void> {
  if (await hasSession()) renderApp('members');
  else mountAuth(app);
  if (DEMO) setTimeout(() => toast('Demo mode — sample data, changes reset on refresh'), 400);
}

// React to sign-in / sign-out anywhere in the app.
onAuthChange((signedIn) => {
  if (signedIn) renderApp('members');
  else mountAuth(app);
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
