/* Shared source validation and inactivity evidence. Quantities remain in their source units. */
globalThis.ColdTrackDataCore=(()=>{
  'use strict';
  const DAY=86400000,clean=v=>String(v??'').trim(),key=v=>clean(v).toLowerCase().replace(/[^a-z0-9]/g,''),itemKey=(client,sku)=>JSON.stringify([client,sku]);
  const number=v=>clean(v)===''?null:Number(clean(v).replaceAll(',',''));
  const fail=(code,detail='')=>{throw Object.assign(Error(code),{code,detail});};
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
  const days=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/DAY);
  function date(v,date1904=false){
    if(v===null||clean(v)==='')return null;
    if(typeof v==='number'){if(!Number.isFinite(v)||v<1||v>200000)return null;return new Date(Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30)+Math.floor(v)*DAY).toISOString().slice(0,10);}
    const raw=clean(v),iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/),us=raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:[ T].*)?$/);
    const out=iso?iso[1]+'-'+iso[2]+'-'+iso[3]:us?(us[3].length===2?'20'+us[3]:us[3])+'-'+us[1].padStart(2,'0')+'-'+us[2].padStart(2,'0'):null;
    return validDate(out)?out:null;
  }
  function table(workbook,required,optional={}){
    for(const sheet of workbook)for(let n=0;n<Math.min(20,sheet.rows.length);n++){
      const headers=sheet.rows[n].values.map(key),c={};
      for(const [field,aliases] of Object.entries({...required,...optional}))c[field]=headers.findIndex(h=>[].concat(aliases).some(alias=>key(alias)===h));
      if(Object.keys(required).every(field=>c[field]>=0))return {sheet,c,rows:sheet.rows.slice(n+1).filter(r=>r.values.some(v=>clean(v)!==''))};
    }
    fail('columns',Object.values(required).map(v=>[].concat(v)[0]).join(', '));
  }
  function stock(workbook){
    const {sheet,c,rows}=table(workbook,{client:'Business Unit - Name',sku:'Item - Number',location:'Location - Locator',units:'Total Units'},{id:'ID',clientCode:'Business Unit - Code',name:'Item - Name',lot:'Lot Number',expiry:'Expiration Date',lpn:['Container - Lpn Number','Container - Number'],type:'Location - Storage Type',created:'Created Date',packQty:'Quantity'}),seen=new Set();
    if(!rows.length)fail('empty');if(rows.length>200000)fail('rowLimit');
    const result=rows.map(r=>{const get=k=>c[k]<0?'':r.values[c[k]],id=clean(get('id'))||'row-'+r.row,units=number(get('units'));
      if(!clean(get('client'))||!clean(get('sku'))||!clean(get('location')))fail('badRow',String(r.row));
      if(units===null||!Number.isFinite(units)||Math.abs(units)>1e12)fail('badQuantity',String(r.row));if(seen.has(id))fail('duplicate',id);seen.add(id);
      const expiry=date(get('expiry'),sheet.date1904),expiryRaw=clean(get('expiry'));
      return {id,client:clean(get('client')),clientCode:clean(get('clientCode')),sku:clean(get('sku')),name:clean(get('name'))||clean(get('sku')),location:clean(get('location')),units,lot:clean(get('lot')),expiry,expiryRaw,dateReason:!expiry?(expiryRaw?'Sin expiración válida':'Sin expiración'):'',lpn:clean(get('lpn')),type:clean(get('type')),packQty:number(get('packQty'))};
    });return {rows:result,sheet:sheet.name};
  }
  function usage(workbook){
    const {sheet,c,rows}=table(workbook,{client:['Business Unit.Name','Business Unit - Name'],sku:['Item.Number','Item - Number'],week:'Order Header.Actual Ship Date.week',qty:'OrderLine.Shipped Pack Quantity.sum'}),seen=new Set(),weeks=new Set();
    if(!rows.length)fail('empty');if(rows.length>200000)fail('rowLimit');
    const result=rows.map(r=>{const get=k=>r.values[c[k]],client=clean(get('client')),sku=clean(get('sku')),week=clean(get('week')),qty=number(get('qty')),id=JSON.stringify([client,sku,week]);
      if(!client||!sku||!/^\d{1,2}$/.test(week)||+week<1||+week>53||qty===null||!Number.isFinite(qty)||qty<0||qty>1e12)fail('badUsage',String(r.row));if(seen.has(id))fail('duplicate',id);seen.add(id);weeks.add(+week);return {client,sku,week:+week,qty};
    });const ordered=[...weeks].sort((a,b)=>b-a);if(ordered.length>1&&ordered[0]-ordered.at(-1)>26)fail('yearRollover');return {rows:result,weeks:ordered,sheet:sheet.name};
  }
  function activity(workbook){
    const {sheet,c,rows}=table(workbook,{client:['Business Unit - Code','Business Unit - Name'],sku:'Item - Number',name:'Activity Name',at:'Start Time'},{id:'ID',process:'Process Name',qty:'Quantity',units:'Total Units (api)',stop:'Stop Time',lot:'Lot #',lpn:['Container - Lpn Number','LPN #']}),seen=new Set();
    if(!rows.length)fail('empty');if(rows.length>250000)fail('rowLimit');let undated=0;
    const result=rows.map(r=>{const get=k=>c[k]<0?'':r.values[c[k]],id=clean(get('id'))||'row-'+r.row;if(seen.has(id))fail('duplicate',id);seen.add(id);
      const at=date(get('stop'),sheet.date1904)||date(get('at'),sheet.date1904);if(!at)undated++;
      return {id,client:clean(get('client')),sku:clean(get('sku')),name:clean(get('name')),process:clean(get('process')),at,qty:number(get('qty')),units:number(get('units')),lot:clean(get('lot')),lpn:clean(get('lpn'))};
    });const dates=result.map(r=>r.at).filter(Boolean).sort();if(!dates.length)fail('noDates');return {rows:result,sheet:sheet.name,first:dates[0],last:dates.at(-1),undated,names:[...new Set(result.map(r=>r.name).filter(Boolean))].sort(),clients:[...new Set(result.map(r=>r.client).filter(Boolean))].sort()};
  }
  function activityCollector(){
    const required={client:['Business Unit - Code','Business Unit - Name'],sku:'Item - Number',name:'Activity Name',at:'Start Time'},optional={id:'ID',process:'Process Name',qty:'Quantity',units:'Total Units (api)',stop:'Stop Time'};
    const seen=new Set(),groups=new Map(),names=new Set(),clients=new Set();let columns=null,sheet='',count=0,undated=0,first=null,last=null;
    function row(values,meta){
      if(!columns){
        if(meta.row>20)return;const labels=values.map(key),found={};
        for(const [field,aliases]of Object.entries({...required,...optional}))found[field]=labels.findIndex(label=>[].concat(aliases).some(alias=>key(alias)===label));
        if(!Object.keys(required).every(field=>found[field]>=0))return;columns=found;sheet=meta.sheet;return new Set(Object.values(found).filter(n=>n>=0));
      }
      if(meta.sheet!==sheet||!values.some(v=>clean(v)!==''))return;
      if(++count>1000000)fail('activityRowLimit');
      const get=k=>columns[k]<0?'':values[columns[k]],sourceId=clean(get('id'));
      if(sourceId){if(seen.has(sourceId))fail('duplicate',sourceId);seen.add(sourceId);}
      const client=clean(get('client')),sku=clean(get('sku')),name=clean(get('name')),process=clean(get('process')),at=date(get('stop'),meta.date1904)||date(get('at'),meta.date1904);
      if(!at)undated++;else{first=!first||at<first?at:first;last=!last||at>last?at:last;}
      if(name)names.add(name);if(client)clients.add(client);
      const quantities=[number(get('units')),number(get('qty'))].filter(n=>n!==null&&Number.isFinite(n));
      const quantityEvidence=!quantities.length?'unknown':quantities.some(n=>Math.abs(n)>0)?'nonzero':'zero',group=JSON.stringify([client,sku,name,process,at,quantityEvidence]);
      // Keep every day/activity and quantity-evidence class. No source unit is
      // summed or converted, and an invalid quantity cannot be hidden by a valid one.
      if(!groups.has(group))groups.set(group,{client,sku,name,process,at,quantityEvidence,events:0});groups.get(group).events++;
    }
    function finish(){
      if(!columns)fail('activityColumns');if(!count)fail('empty');if(!first)fail('noDates');
      return {schema:'coldtrack-activity-v2',sourceRows:count,rows:[...groups.values()],sheet,first,last,undated,names:[...names].sort(),clients:[...clients].sort()};
    }
    return {row,finish};
  }
  function csv(text,filename='report.csv'){
    const first=text.replace(/^\uFEFF/,'').split(/\r?\n/)[0],delimiter=/\.tsv$/i.test(filename)?'\t':(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
    const records=[];let row=[],cell='',quoted=false;const source=text.replace(/^\uFEFF/,'');
    for(let i=0;i<source.length;i++){const ch=source[i];if(ch==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell==='')quoted=true;else if(quoted)quoted=false;else fail('badCSV');}
      else if(ch===delimiter&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&source[i+1]==='\n')i++;row.push(cell);if(row.some(v=>clean(v)!==''))records.push(row);row=[];cell='';}else cell+=ch;
    }if(quoted)fail('badCSV');row.push(cell);if(row.some(v=>clean(v)!==''))records.push(row);return [{name:filename,date1904:false,rows:records.map((values,i)=>({row:i+1,values}))}];
  }
  const defaultOutbound=name=>/ship|dispatch|despacho|shipment/i.test(name)&&!/cancel|unship|transfer|receive|receiv|return|replen|putaway/i.test(name);
  function analyze(sources,config={},settings={}){
    const asOf=settings.asOf||today(),thresholds=settings.thresholds||[7,14,30],inventory=sources.stock;
    if(!validDate(asOf)||!Array.isArray(thresholds)||thresholds.length!==3||thresholds.some((n,i)=>!Number.isInteger(n)||n<1||n>365||(i&&n<=thresholds[i-1])))fail('rules');
    if(!inventory)return {rows:[],asOf,thresholds,warnings:['needStock']};if(asOf<inventory.reportDate)fail('beforeStock');
    const warnings=[],groups=new Map();if(inventory.reportDate!==asOf)warnings.push('oldStock');
    for(const r of inventory.data.rows){const id=itemKey(r.client,r.sku);if(!groups.has(id))groups.set(id,{id,client:r.client,sku:r.sku,name:r.name,units:0,details:[],last:null,days:null,lowerBound:false,zeroWeeks:0,lastWeek:null,weekly:[],evidence:'none',reason:'needHistory',status:'unknown'});const g=groups.get(id);g.units+=r.units;g.details.push(r);}
    const act=sources.activity,weekly=sources.usage,actCurrent=act&&config.activityRevision===act.contentId,from=config.coverageStart,to=config.coverageEnd;
    const criteria=actCurrent&&config.confirmed&&Array.isArray(config.outbound)&&config.outbound.length&&validDate(from)&&validDate(to)&&from<=to;
    const activityFresh=criteria&&to>=asOf&&from<=asOf&&act.data.undated===0,events=new Map(),receipts=new Map(),mappedClients=new Set(),invalidQuantity=new Set();
    const clients=new Set(inventory.data.rows.map(r=>r.client));
    if(act){if(!criteria)warnings.push('confirmActivity');else if(to<asOf)warnings.push('oldActivity');if(act.data.undated)warnings.push('undatedActivity');
      for(const raw of act.data.clients){const same=[...clients].filter(c=>c.toLowerCase()===raw.toLowerCase());const mapped=config.clientMap?.[raw]||(same.length===1?same[0]:'');if(clients.has(mapped))mappedClients.add(mapped);}
      if(criteria)for(const r of act.data.rows){
        if(!r.at||r.at>asOf||r.at<from||r.at>to||!r.sku)continue;
        const same=[...clients].filter(c=>c.toLowerCase()===r.client.toLowerCase()),client=config.clientMap?.[r.client]||(same.length===1?same[0]:'');if(!clients.has(client))continue;
        const id=itemKey(client,r.sku),values=[r.units,r.qty].filter(v=>v!==null&&v!==undefined&&Number.isFinite(v));
        const known=r.quantityEvidence?r.quantityEvidence!=='unknown':values.length>0,nonzero=r.quantityEvidence?r.quantityEvidence==='nonzero':values.some(v=>Math.abs(v)>0);
        if(/receiv|receipt|recibo|recepción/i.test(r.name+' '+r.process)&&nonzero&&(!receipts.has(id)||receipts.get(id)<r.at))receipts.set(id,r.at);
        if(!config.outbound.includes(r.name))continue;if(!known){invalidQuantity.add(client);continue;}if(!nonzero)continue;
        if(!events.has(id)||events.get(id)<r.at)events.set(id,r.at);
      }
    }
    const usageGroups=new Map();if(weekly)for(const r of weekly.data.rows){const id=itemKey(r.client,r.sku);if(!usageGroups.has(id))usageGroups.set(id,new Map());usageGroups.get(id).set(r.week,r.qty);}
    const weeklyFresh=weekly&&weekly.reportDate===asOf;if(weekly&&!weeklyFresh)warnings.push('oldUsage');
    const latestWeek=weekly?.data.weeks[0];
    for(const g of groups.values()){
      g.units=Math.round(g.units*1e6)/1e6;if(g.units<=0)continue;
      g.locations=[...new Set(g.details.map(r=>r.location))];g.expiry=g.details.map(r=>r.expiry).filter(Boolean).sort()[0]||null;
      g.external=g.details.filter(r=>r.location.toLowerCase()==='vertical').reduce((s,r)=>s+r.units,0);
      const u=usageGroups.get(g.id);if(u){g.lastWeek=[...u].filter(([,qty])=>qty>0).map(([week])=>week).sort((a,b)=>b-a)[0]??null;
        g.weekly=Array.from({length:Math.min(4,latestWeek)},(_,i)=>({week:latestWeek-i,qty:u.has(latestWeek-i)?u.get(latestWeek-i):weekly.complete?0:null}));
        for(let week=latestWeek;week>=weekly.data.weeks.at(-1);week--){const qty=u.has(week)?u.get(week):weekly.complete?0:null;if(qty!==0)break;g.zeroWeeks++;}
      }
      if(events.has(g.id))g.last=events.get(g.id);
      if(activityFresh&&mappedClients.has(g.client)&&!invalidQuantity.has(g.client)){
        if(!g.last&&receipts.has(g.id)&&days(receipts.get(g.id),asOf)<thresholds[0]){g.reason='recentReceipt';continue;}
        g.evidence='activity';g.reason='activityEvidence';g.days=g.last?days(g.last,asOf):days(from,asOf);g.lowerBound=!g.last;
        if(g.lowerBound&&g.days<thresholds[0]){g.status='unknown';g.reason='shortCoverage';continue;}
      }else if(weeklyFresh&&u&&(g.zeroWeeks>0||(g.weekly[0]?.qty??0)>0)){
        g.evidence='weekly';g.reason='weeklyEvidence';
      }else{g.reason=act&&!criteria?'confirmActivity':criteria&&!mappedClients.has(g.client)?'mapClient':criteria&&to<asOf?'oldActivity':act?.data.undated?'undatedActivity':invalidQuantity.has(g.client)?'unquantifiedActivity':weekly&&!weeklyFresh?'oldUsage':u?'missingWeeks':'needHistory';continue;}
      const age=g.evidence==='activity'?g.days:g.zeroWeeks*7;g.status=age>=thresholds[2]?'idle30':age>=thresholds[1]?'idle14':age>=thresholds[0]?'idle7':'active';
    }
    const order={idle30:0,idle14:1,idle7:2,unknown:3,active:4};
    return {rows:[...groups.values()].filter(g=>g.units>0).sort((a,b)=>order[a.status]-order[b.status]||(b.days??b.zeroWeeks*7)-(a.days??a.zeroWeeks*7)||a.sku.localeCompare(b.sku)),asOf,thresholds,warnings:[...new Set(warnings)],stockDate:inventory.reportDate};
  }
  const ice=workbook=>{try{return globalThis.ForecastIce.parseLedger(workbook);}catch(error){error.code='iceInvalid';error.detail=error.message;throw error;}};
  return {clean,key,itemKey,number,today,validDate,days,date,table,stock,usage,activity,activityCollector,ice,csv,defaultOutbound,analyze};
})();
