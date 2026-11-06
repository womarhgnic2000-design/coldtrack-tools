globalThis.ForecastReports=(()=>{
'use strict';
function tools(m){const d=ForecastCopy[m.language],t=(k,p={})=>Object.entries(p).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),d[k]||k),fmt=(n,digits=1)=>n===null||n===undefined?'—':new Intl.NumberFormat(m.language==='en'?'en-US':'es-US',{maximumFractionDigits:digits}).format(n),date=(at,time=true)=>{if(!Number.isFinite(at)||at===null)return '—';const p=ForecastCore.parts(at,m.settings.zone);return p.date.slice(5,7)+'-'+p.date.slice(8,10)+'-'+p.date.slice(0,4)+(time?' '+p.time:'');},expiry=s=>s?s.slice(5,7)+'-'+s.slice(8,10)+'-'+s.slice(0,4):'—';return {t,fmt,date,expiry};}
function csv(m){const {t,date,expiry}=tools(m),headers=['client','product','status','onSite','vertical','excluded','weekly','needAt','requestBy','pull','send','projected','shortageUnits','reportCutoffRisk','reportLast','reportUnit','lot','expiration','lpn','qty','iceSourceLabel','iceWeekStart','iceWeekEnd','iceHistorical','rotationTag','rotationInLPN','rotationInExpiry','rotationInQty','rotationOutLPN','rotationOutExpiry','rotationOutQty','movementDate','reason'].map(t),cell=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"',lines=[headers];
 for(const r of m.rows){const ledger=r.ice&&!r.usage.length&&!r.manual,period=ledger?(r.ice.reason?r.ice.historical:r.ice.current):null;lines.push([r.client,r.sku+' · '+r.name,t(r.status)+(r.dataReason?' / '+t(r.dataReason):''),r.onSite,r.external,r.excluded,r.weekly,r.shortageAt===null?'':date(r.shortageAt),r.requestQty?date(r.requestAt):'',r.known?r.requestQty:'',r.sendQty,r.projected,r.shortage,r.cutoffRisk,date(m.end),t(ledger||r.manual?'each':m.settings.basis),r.allocations.map(a=>a.lot).join(' | '),r.allocations.map(a=>expiry(a.expiry)).join(' | '),r.allocations.map(a=>a.container).join(' | '),r.allocations.map(a=>a.units).join(' | '),r.manual?t('manualBadge'):ledger?r.ice.source:m.usageName,period?.start||'',period?.end||'',ledger&&r.ice.reason?r.ice.historical.weekly:'',r.rotation?.detected?t('rotationTag'):'',r.rotation?.pairs.map(p=>p.incoming[0].container).join(' | '),r.rotation?.pairs.map(p=>p.incoming.map(b=>expiry(b.expiry)).join(' / ')).join(' | '),r.rotation?.pairs.map(p=>p.incoming.reduce((n,b)=>n+b.units,0)).join(' | '),r.rotation?.pairs.map(p=>p.outgoing[0].container).join(' | '),r.rotation?.pairs.map(p=>p.outgoing.map(b=>expiry(b.expiry)).join(' / ')).join(' | '),r.rotation?.pairs.map(p=>p.outgoing.reduce((n,b)=>n+b.units,0)).join(' | '),r.rotation?.detected?date(r.rotation.at):'',r.rotation?.reason?t(r.rotation.reason,{hours:m.settings.leadHours}):'']);}
 return lines.map(row=>row.map(cell).join(',')).join('\r\n');
}
async function pdf(m,logoBase64){
 const {PDFDocument,StandardFonts,rgb}=PDFLib,{t,fmt,date,expiry}=tools(m),doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),logo=await doc.embedPng(Uint8Array.from(atob(logoBase64),c=>c.charCodeAt(0))),chars=new Set(font.getCharacterSet());
 doc.setTitle('ColdTrack · '+t('reportTitle'));doc.setAuthor('ColdTrack');doc.setSubject(t('reportSubtitle'));doc.setLanguage(m.language==='es'?'es-US':'en-US');
 const W=792,H=612,M=30,B=42,navy=rgb(.043,.294,.38),blue=rgb(0,.388,1),ink=rgb(.09,.18,.24),muted=rgb(.36,.45,.51),line=rgb(.84,.89,.92),bg=rgb(.96,.975,.985),red=rgb(.77,.14,.24),amber=rgb(.65,.33,0),green=rgb(.03,.45,.3),white=rgb(1,1,1),colors={urgent:red,transfer:blue,shortage:amber,expiry:amber,data:muted,covered:green,excess:navy,rotation:blue,idle:muted};
 let page=null,y=0,section='main';const safe=s=>[...String(s??'').normalize('NFKC').replace(/[\u2011\u2013\u2014]/g,'-').replace(/\u2026/g,'...')].map(c=>c==='\n'||chars.has(c.codePointAt(0))?c:'?').join(''),measure=(s,size=8,f=font)=>f.widthOfTextAtSize(safe(s),size);
 function text(s,x,top,size=8,f=font,color=ink){page.drawText(safe(s),{x,y:H-top-size,size,font:f,color});}
 function rect(x,top,width,height,color,border){page.drawRectangle({x,y:H-top-height,width,height,color,borderColor:border,borderWidth:border?.5:0});}
 function rule(top){page.drawLine({start:{x:M,y:H-top},end:{x:W-M,y:H-top},color:line,thickness:.6});}
 function wrap(value,width,size=8,f=font){const result=[];for(const para of safe(value).split('\n')){let current='';for(const word of para.split(/\s+/)){if(!word)continue;let pending=word;if(current&&measure(current+' '+pending,size,f)<=width){current+=' '+pending;continue;}if(current){result.push(current);current='';}while(measure(pending,size,f)>width){let count=1;while(count<pending.length&&measure(pending.slice(0,count+1),size,f)<=width)count++;result.push(pending.slice(0,count));pending=pending.slice(count);}current=pending;}result.push(current);}return result.length?result:[''];}
 function paragraph(value,x,width,size=8,color=muted,f=font){const ls=wrap(value,width,size,f);for(const l of ls){if(y+size*1.5>H-B){newPage();}text(l,x,y,size,f,color);y+=size*1.5;}return ls.length;}
 const columns=[['product',190],['status',93],['onSite',52],['vertical',52],['weekly',54],['needAt',86],['requestBy',86],['pull',45],['projected',74]];
 function tableHeader(){rect(M,y,W-2*M,23,navy);let x=M;for(const [k,w]of columns){text(t(k),x+7,y+7,7,bold,white);x+=w;}y+=23;}
 function newPage(full=false){page=doc.addPage([W,H]);y=M;
  if(full){page.drawImage(logo,{x:M,y:H-M-33,width:33,height:33});text('ColdTrack',M+43,M+1,19,bold,navy);text(t('eyebrow'),M+43,M+24,7,bold,muted);text(t('reportTitle'),M,M+52,24,bold,navy);text(t('reportSubtitle'),M,M+84,10,font,muted);y=M+110;}
  else{text('ColdTrack',M,M,15,bold,navy);text(section==='lots'?t('reportNotice'):section==='send'?t('reportSendNotice'):section==='rotation'?t('rotationReport'):t('reportTitle'),M+110,M+4,10,bold,navy);text(date(m.start)+' ET  /  '+m.settings.horizon+' '+t('days'),W-M-220,M+6,8,font,muted);y=M+32;rule(y);y+=15;}
 }
 function field(label,value,width=(W-2*M)/2){const ls=wrap(value,width-13,8);text(label,M,y,7,bold,muted);y+=12;ls.forEach(l=>{text(l,M,y,8);y+=11;});y+=9;}
 newPage(true);
 const referenceLine=t('stockAsOf')+': '+date(m.start)+' ET   |   '+t('reportLast')+': '+date(m.end)+' ET';paragraph(referenceLine,M,W-2*M,9,ink,bold);y+=5;
 const onlyLedger=m.rows.length&&m.rows.every(r=>r.ice&&!r.usage.length||r.manual);
 paragraph(t('reportConfig',{hours:m.settings.leadHours,cover:m.settings.coverDays,scenario:Math.round(m.settings.multiplier*100),days:m.settings.days.length}),M,W-2*M,8,ink);paragraph(t('reportUnit')+': '+t(onlyLedger?'each':m.settings.basis)+'  |  '+(onlyLedger?t('iceDatedWeeks'):t('weeksUsed',{weeks:m.selectedWeeks.join(', ')})),M,W-2*M,8,ink);paragraph(t('keepDays')+': '+(m.settings.keepDays??14)+' + '+m.settings.leadHours+' h',M,W-2*M,8,ink);if(m.settings.sendDate)paragraph(t('sendOnDate',{date:expiry(m.settings.sendDate),time:m.settings.sendTime||m.settings.asOf.slice(11,16)}),M,W-2*M,8,ink);if(m.settings.pullDate)paragraph(t('receiveOnDate',{date:expiry(m.settings.pullDate),time:m.settings.pullTime||m.settings.asOf.slice(11,16)}),M,W-2*M,8,ink);y+=5;
 paragraph(t('reportScope',{client:m.filter.client||t('all'),status:t(m.filter.status),search:m.filter.search||'—'})+'  |  '+t('reportSelection')+': '+t(m.scope==='actions'?'actions':'allFiltered'),M,W-2*M,8);paragraph(t('reportUnknownCount',{n:m.unknownCount}),M,W-2*M,8);y+=5;
 paragraph(t('reportSource')+': '+m.stockName+' / '+m.usageName,M,W-2*M,7);if(m.iceName){paragraph(t('iceLedger')+' '+m.iceName,M,W-2*M,7);for(const r of m.rows.filter(r=>r.ice&&!r.usage.length&&r.known&&!r.manual))paragraph(r.client+' / '+r.sku+': '+(r.ice.current.start||'—')+' - '+(r.ice.current.end||'—'),M,W-2*M,7);}for(const r of m.rows.filter(r=>r.manual))paragraph(t('manualBadge')+': '+r.client+' / '+r.sku,M,W-2*M,7);paragraph(t('reportAssumption'),M,W-2*M,7);paragraph(t('wholeRule'),M,W-2*M,7,navy,bold);paragraph(t('reportDates'),M,W-2*M,7);y+=7;
 const clients=[...new Set(m.rows.map(r=>r.client))],cutoffs=clients.map(c=>c+': '+ForecastCore.cutoffDays(c,m.settings)).join('  |  ');paragraph(t('reportCutoffs')+': '+cutoffs,M,W-2*M,7);y+=8;
 paragraph(t('reportTotals',{n:m.rows.length,pulls:m.rows.reduce((sum,r)=>sum+(r.requestQty>0?1:0)+(r.sendQty>0?1:0),0),risk:m.rows.filter(r=>r.cutoffRisk>0).length}),M,W-2*M,9,navy,bold);y+=13;
 if(y>H-B-90)newPage();tableHeader();
 for(const r of m.rows){
  const productLines=wrap(r.sku+' · '+r.name,176,8,bold),clientLines=wrap(r.client,176,7),statusLines=wrap(t(r.status),79,7.5,bold),pendingLines=r.dataReason?wrap(t(r.dataReason),79,6.5):[],riskLines=[...(r.cutoffRisk>0?wrap(t('cutoffRisk',{n:fmt(r.cutoffRisk)}),79,6.5):[]),...(r.sendQty>0?wrap(t('send')+': '+fmt(r.sendQty),79,6.5):[])],productH=productLines.length*10+clientLines.length*9,statusH=statusLines.length*10+(pendingLines.length+riskLines.length)*8;
  const rowH=Math.max(35,productH+11,statusH+11,r.shortage>0?45:35);
  if(y+rowH>H-B){newPage();tableHeader();}const top=y;let x=M;
  let at=top+6;productLines.forEach(l=>{text(l,x+7,at,8,bold,navy);at+=10;});clientLines.forEach(l=>{text(l,x+7,at,7,font,muted);at+=9;});x+=columns[0][1];at=top+6;statusLines.forEach(l=>{text(l,x+7,at,7.5,bold,colors[r.status]);at+=10;});[...pendingLines,...riskLines].forEach(l=>{text(l,x+7,at,6.5,font,muted);at+=8;});x+=columns[1][1];
  const values=[fmt(r.onSite),fmt(r.external),fmt(r.weekly),r.shortageAt===null?'—':date(r.shortageAt).replace(' ','\n'),r.requestQty?date(r.requestAt).replace(' ','\n'):'—',r.known?fmt(r.requestQty,0):'—',fmt(r.projected)];
  values.forEach((v,i)=>{const w=columns[i+2][1],ls=String(v).split('\n'),right=![3,4].includes(i);ls.forEach((l,n)=>text(l,right?x+w-7-measure(l,8):x+7,top+7+n*11,8,i===5?bold:font,i===5&&r.requestQty?colors[r.status]:ink));if(i===6&&r.shortage>0){text(t('shortageUnits'),x+7,top+20,6,font,amber);text(fmt(r.shortage),x+7,top+29,7,bold,amber);}x+=w;});
  y+=rowH;rule(y);
 }
 const pulls=m.rows.filter(r=>r.requestQty>0);
 if(pulls.length){section='lots';newPage();paragraph(t('reportNotice'),M,W-2*M,15,navy,bold);y+=8;
  for(const r of pulls){if(y>H-B-125)newPage();paragraph(r.client+' · '+r.sku+' · '+r.name,M,W-2*M,10,navy,bold);y+=3;
   paragraph(t('requestSummary',{qty:fmt(r.requestQty,0),request:date(r.requestAt),need:date(r.shortageAt),arrival:date(r.arrivalAt)}),M,W-2*M,8,ink);paragraph(t('wholeMovement',{n:r.requestPallets,extra:fmt(r.roundingExtra)}),M,W-2*M,7,navy);
   if(r.requestAt<m.start)paragraph(t('reportException',{n:fmt(r.gap48)}),M,W-2*M,8,red,bold);
   paragraph(t('coverageSummary',{n:m.settings.coverDays,qty:fmt(r.uncovered)}),M,W-2*M,7);y+=8;
   const cols=[['lot',173],['expiration',100],['lpn',360],['pull',99]];
   const head=()=>{rect(M,y,W-2*M,21,navy);let x=M;for(const [k,w]of cols){text(t(k),x+7,y+6,7,bold,white);x+=w;}y+=21;};head();
   for(const a of r.allocations){const vals=[a.lot||'—',expiry(a.expiry),a.container||'—',fmt(a.units,0)],wrapped=vals.map((v,i)=>wrap(v,cols[i][1]-14,8)),h=Math.max(...wrapped.map(ls=>ls.length))*11+12;if(y+h>H-B){newPage();paragraph(r.client+' · '+r.sku,M,W-2*M,9,navy,bold);y+=7;head();}let x=M;wrapped.forEach((ls,i)=>{ls.forEach((l,n)=>text(l,x+7,y+6+n*11,8));x+=cols[i][1];});y+=h;rule(y);}
   y+=22;
  }
 }
 const sends=m.rows.filter(r=>r.sendQty>0);
 if(sends.length){section='send';newPage();paragraph(t('reportSendNotice'),M,W-2*M,15,navy,bold);y+=8;
  for(const r of sends){if(y>H-B-120)newPage();paragraph(r.client+' · '+r.sku+' · '+r.name,M,W-2*M,10,navy,bold);y+=3;paragraph(t('sendSummary',{qty:fmt(r.sendQty,0)}),M,W-2*M,8,ink);if(r.sendAt!==undefined)paragraph(t('movementDate')+': '+date(r.sendAt)+' ET',M,W-2*M,8,ink);y+=8;
   const cols=[['lot',160],['expiration',100],['loc',135],['lpn',265],['send',72]],head=()=>{rect(M,y,W-2*M,21,navy);let x=M;for(const [k,w]of cols){text(t(k),x+7,y+6,7,bold,white);x+=w;}y+=21;};head();
   for(const a of r.sendAllocations){const vals=[a.lot||'—',expiry(a.expiry),a.location,a.container||'—',fmt(a.units,0)],wrapped=vals.map((v,i)=>wrap(v,cols[i][1]-14,8)),h=Math.max(...wrapped.map(ls=>ls.length))*11+12;if(y+h>H-B){newPage();paragraph(r.client+' · '+r.sku,M,W-2*M,9,navy,bold);y+=7;head();}let x=M;wrapped.forEach((ls,i)=>{ls.forEach((l,n)=>text(l,x+7,y+6+n*11,8));x+=cols[i][1];});y+=h;rule(y);}y+=22;
  }
 }
 const rotations=m.rows.filter(r=>r.rotation?.detected);
 if(rotations.length){section='rotation';newPage();paragraph(t('rotationReport'),M,W-2*M,15,navy,bold);y+=8;paragraph(t('rotationIntro'),M,W-2*M,8,ink);paragraph(t('rotationCondition'),M,W-2*M,8,amber,bold);y+=16;
  for(const r of rotations){if(y>H-B-140)newPage();paragraph(r.client+' · '+r.sku+' · '+r.name,M,W-2*M,10,navy,bold);y+=4;paragraph(t('rotationDifference',{outside:expiry(r.rotation.outsideExpiry),inside:expiry(r.rotation.insideExpiry)}),M,W-2*M,8,ink);paragraph(t('movementDate')+': '+date(r.rotation.at)+' ET · '+t('requestBy')+': '+date(r.rotation.requestAt)+' ET',M,W-2*M,8,ink);if(r.rotation.reason)paragraph((r.rotation.reviewCount?t('rotationRemaining',{n:r.rotation.reviewCount})+' ':'')+t(r.rotation.reason,{hours:m.settings.leadHours}),M,W-2*M,8,amber,bold);y+=10;
   const cols=[['rotationTag',120],['loc',110],['lot',120],['expiration',100],['lpn',200],['qty',82]],head=()=>{rect(M,y,W-2*M,23,navy);let x=M;for(const [k,w]of cols){text(t(k),x+7,y+7,7,bold,white);x+=w;}y+=23;};
   for(let i=0;i<r.rotation.pairs.length;i++){if(y>H-B-100)newPage();paragraph(t('rotationPair',{n:i+1}),M,W-2*M,8,navy,bold);y+=5;head();const pair=r.rotation.pairs[i];for(const direction of ['incoming','outgoing'])for(const a of pair[direction]){const vals=[t(direction==='incoming'?'incoming':'outgoing'),a.location,a.lot||'—',expiry(a.expiry),a.container,fmt(a.units,0)],wrapped=vals.map((v,n)=>wrap(v,cols[n][1]-14,8)),h=Math.max(...wrapped.map(ls=>ls.length))*11+14;if(y+h>H-B){newPage();paragraph(r.client+' · '+r.sku+' · '+t('rotationPair',{n:i+1}),M,W-2*M,9,navy,bold);y+=7;head();}let x=M;wrapped.forEach((ls,n)=>{ls.forEach((l,j)=>text(l,x+7,y+7+j*11,8,n===0?bold:font,n===0?navy:ink));x+=cols[n][1];});y+=h;rule(y);}y+=16;}y+=12;
  }
 }
 const pages=doc.getPages();pages.forEach((p,i)=>{page=p;rule(H-32);text('ColdTrack · '+t('noReceipts'),M,H-23,6.5,font,muted);const label=t('reportPage')+' '+(i+1)+' / '+pages.length;text(label,W-M-measure(label,7),H-23,7,font,muted);});
 return doc.save();
}
return {pdf,csv};
})();
