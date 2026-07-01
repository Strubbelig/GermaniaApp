// =============================================================================
// GermaniaApp — Sign-in screen (vanilla TS)
// Two secure options on Supabase Auth:
//   1) Magic link (passwordless) — default; nothing to leak or reuse.
//   2) Email + password — with sign-up (email-verified) and reset.
// Sessions are JWT-based and persisted by supabase-js; all data access is then
// gated by Postgres Row Level Security, so the token alone can't read others'
// private rows.
// =============================================================================
import {
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
  sendPasswordReset,
} from '../lib/api';
import { el, qs, field, toast, clear } from '../lib/ui';
import { crestSvg } from '../lib/crest';

type Mode = 'magic' | 'password';

export function mountAuth(root: HTMLElement): void {
  clear(root);
  let mode: Mode = 'magic';

  const card = el('form', { class: 'card auth' }, []);
  const render = () => {
    clear(card);
    card.append(
      el('h1', {}, ['Bei Germania anmelden']),
      el('div', { class: 'tabs' }, [
        modeTab('Magischer Link', mode === 'magic', () => { mode = 'magic'; render(); }),
        modeTab('Passwort', mode === 'password', () => { mode = 'password'; render(); }),
      ]),
      field('E-Mail', el('input', { name: 'email', type: 'email', required: true, autocomplete: 'email' })),
    );

    if (mode === 'password') {
      card.append(
        field('Passwort', el('input', {
          name: 'password', type: 'password', required: true,
          minlength: 8, autocomplete: 'current-password',
        })),
        el('button', { type: 'submit', class: 'primary', 'data-act': 'login' }, ['Anmelden']),
        el('div', { class: 'inline' }, [
          linkBtn('Konto erstellen', 'signup'),
          linkBtn('Passwort vergessen', 'reset'),
        ]),
      );
    } else {
      card.append(
        el('button', { type: 'submit', class: 'primary', 'data-act': 'magic' }, ['Anmeldelink per E-Mail senden']),
        el('p', { class: 'muted' }, ['Wir senden dir einen einmaligen Link — kein Passwort nötig.']),
      );
    }
  };

  card.addEventListener('submit', async (e) => {
    e.preventDefault();
    await act((e.submitter as HTMLElement)?.getAttribute('data-act') ?? (mode === 'magic' ? 'magic' : 'login'), card);
  });
  card.addEventListener('click', async (e) => {
    const act2 = (e.target as HTMLElement).getAttribute?.('data-act');
    if (act2 === 'signup' || act2 === 'reset') {
      e.preventDefault();
      await act(act2, card);
    }
  });

  render();
  const brand = el('div', { class: 'auth-brand' });
  brand.innerHTML = `${crestSvg(72)}
    <div class="auth-brandtext"><strong>Germania</strong><span>gegründet 1816</span></div>`;
  root.append(el('div', { class: 'profile authwrap' }, [brand, card]));
}

async function act(action: string, card: HTMLElement): Promise<void> {
  const email = (qs<HTMLInputElement>(card, 'input[name=email]')?.value ?? '').trim();
  const pwEl = card.querySelector<HTMLInputElement>('input[name=password]');
  const password = pwEl?.value ?? '';
  if (!email) return toast('Bitte E-Mail eingeben', false);
  try {
    if (action === 'magic') {
      await signInWithMagicLink(email);
      toast('Bitte E-Mail für den Anmeldelink prüfen');
    } else if (action === 'login') {
      await signInWithPassword(email, password);
    } else if (action === 'signup') {
      if (password.length < 8) return toast('Mindestens 8 Zeichen verwenden', false);
      await signUpWithPassword(email, password);
      toast('Konto erstellt — bitte E-Mail bestätigen');
    } else if (action === 'reset') {
      await sendPasswordReset(email);
      toast('E-Mail zum Zurücksetzen gesendet');
    }
  } catch (err) {
    toast((err as Error).message, false);
  }
}

function modeTab(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const b = el('button', { type: 'button', class: `tab ${active ? 'active' : ''}` }, [label]);
  b.addEventListener('click', onClick);
  return b;
}
function linkBtn(label: string, act3: string): HTMLButtonElement {
  return el('button', { type: 'button', class: 'link', 'data-act': act3 }, [label]);
}
