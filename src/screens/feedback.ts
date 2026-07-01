// =============================================================================
// GermaniaApp — Tester-Feedback
// Ein einfaches Feedback-Formular (Bewertung + Nachricht). Ohne Backend öffnet
// "Senden" eine vorausgefüllte E-Mail an die unten gesetzte Adresse. Später
// lässt sich dies leicht auf eine Supabase-Tabelle oder ein Formular umstellen.
// =============================================================================
import { el, field } from '../lib/ui';

// TODO: bei Bedarf auf eine Sammeladresse oder ein Web-Formular ändern.
const FEEDBACK_EMAIL = 'moritz.milewski@yale.edu';

export function showFeedback(): void {
  const overlay = el('div', { class: 'modal-overlay' });
  const card = el('div', { class: 'modal card' }, [
    el('h2', {}, ['Feedback geben']),
    el('p', { class: 'muted' }, ['Wie findest du die App? Dein Hinweis hilft uns sehr.']),
  ]);

  const rating = el('select', { name: 'rating' }, [
    el('option', { value: '5' }, ['★★★★★ — ausgezeichnet']),
    el('option', { value: '4' }, ['★★★★ — gut']),
    el('option', { value: '3' }, ['★★★ — okay']),
    el('option', { value: '2' }, ['★★ — geht so']),
    el('option', { value: '1' }, ['★ — schlecht']),
  ]);
  const msg = el('textarea', { name: 'msg', rows: 4, placeholder: 'Was gefällt dir, was fehlt, was hakt?' });

  const send = el('button', { type: 'button', class: 'primary' }, ['Per E-Mail senden']);
  send.addEventListener('click', () => {
    const subject = `Germania-App Feedback (${rating.value}/5)`;
    const body = `Bewertung: ${rating.value}/5\n\n${(msg as HTMLTextAreaElement).value}`;
    location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    close();
  });
  const cancel = el('button', { type: 'button' }, ['Abbrechen']);
  cancel.addEventListener('click', () => close());

  card.append(
    field('Bewertung', rating),
    field('Nachricht', msg),
    el('div', { class: 'inline' }, [send, cancel]),
  );
  overlay.append(card);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.append(overlay);

  function close(): void { overlay.remove(); }
}
