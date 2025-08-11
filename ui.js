
// Utils
window.qs = (s, el=document) => el.querySelector(s);
window.$all = (s, el=document) => Array.from(el.querySelectorAll(s));
window.on = (el, ev, fn) => el && el.addEventListener(ev, fn);
window.debounce = (fn, wait=200) => { let t=0; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; };
window.formatSec = (s) => { s=Math.max(0,Math.round(s)); const m=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${m}:${ss}`; };
window.toggleLast10 = (el, on) => el && el.classList.toggle('blink', !!on);

// Theme
(function(){
  const key='multichrono_theme';
  const saved=localStorage.getItem(key);
  const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved ? saved==='dark' : prefers;
  document.documentElement.classList.toggle('dark', initial);
  document.addEventListener('DOMContentLoaded', ()=>{
    const t = qs('#darkToggle');
    if(t){ t.checked = initial; on(t,'change', e=>{
      document.documentElement.classList.toggle('dark', e.target.checked);
      localStorage.setItem(key, e.target.checked ? 'dark':'light');
    });}
  });
})();
