// js/chrono.js
// Gestion du chrono 6 minutes + incréments de tours + QR + CSV

(function () {
  const pageReady = () => document.readyState === "interactive" || document.readyState === "complete";
  if (!pageReady()) document.addEventListener("DOMContentLoaded", init);
  else init();

  function init() {
    // Elements
    const nom = qs('#nom');
    const prenom = qs('#prenom');
    const classe = qs('#classe');
    const lapLenInput = qs('#lapLen');

    const display = qs('#display');
    const startBtn = qs('#startBtn');
    const stopBtn = qs('#stopBtn');
    const resetBtn = qs('#resetBtn');
    const incBtns = $all('.mc-increments .mc-chip');
    const qrBox = qs('#qrcode');
    const saveCsvBtn = qs('#saveCsv');

    // Constantes
    const TARGET_SECS = 6 * 60; // 6 minutes
    let running = false;
    let startTime = 0;      // performance.now() au démarrage
    let pausedElapsed = 0;  // ms écoulées si on implémente pause plus tard
    let rafId = 0;

    // Mesures
    let extraLaps = 0;      // somme des +1, +1/2, +1/4 etc. pendant la course
    let lastRender = 0;

    // Helpers
    const setButtons = (isRunning) => {
      running = isRunning;
      startBtn.disabled = isRunning;
      stopBtn.disabled = !isRunning;
      resetBtn.disabled = isRunning;
      incBtns.forEach(b => b.disabled = !isRunning);
    };

    const fmt = (s) => {
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      return `${mm}:${ss}`;
    };

    const updateDisplay = (remainingMs) => {
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      display.textContent = fmt(remainingSec);
      toggleLast10(display, remainingSec <= 10);
    };

    const loop = () => {
      const now = performance.now();
      const elapsed = now - startTime + pausedElapsed;
      const remaining = (TARGET_SECS * 1000) - elapsed;

      if (remaining <= 0) {
        updateDisplay(0);
        stopChrono(true);
        return;
      }

      // Limit refresh to ~15ms
      if (now - lastRender > 15) {
        updateDisplay(remaining);
        lastRender = now;
      }
      rafId = requestAnimationFrame(loop);
    };

    function startChrono() {
      // Validation identité
      if (!nom.value.trim() || !prenom.value.trim() || !classe.value.trim()) {
        alert('Merci de renseigner Nom, Prénom et Classe.');
        return;
      }
      // Reset affichage / mesures
      display.textContent = '06:00';
      toggleLast10(display, false);
      extraLaps = 0;

      setButtons(true);
      startTime = performance.now();
      lastRender = startTime;
      rafId = requestAnimationFrame(loop);
    }

    function stopChrono(auto = false) {
      if (!running) return;
      cancelAnimationFrame(rafId);
      setButtons(false);

      // Calcul distance
      const lapLen = Math.max(0, parseFloat(lapLenInput.value || '0'));
      const totalMeters = Math.round(extraLaps * lapLen);

      // Préparer payload QR
      const payload = {
        mode: "6min",
        nom: nom.value.trim(),
        prenom: prenom.value.trim(),
        classe: classe.value.trim(),
        duree_s: TARGET_SECS,
        distance_m: totalMeters
      };

      // Afficher QR
      makeQRCode(qrBox, payload);

      // Enregistrer ligne pour export CSV
      saveRowToCsv({
        nom: payload.nom,
        prenom: payload.prenom,
        classe: payload.classe,
        mode: payload.mode,
        duree_s: payload.duree_s,
        distance_m: payload.distance_m
      }, 'mc_6min');
    }

    function resetChrono() {
      cancelAnimationFrame(rafId);
      running = false;
      pausedElapsed = 0;
      display.textContent = '06:00';
      toggleLast10(display, false);
      setButtons(false);
      extraLaps = 0;
      // Nettoyer QR
      if (qrBox) qrBox.innerHTML = '';
    }

    // Écoutes
    on(startBtn, 'click', debounce(startChrono, 200));
    on(stopBtn, 'click', debounce(() => stopChrono(false), 200));
    on(resetBtn, 'click', debounce(resetChrono, 200));

    incBtns.forEach(btn => {
      on(btn, 'click', debounce(() => {
        if (!running) return;
        const inc = parseFloat(btn.getAttribute('data-inc') || '0');
        if (!isFinite(inc) || inc <= 0) return;
        extraLaps += inc;
      }, 120));
    });

    // Export CSV (toutes les lignes de la séance)
    on(saveCsvBtn, 'click', () => {
      exportCsvFromStore('mc_6min', 'multichrono_6min.csv');
    });

    // État initial
    setButtons(false);
    display.textContent = '06:00';
  }
})();
