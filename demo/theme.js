import { themeValue } from './model.js';

const media = window.matchMedia('(prefers-color-scheme: dark)');
let preference = 'system';
try { preference = themeValue(localStorage.getItem('dread-demo-theme')); }
catch { preference = 'system'; } // Browser may deny storage; System remains usable.

function apply() {
  document.documentElement.dataset.theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
}
apply();
media.addEventListener('change', apply);
window.addEventListener('storage', event => {
  if (event.key === 'dread-demo-theme' || event.key === null) {
    preference = themeValue(event.newValue);
    apply();
  }
});
window.addEventListener('dread-demo-theme', event => {
  if (!(event instanceof CustomEvent)) return;
  preference = themeValue(event.detail);
  try { localStorage.setItem('dread-demo-theme', preference); }
  catch { /* Selection still applies for this page when storage is unavailable. */ }
  apply();
});
