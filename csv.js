
// Simple in-memory store + CSV export
const __store = {};
window.saveRowToCsv = (row, key) => {
  if(!__store[key]) __store[key] = [];
  __store[key].push(row);
};
window.exportCsvFromStore = (key, filename) => {
  const rows = __store[key]||[];
  if(!rows.length){ alert('Aucune donnée à exporter.'); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(';'), ...rows.map(r=>headers.map(h=>r[h]??'').join(';'))].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename||'export.csv'; a.click();
};
