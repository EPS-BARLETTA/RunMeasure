// js/duel.js
(function () {
  const ready = () => document.readyState === "interactive" || document.readyState === "complete";
  if (!ready()) document.addEventListener("DOMContentLoaded", init);
  else init();

  function init() {
    const lapLenInput = qs('#lapLen');

    // Boutons principaux
    const startBtn = qs('#startBtn');
    const resetBtn = qs('#resetBtn');
    const stopA = qs('#stopA');
    const stopB = qs('#stopB');
    const incA = $all('[data-inc-a]');
    const incB = $all('[data-inc-b]');
    const genQR = qs('#genQR');
    const qrBox = qs('#qrcode');
    const saveCsvBtn = qs('#saveCsv');

    // Infos élève A
    const nomA = qs('#nomA');
    const prenomA = qs('#prenomA');
    const classeA = qs('#classeA');
    const displayA = qs('#displayA');

    // Infos élève B
    const nomB = qs('#nomB');
    const prenomB = qs('#prenomB');
    const classeB = qs('#classeB');
    const displayB = qs('#displayB');

    let running = false;
    let startTime = 0;
    let timeA = null;
    let timeB = null;
    let lapsA = 0;
    let lapsB = 0;
    let rafId = null;

    function fmt(s) {
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(Math.floor(s % 60)).padStart(2, '0');
      return `${mm}:${ss}`;
    }

    function updateDisplays() {
      if (!running) return;
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      if (timeA === null) displayA.textContent = fmt(elapsed);
      if (timeB === null) displayB.textContent = fmt(elapsed);
      rafId = requestAnimationFrame(updateDisplays);
    }

    function startDuel() {
      if (!nomA.value || !prenomA.value || !classeA.value ||
          !nomB.value || !prenomB.value || !classeB.value) {
        alert("Veuillez remplir les infos des deux coureurs");
        return;
      }
      running = true;
      startTime = performance.now();
      timeA = null;
      timeB = null;
      lapsA = 0;
      lapsB = 0;

      startBtn.disabled = true;
      resetBtn.disabled = false;
      stopA.disabled = false;
      stopB.disabled = false;
      incA.forEach(b => b.disabled = false);
      incB.forEach(b => b.disabled = false);
      genQR.disabled = false;

      updateDisplays();
    }

    function stopRunner(which) {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      if (which === 'A' && timeA === null) {
        timeA = elapsed;
        stopA.disabled = true;
        incA.forEach(b => b.disabled = true);
      }
      if (which === 'B' && timeB === null) {
        timeB = elapsed;
        stopB.disabled = true;
        incB.forEach(b => b.disabled = true);
      }
      if (timeA !== null && timeB !== null) {
        running = false;
        cancelAnimationFrame(rafId);
      }
    }

    function resetDuel() {
      running = false;
      cancelAnimationFrame(rafId);
      startBtn.disabled = false;
      resetBtn.disabled = true;
      stopA.disabled = true;
      stopB.disabled = true;
      incA.forEach(b => b.disabled = true);
      incB.forEach(b => b.disabled = true);
      genQR.disabled = true;
      displayA.textContent = "00:00";
      displayB.textContent = "00:00";
      qrBox.innerHTML = '';
    }

    function addLap(which, value) {
      if (which === 'A') lapsA += parseFloat(value);
      if (which === 'B') lapsB += parseFloat(value);
    }

    function generateQR() {
      if (timeA === null || timeB === null) {
        alert("Les deux coureurs doivent avoir terminé");
        return;
      }
      const distTour = parseFloat(lapLenInput.value) || 0;
      const data = {
        eleves: [
          {
            nom: nomA.value,
            prenom: prenomA.value,
            classe: classeA.value,
            temps: timeA,
            distance: lapsA * distTour
          },
          {
            nom: nomB.value,
            prenom: prenomB.value,
            classe: classeB.value,
            temps: timeB,
            distance: lapsB * distTour
          }
        ]
      };
      makeQRCode(qrBox, data);
      saveRowToCsv(data.eleves[0], "duel");
      saveRowToCsv(data.eleves[1], "duel");
    }

    function saveCsv() {
      exportCsvFromStore("duel", "duel.csv");
    }

    startBtn.addEventListener("click", startDuel);
    resetBtn.addEventListener("click", resetDuel);
    stopA.addEventListener("click", () => stopRunner('A'));
    stopB.addEventListener("click", () => stopRunner('B'));
    incA.forEach(b => b.addEventListener("click", () => addLap('A', b.dataset.incA)));
    incB.forEach(b => b.addEventListener("click", () => addLap('B', b.dataset.incB)));
    genQR.addEventListener("click", generateQR);
    saveCsvBtn.addEventListener("click", saveCsv);
  }
})();
