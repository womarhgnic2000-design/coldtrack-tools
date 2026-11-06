(() => {
  'use strict';
  const $=id=>document.getElementById(id),C=ProductIncident,R=ProductIncidentReport;
  document.documentElement.dataset.ctEmbedded=String(parent!==window);
  const lang=()=>globalThis.ColdTrackLanguage?.current||'es',t=key=>ProductIncidentCopy[lang()]?.[key]||ProductIncidentCopy.es[key]||key;
  let current=C.fresh(),photos=[],records=[],db=null,dirty=false,busy=false,messageKey='ready',messageError=false,layoutType=null;
  const groups={
    incidentClassification:[['type','type','select'],['status','status','select'],['issueTitle','issueTitle','text',true]],
    incidentFacts:[['observedAt','observedAt','datetime-local'],['reportedBy','reportedBy'],['client','client'],['facility','facility'],['location','location'],['lpn','lpn'],['reference','reference','text',true]],
    incidentExpected:[['expectedSku','sku'],['expectedName','name'],['expectedLot','lot'],['expectedExpiry','expiry','date']],
    incidentActual:[['actualSku','sku'],['actualName','name'],['actualLot','lot'],['actualExpiry','expiry','date']],
    incidentQuantity:[['expectedQuantity','expectedQuantity','number'],['actualQuantity','actualQuantity','number'],['quantityUnit','quantityUnit','select']],
    incidentLocation:[['expectedLocation','expectedLocation'],['expectedLpn','expectedLpn']],
    incidentImpact:[['casesChecked','casesChecked','number'],['casesAffected','casesAffected','number'],['unitsAffected','unitsAffected','number'],['description','description','textarea',true]],
    incidentFollowup:[['containment','containment','select'],['assignedTo','assignedTo'],['actionNotes','actionNotes','textarea',true]],
    incidentReview:[['reviewedBy','reviewedBy'],['reviewDate','reviewDate','date'],['resolution','resolution','textarea',true]]
  };
  function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function options(select,values,empty){const selected=select.value;select.replaceChildren();if(empty){const option=el('option','',t(empty));option.value='';select.append(option);}for(const value of values){const option=el('option','',t(value));option.value=value;select.append(option);}select.value=values.includes(selected)?selected:'';}
  function buildFields(){
    for(const [group,fields] of Object.entries(groups))for(const [id,label,type='text',wide=false] of fields){
      const wrap=el('label',wide?'wide':''),span=el('span');span.dataset.copy=label;const input=el(type==='textarea'?'textarea':type==='select'?'select':'input');input.id=id;
      if(input.tagName==='INPUT')input.type=type;if(type==='number'){input.min='0';input.step='1';input.inputMode='numeric';}
      input.maxLength=['description','actionNotes','resolution'].includes(id)?6000:['expectedName','actualName'].includes(id)?300:160;
      if(type==='select')options(input,id==='type'?C.types:id==='status'?C.statuses:id==='quantityUnit'?C.quantityUnits:C.actions,id==='type'?'chooseType':undefined);
      wrap.append(span,input);$(group).append(wrap);input.addEventListener('input',changed);input.addEventListener('change',changed);
    }
    options($('incidentPhotoCategory'),C.categories);$('incidentPhotoCategory').value='other';
    options($('incidentStatusFilter'),C.statuses,'allStatuses');
    options($('incidentTypeFilter'),C.types,'allTypes');
  }
  function get(){return {...current,...Object.fromEntries(C.fields.map(id=>[id,$(id).value])),photos:structuredClone(photos)};}
  function message(key,error=false){messageKey=key;messageError=error;$('incidentMessage').textContent=t(key);$('incidentMessage').dataset.error=String(error);}
  function lockControls(value){for(const node of document.querySelectorAll('main button,main input,main select,main textarea'))node.disabled=value;}
  function adaptive(){
    const data=get(),mode=C.mode(data.type),panels=C.productPanels(data),section=$('incidentProductSection');
    $('incidentTypeHelp').textContent=t(data.type?'help_'+data.type:'typeHelp');
    $('incidentProductHeading').textContent=t(mode==='compare'?'comparison':mode==='product'?'productSection':'optionalProductSection');
    for(const prefix of ['expected','actual']){const panel=panels.find(item=>item.prefix===prefix);$('incident'+(prefix==='expected'?'Expected':'Actual')+'Panel').hidden=!panel;$('incident'+(prefix==='expected'?'Expected':'Actual')+'Title').textContent=panel?t(panel.title):'';}
    $('incidentProducts').dataset.panels=String(panels.length);
    if(layoutType!==data.type){section.open=mode!=='general'||C.hasProduct(data,'expected')||C.hasProduct(data,'actual');layoutType=data.type;}
    $('incidentQuantitySection').hidden=data.type!=='quantity'&&data.expectedQuantity===''&&data.actualQuantity==='';
    $('incidentLocationSection').hidden=data.type!=='location_issue'&&!data.expectedLocation&&!data.expectedLpn;
    const diff=C.difference(data),number=new Intl.NumberFormat(lang()==='en'?'en-US':'es-US');
    $('incidentDifference').textContent=diff===null?'':t('difference')+': '+(diff>0?'+':'')+number.format(diff)+' '+t(data.quantityUnit).toLowerCase();
  }
  function changed(){dirty=true;$('incidentDirty').hidden=false;$('incidentState').textContent=t($('status').value);$('incidentState').dataset.status=$('status').value;$('incidentPreviewPanel').hidden=true;$('incidentPreviewPages').replaceChildren();adaptive();}
  function renderPhotos(){
    $('incidentPhotos').replaceChildren();
    if(!photos.length){$('incidentPhotos').append(el('p','incident-hint',t('noPhotos')));return;}
    photos.forEach(photo=>{
      const card=el('div','incident-photo'),im=el('img');im.src=photo.data;im.alt=t(photo.category);const select=el('select');options(select,C.categories);select.value=photo.category;select.setAttribute('aria-label',t('photoCategory'));select.onchange=()=>{photo.category=select.value;im.alt=t(photo.category);changed();};
      const name=el('p','incident-photo-name',photo.name),label=el('label','',t('caption')),caption=el('textarea');caption.value=photo.caption;caption.maxLength=1000;caption.oninput=()=>{photo.caption=caption.value;changed();};label.append(caption);
      const remove=el('button','secondary',t('remove'));remove.type='button';remove.onclick=()=>{photos=photos.filter(item=>item.id!==photo.id);changed();renderPhotos();};select.disabled=caption.disabled=remove.disabled=busy;card.append(im,name,select,label,remove);$('incidentPhotos').append(card);
    });
  }
  function renderHistory(){
    const q=$('incidentSearch').value.toLowerCase().trim(),status=$('incidentStatusFilter').value,type=$('incidentTypeFilter').value;
    $('incidentHistoryCount').textContent=records.length+' '+t('savedCount');$('incidentHistory').replaceChildren();
    const found=records.filter(record=>(!status||record.status===status)&&(!type||record.type===type)&&[record.reportNumber,record.client,record.expectedSku,record.actualSku,record.reportedBy,record.issueTitle,record.location,record.lpn,record.reference,t(record.type)].join(' ').toLowerCase().includes(q));
    if(!found.length)$('incidentHistory').append(el('p','incident-hint',t('noHistory')));
    found.forEach(record=>{const button=el('button');button.type='button';button.disabled=busy;button.dataset.incidentRecord=record.id;button.append(el('strong','',record.reportNumber),el('span','',record.issueTitle||t(record.type||'chooseType')),el('small','',record.client||t('notRecorded')),el('small','',t(record.status)+' · '+R.fmtDate(record.observedAt)));button.onclick=()=>{if(!dirty||confirm(t('confirmReplace'))){load(record);message('ready');}};$('incidentHistory').append(button);});
  }
  function render(){
    for(const node of document.querySelectorAll('[data-copy]'))node.textContent=t(node.dataset.copy);
    $('incidentSearch').placeholder=t('search');$('incidentSearch').setAttribute('aria-label',t('search'));$('incidentStatusFilter').setAttribute('aria-label',t('status'));$('incidentTypeFilter').setAttribute('aria-label',t('type'));document.title='ColdTrack · '+t('title');
    for(const [id,values] of [['type',C.types],['status',C.statuses],['containment',C.actions],['incidentPhotoCategory',C.categories],['quantityUnit',C.quantityUnits]])options($(id),values,id==='type'?'chooseType':undefined);
    options($('incidentStatusFilter'),C.statuses,'allStatuses');options($('incidentTypeFilter'),C.types,'allTypes');$('incidentNumber').textContent=current.reportNumber;$('incidentState').textContent=t($('status').value);$('incidentState').dataset.status=$('status').value;$('incidentDirty').hidden=!dirty;
    adaptive();message(messageKey,messageError);renderPhotos();renderHistory();if(busy)lockControls(true);
  }
  function load(input){
    const data=C.validate(input);current=structuredClone(data);photos=structuredClone(data.photos);for(const id of C.fields)$(id).value=data[id];dirty=false;layoutType=null;$('incidentPreviewPanel').hidden=true;$('incidentPreviewPages').replaceChildren();render();return get();
  }
  const openDB=()=>new Promise((resolve,reject)=>{const request=indexedDB.open('ColdTrack-Product-Incidents',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('reports'))request.result.createObjectStore('reports',{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const all=()=>new Promise((resolve,reject)=>{const transaction=db.transaction('reports','readonly'),request=transaction.objectStore('reports').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const put=data=>new Promise((resolve,reject)=>{const transaction=db.transaction('reports','readwrite');transaction.objectStore('reports').put(data);transaction.oncomplete=()=>resolve();transaction.onerror=transaction.onabort=()=>reject(transaction.error);});
  function download(blob,name){const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  async function save(){
    const data=C.validate(get());data.updatedAt=new Date().toISOString();await ready;if(!db)throw Object.assign(Error('storageUnavailable'),{code:'storageUnavailable'});
    try{await put(data);}catch(_){throw Object.assign(Error('storageFailed'),{code:'storageFailed'});}
    current=structuredClone(data);dirty=false;records=records.filter(record=>record.id!==data.id);records.unshift(structuredClone(data));records.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));render();
    try{C.validate(data,{complete:true});message('saved');}catch(_){message('savedDraft');}return data;
  }
  async function preview(){const data=C.validate(get(),{complete:true}),pages=await R.render(data,lang(),$('incidentLogo').src);$('incidentPreviewPages').replaceChildren(...pages.map((canvas,index)=>{const im=el('img');im.src=canvas.toDataURL('image/jpeg',.94);im.alt=t('page')+' '+(index+1);return im;}));$('incidentPreviewPanel').hidden=false;$('incidentPreviewPanel').scrollIntoView({behavior:'smooth',block:'start'});message('previewReady');return pages;}
  async function exportPDF(){
    const data=C.validate(get(),{complete:true}),language=lang(),pages=await R.render(data,language,$('incidentLogo').src);let stored=true;
    try{await save();}catch(_){stored=false;}
    download(R.pdf(pages),data.reportNumber+'-'+language+'.pdf');message(stored?'pdfReady':'storageUnavailable',!stored);return pages;
  }
  const readFile=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Object.assign(Error('imageError'),{code:'imageError'}));reader.readAsDataURL(file);});
  async function addPhotos(files){
    if(photos.length+files.length>6)throw Object.assign(Error('photoLimit'),{code:'photoLimit'});
    const incoming=[];
    for(const file of files){
      if(file.size>15*1024*1024)throw Object.assign(Error('imageSize'),{code:'imageSize'});if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Object.assign(Error('imageError'),{code:'imageError'});
      const image=await R.image(await readFile(file)),scale=Math.min(1,1600/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      incoming.push({id:crypto.randomUUID(),category:$('incidentPhotoCategory').value||'other',name:file.name,caption:'',data:canvas.toDataURL('image/jpeg',.84)});
    }
    photos.push(...incoming);changed();renderPhotos();message('photoAdded');return photos.length;
  }
  async function run(fn){if(busy)return false;busy=true;lockControls(true);try{return await fn();}catch(error){message(ProductIncidentCopy.es[error.code]?error.code:'operationFailed',true);return false;}finally{busy=false;lockControls(false);}}
  buildFields();load(current);
  const ready=(async()=>{try{db=await openDB();records=(await all()).flatMap(record=>{try{return [C.validate(record)];}catch(_){return [];}}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));renderHistory();}catch(_){message('storageUnavailable',true);}})();
  $('incidentForm').onsubmit=event=>event.preventDefault();$('incidentSave').onclick=()=>run(save);$('incidentPDF').onclick=()=>run(exportPDF);$('incidentPreview').onclick=()=>run(preview);
  $('incidentClosePreview').onclick=()=>{$('incidentPreviewPanel').hidden=true;$('incidentPreviewPages').replaceChildren();};
  $('incidentNew').onclick=()=>{if(!dirty||confirm(t('confirmReplace'))){load(C.fresh());message('ready');}};
  $('incidentExportData').onclick=()=>run(()=>{const data=C.validate(get());download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),data.reportNumber+'.json');message('dataReady');});
  $('incidentImportData').onclick=()=>$('incidentDataFile').click();
  $('incidentDataFile').onchange=event=>run(async()=>{try{const file=event.target.files?.[0];if(!file)return;if(file.size>30*1024*1024)throw Object.assign(Error('jsonSize'),{code:'jsonSize'});let data;try{data=C.validate(JSON.parse(await file.text()));}catch(error){throw Object.assign(Error('invalidData'),{code:error.code||'invalidData'});}if(dirty&&!confirm(t('confirmReplace')))return;load(data);changed();message('imported');}finally{event.target.value='';}});
  $('incidentPhotosUpload').onclick=()=>$('incidentPhotoFiles').click();$('incidentCameraOpen').onclick=()=>$('incidentCamera').click();
  for(const input of [$('incidentPhotoFiles'),$('incidentCamera')])input.onchange=event=>run(async()=>{try{await addPhotos(Array.from(event.target.files||[]));}finally{event.target.value='';}});
  $('incidentSearch').oninput=renderHistory;$('incidentStatusFilter').onchange=renderHistory;$('incidentTypeFilter').onchange=renderHistory;
  window.addEventListener('coldtrack-language-change',()=>{$('incidentPreviewPanel').hidden=true;$('incidentPreviewPages').replaceChildren();render();});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  globalThis.ProductIncidentApp={ready,get,load,render,get records(){return structuredClone(records);},get dirty(){return dirty;},get busy(){return busy;},save:()=>run(save),exportPDF:()=>run(exportPDF),preview:()=>run(preview),addPhotos:files=>run(()=>addPhotos(files))};
})();
