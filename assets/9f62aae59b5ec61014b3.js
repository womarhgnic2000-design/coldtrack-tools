globalThis.ForecastERP = (() => {
  'use strict';
  const C = ForecastCore, $ = id => document.getElementById(id), root = document.documentElement;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const preference = 'coldtrack-forecast-view-v1';
  const copy = {
    es: {
      workspace:'Centro de planificación',erpView:'Vista ERP',dashboard:'Dashboard',planNav:'Plan',transferNav:'Traslados',pickingNav:'Picking',pickingTitle:'Picking de pallets',iceNav:'Hielo',rules:'Reglas',filesNav:'Archivos',helpNav:'Ayuda',
      breadcrumb:'COLDTRACK / INVENTARIO / PLANIFICACIÓN',planTitle:'Plan de inventario',transfersTitle:'Pallets entre ColdTrack y Vertical',iceTitle:'Planificación de hielo',rulesTitle:'Reglas de planificación',
      upload:'Cargar archivos',recalculate:'Recalcular',pdfAction:'Reporte PDF',bolAction:'Preparar BOL',search:'Buscar producto',searchPlaceholder:'SKU, descripción o cliente…',horizon:'Proyección',clear:'Limpiar',clearFilters:'Limpiar filtros',
      empty:'No hay productos con estos filtros.',rows:'Filas',baseUnits:'Unidades base · Total Units',previous:'Página anterior',next:'Página siguiente',
      modelNote:'Saldo proyectado solo en ColdTrack, con consumo y cortes por expiración. Pedir y mandar son sugerencias; no modifican el saldo.',
      sku:'SKU',name:'Descripción / cliente',onSite:'ColdTrack',external:'Vertical',weekly:'Uso / semana',demand48:'Uso 48 h',projected:'Saldo final',requestQty:'Pedir (u.)',sendQty:'Mandar (u.)',requestAt:'Pedir antes de',
      policy:'{hours} h de aviso · Pallets completos',reference:'Inventario: {start} ET · Proyección hasta {end}',days:'{n} días',page:'{page} de {pages}',count:'{shown} de {total} productos',
      select:'Seleccionar {sku} · {client}',selectPrompt:'Seleccioná una fila para revisar su consumo, lotes y LPN.',history:'Historial de salidas',historyAction:'Ver consumo',detailAction:'Detalle y lotes',
      historyWindow:'{n} semanas · {unit}',weekLabel:'S{n}',historyActual:'Cantidades originales del archivo. El escenario y los ajustes manuales no cambian las barras.',
      lots:'Inventario por ubicación, lote y LPN',lotCount:'{n} registros',noLots:'Este producto no tiene inventario en el archivo cargado.',stockState:'Disponibilidad',
      sortAscending:'Ordenar de menor a mayor',sortDescending:'Ordenar de mayor a menor',pending:'Dato por confirmar',notice48:'Consumo en las próximas 48 horas reales, según los días de consumo elegidos.',
      projectedHelp:'Stock restante en ColdTrack al final de la proyección, sin traslados sugeridos.',selectedProduct:'Producto seleccionado',tableLabel:'Plan de inventario. Seleccioná un SKU para ver su detalle.',navigation:'Secciones de planificación',actions:'Acciones de planificación',viewLabel:'Vista de Forecasting'
    },
    en: {
      workspace:'Planning workspace',erpView:'ERP view',dashboard:'Dashboard',planNav:'Plan',transferNav:'Transfers',pickingNav:'Picking',pickingTitle:'Pallet picking',iceNav:'Gel packs',rules:'Rules',filesNav:'Files',helpNav:'Help',
      breadcrumb:'COLDTRACK / INVENTORY / PLANNING',planTitle:'Inventory plan',transfersTitle:'Pallets between ColdTrack and Vertical',iceTitle:'Gel-pack planning',rulesTitle:'Planning rules',
      upload:'Load files',recalculate:'Recalculate',pdfAction:'PDF report',bolAction:'Prepare BOL',search:'Find product',searchPlaceholder:'SKU, description or client…',horizon:'Projection',clear:'Clear',clearFilters:'Clear filters',
      empty:'No products match these filters.',rows:'Rows',baseUnits:'Base units · Total Units',previous:'Previous page',next:'Next page',
      modelNote:'Projected balance is ColdTrack stock after demand and expiry cutoffs. Requests and sends are suggestions; they do not change the balance.',
      sku:'SKU',name:'Description / client',onSite:'ColdTrack',external:'Vertical',weekly:'Usage / week',demand48:'48 h usage',projected:'End balance',requestQty:'Request (u.)',sendQty:'Send (u.)',requestAt:'Request by',
      policy:'{hours} h notice · Whole pallets',reference:'Stock: {start} ET · Projection through {end}',days:'{n} days',page:'{page} of {pages}',count:'{shown} of {total} products',
      select:'Select {sku} · {client}',selectPrompt:'Select a row to review usage, lots and LPNs.',history:'Shipment history',historyAction:'View usage',detailAction:'Details & lots',
      historyWindow:'{n} weeks · {unit}',weekLabel:'W{n}',historyActual:'Original file quantities. Scenarios and manual overrides do not change these bars.',
      lots:'Inventory by location, lot and LPN',lotCount:'{n} records',noLots:'This product has no stock in the loaded file.',stockState:'Availability',
      sortAscending:'Sort ascending',sortDescending:'Sort descending',pending:'Data to confirm',notice48:'Demand over the next 48 elapsed hours, using the selected consumption days.',
      projectedHelp:'ColdTrack stock remaining at the projection end, before any suggested transfers.',selectedProduct:'Selected product',tableLabel:'Inventory plan. Select a SKU to see its details.',navigation:'Planning sections',actions:'Planning actions',viewLabel:'Forecasting view'
    }
  };
  const icons = {
    grid:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
    chart:'<path d="M3 3v18h18M7 16l4-5 4 2 5-7"/>',
    truck:'<path d="M3 5h11v12H3zM14 9h4l3 4v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    ice:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M3.5 10.5l4-1-1-4M20.5 13.5l-4 1 1 4M6.5 18.5l1-4-4-1M17.5 5.5l-1 4 4 1"/>',
    settings:'<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
    folder:'<path d="M3 7V5a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v11H3z"/>',
    upload:'<path d="M12 16V3M7 8l5-5 5 5M4 15v6h16v-6"/>',
    download:'<path d="M12 3v13M7 11l5 5 5-5M4 17v4h16v-4"/>',
    file:'<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h5"/>',
    refresh:'<path d="M20 8a8 8 0 0 0-14-3L3 8M3 3v5h5M4 16a8 8 0 0 0 14 3l3-3M21 21v-5h-5"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.2.7-1.7 1.2-1.7 2.7M12 17h.01"/>',
    shield:'<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6zM8 12l3 3 5-6"/>',
    pointer:'<path d="m5 3 15 9-7 1-3 7zM13 13l5 7"/>',
    detail:'<path d="M14 3h7v7M21 3l-9 9M10 5H4v15h15v-6"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">' + (icons[name] || icons.grid) + '</svg>';
  let app = null, view = 'erp', panel = 'plan', selectedId = null, page = 0, pageSize = 50, sortKey = 'status', sortDirection = 1, ordered = [], firstRender = true, previousFilter = '', previousResult = null;
  const t = (key, params = {}) => Object.entries(params).reduce((text, [name, value]) => text.replaceAll('{' + name + '}', String(value)), copy[app?.state.lang || 'es'][key] || ForecastCopy[app?.state.lang || 'es'][key] || key);
  const fmt = value => value === null || value === undefined ? '—' : new Intl.NumberFormat(app.state.lang === 'en' ? 'en-US' : 'es-US', {maximumFractionDigits: 1}).format(value);
  function date(at, time = false) {
    if (at === null || at === undefined || !Number.isFinite(at)) return '—';
    const p = C.parts(at, app.state.settings.zone);
    return p.date.slice(5,7) + '-' + p.date.slice(8,10) + '-' + p.date.slice(0,4) + (time ? ' ' + p.time : '');
  }
  const expiry = value => value ? value.slice(5,7) + '-' + value.slice(8,10) + '-' + value.slice(0,4) : '—';
  function value(row, key) {
    if (key === 'demand48') return row.known ? C.demandBetween(row.weekly, app.result.start, app.result.start + 48 * C.HOUR, app.state.settings) : null;
    if (key === 'requestQty') return row.known ? row.requestQty : null;
    if (key === 'requestAt') return row.requestQty > 0 ? row.requestAt : null;
    if (key === 'status') return {urgent:0,shortage:1,transfer:2,rotation:3,expiry:4,excess:5,data:6,covered:7,idle:8}[row.status];
    return row[key];
  }
  function order(rows) {
    const collator = new Intl.Collator(app.state.lang === 'en' ? 'en-US' : 'es-US', {numeric:true, sensitivity:'base'});
    return [...rows].sort((a,b) => {
      const x = value(a,sortKey), y = value(b,sortKey), missingX = x === null || x === undefined, missingY = y === null || y === undefined;
      // Unknown values stay last in either direction; zero is a real value.
      if (missingX !== missingY) return missingX ? 1 : -1;
      const delta = missingX ? 0 : typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y));
      return delta * sortDirection || collator.compare(a.client,b.client) || collator.compare(a.sku,b.sku) || a.id.localeCompare(b.id);
    });
  }
  function translate() {
    document.querySelectorAll('[data-e]').forEach(node => {node.textContent = t(node.dataset.e);});
    document.querySelectorAll('[data-e-title]').forEach(node => {node.title = t(node.dataset.eTitle);node.setAttribute('aria-label', node.title);});
    $('erpSearch').placeholder = t('searchPlaceholder');
    $('erpHorizon').querySelectorAll('option').forEach(option => {option.textContent = t('days', {n:option.value});});
  }
  function syncView() {
    root.dataset.forecastView = view;root.dataset.erpPanel = panel;
    const unit=$('unitBanner'),notice=$('notice'),toolbar=$('erpToolbar'),content=document.querySelector('.forecast-content');
    if(view==='erp'){
      if(unit.parentElement!==toolbar)toolbar.append(unit);
      if(notice.parentElement!==$('erpReference').parentElement)$('erpReference').after(notice);
    }else if(unit.parentElement!==content||notice.parentElement!==content){
      document.querySelector('.forecast-content>.intro').after(notice);notice.after(unit);
    }
    document.querySelectorAll('button[data-forecast-view]').forEach(button => {button.setAttribute('aria-pressed', String(button.dataset.forecastView === view));});
    document.querySelectorAll('button[data-erp-panel]').forEach(button => {button.setAttribute('aria-pressed', String(button.dataset.erpPanel === panel));});
  }
  function showView(next) {
    if (!['erp','dashboard'].includes(next)) return;
    view = next;syncView();try {localStorage.setItem(preference,view);} catch (_) {}
    render();
  }
  function showPanel(next) {
    if (!['plan','transfers','picking','ice','rules'].includes(next)) return;
    panel = next;showView('erp');
    if (panel === 'rules') $('settings').open = true;
    // The existing transfer controls keep their deliberate LPN selections.
    $('erpWorkspace').scrollIntoView({block:'start',behavior:'smooth'});
  }
  function syncSelect(target, source) {
    if ($(target).innerHTML !== $(source).innerHTML) $(target).innerHTML = $(source).innerHTML;
    $(target).value = $(source).value;
  }
  function syncBusy() {
    if (!app) return;
    document.querySelectorAll('.erp-toolbar button').forEach(button => {button.disabled = app.busy;});
    $('erpHorizon').disabled = app.busy;
  }
  function headers() {
    document.querySelectorAll('[data-erp-column]').forEach(th => {
      const key = th.dataset.erpColumn, active = key === sortKey;
      th.setAttribute('aria-sort', active ? sortDirection === 1 ? 'ascending' : 'descending' : 'none');
      const hint = key === 'demand48' ? t('notice48') : key === 'projected' ? t('projectedHelp') : '';
      th.innerHTML = '<button data-erp-sort="' + key + '" title="' + esc([hint, t(active && sortDirection === 1 ? 'sortDescending' : 'sortAscending')].filter(Boolean).join(' · ')) + '"><span>' + esc(t(key)) + '</span><span class="erp-sort-arrow" aria-hidden="true">' + (active ? sortDirection === 1 ? '↑' : '↓' : '↕') + '</span></button>';
    });
  }
  function numberCell(row,key,extra = '') {
    const amount = value(row,key), title = key === 'requestQty' && amount > 0 ? t('wholeCount',{n:row.requestPallets}) : key === 'sendQty' && amount > 0 ? t('wholeCount',{n:row.sendPallets}) : amount === null || amount === undefined ? t('pending') : '';
    return '<td class="num ' + extra + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + fmt(amount) + '</td>';
  }
  function renderRows() {
    const pages = Math.max(1,Math.ceil(ordered.length/pageSize));page = Math.max(0,Math.min(page,pages-1));
    const chunk = ordered.slice(page*pageSize,(page+1)*pageSize);
    $('erpRows').innerHTML = chunk.map((row,index) => {
      const selected = row.id === selectedId;
      return '<tr data-erp-row="' + esc(row.id) + '" data-selected="' + selected + '"><td>' + fmt(page*pageSize+index+1) + '</td><td><button class="erp-sku" data-erp-select="' + esc(row.id) + '" aria-pressed="' + selected + '" aria-controls="erpInspector" aria-label="' + esc(t('select',{sku:row.sku,client:row.client})) + '">' + esc(row.sku) + '</button></td><td title="' + esc(row.name + ' · ' + row.client) + '"><span class="erp-product-name">' + esc(row.name || '—') + '</span><span class="erp-product-client">' + esc(row.client) + '</span></td><td title="' + esc(row.dataReason ? t(row.dataReason) : t(row.status)) + '"><span class="erp-status ' + row.status + '"><i aria-hidden="true"></i>' + esc(t(row.status)) + '</span></td>' + numberCell(row,'onSite') + numberCell(row,'external') + numberCell(row,'weekly') + numberCell(row,'demand48') + numberCell(row,'projected') + numberCell(row,'requestQty',row.requestQty > 0 ? 'erp-quantity-emphasis' : '') + numberCell(row,'sendQty',row.sendQty > 0 ? 'erp-quantity-emphasis' : '') + '<td>' + esc(date(value(row,'requestAt'),true)) + '</td></tr>';
    }).join('');
    $('erpEmpty').hidden = ordered.length > 0;
    $('erpCount').textContent = t('count',{shown:fmt(ordered.length),total:fmt(app.result.rows.length)});
    $('erpPageInfo').textContent = t('page',{page:page+1,pages});$('erpPrev').disabled = page === 0;$('erpNext').disabled = page >= pages-1;
  }
  function history(row) {
    if (row.ice && !row.usage.length) {
      const profile = ForecastIce.profiles(app.state.stock,app.state.ice,{...app.state.settings,weeks:4}).get(row.id), series = profile?.reason === 'iceOldCode' ? profile.historical : profile?.current;
      return {known:!!series?.weeks.length,points:(series?.weeks || []).map(point => ({label:expiry(point.start),qty:point.units})),unit:t('usageBaseUnits'),reason:profile?.reason || ''};
    }
    const model = ForecastUsage.model(app.state,row,{range:'4',includeNewest:!app.state.settings.skipNewest});
    return {partial:model.points.some(point=>point.newest),known:model.known,points:model.points.map(point => ({label:t('weekLabel',{n:point.week}),qty:point.qty,partial:point.newest})),unit:t(model.unit),reason:model.recentOnly ? 'usageRecentOnly' : !model.known ? 'usageNoHistory' : ''};
  }
  function miniChart(model) {
    if (!model.known) return '<p class="erp-history-empty">' + esc(t(model.reason || 'usageNoHistory')) + '</p>';
    const W = 420, H = 148, bottom = 118, max = Math.max(1,...model.points.map(point => point.qty)), step = (W-24)/model.points.length;
    return '<svg class="erp-history-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="erpHistoryTitle erpHistoryDesc"><title id="erpHistoryTitle">' + esc(t('history')) + '</title><desc id="erpHistoryDesc">' + esc(model.points.map(point => point.label + ': ' + fmt(point.qty)).join('; ') + '. ' + model.unit) + '</desc><line x1="12" y1="' + bottom + '" x2="408" y2="' + bottom + '" stroke="currentColor" opacity=".3"/>' + model.points.map((point,index) => {
      const x = 12 + step*(index+.5), height = point.qty/max*85, width = Math.min(46,step*.55);
      return '<g><title>' + esc(point.label + ': ' + fmt(point.qty) + ' ' + model.unit) + '</title><rect x="' + (x-width/2) + '" y="' + (bottom-Math.max(2,height)) + '" width="' + width + '" height="' + Math.max(2,height) + '" rx="2"/><text x="' + x + '" y="' + (bottom-height-9) + '" text-anchor="middle" font-size="11" font-weight="650">' + esc(fmt(point.qty)) + '</text><text x="' + x + '" y="137" text-anchor="middle" font-size="10">' + esc(point.label) + '</text></g>';
    }).join('') + '</svg>';
  }
  function renderInspector() {
    const row = app.result.rows.find(product => product.id === selectedId);
    if (!row) {$('erpInspector').innerHTML = '<div class="erp-inspector-empty">' + icon('pointer') + '<p>' + esc(t('selectPrompt')) + '</p></div>';return;}
    const model = history(row);
    const lots = row.stock.length ? '<div class="erp-lots-scroll"><table class="erp-lots-table"><thead><tr>' + ['loc','lot','expiration','lpn','qty','stockState'].map(key => '<th' + (key === 'qty' ? ' class="num"' : '') + ' scope="col">' + esc(t(key)) + '</th>').join('') + '</tr></thead><tbody>' + row.stock.map(lot => '<tr><td>' + esc(lot.loc) + '</td><td>' + esc(lot.lot || '—') + '</td><td>' + esc(lot.dateIssue ? lot.expiryRaw || '—' : expiry(lot.expiry)) + '</td><td>' + esc(lot.container || '—') + '</td><td class="num">' + fmt(lot.units) + '</td><td class="' + (lot.excluded ? 'erp-lot-excluded' : '') + '">' + esc(lot.excluded ? t(lot.excluded === 'cutoff' ? 'cutoffStatus' : lot.excluded) : t('available')) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="erp-lots-none">' + esc(t('noLots')) + '</p>';
    $('erpInspector').innerHTML = '<div class="erp-item-heading"><div><h3>' + esc(row.sku) + ' · ' + esc(row.name || '—') + '</h3><p class="erp-item-client">' + esc(row.client) + '</p></div><div class="erp-item-actions"><button data-erp-action="usage">' + icon('chart') + esc(t('historyAction')) + '</button><button data-erp-action="details">' + icon('detail') + esc(t('detailAction')) + '</button></div></div><div class="erp-inspector-body"><div class="erp-history"><h4>' + esc(t('history')) + '</h4><p class="erp-history-sub">' + esc(t('historyWindow',{n:model.points.length,unit:model.unit})) + '</p>' + miniChart(model) + (model.known && model.reason ? '<p class="erp-history-warning">' + esc(t(model.reason)) + '</p>' : '') + '<p class="erp-history-note">' + esc((model.partial ? t('usagePartial') + '. ' : '') + t('historyActual')) + '</p></div><div class="erp-lots"><div class="erp-lots-heading"><h4>' + esc(t('lots')) + '</h4><small>' + esc(t('lotCount',{n:fmt(row.stock.length)})) + '</small></div>' + lots + '</div></div>';
  }
  function select(id) {
    if (!ordered.some(row => row.id === id)) return;
    selectedId = id;
    $('erpRows').querySelectorAll('[data-erp-row]').forEach(row => {const active = row.dataset.erpRow === selectedId;row.dataset.selected = String(active);row.querySelector('button').setAttribute('aria-pressed',String(active));});
    renderInspector();
  }
  function render() {
    if (!app?.result) return;
    const signature = JSON.stringify(app.filter);
    if (signature !== previousFilter || app.result !== previousResult) page = 0;
    previousFilter = signature;previousResult = app.result;
    ordered = order(app.visible);
    if (firstRender) {selectedId = ordered.find(row => row.usage.length)?.id || ordered[0]?.id || null;firstRender = false;}
    if (!ordered.some(row => row.id === selectedId)) selectedId = null;
    translate();syncView();headers();syncSelect('erpClient','client');syncSelect('erpStatus','status');
    if ($('erpSearch').value !== app.filter.search) $('erpSearch').value = app.filter.search;
    $('erpHorizon').value = String(app.state.settings.horizon);
    $('erpTitle').textContent = t(({plan:'planTitle',transfers:'transfersTitle',picking:'pickingTitle',ice:'iceTitle',rules:'rulesTitle'})[panel]);
    $('erpReference').textContent = t('reference',{start:date(app.result.start,true),end:date(app.result.end)}) + (app.state.settings.sendDate?' · '+t('sendOnDate',{date:expiry(app.state.settings.sendDate),time:app.state.settings.sendTime||app.state.settings.asOf.slice(11,16)}):'') + (app.state.settings.pullDate?' · '+t('receiveOnDate',{date:expiry(app.state.settings.pullDate),time:app.state.settings.pullTime||app.state.settings.asOf.slice(11,16)}):'');
    $('erpPolicy').textContent = t('policy',{hours:app.state.settings.leadHours});
    document.querySelector('.forecast-view-switch').setAttribute('aria-label',t('viewLabel'));
    document.querySelector('.erp-nav').setAttribute('aria-label',t('navigation'));
    document.querySelector('.erp-toolbar').setAttribute('aria-label',t('actions'));
    document.querySelector('.erp-grid-wrap').setAttribute('aria-label',t('tableLabel'));
    $('erpInspector').setAttribute('aria-label',t('selectedProduct'));
    renderRows();renderInspector();syncBusy();
  }
  function filterInput(key,value) {
    const node = $(key);node.value = value;node.dispatchEvent(new Event(key === 'search' ? 'input' : 'change',{bubbles:true}));
  }
  function clearFilters() {filterInput('client','');filterInput('status','all');filterInput('search','');}
  function action(name) {
    if (['recalculate','pdf','csv','files'].includes(name) && app.busy) return;
    if (name === 'files') {if (globalThis.ColdTrackData) ColdTrackData.go();else $('stockUpload').click();}
    if (name === 'recalculate') $('apply').click();
    if (name === 'pdf') $('pdf').click();
    if (name === 'csv') app.csv();
    if (name === 'bol') showPanel('transfers');
    if (name === 'help') $('help').click();
    if (name === 'clear') clearFilters();
    if (name === 'usage' && selectedId) ForecastUsage.open(selectedId);
    if (name === 'details' && selectedId) app.openDetail(selectedId);
  }
  function init(instance) {
    app = instance;
    // One navigation rail belongs to the hub; Forecasting uses full-width section tabs.
    $('erpToolbar').before($('erpNav'));
    try {const saved = localStorage.getItem(preference);view = ['erp','dashboard'].includes(saved) ? saved : ['erp','dashboard'].includes(root.dataset.forecastView) ? root.dataset.forecastView : 'erp';} catch (_) {}
    document.querySelectorAll('[data-erp-icon]').forEach(node => {node.innerHTML = icon(node.dataset.erpIcon);});
    $('erpLogo').src = 'data:image/png;base64,' + JSON.parse($('report-logo').textContent);
    document.addEventListener('click',event => {
      const viewButton = event.target.closest('button[data-forecast-view]'), section = event.target.closest('button[data-erp-panel]'), button = event.target.closest('[data-erp-action]');
      if (viewButton) showView(viewButton.dataset.forecastView);
      if (section) showPanel(section.dataset.erpPanel);
      if (button) action(button.dataset.erpAction);
    });
    for (const key of ['client','status']) $('erp' + key[0].toUpperCase() + key.slice(1)).addEventListener('change',event => filterInput(key,event.target.value));
    $('erpSearch').addEventListener('input',event => filterInput('search',event.target.value));
    $('erpHorizon').addEventListener('change',event => document.querySelector('button[data-horizon="' + event.target.value + '"]').click());
    $('erpClear').addEventListener('click',clearFilters);
    $('erpPageSize').addEventListener('change',event => {pageSize = Number(event.target.value);page = 0;renderRows();$('erpRows').parentElement.parentElement.scrollTop = 0;});
    $('erpPrev').addEventListener('click',() => {page--;renderRows();document.querySelector('.erp-grid-wrap').scrollTop = 0;});
    $('erpNext').addEventListener('click',() => {page++;renderRows();document.querySelector('.erp-grid-wrap').scrollTop = 0;});
    $('erpTable').addEventListener('click',event => {
      const sort = event.target.closest('[data-erp-sort]'), row = event.target.closest('[data-erp-row]');
      if (sort) {const key = sort.dataset.erpSort;sortDirection = key === sortKey ? -sortDirection : 1;sortKey = key;page = 0;ordered = order(app.visible);headers();renderRows();$('erpTable').querySelector('[data-erp-sort="' + key + '"]').focus();document.querySelector('.erp-grid-wrap').scrollTop = 0;}
      if (row) select(row.dataset.erpRow);
    });
    $('erpRows').addEventListener('keydown',event => {
      if (!event.target.matches('[data-erp-select]') || !['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
      event.preventDefault();const buttons = [...$('erpRows').querySelectorAll('[data-erp-select]')], index = buttons.indexOf(event.target), target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : Math.max(0,Math.min(buttons.length-1,index+(event.key === 'ArrowDown' ? 1 : -1)));
      select(buttons[target].dataset.erpSelect);buttons[target].focus();
    });
    syncView();
  }
  return {init,render,syncBusy,showView,showPanel,select,history,value,get view(){return view;},get panel(){return panel;},get selectedId(){return selectedId;},get orderedRows(){return ordered;}};
})();
