// js/chrono12.js
// Chrono 12 minutes (même logique que 6min, durée = 12:00)

(function () {
  const pageReady = () => document.readyState === "interactive" || document.readyState === "complete";
  if (!pageReady()) document.addEventListener("DOMContentLoaded", init);
  else init();

  function init() {
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

    const TARGET_SECS = 12 * 60;
    let running = false;
    let startTime = 0;
    let rafId = 0;
    let extraLaps = 0;
    let lastRender = 0;

    const setButtons = (isRunning) => {
      running = isRunning;
      startBtn.disabled = isRunning;
      stopBtn.disabled = !isRunning;
      resetBtn.disabled = isRunning;
      incBtns.forEach(b => b.disabled = !isRunning ? true : false);
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

    const startChrono = () => {
      if (!nom.value || !prenom.value || !classe.value) {
        alert("Veuillez saisir Nom, Prénom et Classe");
        return;
      }
      startTime = performance.now();
      extraLaps = 0;
      setButtons(true);
      loop();
    };

    const stopChrono = (auto = false) => {
      cancelAnimationFrame(rafId);
      setButtons(false);

      const totalTime = TARGET_SECS;
      const totalMeters = (parseFloat(lapLenInput.value) || 0) * extraLaps;

      const data = {
        nom: nom.value,
        prenom: prenom.value,
        classe: classe.value,
        temps: totalTime,
        distance: totalMeters
      };

      makeQRCode(qrBox, data);
      saveRowToCsv(data, "chrono12");
    };

    const resetChrono = () => {
      cancelAnimationFrame(rafId);
      updateDisplay(TARGET_SECS * 1000);
      setButtons(false);
      qrBox.innerHTML = '';
      extraLaps = 0;
    };

    startBtn.addEventListener("click", startChrono);
    stopBtn.addEventListener("click", () => stopChrono(false));
    resetBtn.addEventListener("click", resetChrono);

    incBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        extraLaps += parseFloat(btn.dataset.inc);
      });
    });

    saveCsvBtn.addEventListener("click", () => {
      exportCsvFromStore("chrono12", "chrono12.csv");
    });

    // Init affichage
    updateDisplay(TARGET_SECS * 1000);
    setButtons(false);
  }
})();
