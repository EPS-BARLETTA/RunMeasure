// js/chrono12.js
// Chrono 12 minutes (même logique que 6min, durée fixe = 12:00)

(function () {
  const ready = () => document.readyState === "interactive" || document.readyState === "complete";
  if (!ready()) document.addEventListener("DOMContentLoaded", init);
  else init();

  function init() {
    // Éléments
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
    const TARGET_SECS = 12 * 60;
    let running = false;
    let startTime = 0;
    let rafId = 0;

    // Mesures
    let extraLaps = 0;
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
      const elapsed = now - startTime;
      const remaining = (TARGET_SECS * 1000) - elapsed;

      if (remaining <= 0) {
        updateDisplay(0);
        stopChrono(true);
        return;
      }

      if (now - lastRender > 15) {
        updateDisplay(remaining);
        lastRender = now;
      }
      rafId = requestAnimationFrame(loop);
    };

    function startChrono() {
      if (!nom.value.trim() || !prenom.value.trim() || !classe.value.trim()) {
        alert('Merci de renseigner Nom, Prénom et Classe.');
        return;
      }
      // Reset mesures
      extraLaps = 0;
      display.textContent = '12:00';
      toggleLast10(display, false);

      setButtons(true);
      startTime = performance.now();
      lastRender = startTime;
      rafId = requestAnimationFrame(loop);
    }

    function stopChrono(auto = false) {
      if (!running) return;
      cancelAnimationFrame(rafId);
      setButtons(false);

      const lapLen = Math.max(0, parseFloat(lapLenInput.value || '0'));
      const totalMeters = Math.round(extraLaps * lapLen);

      const payload = {
        mode: "12min",
        nom: nom.value.trim(),
        prenom: prenom.value.trim(),
        classe: classe.value.trim(),
        duree_s: TARGET_SECS,
        distance_m: totalMeters
      };

      // QR + CSV
      makeQRCode(qrBox, payload);
      saveRowToCsv({
        nom: payload.nom,
        prenom: payload.prenom,
        classe: payload.classe,
        mode: payload.mode,
        duree_s: payload.duree_s,
        distance_m: payload.distance_m
      }, 'mc_12min');
    }

    function resetChrono() {
      cancelAnimationFrame(rafId);
      running = false;
      display.textContent = '12:00';
      toggleLast10(display, false);
      setButtons(false);
      extraLaps = 0;
      if (qrBox) qrBox.innerHTML = '';
    }

    // Événements
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

    on(saveCsvBtn, 'click', () => {
      exportCsvFromStore('mc_12min', 'multichrono_12min.csv');
    });

    // État initial
    setButtons(false);
    updateDisplay(TARGET_SECS * 1000);
  }
})();
