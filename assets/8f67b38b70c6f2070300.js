/* Shared, local-only manifest contract between Forecasting, the portal and BOL. */
globalThis.ColdTrackTransfer=(()=>{
'use strict';
const text=(v,max=500)=>typeof v==='string'&&v.length<=max,date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
function newId(){if(globalThis.crypto?.randomUUID)return crypto.randomUUID();const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
function validate(p,{allowLegacy=false}={}){
 if(!p||p.kind!=='coldtrack-forecast-transfer'||!(p.version===2||allowLegacy&&p.version===1)||!text(p.id,100)||!p.id||!['in','out'].includes(p.direction)||!text(p.client)||!p.client||!date(p.movementDate)||!text(p.asOf,30)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(p.asOf)||!text(p.stockName)||!['es','en'].includes(p.language)||!Number.isFinite(p.leadHours)||p.leadHours<0||p.leadHours>720||!Number.isFinite(p.keepDays)||p.keepDays<1||p.keepDays>90||!Array.isArray(p.lines)||!p.lines.length||p.lines.length>5000)throw Error('Regenerá el plan con pallets completos desde Forecasting / Regenerate a whole-pallet plan in Forecasting.');
 for(const key of ['pickingId','pickingNumber'])if(p[key]!==undefined&&(!text(p[key],100)||!p[key]))throw Error('Referencia de picking inválida / Invalid picking reference.');if(p.movementTime!==undefined&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.movementTime))throw Error('Hora de movimiento inválida / Invalid movement time.');
 const seen=new Set();for(const l of p.lines){if(!l||!text(l.sourceId)||!l.sourceId||seen.has(l.sourceId)||l.client!==p.client||!text(l.sku)||!l.sku||!text(l.name,1500)||!l.name||!text(l.lot)||!text(l.lpn)||!text(l.location)||l.expiration!==null&&!date(l.expiration)||!Number.isFinite(l.qty)||l.qty<=0||l.qty>1e12||['requestAt','neededAt','arrivalAt'].some(k=>l[k]!==null&&!Number.isFinite(l[k])))throw Error('Revisá cliente, lotes y cantidades / Check client, lots and quantities.');seen.add(l.sourceId);}
 if(p.version===2){
  if(p.wholePallets!==true||!Array.isArray(p.pallets)||!p.pallets.length)throw Error('Solo se permiten pallets completos / Whole pallets only.');
  const accounted=new Set(),lpns=new Set();for(const pallet of p.pallets){if(!pallet||!text(pallet.lpn)||!pallet.lpn||lpns.has(pallet.lpn)||pallet.client!==p.client||!text(pallet.location)||!Array.isArray(pallet.sourceIds)||!pallet.sourceIds.length||new Set(pallet.sourceIds).size!==pallet.sourceIds.length||!Number.isFinite(pallet.units)||pallet.units<=0)throw Error('LPN completo inválido / Invalid whole LPN.');lpns.add(pallet.lpn);const lines=p.lines.filter(l=>l.lpn===pallet.lpn);if(lines.length!==pallet.sourceIds.length||lines.some(l=>!pallet.sourceIds.includes(l.sourceId)||l.location!==pallet.location||!Number.isFinite(l.sourceUnits)||Math.abs(l.qty-l.sourceUnits)>1e-6)||new Set(lines.map(l=>l.sku)).size!==1||Math.abs(lines.reduce((s,l)=>s+l.qty,0)-pallet.units)>1e-6)throw Error('No se permite fraccionar un pallet / A pallet cannot be split.');for(const l of lines)accounted.add(l.sourceId);}
  if(accounted.size!==p.lines.length)throw Error('Falta contenido del LPN / Missing LPN contents.');
 }
 if(p.rotation!==undefined){
  const r=p.rotation,key=p.direction==='in'?'incomingLpn':'outgoingLpn';
  if(!r||r.kind!=='fefo-replacement'||r.receiveBeforeRelease!==true||!Array.isArray(r.pairs)||!r.pairs.length||r.pairs.length>5000||new Set(r.pairs.map(a=>a?.[key])).size!==r.pairs.length||r.pairs.some(a=>!a||!text(a.incomingLpn)||!a.incomingLpn||!text(a.outgoingLpn)||!a.outgoingLpn||a.incomingLpn===a.outgoingLpn||!date(a.incomingExpiry)||!date(a.outgoingExpiry)||a.incomingExpiry>=a.outgoingExpiry||!p.pallets?.some(b=>b.lpn===a[key]))||p.pallets?.some(b=>!r.pairs.some(a=>a[key]===b.lpn)))throw Error('Reemplazo FEFO inválido / Invalid FEFO replacement.');
 }
 return p;
}
function rotationNote(p,language=p.language){if(!p.rotation)return '';const en=language==='en';return (en?'FEFO replacement. Receive and verify the Vertical pallets BEFORE releasing their ColdTrack counterparts.':'Reemplazo FEFO. Recibir y verificar las pallets de Vertical ANTES de liberar sus reemplazos de ColdTrack.')+'\n'+p.rotation.pairs.map(a=>(en?'Receive ':'Recibir ')+a.incomingLpn+' / '+(en?'release ':'liberar ')+a.outgoingLpn).join('\n');}
function toBOL(payload,defaults={}){const p=validate(payload),en=p.language==='en',direction=p.direction==='in'?'Vertical Cold → ColdTrack':'ColdTrack → Vertical Cold',note=en?'Whole pallets only. Full LPN quantities in WMS base units (Total Units).':'Pallets completos. Cantidad total del LPN en unidades base del WMS (Total Units).',counted=new Set();
 return {bol:defaults.bol||'OST-'+p.movementDate.replaceAll('-','')+'-'+p.id.replace(/[^a-zA-Z0-9]/g,'').slice(-6).toUpperCase(),shipDate:p.movementDate,destination:p.direction==='in'?'ColdTrack':'Vertical Cold',loadStatus:'Partial',appointment:'',appointmentTime:'',carrier:'',driver:'',truck:'',seal:'',departure:p.movementTime||'',reference:p.client+' | '+(p.direction==='in'?'VERTICAL-IN':'VERTICAL-OUT')+' | '+(p.pickingNumber||p.id.slice(0,8)),shipFrom:'',shipTo:'',notes:direction+'\n'+note+(p.rotation?'\n'+rotationNote(p):'')+(p.pickingNumber?'\nPicking: '+p.pickingNumber:''),shipper:'',signature:'',items:p.lines.map(l=>{const first=!counted.has(l.lpn);counted.add(l.lpn);return {item:l.sku,name:l.name,lot:l.lot,expiration:l.expiration||'',pallets:first?'1':'0',qty:String(l.qty),weight:'',lpn:l.lpn,location:l.location};}),forecastTransfer:structuredClone(p)};
}
function itemsFingerprint(items){const keys=['item','name','lot','expiration','lpn','location'];return JSON.stringify(items.map(r=>JSON.stringify([...keys.map(k=>String(r[k]||'')),Number(r.qty),Number(r.pallets)])).sort());}
function validateEditedPallets(items){
 if(!Array.isArray(items)||!items.length||items.length>5000)throw Error('Agregá al menos un pallet completo / Add at least one whole pallet.');
 const groups=new Map();for(const r of items){if(!r||!text(r.lpn)||!r.lpn.trim()||!text(r.location)||!r.location.trim()||!Number.isFinite(Number(r.qty))||Number(r.qty)<=0||Number(r.qty)>1e12||!Number.isInteger(Number(r.pallets))||Number(r.pallets)<0||Number(r.pallets)>1)throw Error('Completá LPN, ubicación y cantidad total. Cada LPN cuenta como un pallet / Complete LPN, location and full quantity. Each LPN counts as one pallet.');if(!groups.has(r.lpn))groups.set(r.lpn,[]);groups.get(r.lpn).push(r);}
 for(const rows of groups.values())if(rows.reduce((s,r)=>s+Number(r.pallets),0)!==1||new Set(rows.map(r=>r.item)).size!==1||new Set(rows.map(r=>r.location)).size!==1)throw Error('Cada LPN debe contener un SKU en una ubicación y contar como un pallet / Each LPN must contain one SKU in one location and count as one pallet.');return true;
}
function validateBOL(d){const p=validate(d.forecastTransfer,{allowLegacy:true}),fingerprint=itemsFingerprint(d.items);if(p.version===2&&fingerprint===itemsFingerprint(toBOL(p).items))return true;if(!d.forecastEdits?.wholePalletsConfirmed||d.forecastEdits.itemsFingerprint!==fingerprint)throw Error('Confirmá que las cantidades corregidas representan pallets completos / Confirm that corrected quantities represent whole pallets.');validateEditedPallets(d.items);return true;}
return {validate,toBOL,validateBOL,itemsFingerprint,validateEditedPallets,newId,rotationNote};
})();

"use strict";
(() => {
  const $=id=>document.getElementById(id);
  const catalog=JSON.parse($("tool-catalog").textContent),documents=JSON.parse($("tool-documents").textContent);
  const groups=JSON.parse($("tool-groups").textContent);
  const routes=Object.fromEntries(catalog.map(tool=>[tool.id,{...tool,title:(tool.label===tool.title?tool.title:tool.label+" · "+tool.title)+" | ColdTrack"}]));
  routes.inicio={view:"hubView",heading:"hubTitle",label:"Inicio",title:"ColdTrack · Herramientas"};
  const loadedFrames=new Set();
  const frameLayouts=new Map();
  const opened=['inicio'],positions=new Map();
  const sidebar=$('workspaceSidebar'),tablist=$('workspaceTabs');
  const t=value=>globalThis.ColdTrackLanguage?.t(value)||value;
  const mobile=()=>window.matchMedia?window.matchMedia('(max-width:820px)').matches:window.innerWidth<=820;
  let activeName='inicio',lastName=null,menuFocus=null,focusTabAfterRoute=null;
  try{document.body.classList.toggle('workspace-collapsed',localStorage.getItem('coldtrack-workspace-sidebar-v1')==='collapsed');}catch(_){}
  function setMenu(open,restoreFocus=true){
    open=Boolean(open&&mobile());
    if(open&&!document.body.classList.contains('workspace-menu-open'))menuFocus=document.activeElement;
    document.body.classList.toggle('workspace-menu-open',open);
    $('workspaceScrim').hidden=!open;
    $('workspaceMobileToggle').setAttribute('aria-expanded',String(open));
    if(open){sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');}
    else{sidebar.removeAttribute('role');sidebar.removeAttribute('aria-modal');}
    for(const element of document.querySelectorAll('body>main,body>#workspaceHeader')){
      if(open)element.setAttribute('inert','');else element.removeAttribute('inert');
    }
    if(open)$('workspaceCloseMenu').focus();
    else if(restoreFocus&&menuFocus){menuFocus.focus?.({preventScroll:true});menuFocus=null;}
  }
  function refreshSidebar(){
    const collapsed=document.body.classList.contains('workspace-collapsed');
    const label=t(collapsed?'Expandir menú':'Contraer menú');
    $('workspaceCollapse').setAttribute('aria-expanded',String(!collapsed));
    $('workspaceCollapse').setAttribute('aria-label',label);$('workspaceCollapse').title=label;
  }
  function collapseSidebar(collapsed){
    document.body.classList.toggle('workspace-collapsed',collapsed);
    try{localStorage.setItem('coldtrack-workspace-sidebar-v1',collapsed?'collapsed':'expanded');}catch(_){}
    refreshSidebar();window.dispatchEvent(new Event('resize'));
  }
  $('workspaceCollapse').addEventListener('click',()=>collapseSidebar(!document.body.classList.contains('workspace-collapsed')));
  $('workspaceMobileToggle').addEventListener('click',()=>setMenu(!document.body.classList.contains('workspace-menu-open')));
  $('workspaceCloseMenu').addEventListener('click',()=>setMenu(false));
  $('workspaceScrim').addEventListener('click',()=>setMenu(false));
  sidebar.addEventListener('click',event=>{
    const summary=event.target.closest('.workspace-nav-group>summary');
    if(summary&&!mobile()&&document.body.classList.contains('workspace-collapsed')){
      event.preventDefault();collapseSidebar(false);summary.parentElement.open=true;
    }
  });
  sidebar.addEventListener('keydown',event=>{
    if(!document.body.classList.contains('workspace-menu-open'))return;
    if(event.key==='Escape'){event.preventDefault();setMenu(false);return;}
    if(event.key!=='Tab')return;
    const nodes=[...sidebar.querySelectorAll('a,button,select,summary')].filter(node=>!node.disabled&&node.getClientRects().length);
    const first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
  function tabLabel(name){
    if(name==='inventory-finder')return 'Item Lookup';
    const short={'inactive-items':'Sin movimiento','bol':'BOL','destruction':'Destrucción','product-incidents':'Incidencias'};
    return t(short[name]||routes[name].label);
  }
  function renderTabs(){
    tablist.setAttribute('aria-label',t('Herramientas abiertas'));
    for(const node of [...tablist.children])if(!opened.includes(node.dataset.workspaceTab))node.remove();
    for(const name of opened){
      let node=[...tablist.children].find(node=>node.dataset.workspaceTab===name);
      if(!node){
        node=document.createElement('div');node.className='workspace-tab';node.dataset.workspaceTab=name;node.setAttribute('role','presentation');
        const link=document.createElement('a');link.href='#'+name;link.id='workspace-tab-'+name;link.dataset.toolRoute=name;link.setAttribute('role','tab');link.setAttribute('aria-controls',routes[name].view);
        const icon=sidebar.querySelector('[data-tool-route="'+name+'"]>svg');if(icon)link.append(icon.cloneNode(true));
        link.append(document.createElement('span'));node.append(link);
        if(name!=='inicio'){
          const close=document.createElement('button');close.type='button';close.className='workspace-tab-close';close.dataset.workspaceClose=name;close.innerHTML='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m4 4 8 8M4 12l8-8"/></svg>';node.append(close);
        }
        tablist.append(node);
      }
      const link=node.querySelector('[role="tab"]'),selected=name===activeName;
      node.classList.toggle('is-active',selected);link.classList.toggle('is-active',selected);
      link.querySelector('span').textContent=tabLabel(name);link.title=tabLabel(name);
      link.setAttribute('aria-selected',String(selected));link.tabIndex=selected?0:-1;
      if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
      const close=node.querySelector('button');if(close){close.title=t('Cerrar pestaña')+': '+tabLabel(name);close.setAttribute('aria-label',close.title);close.tabIndex=selected?0:-1;}
      $(routes[name].view).setAttribute('aria-labelledby',link.id);
    }
  }
  tablist.setAttribute('data-no-i18n','');
  function go(name,tabFocus=false){
    if(!Object.hasOwn(routes,name))return;
    focusTabAfterRoute=tabFocus?name:null;
    if(window.location.hash==='#'+name)showRoute(!tabFocus);else window.location.hash=name;
  }
  function closeTab(name){
    const index=opened.indexOf(name);if(name==='inicio'||index<0)return;
    opened.splice(index,1);
    $(routes[name].view).removeAttribute('aria-labelledby');
    if(activeName===name)go(opened[Math.max(0,index-1)]||'inicio',true);
    else renderTabs();
    // Closing a tab hides it; its mounted form remains available if reopened.
  }
  tablist.addEventListener('click',event=>{
    const close=event.target.closest('[data-workspace-close]');
    if(close){event.preventDefault();closeTab(close.dataset.workspaceClose);return;}
    const tab=event.target.closest('[role="tab"]');if(tab){event.preventDefault();go(tab.dataset.toolRoute,true);}
  });
  tablist.addEventListener('keydown',event=>{
    const tab=event.target.closest('[role="tab"]');if(!tab)return;
    const index=opened.indexOf(tab.dataset.toolRoute);let next=null;
    if(event.key==='ArrowRight')next=opened[(index+1)%opened.length];
    if(event.key==='ArrowLeft')next=opened[(index-1+opened.length)%opened.length];
    if(event.key==='Home')next=opened[0];if(event.key==='End')next=opened.at(-1);
    if(event.key==='Delete'&&tab.dataset.toolRoute!=='inicio'){event.preventDefault();closeTab(tab.dataset.toolRoute);return;}
    if(next){event.preventDefault();go(next,true);}
  });
  function watchFrame(frame){
    const doc=frame.contentDocument;
    if(!doc?.body||!doc.documentElement.dataset.ctTool)return;
    frameLayouts.get(frame.id)?.disconnect();
    let scheduled=false;
    const update=()=>{
      scheduled=false;
      if(frame.closest('main').hidden)return;
      const height=Math.ceil(doc.body.getBoundingClientRect().height)+2;
      if(height>2&&Math.abs((parseFloat(frame.style.height)||0)-height)>1)frame.style.height=height+'px';
    };
    const queue=()=>{if(!scheduled){scheduled=true;if(window.requestAnimationFrame)window.requestAnimationFrame(update);else window.setTimeout(update,0);}};
    const resize=typeof ResizeObserver==='function'?new ResizeObserver(queue):null;
    resize?.observe(doc.body);
    const changes=new MutationObserver(queue);changes.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true});
    doc.body.addEventListener('load',queue,true);
    doc.fonts?.ready.then(queue);
    frameLayouts.set(frame.id,{queue,disconnect(){resize?.disconnect();changes.disconnect();doc.body.removeEventListener('load',queue,true);}});
    queue();
  }
  const loadingFrames=new Map();
  async function loadTool(name,route){
    if(route.section==='supervisor'&&!ColdTrackSupervisor.unlocked)return;
    if(!route.frame||loadedFrames.has(name))return;
    if(loadingFrames.has(name))return loadingFrames.get(name);
    const task=(async()=>{await ColdTrackCloud.root.prepare(name);const response=await fetch(route.source,{cache:'no-store'});if(!response.ok)throw Error('No se pudo cargar la herramienta.');const source=await response.text();const frame=$(route.frame);frame.addEventListener('load',()=>watchFrame(frame));frame.srcdoc=source;loadedFrames.add(name);})();loadingFrames.set(name,task);try{await task;}finally{loadingFrames.delete(name);}
  }
  let exportedSnapshot=false;
  try{exportedSnapshot=JSON.parse($("demo-state").textContent).exportedSnapshot===true;}catch{}
  let requestedGate=null;
  function showRoute(focus=false){
    const hash=window.location.hash.slice(1).toLowerCase();
    const requested=Object.hasOwn(routes,hash)?hash:!hash&&exportedSnapshot?"pressed":"inicio";
    let name=requested;
    if(routes[requested].section==='supervisor'&&!ColdTrackSupervisor.unlocked){
      name='inicio';
      if(requestedGate!==requested){
        requestedGate=requested;
        ColdTrackSupervisor.request().then(allowed=>{
          if(requestedGate!==requested)return;
          requestedGate=null;
          if(!allowed)history.replaceState(null,'','#inicio');
          showRoute(true);
        });
      }
    }else requestedGate=null;
    if(lastName!==name&&lastName!==null)positions.set(lastName,window.scrollY||0);
    activeName=name;
    if(!opened.includes(name))opened.push(name);
    for(const [key,route] of Object.entries(routes)){$(route.view).hidden=key!==name;$(route.view).setAttribute('role','tabpanel');}
    $("pressedActions").hidden=name!=="pressed";
    $("toolNav").hidden=name==="inicio";
    $("activeToolLabel").textContent=name==="inicio"?"":t(routes[name].label);
    $('workspaceAreaLabel').textContent=t(groups.find(group=>group.id===routes[name].group)?.title||'Stockers');
    renderTabs();
    for(const link of document.querySelectorAll('[data-tool-route]')){
      const active=link.dataset.toolRoute===name;link.classList.toggle('is-active',active);
      if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    }
    for(const details of sidebar.querySelectorAll('[data-workspace-group]')){
      const active=details.dataset.workspaceGroup===routes[name].group;
      details.classList.toggle('has-active',active);
      if(active&&lastName!==name)details.open=true;
    }
    loadTool(name,routes[name]);
    if(routes[name].frame)frameLayouts.get(routes[name].frame)?.queue();
    document.title=t(routes[name].title);
    if(lastName!==name){
      if(mobile())setMenu(false,false);
      if(focus)$(routes[name].heading||routes[name].view).focus({preventScroll:true});
      window.scrollTo({top:positions.get(name)||0,behavior:"auto"});
      $('workspace-tab-'+name)?.scrollIntoView?.({block:'nearest',inline:'nearest'});
    }
    lastName=name;
    if(focusTabAfterRoute===name){$('workspace-tab-'+name)?.focus({preventScroll:true});focusTabAfterRoute=null;}
  }
  window.addEventListener("hashchange",()=>showRoute(true));
  window.addEventListener('coldtrack-supervisor-change',()=>{
    if(!ColdTrackSupervisor.unlocked){
      requestedGate=null;history.replaceState(null,'','#inicio');
      for(let i=opened.length-1;i>=0;i--)if(routes[opened[i]].section==='supervisor')opened.splice(i,1);
    }
    showRoute();
  });
  window.addEventListener('coldtrack-language-change',()=>{refreshSidebar();showRoute();});
  window.addEventListener('resize',()=>{if(!mobile())setMenu(false,false);for(const layout of frameLayouts.values())layout.queue();});
  refreshSidebar();
  showRoute();
  let openingBOL=false;
  globalThis.ColdTrackHub={async prepareBOL(payload){
    if(openingBOL)throw Error('El BOL se está preparando / BOL is being prepared.');
    const plan=ColdTrackTransfer.validate(structuredClone(payload));openingBOL=true;
    try{
      if(!ColdTrackSupervisor.unlocked&&!await ColdTrackSupervisor.request())throw Error('Acceso de Supervisor cancelado / Supervisor access cancelled.');
      const route=routes.bol;await loadTool('bol',route);window.location.hash='bol';showRoute(true);
      const frame=$(route.frame),started=Date.now();
      const receiver=await new Promise((resolve,reject)=>{function check(){const receive=frame.contentWindow?.ColdTrackBOL?.receiveForecast;if(receive)return resolve(receive);if(Date.now()-started>12000)return reject(Error('No se pudo abrir BOL. Descargá sus datos e importalos en BOL / Could not open BOL. Download its data and import in BOL.'));setTimeout(check,50);}check();});
      return receiver(plan);
    }finally{openingBOL=false;}
  }};
})();
