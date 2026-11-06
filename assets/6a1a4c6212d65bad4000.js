/* Inventory forecast: source quantities, FEFO, separate external stock and calendar-hour notice. */
globalThis.ForecastCore=(()=>{
'use strict';
const HOUR=3600000,DAY=24*HOUR,EPS=1e-7,clean=v=>String(v??'').trim(),header=v=>clean(v).toLowerCase().replace(/[^a-z0-9]/g,''),id=(client,sku)=>JSON.stringify([client,sku]);
const round=v=>Math.round(v*1e6)/1e6,number=v=>clean(v)===''?NaN:typeof v==='number'?v:Number(clean(v).replaceAll(',',''));
const dtfs=new Map();
function parts(at,zone='America/New_York'){
 if(!dtfs.has(zone))dtfs.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
 const p=Object.fromEntries(dtfs.get(zone).formatToParts(new Date(at)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return {date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute,year:+p.year,month:+p.month,day:+p.day,hour:+p.hour,minute:+p.minute,second:+p.second};
}
function fromLocal(value,zone='America/New_York'){
 const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);if(!m)throw Error('Fecha de referencia inválida / Invalid reference date.');
 const [,y,mo,d,h,mi]=m.map(Number),target=Date.UTC(y,mo-1,d,h,mi);let at=target;
 for(let i=0;i<4;i++){const p=parts(at,zone),seen=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second),delta=target-seen;if(!delta)break;at+=delta;}
 const p=parts(at,zone);if(p.date+'T'+p.time!==value)throw Error('Fecha u hora local inexistente / Invalid local date or time.');return at;
}
function shiftDate(date,n){const m=date.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)throw Error('Invalid date');return new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+n)).toISOString().slice(0,10);}
function addDays(at,n,zone){const p=parts(at,zone);return fromLocal(shiftDate(p.date,n)+'T'+p.time,zone);}
function isoDate(value,date1904=false){
 if(value===null||clean(value)==='')return null;let iso;
 if(typeof value==='number'){if(value<1||value>200000)throw Error('Fecha de Excel inválida');const start=Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30);iso=new Date(start+Math.floor(value)*DAY).toISOString().slice(0,10);}
 else{const s=clean(value),a=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/),b=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:[ T].*)?$/);if(a)iso=a[1]+'-'+a[2]+'-'+a[3];else if(b)iso=(b[3].length===2?'20'+b[3]:b[3])+'-'+b[1].padStart(2,'0')+'-'+b[2].padStart(2,'0');else throw Error('Expiración inválida');}
 const time=Date.parse(iso+'T00:00:00Z');if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==iso)throw Error('Expiración inválida');return iso;
}
function table(workbook,required,optional={}){
 for(const sheet of workbook)for(let i=0;i<Math.min(15,sheet.rows.length);i++){
  const h=sheet.rows[i].values.map(header),columns={};for(const [k,aliases]of Object.entries({...required,...optional}))columns[k]=h.findIndex(v=>(Array.isArray(aliases)?aliases:[aliases]).some(a=>header(a)===v));
  if(Object.keys(required).every(k=>columns[k]>=0))return {sheet,c:columns,rows:sheet.rows.slice(i+1).filter(r=>r.values.some(v=>clean(v)!==''))};
 }
 throw Error('Faltan columnas requeridas / Required columns are missing: '+Object.values(required).flat().join(', '));
}
function parseStock(workbook,filename){
 const {sheet,c,rows}=table(workbook,{client:'Business Unit - Name',sku:'Item - Number',loc:'Location - Locator',units:'Total Units',type:'Location - Storage Type',locStatus:'Location - Status',status:'Status',expiry:'Expiration Date',tracking:'Item - Lot Tracking Enabled'},{sourceId:'ID',name:'Item - Name',locId:'Location - Number',lot:'Lot Number',container:'Container - Lpn Number',container2:'Container - Number',pack:'Pack - Pack Key',packQty:'Quantity'});
 const result=[],seen=new Set();
 for(const row of rows){const get=k=>c[k]>=0?row.values[c[k]]:'',client=clean(get('client')),sku=clean(get('sku')),loc=clean(get('loc')),units=number(get('units')),sourceId=clean(get('sourceId'))||'row-'+row.row;
  if(!client||!sku||!loc)throw Error('Fila / Row '+row.row+': falta cliente, SKU o ubicación.');
  if(!Number.isFinite(units)||units<0||units>1e12)throw Error('Fila / Row '+row.row+': Total Units inválido.');
  if(seen.has(sourceId))throw Error('ID duplicado / Duplicate ID: '+sourceId);seen.add(sourceId);
  let expiry=null,dateIssue=false;try{expiry=isoDate(get('expiry'),sheet.date1904);}catch(_){dateIssue=true;}
  const pack=clean(get('pack')),m=pack.match(/--([0-9]+(?:\.[0-9]+)?)$/),p=m?+m[1]:null,q=number(get('packQty')),factor=p>0&&Number.isFinite(q)&&Math.abs(q*p-units)<EPS?p:null;
  result.push({sourceId,client,sku,name:clean(get('name'))||sku,loc,locId:clean(get('locId'))||loc,units,lot:clean(get('lot')),expiry,expiryRaw:clean(get('expiry')),dateIssue,tracking:/^(true|1|yes)$/i.test(clean(get('tracking'))),container:clean(get('container'))||clean(get('container2')),factor,type:clean(get('type')),locStatus:clean(get('locStatus')),status:clean(get('status'))});
 }
 if(!result.length)throw Error('El archivo no tiene inventario / No stock rows.');return {filename:clean(filename),sheet:sheet.name,rows:result};
}
function parseUsage(workbook,filename){
 const {sheet,c,rows}=table(workbook,{client:'Business Unit.Name',sku:'Item.Number',week:'Order Header.Actual Ship Date.week',qty:'OrderLine.Shipped Pack Quantity.sum'}),records=[],weeks=[],seen=new Set();
 for(const r of rows){const v=r.values,client=clean(v[c.client]),sku=clean(v[c.sku]),week=clean(v[c.week]),qty=number(v[c.qty]);
  if(!client||!sku||!/^\d{1,2}$/.test(week)||+week<1||+week>53||!Number.isFinite(qty)||qty<0||qty>1e12)throw Error('Fila de consumo inválida / Invalid usage row '+r.row);
  const k=JSON.stringify([client,sku,week]);if(seen.has(k))throw Error('Consumo duplicado / Duplicate usage: '+k);seen.add(k);if(!weeks.includes(week))weeks.push(week);records.push({client,sku,week,qty});
 }
 if(!records.length)throw Error('No hay consumo / No usage rows.');
 if(weeks.slice(1).some((w,i)=>Math.abs(+w-+weeks[i])>26))throw Error('Cambio de año ambiguo: usá un reporte con fechas / Ambiguous year rollover: use dated history.');
 const asc=weeks.length>1&&weeks.slice(1).every((w,i)=>+w>+weeks[i]),desc=weeks.slice(1).every((w,i)=>+w<+weeks[i]);
 if(asc)weeks.reverse();else if(!desc)throw Error('Ordená las semanas de reciente a antigua; un cambio de año necesita un reporte con fecha / Sort weeks newest first; year rollovers require dated history.');
 return {filename:clean(filename),sheet:sheet.name,rows:records,weeks};
}
function cutoffDays(client,s){const rule=s.rules?.find(r=>r.client===client);return rule?rule.days:/pressed\s*juicery/i.test(client)?14:0;}
function selectedWeeks(usage,s){return usage.weeks.slice(s.skipNewest?1:0,s.skipNewest?1+s.weeks:s.weeks);}
function validSettings(s){
 for(const key of ['sendDate','pullDate','rotationDate'])if(s[key]){if(isoDate(s[key])!==s[key]||s[key]<s.asOf.slice(0,10)||s[key]>shiftDate(s.asOf.slice(0,10),365))throw Error('Elegí una fecha desde el inventario y hasta un año después / Choose a date from the stock reference through one year later.');fromLocal(s[key]+'T'+(s[key.replace('Date','Time')]||s.asOf.slice(11,16)),s.zone);}
 for(const key of ['sendTime','pullTime','rotationTime'])if(s[key]&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(s[key]))throw Error('Hora de movimiento inválida / Invalid movement time.');
 if(s.keepDays!==undefined&&(!Number.isInteger(s.keepDays)||s.keepDays<1||s.keepDays>90))throw Error('Cobertura local: 1 a 90 días / Local coverage: 1 to 90 days.');
 if(!['pending','each','cases'].includes(s.basis)||!Number.isInteger(s.weeks)||s.weeks<1||s.weeks>52||![7,14,30].includes(s.horizon)||!Number.isFinite(s.leadHours)||s.leadHours<0||s.leadHours>720||!Number.isFinite(s.multiplier)||s.multiplier<0||s.multiplier>5||!Number.isInteger(s.coverDays)||s.coverDays<1||s.coverDays>30||!Array.isArray(s.days)||!s.days.length||new Set(s.days).size!==s.days.length||s.days.some(d=>!Number.isInteger(d)||d<0||d>6)||!Array.isArray(s.rules)||s.rules.some(r=>typeof r.client!=='string'||!Number.isInteger(r.days)||r.days<0||r.days>365)||!Array.isArray(s.overrides)||s.overrides.some(o=>typeof o.id!=='string'||(o.weekly!==null&&(!Number.isFinite(o.weekly)||o.weekly<0||o.weekly>1e12))||(o.factor!==null&&(!Number.isFinite(o.factor)||o.factor<=0||o.factor>1e6))))throw Error('Revisá las reglas / Check forecast settings.');
 fromLocal(s.asOf,s.zone);return true;
}
function prepareRows(stock,s){const start=fromLocal(s.asOf,s.zone),cache=new Map();return stock.rows.map(r=>{
 const days=cutoffDays(r.client,s),key=(r.expiry||'')+'|'+days;let cutoff=Infinity;
 if(r.expiry){if(!cache.has(key))cache.set(key,fromLocal(shiftDate(r.expiry,-days)+'T00:00',s.zone));cutoff=cache.get(key);}
 let excluded='';
 if(r.dateIssue||(!r.expiry&&r.tracking))excluded='date';
 else if(r.locStatus.toLowerCase()!=='ready'||(r.status&&r.status.toLowerCase()!=='ready'))excluded='hold';
 else if(cutoff<=start)excluded='cutoff';
 const external=clean(r.loc).toLowerCase()==='vertical';
 if(!excluded&&!external&&!/^(reserve storage|split case picking|picking)$/i.test(r.type))excluded='area';
 return {...r,cutoff,external,excluded};
});}
function calendar(start,end,s){const points=[start];let t=start;
 while(t<end){const p=parts(t,s.zone),next=fromLocal(shiftDate(p.date,1)+'T00:00',s.zone);t=Math.min(next,end);if(t<=points.at(-1))throw Error('Calendar boundary failed');points.push(t);}
 return points;
}
function demandBetween(weekly,start,end,s){if(end<=start||weekly<=0)return 0;let t=start,total=0;
 while(t<end-EPS){const p=parts(t,s.zone),mid=fromLocal(p.date+'T00:00',s.zone),next=fromLocal(shiftDate(p.date,1)+'T00:00',s.zone),to=Math.min(next,end),weekday=new Date(p.date+'T12:00:00Z').getUTCDay();if(s.days.includes(weekday))total+=weekly/s.days.length*(to-t)/(next-mid);t=to;}return total;
}
function simulate(lots,weekly,start,end,s,boundaries=calendar(start,end,s)){
 const bins=lots.map(r=>({...r,left:r.units,used:0,waste:0})).sort((a,b)=>a.cutoff-b.cutoff||a.sourceId.localeCompare(b.sourceId));
 const events=[...new Set([start,end,...boundaries.filter(t=>t>start&&t<end),...bins.map(r=>r.cutoff).filter(t=>t>start&&t<=end)])].sort((a,b)=>a-b);
 let shortage=0,waste=0,firstShortage=null;const samples=[],remaining=()=>bins.reduce((sum,r)=>sum+r.left,0);
 for(let n=0;n<events.length;n++){const at=events[n];for(const b of bins)if(b.cutoff<=at&&b.left>EPS){waste+=b.left;b.waste+=b.left;b.left=0;}
  samples.push({at,available:round(remaining()),shortage:round(shortage),waste:round(waste)});if(n===events.length-1)break;
  const to=events[n+1],need=demandBetween(weekly,at,to,s);let left=need,used=0;
  for(const b of bins){if(left<=EPS)break;const take=Math.min(b.left,left);b.left-=take;b.used+=take;used+=take;left-=take;}
  if(left>EPS){shortage+=left;if(firstShortage===null)firstShortage=at+(need>0?used/need*(to-at):0);}
 }
 return {bins,firstShortage,shortage:round(shortage),waste:round(waste),remaining:round(remaining()),samples};
}
function atSample(result,at){let sample=result.samples[0];for(const next of result.samples){if(next.at>at)break;sample=next;}return sample;}
function palletize(rows){
 const groups=new Map();for(const r of rows){r.palletIssue=r.container?'':'palletMissing';r.palletEligible=false;r.palletSourceIds=[];if(r.container&&r.units>EPS){if(!groups.has(r.container))groups.set(r.container,[]);groups.get(r.container).push(r);}}
 for(const [lpn,lines]of groups){let issue='';if(new Set(lines.map(r=>id(r.client,r.sku))).size!==1)issue='palletMixed';else if(new Set(lines.map(r=>r.loc)).size!==1)issue='palletLocations';else if(lines.some(r=>r.excluded||!/^reserve storage$/i.test(r.type)))issue='palletBlocked';const ids=lines.map(r=>r.sourceId);for(const r of lines){r.palletIssue=issue;r.palletEligible=!issue;r.palletSourceIds=ids;}}
 return rows;
}
function fullPallets(rows){const groups=new Map();for(const r of rows)if(r.palletEligible&&r.units>EPS){if(!groups.has(r.container))groups.set(r.container,[]);groups.get(r.container).push(r);}return [...groups.values()].filter(lines=>lines.length===lines[0].palletSourceIds.length&&lines.every(r=>r.palletSourceIds.every(id=>lines.some(l=>l.sourceId===id))));}
function planSend(onSiteLots,weekly,start,s){
 const sendAt=s.sendDate?fromLocal(s.sendDate+'T'+(s.sendTime||s.asOf.slice(11,16)),s.zone):start,keepUntil=addDays(sendAt,s.keepDays??14,s.zone)+s.leadHours*HOUR,returnUntil=addDays(keepUntil+s.leadHours*HOUR,s.coverDays,s.zone);
 if(sendAt<start)throw Error('El envío no puede ser anterior al inventario / Shipment cannot precede the stock reference.');
 if(weekly===null||weekly<=0)return {sendQty:weekly===null?null:0,sendPallets:0,sendAllocations:[],sendAt,keepUntil,returnUntil};
 if(onSiteLots.some(r=>r.palletEligible===undefined))onSiteLots=palletize(onSiteLots.map(r=>({...r})));
 const kept=simulate(onSiteLots,weekly,start,keepUntil,s);
 if(kept.shortage>EPS)return {sendQty:0,sendPallets:0,sendAllocations:[],sendAt,keepUntil,returnUntil};
 const eligible=fullPallets(kept.bins).filter(lines=>lines.every(b=>!/(?:^|[^a-z])pf/i.test(b.loc)&&!/a[12]$/i.test(b.loc)&&b.cutoff>returnUntil&&b.used<=EPS&&b.waste<=EPS&&Math.abs(b.left-b.units)<=EPS)).sort((a,b)=>Math.min(...b.map(r=>r.cutoff))-Math.min(...a.map(r=>r.cutoff))||a[0].container.localeCompare(b[0].container));
 const sendAllocations=eligible.flatMap(lines=>lines.map(b=>({sourceId:b.sourceId,lot:b.lot,expiry:b.expiry,container:b.container,location:b.loc,units:b.units,sourceUnits:b.units,cutoff:b.cutoff})));
 return {sendQty:round(sendAllocations.reduce((sum,b)=>sum+b.units,0)),sendPallets:eligible.length,sendAllocations,sendAt,keepUntil,returnUntil};
}
/* A replacement is conditional: receive the older external LPN before releasing
   its newer reserve counterpart. Neither leg changes the baseline projection. */
function planRotation(r,start,s){
 const at=s.rotationDate?fromLocal(s.rotationDate+'T'+(s.rotationTime||s.asOf.slice(11,16)),s.zone):start+s.leadHours*HOUR;
 if(at<start)throw Error('El intercambio no puede ser anterior al inventario / Replacement cannot precede the stock reference.');
 const local=r.onSiteLots.filter(b=>b.units>EPS&&b.expiry),outside=r.externalLots.filter(b=>b.units>EPS&&b.expiry),latest=local.reduce((v,b)=>b.expiry>v?b.expiry:v,''),older=outside.filter(b=>b.expiry<latest);
 const result={detected:older.length>0,at,requestAt:at-s.leadHours*HOUR,pairs:[],reason:'',outsideExpiry:older.map(b=>b.expiry).sort()[0]||null,insideExpiry:latest||null};
 if(!result.detected)return result;
 if(r.weekly===null){result.reason='rotationData';return result;}
 if(r.weekly<=0){result.reason='rotationZero';return result;}
 if(at<start+s.leadHours*HOUR-EPS){result.reason='rotationNotice';return result;}
 const reservedIn=new Set(r.allocations.map(b=>b.container)),reservedOut=new Set(r.sendAllocations.map(b=>b.container));
 const incoming=fullPallets(r.externalLots).filter(lines=>lines.every(b=>b.expiry&&b.expiry<latest&&b.cutoff>at)&&!reservedIn.has(lines[0].container)).sort((a,b)=>Math.min(...a.map(b=>b.cutoff))-Math.min(...b.map(b=>b.cutoff))||a[0].container.localeCompare(b[0].container));
 if(!incoming.length){result.reason=older.every(b=>reservedIn.has(b.container))?'rotationCoverage':older.every(b=>b.cutoff<=at)?'rotationArrival':'rotationPallet';return result;}
 const before=simulate(r.onSiteLots,r.weekly,start,at,s),remaining=before.bins.filter(b=>b.left>EPS).map(b=>({...b,units:b.left})),keepUntil=addDays(at,s.keepDays??14,s.zone)+s.leadHours*HOUR,returnUntil=addDays(keepUntil+s.leadHours*HOUR,s.coverDays,s.zone);
 const outgoing=fullPallets(before.bins).filter(lines=>!reservedOut.has(lines[0].container)&&lines.every(b=>b.expiry&&!/(?:^|[^a-z])pf/i.test(b.loc)&&!/a[12]$/i.test(b.loc)&&b.used<=EPS&&b.waste<=EPS&&Math.abs(b.left-b.units)<=EPS&&b.cutoff>returnUntil)).sort((a,b)=>Math.min(...b.map(r=>r.cutoff))-Math.min(...a.map(r=>r.cutoff))||a[0].container.localeCompare(b[0].container));
 const selectedIn=[],selectedOut=new Set(),allocation=b=>({sourceId:b.sourceId,lot:b.lot,expiry:b.expiry,container:b.container,location:b.loc,units:b.units,sourceUnits:b.units,cutoff:b.cutoff});
 let reason='rotationReserve';
 for(const pallet of incoming){
  const newestIn=pallet.reduce((v,b)=>b.expiry>v?b.expiry:v,'');
  for(const replacement of outgoing){
   if(selectedOut.has(replacement[0].container)||replacement.some(b=>b.expiry<=newestIn))continue;
   const outgoingIds=new Set([...selectedOut,replacement[0].container]),trial=[...remaining.filter(b=>!outgoingIds.has(b.container)),...selectedIn,...pallet];
   if(simulate(trial,r.weekly,at,keepUntil,s).shortage>EPS){reason='rotationCoverageRisk';continue;}
   // There is enough scheduled demand to consume all stock by this upper bound;
   // stop sooner at the latest incoming cutoff. Check every incoming source row.
   const maxCutoff=Math.max(...selectedIn.map(b=>b.cutoff),...pallet.map(b=>b.cutoff)),total=trial.reduce((sum,b)=>sum+b.units,0),weeks=Math.ceil(total/r.weekly)+1,daysToCutoff=Math.ceil((maxCutoff-at)/DAY)+2,consumeEnd=Math.min(maxCutoff,addDays(at,Math.min(weeks*7,daysToCutoff),s.zone));
   const consumed=simulate(trial,r.weekly,at,consumeEnd,s),incomingIds=new Set([...selectedIn,...pallet].map(b=>b.sourceId));
   if(consumed.bins.some(b=>incomingIds.has(b.sourceId)&&(b.used<b.units-EPS||b.waste>EPS))){reason='rotationConsumption';continue;}
   selectedIn.push(...pallet);selectedOut.add(replacement[0].container);
   result.pairs.push({incoming:pallet.map(allocation),outgoing:replacement.map(allocation)});break;
  }
 }
 const selectedLpns=new Set(selectedIn.map(b=>b.container)),pending=older.filter(b=>!reservedIn.has(b.container)&&!selectedLpns.has(b.container));
 result.reviewCount=new Set(pending.map(b=>b.container||b.sourceId)).size;
 result.reason=result.reviewCount?(pending.some(b=>b.cutoff<=at)?'rotationArrival':pending.some(b=>!incoming.some(p=>p.some(a=>a.sourceId===b.sourceId)))?'rotationPallet':reason):'';return result;
}
function evaluate(stock,usage,s,ice=null){
 validSettings(s);const start=fromLocal(s.asOf,s.zone),end=addDays(start,s.horizon,s.zone),lookEnd=addDays(start,s.horizon+Math.ceil(s.leadHours/24)+s.coverDays+2,s.zone),bounds=calendar(start,lookEnd,s),selected=selectedWeeks(usage,s),rows=palletize(prepareRows(stock,s)),groups=new Map(),selectedSet=new Set(selected);
 const ensure=(client,sku)=>{const k=id(client,sku);if(!groups.has(k))groups.set(k,{id:k,client,sku,name:sku,stock:[],usage:[]});return groups.get(k);};
 for(const r of rows){const g=ensure(r.client,r.sku);g.name=r.name;g.stock.push(r);}
 for(const r of usage.rows)ensure(r.client,r.sku).usage.push(r);
 const iceProfiles=globalThis.ForecastIce?.profiles(stock,ice,s)||new Map();for(const profile of iceProfiles.values()){const g=ensure(profile.client,profile.sku);g.ice=profile;if(!g.stock.length)g.name=profile.name;}
 const results=[];
 for(const g of groups.values()){
  const valid=g.stock.filter(r=>!r.excluded),onSiteLots=valid.filter(r=>!r.external),externalLots=valid.filter(r=>r.external),override=s.overrides.find(o=>o.id===g.id),cases=[...new Set(g.stock.map(r=>r.factor).filter(f=>f>1))],caseFactor=cases.length===1?cases[0]:null,selectedUsage=g.usage.filter(r=>selectedSet.has(r.week));
  let weekly=null,dataReason='',factor=null;
  if(override?.weekly!==null&&override?.weekly!==undefined){weekly=override.weekly*s.multiplier;factor=1;}
  else if(g.ice&&!g.usage.length){weekly=g.ice.weekly===null?null:g.ice.weekly*s.multiplier;factor=1;dataReason=g.ice.reason;}
  else if(s.basis==='pending')dataReason='units';
  else if(!selected.length||!g.usage.length)dataReason='history';
  else if(!selectedUsage.length&&g.usage.every(r=>usage.weeks.indexOf(r.week)<(s.skipNewest?1:0)))dataReason='recentOnly';
  else{factor=s.basis==='each'?1:override?.factor||caseFactor;if(!factor)dataReason='factor';else weekly=selectedUsage.reduce((sum,r)=>sum+r.qty,0)/selected.length*factor*s.multiplier;}
  const sum=rs=>round(rs.reduce((a,r)=>a+r.units,0)),site=sum(onSiteLots),external=sum(externalLots),excluded=sum(g.stock.filter(r=>r.excluded)),cutoffNow=sum(g.stock.filter(r=>r.excluded==='cutoff')),dateUnits=sum(g.stock.filter(r=>r.excluded==='date'));
  const base={...g,onSiteLots,externalLots,onSite:site,external,excluded,gross:sum(g.stock),cutoffNow,dateUnits,weekly,caseFactor,dataReason,selectedWeeks:selected,known:weekly!==null,manual:override?.weekly!==null&&override?.weekly!==undefined,factor,scopeDays:cutoffDays(g.client,s),...planSend(onSiteLots,weekly,start,s)};
  if(weekly===null){results.push({...base,status:'data',shortageAt:null,requestAt:null,requestQty:0,requestPallets:0,roundingExtra:0,arrivalAt:null,projected:null,shortage:null,waste:null,cutoffRisk:cutoffNow,projection:null,allocations:[],gap48:null});continue;}
  const sim=simulate(onSiteLots,weekly,start,lookEnd,s,bounds),horizon=simulate(onSiteLots,weekly,start,end,s,bounds),shortageAt=sim.firstShortage,plannedArrival=s.pullDate?fromLocal(s.pullDate+'T'+(s.pullTime||s.asOf.slice(11,16)),s.zone):null,arrivalAt=plannedArrival??(shortageAt===null?null:Math.max(shortageAt,start+s.leadHours*HOUR)),requestAt=plannedArrival!==null?plannedArrival-s.leadHours*HOUR:shortageAt===null?null:shortageAt-s.leadHours*HOUR;
  if(arrivalAt!==null&&arrivalAt<start)throw Error('La llegada no puede ser anterior al inventario / Arrival cannot precede the stock reference.');
  const wasteExternal=sum(externalLots.filter(r=>r.cutoff<=end)),cutoffRisk=round(cutoffNow+horizon.waste+wasteExternal);
  let requestQty=0,requestPallets=0,roundingExtra=0,uncovered=0,allocations=[];
  if(arrivalAt!==null&&(plannedArrival!==null||requestAt<=end+EPS)&&weekly>0){
   const coverageEnd=addDays(arrivalAt,s.coverDays,s.zone),before=simulate(onSiteLots,weekly,start,arrivalAt,s,bounds),remaining=before.bins.filter(r=>r.left>EPS).map(r=>({...r,units:r.left}));
   const eligible=fullPallets(externalLots).filter(lines=>lines.every(r=>r.cutoff>arrivalAt)).sort((a,b)=>Math.min(...a.map(r=>r.cutoff))-Math.min(...b.map(r=>r.cutoff))||a[0].container.localeCompare(b[0].container));
   const noPull=simulate(remaining,weekly,arrivalAt,coverageEnd,s);let combined=noPull,chosen=[];
   for(const pallet of eligible){if(combined.shortage<=EPS)break;const trial=simulate([...remaining,...chosen,...pallet],weekly,arrivalAt,coverageEnd,s);if(trial.shortage>=combined.shortage-EPS)continue;chosen.push(...pallet);combined=trial;requestPallets++;}
   allocations=chosen.map(b=>({sourceId:b.sourceId,lot:b.lot,expiry:b.expiry,container:b.container,location:b.loc,units:b.units,sourceUnits:b.units,cutoff:b.cutoff}));requestQty=sum(chosen);uncovered=combined.shortage;roundingExtra=round(Math.max(0,requestQty-noPull.shortage));
  }
  const gap48=simulate(onSiteLots,weekly,start,start+s.leadHours*HOUR,s,bounds).shortage;
  let status='covered';if(requestQty>0&&requestAt<=start+EPS)status='urgent';else if(requestQty>0&&(plannedArrival!==null||requestAt<=end+EPS))status='transfer';else if(horizon.shortage>EPS)status='shortage';else if(cutoffRisk>EPS)status='expiry';else if(base.sendQty>0)status='excess';else if(weekly===0)status='idle';
  results.push({...base,status,shortageAt,requestAt,requestQty,requestPallets,roundingExtra,arrivalAt,projected:horizon.remaining,shortage:horizon.shortage,waste:horizon.waste,cutoffRisk,projection:sim,horizonSamples:horizon.samples,allocations,uncovered,gap48});
 }
 for(const r of results){r.rotation=planRotation(r,start,s);if(r.rotation.detected&&!['urgent','shortage','transfer','data'].includes(r.status))r.status='rotation';}
 const order={urgent:0,shortage:1,transfer:2,rotation:3,expiry:4,excess:5,data:6,covered:7,idle:8};results.sort((a,b)=>order[a.status]-order[b.status]||(a.requestAt??Infinity)-(b.requestAt??Infinity)||a.client.localeCompare(b.client)||a.sku.localeCompare(b.sku,undefined,{numeric:true}));
 return {start,end,selectedWeeks:selected,rows:results,stockRows:stock.rows.length,usageRows:usage.rows.length,clientCount:new Set(results.map(r=>r.client)).size,externalRows:rows.filter(r=>r.external).length};
}
return {HOUR,DAY,EPS,id,round,parts,fromLocal,shiftDate,addDays,isoDate,parseStock,parseUsage,cutoffDays,selectedWeeks,validSettings,prepareRows,palletize,fullPallets,demandBetween,simulate,planSend,planRotation,evaluate};
})();
