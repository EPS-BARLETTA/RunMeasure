
window.makeQRCode = (container, payload)=>{
  if(!container) return;
  container.innerHTML='';
  try{
    const text = JSON.stringify(payload);
    new QRCode(container,{text,width:220,height:220});
  }catch(e){ console.error(e); container.textContent='Erreur QR'; }
};
