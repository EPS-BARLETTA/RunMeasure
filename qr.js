// js/qr.js
// Génération de QR codes compatibles ScanProf

window.makeQRCode = (container, payload) => {
  if (!container) return;
  container.innerHTML = '';

  try {
    const text = JSON.stringify(payload);
    new QRCode(container, {
      text: text,
      width: 200,
      height: 200
    });
  } catch (err) {
    console.error("Erreur génération QR", err);
    container.textContent = "Erreur QR";
  }
};
