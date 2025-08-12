
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const type=qs('#testType'), palier=qs('#palier'), niv=qs('#niv'), nav=qs('#nav'), vma=qs('#vma');
    const v_nom=qs('#v_nom'), v_prenom=qs('#v_prenom'), v_classe=qs('#v_classe'), v_sexe=qs('#v_sexe');
    const qr=qs('#qr_vma');
    const speedsLeger = [8,9,10,11,12,12.5,13,13.5,14,14.5,15,15.5,16,16.5,17]; // approx per level

    function calcVMA(){
      const t = type.value;
      if(t==='vameval'){
        // VMA = 8 + 0.5 * palier
        return 8 + 0.5 * (parseFloat(palier.value)||0);
      } else if(t==='leger'){
        // Approx: base speed = array[level-1], + small increment with shuttle
        const L = Math.max(1, (parseInt(niv.value)||1));
        const S = Math.max(1, (parseInt(nav.value)||1));
        const base = speedsLeger[Math.min(L-1, speedsLeger.length-1)];
        const inc = Math.min((S-1)*0.1, 0.5); // small increment per shuttle
        return base + inc;
      } else {
        return parseFloat(vma.value)||0;
      }
    }

    function toggleFields(){
      const t = type.value;
      $all('[data-vameval]').forEach(e=> e.style.display = t==='vameval' ? '' : 'none');
      $all('[data-leger]').forEach(e=> e.style.display = t==='leger' ? '' : 'none');
      $all('[data-direct]').forEach(e=> e.style.display = t==='direct' ? '' : 'none');
    }

    on(type,'change', toggleFields);
    toggleFields();

    on(qs('#genVMA'),'click', ()=>{
      const v = Math.round(calcVMA()*10)/10;
      const payload = {
        mode:'vma',
        test:type.value,
        nom:v_nom.value.trim(), prenom:v_prenom.value.trim(), classe:v_classe.value.trim(), sexe:v_sexe.value || '',
        vma_kmh: v
      };
      makeQRCode(qr, payload);
    });
  });
})();
