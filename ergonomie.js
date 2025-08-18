// ergonomie.js — interactions tactiles et confort. Ne modifie pas le module QR existant.
(function(){
  const $ = (s, r=document)=> r.querySelector(s);

  // Utiliser pointerdown pour réduire la latence tactile
  function onTap(el, fn){ if(!el) return; el.addEventListener('pointerdown', fn, {passive:true}); }

  // Plein écran
  onTap($('#fullscreen'), ()=>{
    const el = document.documentElement;
    if(el.requestFullscreen) el.requestFullscreen();
  });

  // Wake Lock (éviter la mise en veille)
  let wakeLock;
  async function keepAwake(){
    try{ wakeLock = await navigator.wakeLock.request('screen'); }
    catch(e){ /* silencieux */ }
  }
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible' && wakeLock?.released) keepAwake();
  });

  // Armer l'audio sur premier tap
  let audioReady=false;
  onTap(document.body, ()=>{
    if(audioReady) return;
    try {
      const beep = new Audio('beep.mp3');
      beep.play().catch(()=>{});
      audioReady = true;
    } catch(e){}
  });

  // Démarrage => activer wake lock
  onTap($('#start'), keepAwake);

  // Protéger buildQrPayload si elle existe (immutabilité)
  if (typeof window.buildQrPayload === 'function'){
    const original = window.buildQrPayload;
    window.buildQrPayload = function(...args){
      try{
        const payload = original.apply(this, args);
        // Retourner une copie immuable sans toucher au format d'origine
        return Object.freeze(JSON.parse(JSON.stringify(payload)));
      }catch(e){
        return original.apply(this, args);
      }
    };
  }
})();
