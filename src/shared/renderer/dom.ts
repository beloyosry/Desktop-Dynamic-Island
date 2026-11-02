/** Required elements fail at startup with a useful selector instead of a later null access. */
export function $<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

export const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  root.querySelectorAll<T>(selector);
