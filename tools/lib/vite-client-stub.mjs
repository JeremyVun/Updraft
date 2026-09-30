// Stands in for Vite's dev client so another session's source edit cannot reload a page mid-check,
// while modules that import it (stylesheets loaded as modules) still load.
const body = `
export const createHotContext = () => ({ accept() {}, dispose() {}, prune() {}, on() {}, off() {}, send() {}, invalidate() {}, data: {} });
const sheets = new Map();
export function updateStyle(id, css) {
  let sheet = sheets.get(id);
  if (!sheet) { sheet = document.createElement('style'); sheet.dataset.viteDevId = id; document.head.append(sheet); sheets.set(id, sheet); }
  sheet.textContent = css;
}
export function removeStyle(id) { sheets.get(id)?.remove(); sheets.delete(id); }
export const injectQuery = url => url;`;
export const withoutHotReload = page => page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body }));
