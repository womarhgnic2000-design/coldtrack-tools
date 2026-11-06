(() => {
  'use strict';
  const C=ColdTrackPackaging,A=ColdTrackData,L=ColdTrackPackagingLoader,$=id=>document.getElementById(id),seed=JSON.parse($('packaging-seed').textContent);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lang=()=>globalThis.ColdTrackLanguage?.current==='en'?'en':'es',t=(key,params={})=>Object.entries(params).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),ColdTrackPackagingCopy[lang()][key]||key);
  const fmt=value=>value===null||value===undefined?'—':new Intl.NumberFormat(lang()==='en'?'en-US':'es-US',{maximumFractionDigits:2}).format(value),date=value=>value?value.slice(5,7)+'-'+value.slice(8,10)+'-'+value.slice(0,4):'—';
  let settings={asOf:C.today(),period:30,threshold:30},record=null,stock=null,data=null,result=null,visible=[],base=[],page=0,busy=false,reporting=false,selected=null,range=12,sortKey='',direction=1,reloading=null,messageState=null;
  try{const saved=JSON.parse(localStorage.getItem('coldtrack-packaging-settings-v1'));if(saved&&C.validDate(saved.asOf)&&[7,14,30,60,90].includes(saved.period)&&[14,30,60,90].includes(saved.threshold))settings={...settings,period:saved.period,threshold:saved.threshold};}catch(_){}
  $('pgDate').value=settings.asOf;$('pgPeriod').value=String(settings.period);$('pgThreshold').value=String(settings.threshold);
  let portal=null,frame=null;try{if(parent!==window&&parent.ColdTrackHub){portal=parent;frame=frameElement;}}catch(_){}
  document.documentElement.dataset.pgEmbedded=String(!!portal);
  const sourceUsed=()=>{try{return localStorage.getItem('coldtrack-packaging-shared-v1')==='yes';}catch(_){return false;}};
  function message(key,error=false,params={}){messageState={key,error,params};$('pgMessage').textContent=t(key,params);$('pgMessage').dataset.error=String(error);$('pgMessage').hidden=false;}
  function errorMessage(error){const raw=error?.message||String(error);if(raw==='IMPORT_CANCELLED')return message('cancelled');let key=raw.startsWith('DUPLICATE_ID:')?'duplicate':raw.startsWith('INVALID_ROW:')?'invalidRow':raw==='FILE_LIMIT'?'limit':raw==='MISSING_COLUMNS'?'columns':raw==='BROWSER_STREAMING_REQUIRED'?'browser':raw==='INVALID_SETTINGS'?'badSettings':'genericError';message(key,true);if(raw.startsWith('DUPLICATE_ID:')||raw.startsWith('INVALID_ROW:'))$('pgMessage').append(' · '+raw.split(':').slice(1).join(':'));}
  function syncExports(){for(const id of ['pgCSV','pgPDF','pgPrint'])$(id).disabled=busy||reporting||!visible.length;window.dispatchEvent(new CustomEvent('coldtrack-packaging-view'));}
  function lock(value){busy=value;for(const id of ['pgUpload','pgFile','pgApply','pgFiles','pgOriginal'])$(id).disabled=value;$('pgProgress').hidden=!value;syncExports();}
  function progress(m){$('pgProgressBar').value=Math.round(m.fraction*99);$('pgProgressText').textContent=m.phase==='strings'?t('strings'):t('progress',{rows:fmt(Math.max(0,(m.rows||1)-1)),percent:Math.round(m.fraction*99)});}
  function download(value,name,type){const url=URL.createObjectURL(value instanceof Blob?value:new Blob([value],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  async function upload(file){
    if(busy||!file)return false;lock(true);$('pgProgressText').textContent=t('loading');$('pgProgressBar').value=0;
    try{
      if(file.size>100*1024*1024||!/\.(xlsx|csv|tsv)$/i.test(file.name))throw Error('FILE_LIMIT');
      const parsed=await L.read(file,progress),stamp=file.name.match(/_(20\d{2})(\d{2})(\d{2})_([012]\d)([0-5]\d)/),reportDate=stamp?stamp[1]+'-'+stamp[2]+'-'+stamp[3]:C.today();
      if(!C.validDate(reportDate)||reportDate>C.today()){message('future',true);return false;}if(parsed.last>reportDate){message('futureRows',true);return false;}
      const bytes=await file.arrayBuffer();await A.save('packaging',file,{reportDate,reportTime:stamp?stamp[4]+':'+stamp[5]:'00:00',complete:false},parsed,bytes);
      try{localStorage.setItem('coldtrack-packaging-shared-v1','yes');}catch(_){}await refresh();message(A.persistent?'loaded':'session');return true;
    }catch(error){errorMessage(error);return false;}finally{lock(false);$('pgFile').value='';}
  }
  function options(node,items,first){const value=node.value;node.innerHTML='<option value="">'+esc(t(first))+'</option>'+items.map(([v,label])=>'<option value="'+esc(v)+'">'+esc(label)+'</option>').join('');node.value=items.some(([v])=>v===value)?value:'';}
  function translate(){
    document.documentElement.lang=lang();document.title='ColdTrack · Packaging';document.querySelectorAll('[data-p]').forEach(node=>{node.textContent=t(node.dataset.p);});
    for(const id of ['pgPeriod','pgThreshold'])$(id).querySelectorAll('option').forEach(option=>{option.textContent=t('days',{n:option.value});});
    $('pgSearch').placeholder=lang()==='en'?'SKU or description…':'SKU o descripción…';$('pgClose').setAttribute('aria-label',t('close'));
    if(messageState)message(messageState.key,messageState.error,messageState.params);
  }
  function warn(key,params={}){const p=document.createElement('p');p.className='pg-warning';p.textContent=t(key,params);$('pgWarnings').append(p);}
  function warnings(){
    $('pgWarnings').replaceChildren();if(!data)return;
    if(!stock)warn('noStock');else if(stock.reportDate!==settings.asOf)warn('stockOld',{date:date(stock.reportDate)});
    if(result.possibleCap)warn('capped');if(result.short)warn('short',{n:result.observedDays});if(result.stale)warn('stale',{date:date(result.reportDate)});
    if(data.anomalies)warn('anomalies',{n:fmt(data.anomalies)});if(data.ignored)warn('ignored',{n:fmt(data.ignored)});
  }
  function sort(rows){
    if(!sortKey)return [...rows];const collator=new Intl.Collator(lang()==='en'?'en-US':'es-US',{numeric:true,sensitivity:'base'});
    return [...rows].sort((a,b)=>{const x=a[sortKey],y=b[sortKey],nx=x===null||x===undefined,ny=y===null||y===undefined;if(nx!==ny)return nx?1:-1;return (nx?0:typeof x==='number'?x-y:collator.compare(String(x),String(y)))*direction||collator.compare(a.client,b.client)||collator.compare(a.sku,b.sku);});
  }
  const columns=['sku','name','status','total','average','lastUse','idle','stock'];
  function headers(){
    $('pgHead').innerHTML='<tr>'+columns.map(key=>'<th scope="col" aria-sort="'+(sortKey===key?direction===1?'ascending':'descending':'none')+'" class="'+(['total','average','idle','stock'].includes(key)?'pg-num':'')+'"><button data-pg-sort="'+key+'" title="'+esc(t(key==='average'?'observedAverage':'sort',{n:result?.observedDays||0}))+'">'+esc(t(key))+'<span aria-hidden="true">'+(sortKey===key?direction===1?'↑':'↓':'↕')+'</span></button></th>').join('')+'</tr>';
  }
  function kpis(){
    $('pgCountAll').textContent=fmt(base.length);$('pgCountActive').textContent=fmt(base.filter(r=>r.status==='active').length);$('pgCountUnused').textContent=fmt(base.filter(r=>['unused','noUse'].includes(r.status)).length);$('pgCountUnknown').textContent=fmt(base.filter(r=>['noHistory','uncovered'].includes(r.status)).length);
    $('pgActiveSub').textContent=t('activeSub',{n:settings.threshold});$('pgUnusedSub').textContent=t('unusedSub',{n:settings.threshold});
    document.querySelectorAll('[data-pg-kpi]').forEach(button=>{button.setAttribute('aria-pressed',String($('pgStatus').value===button.dataset.pgKpi||!$('pgStatus').value&&button.dataset.pgKpi==='all'));});
  }
  function rows(){
    const pages=Math.max(1,Math.ceil(visible.length/40));page=Math.max(0,Math.min(page,pages-1));
    $('pgRows').innerHTML=visible.slice(page*40,(page+1)*40).map(row=>'<tr><td><button class="pg-item-button" data-pg-item="'+esc(row.id)+'">'+esc(row.sku)+'</button><span class="pg-item-client">'+esc(row.client)+'</span></td><td class="pg-name">'+esc(row.name&&row.name!==row.sku?row.name:'—')+'</td><td><span class="pg-badge '+row.status+'">'+esc(t(row.status))+'</span>'+(row.status==='noHistory'?'<span class="pg-cell-sub">'+esc(t('noHistoryReason'))+'</span>':'')+'</td><td class="pg-num">'+fmt(row.total)+'</td><td class="pg-num">'+fmt(row.average)+'</td><td>'+esc(row.lastUse?date(row.lastUse):row.history?t('never'):'—')+'</td><td class="pg-num">'+fmt(row.idle)+'</td><td class="pg-num"'+(row.stockAbsent?' title="'+esc(t('stockMissing'))+'"':'')+'>'+fmt(row.stock)+'</td></tr>').join('');
    $('pgEmpty').hidden=visible.length>0;$('pgEmpty').textContent=t(data?'empty':'noSource');$('pgPage').textContent=t('page',{page:page+1,pages});$('pgPrev').disabled=page===0;$('pgNext').disabled=page===pages-1;syncExports();
    $('pgResultCount').textContent=result?t('count',{n:fmt(visible.length),from:date(result.requestedStart),to:date(result.asOf)}):t('noSource');
  }
  function filter(){
    const q=$('pgSearch').value.trim().toLowerCase(),business=$('pgClient').value,status=$('pgStatus').value,packOnly=$('pgScope').value==='packaging',stockOnly=$('pgStockOnly').checked;
    base=(result?.rows||[]).filter(row=>(!packOnly||row.detected)&&(!business||C.client(row.client)===business)&&(!stockOnly||row.stock>0)&&(!q||[row.sku,row.name,row.client].some(s=>s.toLowerCase().includes(q))));
    visible=sort(base.filter(row=>!status||status==='unused'?(!status||['unused','noUse'].includes(row.status)):status==='noHistory'?['noHistory','uncovered'].includes(row.status):row.status===status));
    kpis();rows();
  }
  function render(){
    translate();result=data?C.analyze(data,stock?.data||null,{...settings,reportDate:record.reportDate}):null;
    const clients=new Map();for(const row of result?.rows||[])clients.set(C.client(row.client),row.client);options($('pgClient'),[...clients].sort((a,b)=>a[1].localeCompare(b[1])),'allClients');options($('pgStatus'),['active','unused','noUse','noHistory','uncovered'].map(key=>[key,t(key)]),'allStatuses');
    $('pgFilename').textContent=record?.filename||t('noSource');$('pgSourceInfo').textContent=data?t('sourceInfo',{rows:fmt(data.sourceRows),items:fmt(data.items.length),first:date(data.first),last:date(record.reportDate)}):'';$('pgOriginal').hidden=!record?.bytes;
    $('pgStockSource').textContent=stock?t('stockSource',{name:stock.filename,date:date(stock.reportDate)}):'';warnings();headers();filter();if($('pgDetail').open)detail();
  }
  async function refresh(){
    if(reloading)return reloading;
    reloading=(async()=>{
      const [shared,inventory]=await Promise.all([A.read('packaging'),A.read('stock')]);
      stock=inventory||null;
      if(shared){C.validate(shared.data);record=shared;data=shared.data;try{localStorage.setItem('coldtrack-packaging-shared-v1','yes');}catch(_){}}
      else if(!sourceUsed()){record=seed;data=seed.data;C.validate(data);}else{record=null;data=null;}
      page=0;render();
    })();try{return await reloading;}finally{reloading=null;}
  }
  function apply(){try{const next={asOf:$('pgDate').value,period:Number($('pgPeriod').value),threshold:Number($('pgThreshold').value)};if(next.asOf>C.today()){message('future',true);return;}if(data)C.analyze(data,stock?.data||null,{...next,reportDate:record.reportDate});else if(!C.validDate(next.asOf))throw Error('INVALID_SETTINGS');settings=next;page=0;render();try{localStorage.setItem('coldtrack-packaging-settings-v1',JSON.stringify(settings));}catch(_){}}catch(error){errorMessage(error);}}
  function position(){if(!portal||!frame)return;const top=frame.getBoundingClientRect().top;document.documentElement.style.setProperty('--pg-dialog-top',Math.max(16,16-top)+'px');document.documentElement.style.setProperty('--pg-dialog-height',Math.max(180,portal.innerHeight-Math.max(0,top)-32)+'px');}
  function chart(row){
    if(!row.history||row.status==='noHistory')return '<div class="pg-chart"><h3>'+esc(t('history'))+'</h3><p class="pg-no-stock">'+esc(t('noHistoryReason'))+'</p></div>';
    const points=C.weekly(row,settings.asOf,range,data.first,record.reportDate),W=Math.max(700,points.length*68+44),bottom=190,top=34,max=Math.max(1,...points.map(p=>p.units||0)),step=(W-50)/points.length;
    return '<div class="pg-chart"><div class="pg-chart-head"><div><h3>'+esc(t('history'))+'</h3><p>'+esc(t('historySub'))+'</p></div><div>'+[4,8,12].map(n=>'<button data-pg-range="'+n+'" aria-pressed="'+(range===n)+'">'+esc(t('weeks',{n}))+'</button>').join('')+'</div></div><div class="pg-chart-scroll" tabindex="0" role="region" aria-label="'+esc(t('history'))+'"><svg viewBox="0 0 '+W+' 232" role="img" aria-labelledby="pgChartTitle pgChartDescription"><title id="pgChartTitle">'+esc(t('chart',{sku:row.sku}))+'</title><desc id="pgChartDescription">'+esc(points.map(p=>date(p.start)+': '+fmt(p.units)).join('; '))+'</desc><line x1="24" y1="'+bottom+'" x2="'+(W-25)+'" y2="'+bottom+'" stroke="currentColor" opacity=".35"/>'+points.map((p,i)=>{const x=25+step*(i+.5),h=(p.units||0)/max*(bottom-top);return '<g><title>'+esc(t('week',{date:date(p.start)})+': '+fmt(p.units))+'</title>'+(p.units!==null?'<rect x="'+(x-16)+'" y="'+(bottom-Math.max(2,h))+'" width="32" height="'+Math.max(2,h)+'" rx="3" data-partial="'+p.partial+'"/>':'')+'<text x="'+x+'" y="'+(bottom-h-9)+'" text-anchor="middle" font-size="11">'+esc(fmt(p.units))+'</text><text x="'+x+'" y="214" text-anchor="middle" font-size="10">'+esc(date(p.start).slice(0,5))+'</text></g>';}).join('')+'</svg></div><p class="pg-chart-note">'+esc(t('partial'))+'</p></div>';
  }
  function detail(){
    const row=result?.rows.find(row=>row.id===selected);$('pgClose').setAttribute('aria-label',t('close'));
    if(!row){$('pgDetailBody').textContent=t('noHistoryReason');return;}
    $('pgDetailClient').textContent=row.client;$('pgDetailTitle').textContent=row.sku+(row.name!==row.sku?' · '+row.name:'');
    const stats='<div class="pg-detail-stats">'+[['total',row.total],['average',row.average],['returns',row.returns],['stock',row.stock]].map(([key,value])=>'<div class="pg-detail-stat"><span>'+esc(t(key))+'</span><strong>'+fmt(value)+'</strong></div>').join('')+'</div>';
    const inventory=row.stockDetails.length?'<div class="pg-details-table"><table><thead><tr>'+['location','lot','lpn','quantity'].map(key=>'<th>'+esc(t(key))+'</th>').join('')+'</tr></thead><tbody>'+row.stockDetails.map(r=>'<tr><td>'+esc(r.location)+'</td><td>'+esc(r.lot||'—')+'</td><td>'+esc(r.lpn||'—')+'</td><td>'+fmt(r.units)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="pg-no-stock">'+esc(t('missingStock'))+'</p>';
    const daily='<details style="margin-top:22px"><summary>'+esc(t('daily'))+'</summary><div class="pg-details-table"><table><thead><tr>'+['date','total','returns'].map(key=>'<th>'+esc(t(key))+'</th>').join('')+'</tr></thead><tbody>'+row.daily.filter(day=>day[0]>=result.requestedStart&&day[0]<=result.observedEnd).map(day=>'<tr><td>'+date(day[0])+'</td><td>'+fmt(day[1])+'</td><td>'+fmt(day[2])+'</td></tr>').join('')+'</tbody></table></div></details>';
    $('pgDetailBody').innerHTML=stats+chart(row)+'<h3>'+esc(t('locations'))+'</h3>'+inventory+daily;position();
  }
  function openDetail(id){if(!result?.rows.some(row=>row.id===id))return;selected=id;range=12;detail();if(!$('pgDetail').open)$('pgDetail').showModal();position();}
  function exportCSV(){
    const cell=value=>{const raw=typeof value==='string'&&/^[\s]*[=+@\-\t\r]/.test(value)?"'"+value:value??'';return '"'+String(raw).replaceAll('"','""')+'"';};
    const out=[[t('ledgerLabel'),record?.filename||''],[t('reviewLabel'),date(settings.asOf)],[t('from'),date(result?.requestedStart)],[t('through'),date(result?.observedEnd)],[t('thresholdLabel'),settings.threshold],[t('inputDate'),date(stock?.reportDate)],[t('client'),'SKU',t('name'),t('status'),t('total'),t('average'),t('lastUse'),t('idle'),t('stock'),t('returns')],...visible.map(row=>[row.client,row.sku,row.name,t(row.status),row.total,row.average,date(row.lastUse),row.idle,row.stock,row.returns])].map(row=>row.map(cell).join(',')).join('\r\n');
    download('\uFEFF'+out,'ColdTrack-Packaging-'+settings.asOf+'-'+lang()+'.csv','text/csv;charset=utf-8');message('csvReady');return out;
  }
  function reportModel(){
    if(!result||!record||!visible.length)return null;
    const option=id=>$(id).selectedOptions[0]?.textContent||'',now=new Date();
    const generated=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'2-digit',day:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(now).replaceAll('/','-').replace(',','');
    return {language:lang(),generated,settings:{...settings},requestedStart:result.requestedStart,observedStart:result.observedStart,observedEnd:result.observedEnd,observedDays:result.observedDays,
      ledger:{filename:record.filename,reportDate:record.reportDate},stock:stock?{filename:stock.filename,reportDate:stock.reportDate}:null,
      filters:{client:option('pgClient'),status:option('pgStatus'),scope:option('pgScope'),stockOnly:$('pgStockOnly').checked,search:$('pgSearch').value.trim()},
      order:sortKey?t(sortKey)+' ('+t(direction===1?'reportAsc':'reportDesc')+')':t('reportDefaultOrder'),warnings:[...$('pgWarnings').children].map(p=>p.textContent),
      qualifications:{possibleCap:!!result.possibleCap,short:!!result.short,stale:!!result.stale,anomalies:data.anomalies||0},
      rows:visible.map(({id,client,sku,name,status,total,average,lastUse,history,idle,stock,returns})=>({id,client,sku,name,status,total,average,lastUse,history,idle,stock,returns}))};
  }
  const reportLogo=()=>document.querySelector('.pg-brand img').src;
  async function exportPDF(){
    if(busy||reporting)return false;const model=reportModel();if(!model)return false;
    reporting=true;syncExports();message('reportPreparing');
    try{const bytes=await ColdTrackPackagingReports.pdf(model,reportLogo());download(bytes,'ColdTrack-Packaging-'+model.settings.asOf+'-'+model.language+'.pdf','application/pdf');message('reportReady');return bytes;}
    catch(_){message('reportFailed',true);return false;}finally{reporting=false;syncExports();}
  }
  function preparePrint(model){const node=$('pgPrintReport');node.lang=model.language;node.innerHTML=ColdTrackPackagingReports.html(model,reportLogo());return node;}
  async function printReport(){
    if(busy||reporting)return false;const model=reportModel();if(!model)return false;
    reporting=true;syncExports();
    try{const node=preparePrint(model);await Promise.all([...node.querySelectorAll('img')].map(img=>img.decode?.().catch(()=>{})));window.print();message('reportPrintReady');return true;}
    catch(_){message('reportFailed',true);return false;}finally{reporting=false;syncExports();}
  }
  $('pgUpload').onclick=()=>$('pgFile').click();$('pgFile').onchange=()=>void upload($('pgFile').files?.[0]);$('pgCancel').onclick=()=>L.cancel();$('pgFiles').onclick=()=>A.go();$('pgApply').onclick=apply;
  $('pgOriginal').onclick=()=>{if(record?.bytes)download(record.bytes,record.filename,record.mime);};$('pgCSV').onclick=exportCSV;$('pgPDF').onclick=()=>void exportPDF();$('pgPrint').onclick=()=>void printReport();
  for(const id of ['pgClient','pgStatus','pgStockOnly','pgScope'])$(id).onchange=()=>{page=0;filter();};$('pgSearch').oninput=()=>{page=0;filter();};$('pgPrev').onclick=()=>{page--;rows();document.querySelector('.pg-table-scroll').scrollTop=0;};$('pgNext').onclick=()=>{page++;rows();document.querySelector('.pg-table-scroll').scrollTop=0;};
  document.querySelectorAll('[data-pg-kpi]').forEach(button=>{button.onclick=()=>{$('pgStatus').value=button.dataset.pgKpi==='all'?'':button.dataset.pgKpi;page=0;filter();};});
  $('pgTable').onclick=event=>{const item=event.target.closest('[data-pg-item]'),sortButton=event.target.closest('[data-pg-sort]');if(item)openDetail(item.dataset.pgItem);if(sortButton){const key=sortButton.dataset.pgSort;direction=sortKey===key?-direction:1;sortKey=key;page=0;headers();filter();$('pgHead').querySelector('[data-pg-sort="'+key+'"]').focus();}};
  $('pgClose').onclick=()=>$('pgDetail').close();$('pgDetail').addEventListener('close',()=>{selected=null;});$('pgDetailBody').onclick=event=>{const button=event.target.closest('[data-pg-range]');if(button){range=Number(button.dataset.pgRange);detail();$('pgDetailBody').querySelector('[data-pg-range="'+range+'"]').focus();}};
  A.subscribe(kind=>{if(['packaging','stock'].includes(kind)&&!busy)void refresh().catch(errorMessage);});window.addEventListener('coldtrack-language-change',()=>render());portal?.addEventListener('scroll',position,{passive:true});portal?.addEventListener('resize',position);
  window.addEventListener('beforeprint',()=>{if(!busy&&!reporting){const model=reportModel();if(model)preparePrint(model);}});
  window.addEventListener('pagehide',()=>{L.cancel();portal?.removeEventListener('scroll',position);portal?.removeEventListener('resize',position);},{once:true});
  const ready=refresh().catch(errorMessage);globalThis.ColdTrackPackagingApp={ready,upload,refresh,apply,openDetail,exportCSV,reportModel,exportPDF,printReport,get result(){return result;},get visible(){return visible;},get record(){return record;},get busy(){return busy;},get reporting(){return reporting;},get selected(){return selected;},get range(){return range;}};
})();
