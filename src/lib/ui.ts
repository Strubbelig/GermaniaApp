// =============================================================================
// GermaniaApp — tiny DOM helpers shared by screens (no framework).
// =============================================================================
type Attrs = Record<string, string | number | boolean>;

export function el<K extends keyof HTMLElementTagNameMap>(
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

export const qs = <T extends HTMLElement>(p: HTMLElement, sel: string) => p.querySelector<T>(sel)!;

export function field(label: string, control: HTMLElement): HTMLElement {
  return el('label', { class: 'field' }, [el('span', { class: 'field-label' }, [label]), control]);
}

export function toast(msg: string, ok = true): void {
  const t = el('div', { class: `toast ${ok ? 'ok' : 'err'}` }, [msg]);
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

export function clear(root: HTMLElement): void {
  root.innerHTML = '';
}
