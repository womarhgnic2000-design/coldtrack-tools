
"use strict";
(() => {
  const F = globalThis.PressedForecast, $ = id => document.getElementById(id), KEY = "pressed-future-demo-v1";
  const num = n => new Intl.NumberFormat("es-US", {maximumFractionDigits:1}).format(Math.abs(n) < 1e-8 ? 0 : n);
  const date = (iso, long=false) => new Intl.DateTimeFormat(globalThis.ColdTrackLanguage?.locale||"es", {day:"numeric", month:long ? "long" : "short", ...(long ? {year:"numeric"} : {}), timeZone:"UTC"}).format(new Date(iso + "T00:00:00Z"));
  const esc = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const sum = rows => rows.reduce((s,row) => s + (row.risk || 0), 0);
  let state = F.demoState(), output, toastTimer;
  try {
    const embedded = JSON.parse($("demo-state").textContent);
    let saved = null;
    if (!embedded?.exportedSnapshot) { try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {} }
    const candidate = embedded?.exportedSnapshot ? embedded : saved?.version === 2 ? saved : embedded || saved;
    if ([1,2].includes(candidate?.version)) { F.forecast(candidate); state = candidate; }
  } catch (_) {}
  const initialState = (()=>{try{return JSON.parse($("demo-state").textContent);}catch(_){return null;}})();
  state.version=2;
  function storeState() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
  function renderSources() {
    const real=state.demo===false, stock=state.stock, history=state.history,tr=value=>globalThis.ColdTrackLanguage?.t(value)||value;
    $("dataBadge").textContent=real?"DATOS CARGADOS":"DEMO";
    $("usageFilename").textContent=history?.filename||"Seleccioná el reporte semanal .xlsx";
    $("inventoryFilename").textContent=stock?.filename||"Seleccioná el stock unit .xlsx";
    $("averageField").hidden=!history;
    $("averageWeeks").value=String(state.averageWeeks||4);
    $("selectedWeeks").textContent=history?"Semanas usadas: "+state.selectedWeeks.join(", ")+". Se incluyen ceros en semanas sin salidas del ítem.":"";
    $("sourceNote").textContent=tr(real?"Inventario estándar del Centro de datos · Solo Pressed Juicery. Cantidad: Total Units; Quantity no se usa como existencias. Consumo: Shipped Pack Quantity por SKU; cada six-pack conserva su propio SKU.":"Inventario y uso semanal de ejemplo.");
    const parts=[];
    if(real&&!history)parts.push("Falta subir el weekly usage para estimar las salidas.");
    if(real&&!stock)parts.push("Falta subir el inventario disponible.");
    if(stock){
      parts.push("Filtro: Pressed Juicery · "+stock.sourceRows+" filas · "+(stock.outside||0)+" de otros clientes excluidas.");
      parts.push("Stock Pressed: "+num(stock.totalUnits)+" unidades · "+num(stock.inventory.reduce((total,row)=>total+row.qty,0))+" con expiración válida.");
      parts.push(stock.datedRows+" filas con expiración → "+stock.inventory.length+" lotes agrupados.");
      if(stock.undated.length)parts.push(stock.undated.length+" filas sin expiración válida quedan fuera del cálculo; podés verlas en Datos de inventario.");
      if(!stock.sourceRows)parts.push("Este inventario no contiene filas de Pressed Juicery. La proyección queda vacía.");
    }
    if(history){parts.push("Weekly usage: "+history.rowCount+" filas de Pressed · "+(history.outside||0)+" de otros clientes excluidas.");if(!history.rowCount)parts.push("Este weekly usage no contiene filas de Pressed Juicery. El consumo queda sin estimar.");}
    const missing=output.lots.filter(r=>r.qty>0&&r.risk===null);
    if(missing.length)parts.push(missing.length+" lotes no tienen historial de consumo; su sobrante queda sin estimar.");
    $("importNotice").hidden=!parts.length;$("importNotice").textContent=parts.map(tr).join(" ");
    $("footerNote").innerHTML=real?"<strong>Proyección desde tus reportes.</strong> Promedio histórico, corte y calendario de despacho ajustables.":"<strong>Demostración con datos ficticios.</strong> Los nombres, cantidades, ubicaciones y reglas son de ejemplo.";
    $("resetBtn").textContent=initialState?"Restablecer datos iniciales ↺":"Restablecer ejemplo ↺";
  }
  async function importFile(kind,file) {
    if(!file)return;
    const button=$(kind==="usage"?"uploadUsageBtn":"uploadInventoryBtn"), old=button.textContent;
    button.disabled=true;button.textContent="Leyendo…";
    try{
      if(!/\.xlsx$/i.test(file.name))throw new Error("Elegí un archivo Excel .xlsx. Guardá los .xls como .xlsx primero.");
      if(file.size>20*1024*1024)throw new Error("El archivo supera 20 MB. Exportá un reporte más pequeño.");
      const X=globalThis.PressedExcel, workbook=await X.readXlsx(await file.arrayBuffer());
      const parsed=kind==="usage"?X.parseUsage(workbook,file.name):X.parseInventory(workbook,file.name);
      const real=state.demo===false;
      const history=kind==="usage"?parsed:real?state.history:null;
      const stock=kind==="inventory"?parsed:real?state.stock:null;
      const candidate=X.applySources(state,history,stock,state.averageWeeks||4);
      if(kind==="inventory")candidate.baseDate=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
      F.forecast(candidate);state=candidate;$("search").value="";render();toast("Archivo cargado. Proyección actualizada.");
    }catch(error){$("errorBanner").textContent=error.message;$("errorBanner").hidden=false;toast("No se cambió el inventario: revisá el aviso.");}
    finally{button.disabled=false;button.textContent=old;}
  }
  function toast(message) { $("toast").textContent = message; $("toast").hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $("toast").hidden = true, 3000); }
  function severity(row) {
    if (row.cutIn <= 0 && row.risk > 0) return {color:"red", text:"Ya en corte"};
    if (row.risk === null) return {color:"blue", text:"Falta weekly usage"};
    if (row.risk <= 0) return {color:"good", text:"Se consumiría"};
    if (row.cutIn <= 3) return {color:"orange", text:"En " + row.cutIn + (row.cutIn === 1 ? " día" : " días")};
    return {color:row.cutIn <= 14 ? "amber" : "blue", text:"En " + row.cutIn + " días"};
  }
  function syncControls() {
    $("baseDate").value = state.baseDate; $("minLife").value = state.minLife; $("shippingDays").value = state.shippingDays;
    $("usageFactor").value = state.factor; $("factorLabel").textContent = state.factor + " %";
    $("horizonRange").value = state.horizon;
    document.querySelectorAll("[data-horizon]").forEach(btn => btn.setAttribute("aria-pressed", String(Number(btn.dataset.horizon) === state.horizon)));
  }
  function render() {
    try { output = F.forecast(state); $("errorBanner").hidden = true; }
    catch (error) { $("errorBanner").textContent = error.message; $("errorBanner").hidden = false; return; }
    syncControls();
    renderSources();
    globalThis.PressedSequenceUI?.render(state);
    const all = output.lots.filter(row => row.qty > 0), current = all.filter(row => row.cutIn <= 0 && row.risk > 0);
    const future = all.filter(row => row.cutIn > 0 && row.cutIn <= state.horizon && row.risk > 0);
    const pending = all.filter(row => row.cutIn > 0 && row.cutIn <= state.horizon && row.risk === null);
    const next = all.filter(row => row.cutIn > 0 && row.risk > 0).sort((a,b) => a.cutIn - b.cutIn || b.risk - a.risk)[0];
    const until = F.addDays(state.baseDate, state.horizon);
    $("snapshotLabel").textContent = date(state.baseDate, true);
    $("usageCount").textContent = state.history ? state.history.weeks.length+" semanas · promedio de "+state.selectedWeeks.length : state.demo===false ? "Pendiente de cargar" : state.items.length + " ítems · datos de ejemplo";
    $("inventoryCount").textContent = all.length + " lotes · " + num(all.reduce((s,r) => s+r.qty,0)) + " unidades";
    $("ruleSummary").textContent = "Corte: " + state.minLife + " días · " + state.shippingDays + " despachos/sem.";
    $("horizonLabel").textContent = state.horizon + (state.horizon === 1 ? " día" : " días");
    $("untilLabel").textContent = "Desde el " + date(state.baseDate) + " hasta el " + date(until) + ". Consumo al " + state.factor + " %.";
    $("currentValue").innerHTML = num(sum(current)) + "<small>unidades</small>";
    $("currentCaption").textContent = current.length + (current.length === 1 ? " lote ya alcanzó su corte" : " lotes ya alcanzaron su corte");
    $("futureLabel").textContent = "Riesgo futuro · próximos " + state.horizon + " días";
    $("futureValue").innerHTML = num(sum(future)) + "<small>unidades</small>";
    $("lotsValue").textContent = current.length + future.length;
    $("lotsCaption").textContent = current.length + " ya en corte + " + future.length + " futuros" + (pending.length ? " · " + pending.length + " sin estimar" : "");
    $("nextValue").textContent = next ? "En " + next.cutIn + (next.cutIn === 1 ? " día" : " días") : pending.length ? "Sin estimación" : "Sin riesgo futuro";
    $("nextCaption").textContent = next ? next.sku + " · " + date(next.cutoffISO) : pending.length ? "Hay lotes sin weekly usage" : "Según el inventario y consumo cargados";
    $("tableSubtitle").textContent = "Lotes con corte hasta el " + date(until) + ". Cada tarjeta muestra el sobrante estimado al corte.";
    renderRows(); renderStory(next); renderTimeline();
    $("timelineNote").textContent = "El gráfico muestra riesgo futuro. Las " + num(sum(current)) + " unidades que ya están en corte figuran por separado en el resumen. " + (pending.length ? pending.length+" lotes sin consumo no están estimados." : "");
    $("printNote").textContent = "Regla de ejemplo: corte cuando quedan " + state.minLife + " días o menos hasta expirar. Despacho " + state.shippingDays + " días/semana. Consumo al " + state.factor + " %.";
    storeState();
  }
  function renderRows() {
    const q = $("search").value.toLowerCase().trim();
    const rows = output.lots.filter(row => row.qty > 0 && row.cutIn <= state.horizon)
      .filter(row => [row.sku,row.name,row.lot,row.location].join(" ").toLowerCase().includes(q))
      .sort((a,b) => a.cutIn-b.cutIn || (b.risk||0)-(a.risk||0));
    const groups = [
      {key:"blocked",title:"Ya en corte",color:"red",description:"Fuera del plazo de envío",rows:[]},
      {key:"urgent",title:"Riesgo en 1–3 días",color:"orange",description:"Prioridad en los próximos días",rows:[]},
      {key:"upcoming",title:"Riesgo después de 3 días",color:"amber",description:state.horizon>3?"Del día 4 al "+state.horizon:"Ampliá el plazo para ver más adelante",rows:[]},
      {key:"safe",title:"Sin sobrante previsto",color:"good",description:"Se consumirían antes de su corte",rows:[]}
    ];
    const unknown=[];
    for(const row of rows){
      if(row.risk===null){unknown.push(row);continue;}
      const index=row.risk===0?3:row.cutIn<=0?0:row.cutIn<=3?1:2;
      groups[index].rows.push(row);
    }
    function card(row,color){
      const status=severity(row),locations=row.locations||[{location:row.location,qty:row.qty}];
      const location=locations.length>1?locations[0].location+" + "+(locations.length-1)+" más":row.location;
      const amountLabel=row.cutIn<=0?"unidades fuera de plazo":row.risk===0?"unidades sobrantes previstas":"unidades en riesgo";
      return `<article class="risk-card" data-lot-id="${esc(row.id)}"><div class="risk-card-top"><span class="sku-label">${esc(row.sku)}</span><span class="tag ${status.color}"><i></i>${status.text}</span></div><h4 class="risk-item-name">${esc(row.name)}</h4><p class="risk-lot">Lote <strong>${esc(row.lot)}</strong></p><div class="risk-card-value" style="color:var(--${color})">${num(row.risk)}<span>${amountLabel}</span></div><div class="risk-card-quantities"><div><span>Disponibles hoy</span><strong>${num(row.qty)}</strong></div><div><span>Saldrían antes</span><strong>${num(row.used)}</strong></div></div><div class="risk-card-date"><span>Corte de envío</span><strong>${date(row.cutoffISO)}</strong></div><p class="risk-expiry">Expira ${date(row.expiry)} · <span title="${esc(row.location)}">${esc(location)}</span></p><button class="risk-detail" data-detail="${esc(row.id)}" aria-label="Ver cálculo del lote ${esc(row.lot)}">Ver cálculo y ubicaciones <span aria-hidden="true">↗</span></button></article>`;
    }
    $("lotRows").innerHTML=groups.map(group=>{
      const units=sum(group.rows);
      return `<section class="risk-lane ${group.color}" data-level="${group.key}" aria-label="${group.title}"><header class="lane-header"><div class="lane-heading"><span class="lane-dot"></span><h3>${group.title}</h3><span class="lane-count" aria-label="${group.rows.length} lotes">${group.rows.length}</span></div><p class="lane-description">${group.description}</p><p class="lane-total"><strong>${num(units)}</strong> unidades ${group.key==="blocked"?"fuera de plazo":group.key==="safe"?"sobrantes previstas":"en riesgo"}</p></header><div class="lane-cards">${group.rows.length?group.rows.map(row=>card(row,group.color)).join(""):`<p class="lane-empty">${q?"Sin coincidencias con tu búsqueda.":"No hay lotes en este nivel dentro del plazo elegido."}</p>`}</div></section>`;
    }).join("");
    $("unestimatedBox").hidden=!unknown.length;
    $("unestimatedBox").innerHTML=unknown.length?`<strong>Sin estimación: ${unknown.length} lotes.</strong> Falta el weekly usage de estos ítems. ${unknown.map(row=>`<button class="unknown-lot" data-detail="${esc(row.id)}">${esc(row.sku)} · ${esc(row.lot)}</button>`).join(" ")}`:"";
    $("emptyState").hidden=rows.length>0;
    $("emptyState").textContent=q?"No hay coincidencias con esa búsqueda.":"No hay lotes con corte dentro del plazo elegido. Ampliá los días para mirar más adelante.";
    $("rowCount").textContent=rows.length+(rows.length===1?" lote mostrado":" lotes mostrados")+(unknown.length?" · "+unknown.length+" sin estimar":"")+" · Agrupados por ítem, lote y expiración";
  }
  function renderStory(next) {
    const example = next || output.lots.find(row => row.qty > 0 && row.known && row.cutIn > 0);
    if (!example) { $("storyTitle").textContent = "Sin lotes futuros para proyectar"; $("storyRisk").textContent = "—"; $("storyBreakdown").innerHTML = ""; $("storyNote").textContent = "Revisá los datos cargados."; }
    else {
      $("storyTitle").textContent = example.name + " · " + date(example.cutoffISO);
      $("storyRisk").innerHTML = num(example.risk || 0) + " <span>unidades en riesgo</span>";
      $("storyBreakdown").innerHTML = `<div class="mini-row"><span>Inventario de este lote</span><strong>${num(example.qty)}</strong></div><div class="mini-row"><span>Saldrían antes del corte</span><strong>${num(example.used)}</strong></div><div class="mini-row"><span>Quedarían al corte</span><strong>${num(example.risk || 0)}</strong></div>`;
      $("storyNote").textContent = "Lote " + example.lot + ". " + (example.risk > 0 ? "Todavía puede enviarse, pero el ritmo previsto dejaría un sobrante dentro de " + example.cutIn + " días." : "El consumo previsto agotaría este lote antes de su corte.");
    }
    const focus = output.lots.filter(row => row.risk > 0 && row.cutIn > 0 && row.cutIn <= state.horizon);
    $("actionTitle").textContent = focus.length ? "Preparar " + focus.length + (focus.length === 1 ? " lote antes del corte" : " lotes antes del corte") : "Mirar la siguiente ventana";
    $("actionText").innerHTML = focus.length ? "El escenario proyecta <strong>" + num(sum(focus)) + " unidades sobrantes</strong> en los próximos " + state.horizon + " días. Verificá estos lotes y revisá las órdenes previstas para gestionar el posible sobrante con anticipación." : "Ampliá el horizonte o probá un consumo menor para ver cómo cambiaría el riesgo futuro.";
  }
  function renderTimeline() {
    const byDay = Array.from({length:30},(_,i) => ({day:i+1,qty:0}));
    output.lots.forEach(row => {if(row.risk > 0 && row.cutIn >=1 && row.cutIn<=30) byDay[row.cutIn-1].qty += row.risk;});
    const max = Math.max(1,...byDay.map(d=>d.qty));
    $("timeline").innerHTML = byDay.map(d=>{
      const iso = F.addDays(state.baseDate,d.day), height = d.qty ? Math.max(8,d.qty/max*75) : 4;
      return `<button class="day-bar ${d.qty ? "has-risk" : ""} ${d.day<=3 ? "soon" : ""} ${d.day>state.horizon ? "outside" : ""} ${d.day===state.horizon ? "selected" : ""}" data-horizon="${d.day}" aria-pressed="${d.day===state.horizon}" aria-label="${date(iso)}: ${num(d.qty)} unidades en riesgo; proyectar ${d.day} días" title="${date(iso)} · ${num(d.qty)} unidades"><span class="bar-val">${d.qty ? num(d.qty) : ""}</span><span class="bar-fill" style="height:${height}px"></span><span class="bar-date">${new Date(iso+"T00:00:00Z").getUTCDate()}</span></button>`;
    }).join("");
  }
  function setHorizon(n) { state.horizon = Math.max(1,Math.min(30,Number(n))); render(); }
  function selectTab(tab) {
    ["inventory","usage"].forEach(name=>{ const active = tab===name; $(name+"Panel").hidden = !active; $(name+"Tab").setAttribute("aria-selected",String(active)); $(name+"Tab").tabIndex = active ? 0 : -1; });
  }
  function openData(tab) {
    $("inventoryEditor").innerHTML = state.inventory.map(row=>`<tr><td><strong>${esc(row.sku)}</strong><p class="item-meta">${esc(row.lot)}</p></td><td>${esc(row.location)}</td><td><label class="sr-only" for="qty_${esc(row.id)}">Unidades del lote ${esc(row.lot)}</label><input id="qty_${esc(row.id)}" name="qty_${esc(row.id)}" type="number" value="${row.qty}" min="0" max="10000000" step="any" required ${state.demo===false?"readonly":""}></td><td><label class="sr-only" for="exp_${esc(row.id)}">Expiración del lote ${esc(row.lot)}</label><input id="exp_${esc(row.id)}" name="exp_${esc(row.id)}" type="date" value="${row.expiry}" required ${state.demo===false?"readonly":""}></td></tr>`).join("");
    $("usageEditor").innerHTML = state.items.map(item=>`<tr><td><strong>${esc(item.name)}</strong><p class="item-meta">${esc(item.sku)}</p></td><td>${state.demo===false?item.weekly===null?"Sin historial":num(item.weekly):`<label class="sr-only" for="usage_${esc(item.sku)}">Uso semanal de ${esc(item.name)}</label><input id="usage_${esc(item.sku)}" name="usage_${esc(item.sku)}" type="number" value="${item.weekly ?? ""}" min="0" max="10000000" step="any" required>`}</td><td>Unidades por semana</td></tr>`).join("");
    $("dataTitle").textContent=state.demo===false?"Datos cargados desde Excel":"Explorá los datos del ejemplo";
    $("dataDescription").textContent=state.demo===false?"Solo Pressed Juicery del inventario estándar, agrupado por ítem, lote y expiración. Weekly usage promediado por las semanas seleccionadas.":"Cambiá cantidades, expiraciones o uso semanal y recalculá.";
    $("dataSave").textContent=state.demo===false?"Cerrar":"Recalcular proyección →";
    $("dataFoot").textContent=state.demo===false?"Para actualizar las cantidades, subí el nuevo reporte de Excel.":"Datos ficticios para probar la idea.";
    const undated=state.stock?.undated||[];
    $("undatedDetails").hidden=!undated.length;
    $("undatedSummary").textContent=undated.length+" filas sin expiración válida · fuera del cálculo";
    $("undatedEditor").innerHTML=undated.map(r=>`<tr><td>${esc(r.sku)}<p class="item-meta">${esc(r.name)}</p></td><td>${esc(r.location)}</td><td>${num(r.qty)}</td><td>${esc(r.reason)}</td></tr>`).join("");
    selectTab(tab); $("dataDialog").showModal();
  }
  function showDetail(id) {
    const row=output.lots.find(r=>r.id===id); if(!row)return;
    const earlier=output.lots.filter(r=>r.sku===row.sku && r.cutoff<row.cutoff && r.cutIn>0).reduce((s,r)=>s+r.used,0);
    $("detailTitle").textContent=row.name;
    $("detailSubtitle").textContent=row.sku+" · "+row.lot+" · "+row.location;
    let explanation;
    if(row.cutIn<=0) explanation="Este lote ya alcanzó el corte de envío con la regla cargada. Sus "+num(row.qty)+" unidades están fuera del plazo permitido desde el "+date(row.cutoffISO)+".";
    else if(!row.known) explanation="Falta el uso semanal de este ítem. Cargalo para poder estimar las salidas y el posible sobrante.";
    else explanation="Uso semanal: <strong>"+num(row.weekly)+" unidades</strong> ÷ "+state.shippingDays+" días de despacho × "+state.factor+" % = <strong>"+num(row.daily)+" unidades/día de despacho</strong>. "+(earlier>0 ? "Antes de este lote, otros lotes del mismo ítem consumirían "+num(earlier)+" unidades de la demanda prevista. " : "")+"El cálculo reparte las salidas por vencimiento y detiene el consumo de este lote al llegar al corte.";
    $("detailBody").innerHTML=`<div class="detail-summary"><div><small>Unidades disponibles hoy</small><strong>${num(row.qty)}</strong></div><div><small>Saldrían antes del corte</small><strong>${row.risk===null?"—":num(row.used)}</strong></div><div><small>Quedarían al corte</small><strong style="color:var(--${severity(row).color})">${row.risk===null?"—":num(row.risk)}</strong></div></div><p class="detail-text">${explanation}</p><p class="detail-formula"><strong>Expiración:</strong> ${date(row.expiry,true)}<br><strong>Menos ${state.minLife} días de vida útil = corte de envío:</strong> ${date(row.cutoffISO,true)}<br>Desde el día del corte, el lote queda fuera del despacho proyectado.</p><p class="detail-text">${row.depletedOn ? "El lote se consumiría el "+date(row.depletedOn)+"." : row.risk>0 ? "Este sobrante se estima con el ritmo de salida cargado; las órdenes reales pueden cambiar el resultado." : ""}</p>`;
    $("detailDialog").showModal();
  }
  document.addEventListener("click",event=>{
    const horizon=event.target.closest("[data-horizon]"); if(horizon)setHorizon(horizon.dataset.horizon);
    const detail=event.target.closest("[data-detail]"); if(detail)showDetail(detail.dataset.detail);
    const close=event.target.closest("[data-close]"); if(close)$(close.dataset.close).close();
    const tab=event.target.closest("[data-tab]"); if(tab)selectTab(tab.dataset.tab);
  });
  document.querySelectorAll("[role=tab]").forEach(tab=>tab.addEventListener("keydown",event=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(event.key)){event.preventDefault();const name=event.key==="Home"?"inventory":event.key==="End"?"usage":tab.id==="inventoryTab"?"usage":"inventory";selectTab(name);$(name+"Tab").focus();}}));
  $("horizonRange").addEventListener("input",event=>setHorizon(event.target.value));
  $("search").addEventListener("input",renderRows);
  ["baseDate","minLife","shippingDays"].forEach(id=>$(id).addEventListener("change",event=>{
    if(!event.target.checkValidity()){event.target.reportValidity();return;}
    const key={baseDate:"baseDate",minLife:"minLife",shippingDays:"shippingDays"}[id], old=state[key];
    state[key]=id==="baseDate"?event.target.value:Number(event.target.value);
    try{F.forecast(state);render();}catch(error){state[key]=old;syncControls();toast(error.message);}
  }));
  $("usageFactor").addEventListener("input",event=>{state.factor=Number(event.target.value);render();});
  $("uploadUsageBtn").addEventListener("click",()=>$("usageFile").click());
  $("uploadInventoryBtn").addEventListener("click",()=>$("inventoryFile").click());
  $("inventoryExampleBtn").addEventListener("click",()=>$("inventoryExampleDialog").showModal());
  $("usageFile").addEventListener("change",async event=>{await importFile("usage",event.target.files[0]);event.target.value="";});
  $("inventoryFile").addEventListener("change",async event=>{await importFile("inventory",event.target.files[0]);event.target.value="";});
  $("averageWeeks").addEventListener("change",event=>{state=globalThis.PressedExcel.applySources(state,state.history,state.stock,event.target.value==="all"?"all":Number(event.target.value));render();});
  $("usageBtn").addEventListener("click",()=>openData("usage")); $("inventoryBtn").addEventListener("click",()=>openData("inventory"));
  $("dataForm").addEventListener("submit",event=>{
    event.preventDefault();
    if(state.demo===false){$("dataDialog").close();return;}
    const form=new FormData(event.target), candidate=JSON.parse(JSON.stringify(state));
    candidate.inventory.forEach(row=>{row.qty=Number(form.get("qty_"+row.id));row.expiry=String(form.get("exp_"+row.id));});
    candidate.items.forEach(item=>item.weekly=Number(form.get("usage_"+item.sku)));
    try{F.forecast(candidate);state=candidate;$("dataDialog").close();render();toast("Proyección recalculada con tus cambios.");}catch(error){toast(error.message);}
  });
  $("dataForm").addEventListener("invalid",event=>{const panel=event.target.closest("[role=tabpanel]");if(panel)selectTab(panel.id==="inventoryPanel"?"inventory":"usage");},true);
  $("resetBtn").addEventListener("click",()=>{state=initialState?JSON.parse(JSON.stringify(initialState)):F.demoState();state.version=2;$("search").value="";render();toast("Datos iniciales restaurados.");});

  function currentReport(){return globalThis.PressedReport.build(state,{search:$("search").value,includeHealthy:$("reportIncludeHealthy").checked});}
  function refreshReport(){
    const report=currentReport();
    $("reportScope").textContent="Inventario del "+date(report.baseDate,true)+" · Próximos "+report.horizon+" días, hasta el "+date(report.until)+"."+(report.search?" Búsqueda: "+report.search:" ");
    $("reportLotCount").textContent=report.rows.length;
    $("reportCurrentCount").textContent=num(report.currentRisk)+" u.";
    $("reportFutureCount").textContent=num(report.futureRisk)+" u.";
    $("reportEstimateNote").textContent="Corte: "+report.minLife+" días antes de expirar. "+(report.unknownCount?report.unknownCount+" lotes quedan sin estimar por falta de weekly usage. ":"")+(report.undatedCount?report.undatedCount+" registros sin expiración válida están fuera de la proyección.":"");
    $("reportPdfBtn").disabled=!report.rows.length;$("reportCsvBtn").disabled=!report.rows.length;$("reportEmpty").hidden=!!report.rows.length;
    return report;
  }
  function downloadReportBytes(bytes,mime,filename){
    const url=URL.createObjectURL(new Blob([bytes],{type:mime}));
    const link=document.createElement("a");link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  async function exportReport(format){
    $("reportError").hidden=true;
    const report=refreshReport();if(!report.rows.length)return;
    const active=$(format==="pdf"?"reportPdfBtn":"reportCsvBtn");
    $("reportPdfBtn").disabled=true;$("reportCsvBtn").disabled=true;$("reportIncludeHealthy").disabled=true;active.setAttribute("aria-busy","true");
    try{
      const name=(report.language==='en'?"ColdTrack-Pressed-Report-":"ColdTrack-Pressed-Reporte-")+report.baseDate+"-"+report.horizon+(report.language==='en'?"days.":"dias.")+format;
      if(format==="pdf"){
        const logo=JSON.parse($("report-logo").textContent);
        const bytes=await globalThis.PressedReport.pdf(report,logo);
        downloadReportBytes(bytes,"application/pdf",name);
      }else downloadReportBytes(globalThis.PressedReport.csv(report),"text/csv;charset=utf-8",name);
      toast("Reporte preparado para descargar.");
    }catch(error){$("reportError").textContent="No se pudo generar el "+format.toUpperCase()+". "+(format==="pdf"?"Podés descargar la versión para Excel (.csv).":"Intentá nuevamente.");$("reportError").hidden=false;}
    finally{active.removeAttribute("aria-busy");$("reportIncludeHealthy").disabled=false;refreshReport();}
  }
  $("reportBtn").addEventListener("click",()=>{$("reportError").hidden=true;refreshReport();$("reportDialog").showModal();});
  $("reportIncludeHealthy").addEventListener("change",refreshReport);
  $("reportPdfBtn").addEventListener("click",()=>exportReport("pdf"));
  $("reportCsvBtn").addEventListener("click",()=>exportReport("csv"));
  $("printBtn").addEventListener("click",()=>window.print());
  $("downloadBtn").addEventListener("click",()=>{
    const clone=document.documentElement.cloneNode(true);
    clone.querySelector("#demo-state").textContent=JSON.stringify({...state,exportedSnapshot:true}).replace(/</g,"\\u003c");
    clone.querySelectorAll("iframe[data-tool-frame]").forEach(frame=>{frame.removeAttribute("srcdoc");frame.removeAttribute("src");});
    clone.querySelectorAll("dialog").forEach(d=>d.removeAttribute("open"));
    clone.querySelector("#toast").hidden=true;
    const url=URL.createObjectURL(new Blob(["<!doctype html>\n"+clone.outerHTML],{type:"text/html;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="ColdTrack-Pressed-Proyeccion.html";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast("HTML preparado con el escenario actual.");
  });
  window.addEventListener('coldtrack-language-change',()=>{render();if($("reportDialog").open)refreshReport();});
  async function applySharedSources(stockRecord,usageRecord){
    const X=globalThis.PressedExcel,A=globalThis.ColdTrackData,signature={stock:A.signature(stockRecord),usage:A.signature(usageRecord),standard:1};
    if(state.sharedSources?.standard===signature.standard&&state.sharedSources?.stock===signature.stock&&state.sharedSources?.usage===signature.usage)return true;
    // The Data center is the inventory contract. Do not reopen it with the legacy Pressed header requirements.
    const history=usageRecord?X.fromStandardUsage(usageRecord.data,usageRecord.filename):null,stock=stockRecord?X.fromStandardInventory(stockRecord.data,stockRecord.filename):null;
    const candidate=X.applySources(state,history,stock,state.averageWeeks||4);candidate.sharedSources=signature;if(stockRecord)candidate.baseDate=stockRecord.reportDate;
    F.forecast(candidate);state=candidate;render();return true;
  }
  globalThis.PressedApp={get state(){return state;},applySharedSources,importFile};
  render();
})();
