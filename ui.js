// Sélecteurs rapides
window.qs = (sel, el = document) => el.querySelector(sel);
window.$all = (sel, el = document) => Array.from(el.querySelectorAll(sel));

// Formater millisecondes en mm:ss
window.formatMs = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

// Clignotement rouge pour dernières secondes
window.toggleLast10 = (el, on) => {
  if (!el) return;
  el.classList.toggle('blink', !!on);
};

// Anti double clic
window.debounce = (fn, wait = 200) => {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

// Gestion des événements simplifiée
window.on = (el, evt, handler) => {
  if (el) el.addEventListener(evt, handler);
};
