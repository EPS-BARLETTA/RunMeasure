// js/csv.js
// Stockage temporaire et export CSV pour MultiChrono

const csvStore = {};

window.saveRowToCsv = (row, key) => {
  if (!csvStore[key]) csvStore[key] = [];
  csvStore[key].push(row);
};

window.exportCsvFromStore = (key, filename) => {
  if (!csvStore[key] || csvStore[key].length === 0) {
    alert("Aucune donnée à exporter.");
    return;
  }
  const rows = csvStore[key];
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(";"),
    ...rows.map(r => headers.map(h => r[h] ?? "").join(";"))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename || "export.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
