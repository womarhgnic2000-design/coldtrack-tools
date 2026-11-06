(() => {
  'use strict';
  const $=id=>document.getElementById(id),C=ColdTrackDataCore,A=ColdTrackData,mode=document.documentElement.dataset.ctTool==='data-center'?'center':'idle';
  const lang=()=>globalThis.ColdTrackLanguage?.current==='en'?'en':'es',t=key=>ColdTrackDataCopy[lang()][key]||key;
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt=v=>v===null||v===undefined?'—':new Intl.NumberFormat(lang()==='en'?'en-US':'es-US',{maximumFractionDigits:3}).format(v),display=v=>v?v.slice(5,7)+'-'+v.slice(8,10)+'-'+v.slice(0,4):'—';
  const e=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  let sources={},configuration={},result={rows:[],warnings:[]},visible=[],page=0,busy=false,messageKey='ready',messageError=false,dateEdited=false,reloading=null,lastDay=C.today();
  $('sdCenter').hidden=mode!=='center';$('sdIdle').hidden=mode!=='idle';$('sdReviewDate').value=C.today();
  const links=[['pressed','Pressed'],['forecasting','Forecasting'],['count-planner','Conteos'],['redflags','Red Flags'],['inventory-finder','Item Lookup'],['inactive-items','Ítems sin movimiento'],['packaging','Packaging']];
  function navigate(route){try{if(parent!==window&&parent.ColdTrackHub){parent.location.hash=route;return;}}catch(_){}location.href='../index.html#'+route;}
  $('sdNavigate').onclick=()=>navigate(mode==='center'?'inactive-items':'data-center');
  function message(key,error=false,detail=''){messageKey=key;messageError=error;$('sdMessage').textContent=t(key)+(detail?' '+detail:'');$('sdMessage').dataset.error=String(error);}
  const buffer=file=>typeof file.arrayBuffer==='function'?file.arrayBuffer():new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Unreadable file'));reader.readAsArrayBuffer(file);});
  function download(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=e('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function lock(value){busy=value;for(const node of document.querySelectorAll('main button,main input,main select'))node.disabled=value;}
  async function run(fn){if(busy)return false;lock(true);try{return await fn();}catch(error){message(ColdTrackDataCopy.es[error.code]?error.code:'failed',!['activityCancelled','packagingCancelled'].includes(error.code),error.detail||error.key||'');return false;}finally{lock(false);if(mode==='idle')applyFilters();}}
  async function upload(kind,file,metadata={}){
    if(!file)return false;const reportDate=metadata.reportDate||$('sdDate-'+kind)?.value||C.today();
    if(!C.validDate(reportDate)||reportDate>C.today())throw Object.assign(Error('futureDate'),{code:'futureDate'});
    const supported=kind==='needs'?/\.pdf$/i.test(file.name):['activity','packaging'].includes(kind)?/\.(xlsx|csv|tsv)$/i.test(file.name):/\.xlsx$/i.test(file.name);
    if(!supported)throw Object.assign(Error('badFormat'),{code:'badFormat'});if(file.size>(['activity','packaging'].includes(kind)?100:20)*1024*1024){const code=kind==='activity'?'activityTooLarge':kind==='packaging'?'packagingTooLarge':'tooLarge';throw Object.assign(Error(code),{code});}
    message('loading');let bytes,data;const activityBox=kind==='activity'?$('sdActivityProgress'):null;
    try{
    if(kind==='activity'){
      const bar=$('sdActivityBar'),label=$('sdActivityText'),cancel=$('sdCancel-activity');activityBox.hidden=false;bar.value=0;label.textContent=t('loading');cancel.disabled=false;
      try{data=await ColdTrackActivityLoader.read(file,m=>{bar.value=Math.min(99,Math.round(m.fraction*99));label.textContent=m.phase==='strings'?t('activityStrings'):Math.max(0,(m.rows||1)-1).toLocaleString()+' '+t('rows')+' · '+Math.round(m.fraction*99)+' %';});}
      finally{cancel.disabled=true;}
      bar.value=99;label.textContent=t('activitySaving');
    }
    else if(kind==='needs'){const parsed=await ColdTrackItemPDF.read(file);data=ColdTrackItemNeeds.report(parsed,{date:reportDate,filename:file.name});}
    else if(kind==='packaging'){
      const box=$('sdPackagingProgress'),bar=$('sdPackagingBar'),label=$('sdPackagingText'),cancel=$('sdCancel-packaging');box.hidden=false;cancel.disabled=false;
      try{data=await ColdTrackPackagingLoader.read(file,m=>{bar.value=Math.round(m.fraction*99);label.textContent=m.phase==='strings'?t('loading'):Math.max(0,(m.rows||1)-1).toLocaleString()+' '+t('rows')+' · '+Math.round(m.fraction*99)+' %';});}
      catch(error){const raw=error.message,code=raw==='IMPORT_CANCELLED'?'packagingCancelled':raw==='BROWSER_STREAMING_REQUIRED'?'packagingBrowser':raw==='MISSING_COLUMNS'?'packagingColumns':raw.startsWith('DUPLICATE_ID:')?'duplicate':raw.startsWith('INVALID_ROW:')?'badRow':'packagingInvalid';throw Object.assign(error,{code,detail:raw.includes(':')?raw.split(':').slice(1).join(':'):''});}
      finally{box.hidden=true;}
    }
    else {bytes=await buffer(file);const workbook=/\.xlsx$/i.test(file.name)?await (kind==='ice'?ForecastIce:PressedExcel).readXlsx(bytes):C.csv(new TextDecoder().decode(bytes),file.name);data=C[kind](workbook);}
    if(['ice','packaging'].includes(kind)&&data.last>reportDate)throw Object.assign(Error('futureDate'),{code:'futureDate'});
    const complete=kind==='usage'&&(metadata.complete??$('sdUsageComplete')?.checked??false);
    const stamp=file.name.match(/_(20\d{2})(\d{2})(\d{2})_([01]\d|2[0-3])([0-5]\d)/),reportTime=stamp?stamp[4]+':'+stamp[5]:'00:00';
    bytes??=await buffer(file);const record=await A.save(kind,file,{reportDate,reportTime,complete},data,bytes);await refresh();message('loaded');return record;
    }finally{if(activityBox)activityBox.hidden=true;}
  }
  function buildCenter(){
    for(const kind of A.kinds){
      const card=e('section','sd-card');card.dataset.kind=kind;const heading=e('h2');heading.dataset.sdCopy=kind;const help=e('p');help.dataset.sdCopy=kind+'Help';
      const info=e('div','sd-file-info');info.id='sdInfo-'+kind;const label=e('label','sd-date'),span=e('span');span.dataset.sdCopy='reportDate';const date=e('input');date.type='date';date.id='sdDate-'+kind;date.value=C.today();date.max=C.today();label.append(span,date);
      const actions=e('div','sd-card-actions'),up=e('button','sd-button primary'),original=e('button','sd-button'),remove=e('button','sd-button danger'),input=e('input');
      up.type=original.type=remove.type='button';up.id='sdUpload-'+kind;original.id='sdOriginal-'+kind;remove.id='sdRemove-'+kind;original.dataset.sdCopy='download';remove.dataset.sdCopy='remove';input.type='file';input.hidden=true;input.id='sdFile-'+kind;input.accept=kind==='needs'?'.pdf,application/pdf':['activity','packaging'].includes(kind)?'.xlsx,.csv,.tsv':'.xlsx';
      up.onclick=()=>input.click();input.onchange=()=>run(async()=>{try{const file=input.files?.[0];if(!file)return;const match=file.name.match(/(20\d{2})(\d{2})(\d{2})_\d{4}/);if(!date.dataset.edited)date.value=match?match[1]+'-'+match[2]+'-'+match[3]:C.today();const result=await upload(kind,file);delete date.dataset.edited;return result;}finally{input.value='';}});
      original.onclick=()=>{const record=sources[kind];if(record)download(record.bytes,record.filename,record.mime);};
      remove.onclick=()=>run(async()=>{if(!confirm(t('confirmRemove')))return;await A.remove(kind);await refresh();message('removed');});
      date.onchange=()=>run(async()=>{date.dataset.edited='true';if(!C.validDate(date.value)||date.value>C.today())throw Object.assign(Error('futureDate'),{code:'futureDate'});if(sources[kind]){if(kind==='packaging'&&sources[kind].data.last>date.value)throw Object.assign(Error('packagingDateMismatch'),{code:'packagingDateMismatch'});await A.update(kind,{reportDate:date.value});if(kind==='needs'){const row=await A.read(kind);row.data.date=date.value;await A.save(kind,A.file(row),{reportDate:date.value,complete:false},row.data,row.bytes);}await refresh();message('loaded');}});
      actions.append(up,original,remove,input);card.append(heading,help,info,label,actions);
      if(kind==='usage'){const check=e('label','sd-check'),box=e('input'),text=e('span');box.type='checkbox';box.id='sdUsageComplete';text.dataset.sdCopy='completeUsage';check.append(box,text);const caution=e('p','sd-small');caution.dataset.sdCopy='usageCaution';box.onchange=()=>run(async()=>{if(sources.usage){await A.update('usage',{complete:box.checked});await refresh();}});card.append(check,caution);}
      if(kind==='packaging'){const progress=e('div','sd-packaging-progress');progress.id='sdPackagingProgress';progress.hidden=true;const text=e('small');text.id='sdPackagingText';const bar=e('progress');bar.id='sdPackagingBar';bar.max=100;bar.value=0;const cancel=e('button','sd-button');cancel.id='sdCancel-packaging';cancel.type='button';cancel.dataset.sdCopy='packagingCancel';cancel.onclick=()=>ColdTrackPackagingLoader.cancel();progress.append(text,bar,cancel);card.append(progress);}
      if(kind==='activity'){const progress=e('div','sd-packaging-progress');progress.id='sdActivityProgress';progress.hidden=true;progress.setAttribute('role','status');progress.setAttribute('aria-live','polite');const text=e('small');text.id='sdActivityText';const bar=e('progress');bar.id='sdActivityBar';bar.max=100;bar.value=0;bar.setAttribute('aria-labelledby','sdActivityText');const cancel=e('button','sd-button');cancel.id='sdCancel-activity';cancel.type='button';cancel.dataset.sdCopy='activityCancel';cancel.onclick=()=>ColdTrackActivityLoader.cancel();progress.append(text,bar,cancel);card.append(progress);}
      $('sdUploadGrid').append(card);
    }
    for(const [route,label] of links){const a=e('a','',label);a.href='#'+route;a.onclick=event=>{event.preventDefault();navigate(route);};a.dataset.sdRoute=route;$('sdConnections').append(a);}
  }
  function renderRules(){
    const act=sources.activity,valid=act&&configuration.activityRevision===act.contentId;$('sdActivitySettings').hidden=!act;
    $('sdRulesState').textContent=t(!act?'noActivity':valid&&configuration.confirmed?'rulesCurrent':'rulesPending');if(!act)return;
    $('sdCoverageStart').value=valid?configuration.coverageStart:act.data.first;$('sdCoverageEnd').value=valid?configuration.coverageEnd:act.reportDate;
    $('sdCoverageConfirmed').checked=valid&&configuration.confirmed||false;$('sdOutbound').replaceChildren();
    for(const name of act.data.names){const label=e('label','sd-check'),box=e('input');box.type='checkbox';box.value=name;box.checked=valid?configuration.outbound?.includes(name):C.defaultOutbound(name);label.append(box,e('span','',name));$('sdOutbound').append(label);}
    const clients=[...new Set(sources.stock?.data.rows.map(r=>r.client)||[])].sort();$('sdClientMap').replaceChildren();
    for(const raw of act.data.clients){const label=e('label','',raw),select=e('select');select.dataset.sdClient=raw;select.setAttribute('aria-label',raw);const empty=e('option','',t('unmapped'));empty.value='';select.append(empty);for(const client of clients){const option=e('option','',client);option.value=client;select.append(option);}
      const exact=clients.filter(client=>client.toLowerCase()===raw.toLowerCase()),fromCode=[...new Set((sources.stock?.data.rows||[]).filter(r=>r.clientCode&&r.clientCode===raw).map(r=>r.client))];select.value=configuration.clientMap?.[raw]||(exact.length===1?exact[0]:fromCode.length===1?fromCode[0]:'');label.append(select);$('sdClientMap').append(label);}
  }
  function renderCenter(){
    for(const kind of A.kinds){const record=sources[kind],info=$('sdInfo-'+kind);info.replaceChildren();$('sdUpload-'+kind).textContent=t(record?'replace':'upload');$('sdOriginal-'+kind).hidden=$('sdRemove-'+kind).hidden=!record;
      if(record){const count=kind==='packaging'?fmt(record.data.sourceRows)+' '+t('ledgerRows')+' · '+fmt(record.data.items.length)+' '+t('packagingItems'):kind==='ice'?fmt(record.data.sourceRows)+' '+t('ledgerRows')+' · '+fmt(record.data.rows.length)+' '+t('iceDailyRows'):fmt(kind==='activity'?record.data.sourceRows??record.data.rows.length:record.data.rows.length)+' '+t('rows');info.append(e('strong','',record.filename),e('small','',t('reportDate')+': '+display(record.reportDate)),e('small','',count+' · '+(record.bytes.byteLength/1024/1024).toFixed(2)+' MB'));$('sdDate-'+kind).value=record.reportDate;}else info.append(e('small','',t('noFile')));
    }
    $('sdUsageComplete').checked=sources.usage?.complete||false;renderRules();
  }
  async function confirmRules(){
    const act=sources.activity,coverageStart=$('sdCoverageStart').value,coverageEnd=$('sdCoverageEnd').value,outbound=[...document.querySelectorAll('#sdOutbound input:checked')].map(n=>n.value);
    if(!act||!C.validDate(coverageStart)||!C.validDate(coverageEnd)||coverageStart>coverageEnd||coverageEnd>C.today()||!$('sdCoverageConfirmed').checked||!outbound.length)throw Object.assign(Error('badCoverage'),{code:'badCoverage'});
    const clientMap=Object.fromEntries([...document.querySelectorAll('#sdClientMap select')].map(n=>[n.dataset.sdClient,n.value]));
    await A.setConfig({...configuration,activityRevision:act.contentId,coverageStart,coverageEnd,outbound,clientMap,confirmed:true});await refresh();message('rulesSaved');return true;
  }
  const settings=()=>({asOf:$('sdReviewDate').value,thresholds:[1,2,3].map(n=>Number($('sdThreshold'+n).value))});
  function choice(select,values,first){const previous=select.value;select.replaceChildren();const all=e('option','',t(first));all.value='';select.append(all);for(const value of values){const option=e('option','',first==='allStatuses'?t(value):value);option.value=value;select.append(option);}select.value=values.includes(previous)?previous:'';}
  function evidenceText(row){if(row.evidence==='weekly')return row.zeroWeeks+' '+t('weeksZero');if(row.days!==null&&row.evidence==='activity')return (row.lowerBound?t('atLeast')+' ':'')+row.days+' '+t('days');return '—';}
  function usageText(row){return row.weekly.length?row.weekly.map(v=>t('week')+' '+v.week+': '+(v.qty===null?t('unknownQty'):fmt(v.qty))).join(' · '):'—';}
  function applyFilters(){
    const q=$('sdSearch').value.toLowerCase().trim(),client=$('sdClientFilter').value,status=$('sdStatusFilter').value,location=$('sdLocationFilter').value;
    visible=result.rows.filter(r=>(!client||r.client===client)&&(!status||r.status===status)&&($('sdShowActive').checked||status==='active'||r.status!=='active')&&(!location||location==='outside'?(!location||r.external>0):r.units-r.external>0)&&(!q||[r.sku,r.name,r.client,...r.details.flatMap(d=>[d.location,d.lot,d.lpn])].join(' ').toLowerCase().includes(q)));
    const pages=Math.max(1,Math.ceil(visible.length/40));page=Math.min(page,pages-1);$('sdRows').replaceChildren();
    for(const row of visible.slice(page*40,page*40+40)){
      const tr=e('tr'),item=e('td');item.append(e('strong','',row.sku),e('small','',row.name),e('small','',row.client));
      const detail=e('details','sd-row-details'),summary=e('summary','',t('details'));detail.append(summary);const list=e('dl');
      for(const d of row.details){list.append(e('dt','',d.location+' · '+fmt(d.units)+' u.'),e('dd','',t('lot')+': '+(d.lot||'—')+' · '+t('lpn')+': '+(d.lpn||'—')+' · '+t('expiry')+': '+display(d.expiry)));}detail.append(list);item.append(detail);
      const statusCell=e('td'),badge=e('span','sd-badge '+row.status,t(row.status));statusCell.append(badge,e('small','',t(row.reason)));
      const last=e('td','',row.last?display(row.last):row.evidence==='activity'?t('noOutbound'):t('noExactDate'));if(row.lastWeek!==null)last.append(e('small','',t('week')+' '+row.lastWeek));
      const idle=e('td','',evidenceText(row));idle.append(e('small','',t(row.evidence==='activity'?'activityEvidence':row.evidence==='weekly'?'weeklyEvidence':row.reason)));
      tr.append(item,e('td','',fmt(row.units)),last,idle,e('td','',usageText(row)),statusCell,e('td','',display(row.expiry)));$('sdRows').append(tr);
    }
    $('sdEmpty').hidden=visible.length>0;$('sdEmpty').textContent=t(sources.stock?'noResults':'noStock');$('sdResultCount').textContent=fmt(visible.length)+' '+t('filtered');$('sdPage').textContent=t('page')+' '+(page+1)+' '+t('of')+' '+pages;$('sdPrevious').disabled=busy||page===0;$('sdNext').disabled=busy||page>=pages-1;$('sdCSV').disabled=$('sdPDF').disabled=busy||!visible.length;
  }
  function renderIdle(){
    choice($('sdClientFilter'),[...new Set(result.rows.map(r=>r.client))].sort(),'allClients');choice($('sdStatusFilter'),['idle30','idle14','idle7','unknown','active'],'allStatuses');
    const place=$('sdLocationFilter'),last=place.value;place.innerHTML='<option value="">'+esc(t('allLocations'))+'</option><option value="inside">'+esc(t('inside'))+'</option><option value="outside">'+esc(t('outside'))+'</option>';place.value=last;
    $('sdSources').replaceChildren();for(const kind of ['stock','usage','activity'])if(sources[kind])$('sdSources').append(e('span','',t(kind)+': '+sources[kind].filename+' · '+display(sources[kind].reportDate)));
    $('sdWarnings').replaceChildren();for(const warning of result.warnings)$('sdWarnings').append(e('p','sd-warning',t(warning)));
    $('sdKpis').replaceChildren();for(const status of ['idle30','idle14','idle7','unknown']){const box=e('div','sd-kpi');box.dataset.status=status;box.append(e('b','',fmt(result.rows.filter(r=>r.status===status).length)),e('span','',t(status)));$('sdKpis').append(box);}
    $('sdTableHead').innerHTML='<tr>'+['item','stockUnits','lastOutbound','idleDays','usage4','status','expiry'].map(key=>'<th>'+esc(t(key))+'</th>').join('')+'</tr>';applyFilters();
  }
  function translate(){document.documentElement.lang=lang();document.title='ColdTrack · '+t(mode==='center'?'centerTitle':'idleTitle');for(const node of document.querySelectorAll('[data-sd-copy]'))node.textContent=t(node.dataset.sdCopy);$('sdTitle').textContent=t(mode==='center'?'centerTitle':'idleTitle');$('sdSubtitle').textContent=t(mode==='center'?'centerSub':'idleSub');$('sdNavigate').textContent=t(mode==='center'?'openIdle':'openCenter');$('sdSearch').placeholder=t('search');$('sdSearch').setAttribute('aria-label',t('search'));$('sdClientFilter').setAttribute('aria-label',t('allClients'));$('sdStatusFilter').setAttribute('aria-label',t('status'));$('sdLocationFilter').setAttribute('aria-label',t('allLocations'));message(messageKey,messageError);}
  async function refresh(){
    if(reloading)return reloading;reloading=(async()=>{[sources,configuration]=await Promise.all([A.all(mode==='center'?A.kinds:['stock','usage','activity']),A.config()]);translate();if(mode==='center')renderCenter();else{result=C.analyze(sources,configuration,settings());renderIdle();}if(!A.persistent)message('notSaved',true);})();try{return await reloading;}finally{reloading=null;}
  }
  function model(){return {language:lang(),asOf:result.asOf,stockDate:result.stockDate,thresholds:result.thresholds,rows:visible.map(row=>({...row,evidenceLabel:evidenceText(row),usageLabel:usageText(row)})),sources:Object.fromEntries(Object.entries(sources).filter(([key])=>!['needs','ice','packaging'].includes(key)).map(([kind,r])=>[kind,{filename:r.filename,reportDate:r.reportDate}])),coverage:configuration.confirmed?{from:configuration.coverageStart,to:configuration.coverageEnd}:null};}
  async function exportPDF(){if(!visible.length)throw Object.assign(Error('noRows'),{code:'noRows'});const data=model(),bytes=await ColdTrackIdleReports.pdf(data,$('sdLogo').src);download(bytes,'ColdTrack-Sin-Movimiento-'+data.asOf+'-'+data.language+'.pdf','application/pdf');message('pdfReady');return bytes;}
  function exportCSV(){const data=model(),bytes=ColdTrackIdleReports.csv(data);download('\ufeff'+bytes,'ColdTrack-Sin-Movimiento-'+data.asOf+'-'+data.language+'.csv','text/csv;charset=utf-8');return bytes;}
  if(mode==='center')buildCenter();
  $('sdConfirmRules').onclick=()=>run(confirmRules);$('sdReview').onclick=()=>run(async()=>{page=0;await refresh();message('ready');});$('sdReviewDate').onchange=()=>{dateEdited=true;};
  $('sdSearch').oninput=()=>{page=0;applyFilters();};for(const id of ['sdClientFilter','sdStatusFilter','sdLocationFilter','sdShowActive'])$(id).onchange=()=>{page=0;applyFilters();};$('sdPrevious').onclick=()=>{page--;applyFilters();};$('sdNext').onclick=()=>{page++;applyFilters();};$('sdCSV').onclick=()=>run(exportCSV);$('sdPDF').onclick=()=>run(exportPDF);
  A.subscribe(()=>{if(!busy)void refresh().catch(error=>message(error.code||'failed',true));});window.addEventListener('coldtrack-language-change',()=>{translate();if(mode==='center')renderCenter();else renderIdle();});
  const dayCheck=setInterval(()=>{if(C.today()!==lastDay){lastDay=C.today();if(!dateEdited)$('sdReviewDate').value=lastDay;void refresh().catch(()=>{});}},30000);window.addEventListener('pagehide',()=>{clearInterval(dayCheck);globalThis.ColdTrackActivityLoader?.cancel();},{once:true});
  const ready=refresh().catch(error=>message(error.code||'failed',true));globalThis.ColdTrackDataApp={ready,refresh,upload:(kind,file,metadata)=>run(()=>upload(kind,file,metadata)),confirmRules:()=>run(confirmRules),model,exportPDF:()=>run(exportPDF),exportCSV:()=>run(exportCSV),get result(){return result;},get visible(){return visible;},get sources(){return sources;},get busy(){return busy;}};
})();
