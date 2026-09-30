// Stands in for the dev server's /@vite/client so a src edit cannot reload a page mid-measurement. Stylesheets
// imported from modules (styles-qa.css hides the interface under ?shot) still need its style exports to load.
const body = `
const sheets = new Map();
export function updateStyle(id, css) {
  let sheet = sheets.get(id);
  if (!sheet) { sheet = document.createElement('style'); sheet.setAttribute('data-vite-dev-id', id); document.head.appendChild(sheet); sheets.set(id, sheet); }
  sheet.textContent = css;
}
export function removeStyle(id) { sheets.get(id)?.remove(); sheets.delete(id); }
export function createHotContext() {
  const noop = () => {};
  return { data: {}, accept: noop, acceptExports: noop, dispose: noop, prune: noop, invalidate: noop, on: noop, off: noop, send: noop };
}
export const injectQuery = url => url;
`;
export const stubViteClient = page => page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body }));
