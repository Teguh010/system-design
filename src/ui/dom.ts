export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function q<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
}

/** Restart a CSS animation class on an element. */
export function replayClass(el: Element, cls: string) {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}
