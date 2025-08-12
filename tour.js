(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const nom=qs('#nom'), prenom=qs('#prenom'), classe=qs('#classe');
    const totalDist=qs('#totalDist'), lapLen=qs('#lapLen'), affichage=qs('#affichage');
    const display=qs('#display'), start=qs('#startBtn'), stop=qs('#stopBtn'), reset=qs('#resetBtn'), split=qs('#splitBtn');
    const lapsBody=qs('#lapsBody'), lapsPlanned=qs('#lapsPlanned'), lapsDone=qs('#lapsDone'), totalTime=qs('#totalTime'), avgSpeed=qs('#avgSpeed');
    const qr=qs('#qrcode'), saveCsv=qs('#saveCsv');

    let running=false, t0=0, raf=0, lastSplit=0, splits=[];

    const tick=()=>{ display.textContent = formatSec((performance.now()-t0)/1000); raf=requestAnimationFrame(tick); };
    const plannedLaps=()=>{ const L=parseFloat(lapLen.value)||200; const T=parseFloat(totalDist.value)||0; return L>0? Math.round(T/L):0; };
    const speedKmh=(m,s)=> s>0? Math.round((m/s)*3.6*10)/10 : 0;

    function renderTable(){
      lapsBody.innerHTML=''; let cum=0, prev=null; const L=parseFloat(lapLen.value)||0;
      splits.forEach((s,i)=>{
        cum+=s; const v=speedKmh(L,s); const delta = prev==null?0:Math.round((s-prev)*100)/100;
        const timeTxt = (affichage.value==='inter')? s.toFixed(2) : cum.toFixed(2);
        const deltaClass = delta<0?'delta-pos':(delta>0?'delta-neg':'');
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${i+1}</td><td>${timeTxt}</td><td>${s.toFixed(2)}</td><td>${cum.toFixed(2)}</td><td>${v.toFixed(1)}</td><td class="${deltaClass}">${delta>0?'+':''}${delta.toFixed(2)}</td>`;
        lapsBody.appendChild(tr); prev=s;
      });
      lapsPlanned.value=String(plannedLaps()); lapsDone.value=String(splits.length);
      const tot = splits.reduce((a,b)=>a+b,0); totalTime.value = tot? formatSec(Math.round(tot)) + ` (${tot.toFixed(2)} s)` : '';
      const avg = tot? speedKmh((parseFloat(lapLen.value)||0)*splits.length, tot):0; avgSpeed.value = avg? `${avg.toFixed(1)} km/h` : '';
    }

    function setRun(r){ running=r; start.disabled=r; stop.disabled=!r; reset.disabled=r; split.disabled=!r; }

    on(start,'click',()=>{
      if(!nom.value||!prenom.value||!classe.value){ alert('Nom, Prénom, Classe.'); return; }
      splits=[]; lapsBody.innerHTML=''; lastSplit=0; display.textContent='00:00'; qr.innerHTML='';
      t0=performance.now(); setRun(true); tick(); renderTable();
    });

    on(split,'click',()=>{
      if(!running) return;
      const now=performance.now(); const elapsed=(now-t0)/1000; const s=elapsed-lastSplit; lastSplit=elapsed;
      splits.push(Math.max(0,s)); renderTable();
      if(splits.length>=plannedLaps() && plannedLaps()>0){ finish(); }
    });

    function finish(){
      cancelAnimationFrame(raf); setRun(false);
      const L=parseFloat(lapLen.value)||0; const T=parseFloat(totalDist.value)||0; const tot=splits.reduce((a,b)=>a+b,0);
      const payload={
        mode:'chrono_tour', nom:nom.value.trim(), prenom:prenom.value.trim(), classe:classe.value.trim(),
        total_distance_m:T, lap_distance_m:L, total_time_s:Math.round(tot),
        splits: splits.map((s,i)=>{ const cum=splits.slice(0,i+1).reduce((a,b)=>a+b,0);
          return {i:i+1, split_s:Math.round(s*100)/100, cum_s:Math.round(cum*100)/100, speed_kmh:Math.round((L/s)*3.6*10)/10, delta_s:i===0?0:Math.round((s-splits[i-1])*100)/100}; })
      };
      makeQRCode(qr,payload);
      saveRowToCsv({
        nom:payload.nom, prenom:payload.prenom, classe:payload.classe, mode:payload.mode,
        total_distance_m:payload.total_distance_m, lap_distance_m:payload.lap_distance_m,
        total_time_s:payload.total_time_s, splits: payload.splits.map(o=>`#${o.i}:${o.split_s}s`).join('|')
      }, 'mc_tour');
    }

    on(stop,'click',finish);
    on(reset,'click',()=>{ cancelAnimationFrame(raf); setRun(false); display.textContent='00:00'; splits=[]; lapsBody.innerHTML=''; qr.innerHTML=''; renderTable(); });
    on(saveCsv,'click',()=> exportCsvFromStore('mc_tour','multichrono_tour.csv'));

    renderTable();
  });
})();
