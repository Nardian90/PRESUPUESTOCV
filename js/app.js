/* =========================================================
   PRESUPUESTO CCTV v2.0 — app.js
   Plataforma profesional de presupuestación técnica y comercial
   · Fórmula: Equipos+Materiales+Software+MO+Transporte = CD
     CD + Utilidad = Subtotal de Venta · Subtotal + Impuesto = Total de Oferta
   · 100% local · localStorage · sin dependencias
   ========================================================= */
'use strict';

const LS_KEY = 'PCTV_STATE_V2';
const STAGES = ['BORRADOR', 'REVISIÓN TÉCNICA', 'REVISIÓN COMERCIAL', 'LISTO PARA CLIENTE'];

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const money = n => (Number.isFinite(+n) ? +n : 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

let S = null;
let fuentesFilter = 'TODOS';

/* ---------- Estado ---------- */
function seedState(){
  return JSON.parse(JSON.stringify({
    meta: PROJECT_META, config: CONFIG, rates: RATES, tech: TECH,
    items: EQUIPMENT, software: SOFTWARE, labor: LABOR,
    transport: TRANSPORT, sust: SUSTITUCIONES, audit: AUDIT,
    overrides: {}, vnotes: {}, stage: 0, v: 2
  }));
}
function load(){
  try { const raw = localStorage.getItem(LS_KEY); if (raw) { S = JSON.parse(raw); return; } } catch(e){}
  S = seedState(); save(true);
}
function save(silent){
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch(e){}
  const t = new Date().toLocaleTimeString('es', {hour:'2-digit', minute:'2-digit'});
  $('#saveStatus').textContent = '✓ Guardado ' + t;
  $('#sideSave').textContent = '✓ Cambios guardados · ' + t;
  if (!silent) toast('Guardado en este navegador');
}
let toastTimer = null;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
function setPath(path, v){
  const ps = path.split('.'); let o = S;
  for (let i = 0; i < ps.length - 1; i++) o = o[ps[i]];
  o[ps[ps.length - 1]] = v;
}

/* ---------- Motor económico ---------- */
function calc(){
  const sumCat = ks => S.items.filter(i => ks.includes(i.cat)).reduce((a,i) => a + num(i.qty) * num(i.cost), 0);
  const equipTotal = sumCat(['A','B']);
  const matTotal   = sumCat(['C','D','H']);
  const swTotal    = S.software.reduce((a,s) => a + num(s.cant) * num(s.pu), 0);
  const laborTotal = S.labor.reduce((a,l) => a + num(l.cant) * num(l.pu), 0);
  const T = S.transport; let ship = 0;
  if (T.enabled){
    if (T.mode === 'items')      ship = T.items.reduce((a,t) => a + num(t.cant) * num(t.pu), 0);
    else if (T.mode === 'fijo')  ship = num(T.fijo);
    else if (T.mode === 'pct')   ship = (equipTotal + matTotal + swTotal + laborTotal) * num(T.pct) / 100;
    else if (T.mode === 'viaje') ship = num(T.viajes) * num(T.costoViaje);
    else if (T.mode === 'km')    ship = num(T.km) * num(T.costoKm);
    else if (T.mode === 'manual')ship = num(T.manual);
  }
  const cd = equipTotal + matTotal + swTotal + laborTotal + ship;
  const m = num(S.config.markupPct);
  const utilidad = S.config.markupMode === 'costo' ? cd * m / 100 : cd * m / (100 - m);
  const sub = cd + utilidad;
  const imp = sub * num(S.config.taxPct) / 100;
  const pf  = sub + imp;
  const elig = S.items.filter(i => ['A','B','C','D'].includes(i.grade));
  const ab = elig.filter(i => i.grade === 'A' || i.grade === 'B');
  const cov = elig.length ? ab.length / elig.length * 100 : 0;
  return {equipTotal, matTotal, swTotal, laborTotal, ship, cd, utilidad, sub, imp, pf, cov, nElig: elig.length, nAB: ab.length};
}

function techCalc(){
  const t = S.tech;
  const cams = S.items.filter(i => /CAM-/.test(i.code || '')).reduce((a,i) => a + num(i.qty), 0);
  const poeLoad = cams * num(t.camWatts);
  const poeBudget = num(t.nvrPoeBudget) + num(t.swPoeBudget);
  const poeOK = poeLoad * 1.2 <= poeBudget;
  const ports = num(t.nvrPoePorts) + num(t.swPoePorts);
  const portsOK = ports >= cams && cams > 0;
  const bw = cams * num(t.bitrateMbps);
  const bwOK = bw <= num(t.nvrBwMbps);
  const days = num(t.hddTB) * 1000 / (cams * num(t.bitrateMbps) * 10.8);
  const daysOK = days >= num(t.retencionDias);
  return {cams, poeLoad, poeBudget, poeOK, ports, portsOK, bw, bwOK, days, daysOK};
}

/* ---------- Validaciones (16) ---------- */
function valState(n){
  const c = calc(), t = techCalc();
  switch(n){
    case 1:  return c.cov >= 99.999;
    case 2:  return !S.items.some(i => num(i.cost) === 0 && !/gratuit/i.test((i.note||'') + (i.stock||'')))
                  && !S.software.some(s => num(s.pu) === 0 && !/gratuit/i.test((s.obs||'') + (s.tipo||'')));
    case 3:  return !S.items.some(i => ['C','D'].includes(i.grade));
    case 4:  return t.cams > 0 && t.cams <= num(S.tech.nvrCanal);
    case 5:  return t.poeOK && t.portsOK;
    case 6:  return t.bwOK;
    case 7:  return t.daysOK;
    case 8:  { const h = S.items.find(i => i.code === 'HDD-01'); return !!h && num(h.qty) >= 2 && num(h.cost) > 0; }
    case 9:  return S.items.every(i => !!String(i.url || '').trim());
    case 10: return S.items.every(i => i.stock === 'EN STOCK' || i.stock === 'GRATUITO');
    case 11: return !S.items.some(i => /ebay|ebee|aliexpress|wish|temu|mercado libre/i.test(i.source || ''));
    case 12: return S.software.length > 0 && S.software.every(s => num(s.pu) > 0 || /gratuit|justific/i.test((s.obs||'') + (s.tipo||'')));
    case 13: return S.labor.length >= 29 && S.labor.every(l => num(l.cant) > 0 && num(l.pu) > 0);
    case 14: return c.pf > 0 && Math.abs((c.cd + c.utilidad + c.imp) - c.pf) < 0.01;
    case 15: return S.config.taxPct !== '' && num(S.config.taxPct) >= 0;
    case 16: return !!(S.meta.nombre && S.meta.direccion && S.meta.fecha);
  }
  return false;
}
function valSatisfied(n){ return valState(n) || !!S.overrides[n]; }
function failedVals(){
  const f = []; VALIDATIONS.forEach(v => { if (!valSatisfied(v.n)) f.push(v.n); }); return f;
}
function covClass(p){ return p >= 99.999 ? 'ok' : (p >= 90 ? 'warn' : 'bad'); }

/* ---------- Render: Dashboard ---------- */
function renderDash(){
  const c = calc(), cls = covClass(c.cov), t = techCalc();
  const kpi = (l, v, s, hl) => '<div class="kpi' + (hl ? ' hl' : '') + '"><span class="kpi-l">' + l + '</span><span class="kpi-v"' + (s ? ' style="font-size:15.5px"' : '') + '>' + v + '</span>' + (s ? '<span class="kpi-s">' + s + '</span>' : '') + '</div>';
  $('#kpiGrid').innerHTML =
    kpi('EQUIPOS', 'USD ' + money(c.equipTotal)) +
    kpi('MATERIALES', 'USD ' + money(c.matTotal)) +
    kpi('SOFTWARE', 'USD ' + money(c.swTotal)) +
    kpi('MANO DE OBRA', 'USD ' + money(c.laborTotal)) +
    kpi('TRANSPORTE', 'USD ' + money(c.ship), S.transport.enabled ? 'Incluido' : 'No incluido') +
    kpi('COSTOS DIRECTOS', 'USD ' + money(c.cd)) +
    kpi('UTILIDAD', 'USD ' + money(c.utilidad)) +
    kpi('IMPUESTO', 'USD ' + money(c.imp)) +
    kpi('TOTAL DE OFERTA', 'USD ' + money(c.pf), null, true);
  $('#indChips').innerHTML =
    '<span class="chip">Cámaras: <b>' + t.cams + '</b></span>' +
    '<span class="chip">Líneas presupuestarias: <b>' + (S.items.length + S.software.length + S.labor.length) + '</b></span>' +
    '<span class="chip">Cobertura A/B: <b style="color:var(--' + (cls === 'ok' ? 'success' : cls === 'warn' ? 'warning' : 'danger') + ')">' + c.cov.toFixed(1) + '%</b></span>' +
    '<span class="chip">Margen de utilidad: <b>' + esc(S.config.markupPct) + '%</b></span>' +
    '<span class="chip">Impuesto: <b>' + esc(S.config.taxPct) + '%</b></span>' +
    '<span class="chip">Estado de validación: <b>' + esc(STAGES[S.stage]) + '</b></span>';

  $('#ofertaCard').innerHTML =
    '<h3>RESUMEN DE OFERTA</h3>' +
    '<div class="of-row">Proyecto: <b>' + esc(S.meta.nombre || '—') + '</b></div>' +
    '<div class="of-row">Cliente: <b>' + esc(S.meta.cliente || 'Por definir') + '</b></div>' +
    '<div class="of-row">Sistema: <b>Circuito Cerrado de Televisión (CCTV)</b></div>' +
    '<div class="of-row">Cantidad de cámaras: <b>' + t.cams + '</b></div>' +
    '<div class="of-total">$ ' + money(c.pf) + ' <span style="font-size:13px;font-weight:600">' + esc(S.meta.moneda || 'USD') + '</span></div>' +
    '<div style="font-size:11px;color:#bfdbfe">TOTAL DE OFERTA · vigencia ' + esc(S.meta.vigencia || '30 días') + '</div>' +
    '<ul class="of-inc">' +
    '<li>✓ Equipos</li><li>✓ Materiales</li><li>✓ Software</li><li>✓ Mano de obra</li>' +
    '<li>✓ Transporte' + (S.transport.enabled ? '' : ' (no aplica)') + '</li><li>✓ Utilidad</li><li>✓ Impuesto</li></ul>';

  $('#formulaPanel').innerHTML = '<h3>Fórmula económica (en vivo)</h3>' +
    '<table class="t"><tr><th>Concepto</th><th class="tot">' + esc(S.meta.moneda || 'USD') + '</th></tr>' +
    '<tr><td>Equipos</td><td class="tot">' + money(c.equipTotal) + '</td></tr>' +
    '<tr><td>+ Materiales</td><td class="tot">' + money(c.matTotal) + '</td></tr>' +
    '<tr><td>+ Software</td><td class="tot">' + money(c.swTotal) + '</td></tr>' +
    '<tr><td>+ Mano de obra</td><td class="tot">' + money(c.laborTotal) + '</td></tr>' +
    '<tr><td>+ Transporte</td><td class="tot">' + money(c.ship) + '</td></tr>' +
    '<tr class="catrow"><td>= COSTO DIRECTO</td><td class="tot">' + money(c.cd) + '</td></tr>' +
    '<tr><td>+ Utilidad (' + esc(S.config.markupPct) + '% ' + (S.config.markupMode === 'costo' ? 'sobre costo' : 'sobre precio') + ')</td><td class="tot">' + money(c.utilidad) + '</td></tr>' +
    '<tr class="catrow"><td>= SUBTOTAL DE VENTA</td><td class="tot">' + money(c.sub) + '</td></tr>' +
    '<tr><td>+ Impuesto (' + esc(S.config.taxPct) + '%)</td><td class="tot">' + money(c.imp) + '</td></tr>' +
    '<tr class="grand"><td>= TOTAL DE OFERTA</td><td class="tot">' + money(c.pf) + '</td></tr></table>';

  const catSum = k => S.items.filter(i => i.cat === k).reduce((a,i) => a + num(i.qty) * num(i.cost), 0);
  const rows = [['A', catSum('A')], ['B', catSum('B')], ['C', catSum('C')], ['D', catSum('D')],
                ['E', c.swTotal], ['F', c.laborTotal], ['G', c.ship], ['H', catSum('H')], ['I', c.utilidad], ['J', c.imp]];
  let html = '<table class="t"><tr><th>Cat.</th><th>Concepto</th><th class="tot">USD</th></tr>';
  rows.forEach(([k, v]) => { html += '<tr><td><b>' + k + '</b></td><td>' + esc(CATS[k]) + '</td><td class="tot">' + money(v) + '</td></tr>'; });
  html += '<tr class="grand"><td colspan="2">TOTAL DE OFERTA</td><td class="tot">' + money(c.pf) + '</td></tr></table>';
  $('#summaryTable').innerHTML = html;
}

/* ---------- Render: Datos del Proyecto ---------- */
function renderProyecto(){
  const m = S.meta, r = m.responsable || {};
  const fld = (lbl, path, val, type, ph) => '<label>' + lbl + ': <input type="' + (type || 'text') + '" data-path="' + path + '" value="' + esc(val == null ? '' : val) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '></label>';
  $('#proyectoForm').innerHTML =
    '<div class="card"><h3>Información General</h3>' +
      fld('Nombre del proyecto', 'meta.nombre', m.nombre) +
      fld('Nombre de la obra', 'meta.obra', m.obra, 'text', 'Ej. Supermercado 23 y 10') +
      fld('Dirección', 'meta.direccion', m.direccion) +
      fld('Cliente', 'meta.cliente', m.cliente, 'text', 'Nombre del cliente') +
      fld('Especialidad', 'meta.especialidad', m.especialidad) +
      fld('Número de presupuesto', 'meta.numPresupuesto', m.numPresupuesto, 'text', 'Ej. PCT-2025-001') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      fld('Fecha', 'meta.fecha', m.fecha, 'date') +
      fld('Vigencia de la oferta', 'meta.vigencia', m.vigencia, 'text', 'Ej. 30 días') + '</div>' +
      fld('Moneda', 'meta.moneda', m.moneda) +
    '</div>' +
    '<div class="card"><h3>Responsable (opcional)</h3>' +
      '<p class="muted" style="font-size:11.5px;margin-bottom:10px">Todos los campos pueden quedar vacíos. Solo se mostrarán en los PDFs los campos con información.</p>' +
      fld('Elaborado por / Responsable', 'meta.responsable.nombre', r.nombre, 'text', 'Nombre libre del responsable') +
      fld('Cargo / Especialidad', 'meta.responsable.cargo', r.cargo, 'text', 'Ej. Ingeniero de Telecomunicaciones') +
      fld('Empresa', 'meta.responsable.empresa', r.empresa, 'text', 'Nombre de la empresa') +
      fld('Teléfono', 'meta.responsable.telefono', r.telefono, 'text', 'Ej. +53 XXX XXX XXX') +
      fld('Correo electrónico', 'meta.responsable.correo', r.correo, 'email', 'contacto@empresa.com') +
    '</div>';
  $('#obsCard').innerHTML = '<h3>Observaciones generales</h3><textarea data-path="meta.observaciones" placeholder="Notas, condiciones adicionales, aclaraciones…">' + esc(m.observaciones || '') + '</textarea>';
}
/* ---------- Render: Equipos y Materiales ---------- */
function renderEquip(){
  let h = '<table class="t"><tr><th>ID</th><th>Cat.</th><th>Código</th><th>Descripción</th><th>Cant.</th><th>Unid.</th><th>Costo U.</th><th class="tot">Total</th><th>Grado</th><th>Fuente</th><th>Disponib.</th><th>URL</th><th>Nota</th><th></th></tr>';
  S.items.forEach((it, idx) => {
    h += '<tr><td>' + esc(it.id) + '</td>' +
      '<td><select data-path="items.' + idx + '.cat">' + ['A','B','C','D','H'].map(k => '<option value="' + k + '"' + (it.cat === k ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></td>' +
      '<td><input data-path="items.' + idx + '.code" value="' + esc(it.code) + '" style="width:92px"></td>' +
      '<td><input data-path="items.' + idx + '.desc" value="' + esc(it.desc) + '" style="min-width:250px"></td>' +
      '<td><input type="number" step="1" min="0" data-path="items.' + idx + '.qty" data-num="1" value="' + esc(it.qty) + '"></td>' +
      '<td><input data-path="items.' + idx + '.unit" value="' + esc(it.unit) + '" style="width:55px"></td>' +
      '<td><input type="number" step="0.01" min="0" data-path="items.' + idx + '.cost" data-num="1" value="' + esc(it.cost) + '"></td>' +
      '<td class="tot">' + money(num(it.qty) * num(it.cost)) + '</td>' +
      '<td><select data-path="items.' + idx + '.grade">' + ['A','B','C','D'].map(g => '<option value="' + g + '"' + (it.grade === g ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></td>' +
      '<td><input data-path="items.' + idx + '.source" value="' + esc(it.source) + '" style="min-width:108px"></td>' +
      '<td><select data-path="items.' + idx + '.stock">' + ['EN STOCK','POR CONFIRMAR','GRATUITO','AGOTADO'].map(s => '<option' + (it.stock === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></td>' +
      '<td><input data-path="items.' + idx + '.url" value="' + esc(it.url) + '" style="min-width:170px"></td>' +
      '<td><input data-path="items.' + idx + '.note" value="' + esc(it.note) + '" style="min-width:130px"></td>' +
      '<td><button class="del" data-act="del-row" data-id="' + esc(it.id) + '" title="Eliminar">&times;</button></td></tr>';
  });
  $('#eqTable').innerHTML = h + '</table>';
}

/* ---------- Render: Software CCTV ---------- */
function renderSoftware(){
  let h = '<table class="t"><tr><th>ID</th><th>Nombre</th><th>Tipo de licencia</th><th>Cant.</th><th>Unid.</th><th>Precio U.</th><th class="tot">Subtotal</th><th>Fuente</th><th>Observaciones</th><th></th></tr>';
  S.software.forEach((s, idx) => {
    h += '<tr><td>' + esc(s.id) + '</td>' +
      '<td><input data-path="software.' + idx + '.nombre" value="' + esc(s.nombre) + '" style="min-width:200px"></td>' +
      '<td><select data-path="software.' + idx + '.tipo">' + ['Gratuita','Comercial','Suscripción','Personalizada','Otra'].map(t => '<option' + (s.tipo === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></td>' +
      '<td><input type="number" step="1" min="0" data-path="software.' + idx + '.cant" data-num="1" value="' + esc(s.cant) + '"></td>' +
      '<td><input data-path="software.' + idx + '.unidad" value="' + esc(s.unidad) + '" style="width:52px"></td>' +
      '<td><input type="number" step="0.01" min="0" data-path="software.' + idx + '.pu" data-num="1" value="' + esc(s.pu) + '"></td>' +
      '<td class="tot">' + money(num(s.cant) * num(s.pu)) + '</td>' +
      '<td><input data-path="software.' + idx + '.fuente" value="' + esc(s.fuente) + '" style="min-width:120px"></td>' +
      '<td><input data-path="software.' + idx + '.obs" value="' + esc(s.obs) + '" style="min-width:190px"></td>' +
      '<td><button class="del" data-act="del-sw" data-id="' + esc(s.id) + '" title="Eliminar">&times;</button></td></tr>';
  });
  const tot = S.software.reduce((a,s) => a + num(s.cant) * num(s.pu), 0);
  $('#swTable').innerHTML = h + '<tr class="grand"><td colspan="6">TOTAL SOFTWARE</td><td class="tot">' + money(tot) + '</td><td colspan="3"></td></tr></table>';
}

/* ---------- Render: Mano de Obra ---------- */
function renderMO(){
  const r = S.rates;
  $('#ratesPanel').innerHTML = '<h3>Tarifas de referencia por nivel (USD/h — editables)</h3><div class="grid3">' +
    '<label>Técnico: <input type="number" step="0.5" data-path="rates.T" data-num="1" value="' + esc(r.T) + '"></label>' +
    '<label>Supervisor: <input type="number" step="0.5" data-path="rates.S" data-num="1" value="' + esc(r.S) + '"></label>' +
    '<label>Ingeniero: <input type="number" step="0.5" data-path="rates.I" data-num="1" value="' + esc(r.I) + '"></label></div>' +
    '<p class="muted" style="font-size:11.5px;margin-top:6px">Las tarifas son valores de referencia: cada operación tiene su propio Precio Unitario editable.</p>';
  let h = '<table class="t"><tr><th>N°</th><th>Categoría</th><th>Operación</th><th>Unid.</th><th>Cantidad</th><th>Precio Unit.</th><th class="tot">Subtotal</th><th>Nivel</th><th></th></tr>';
  let grand = 0;
  MO_CATS.forEach(cat => {
    const ops = S.labor.map((l, idx) => ({l, idx})).filter(x => x.l.cat === cat);
    if (!ops.length) return;
    let sub = 0;
    let body = '';
    ops.forEach(({l, idx}) => {
      const tot = num(l.cant) * num(l.pu); sub += tot; grand += tot;
      body += '<tr><td>' + l.n + '</td>' +
        '<td><input data-path="labor.' + idx + '.op" value="' + esc(l.op) + '" style="min-width:290px"></td>' +
        '<td><input data-path="labor.' + idx + '.unidad" value="' + esc(l.unidad) + '" style="width:46px"></td>' +
        '<td><input type="number" step="0.5" min="0" data-path="labor.' + idx + '.cant" data-num="1" value="' + esc(l.cant) + '"></td>' +
        '<td><input type="number" step="0.01" min="0" data-path="labor.' + idx + '.pu" data-num="1" value="' + esc(l.pu) + '"></td>' +
        '<td class="tot">' + money(tot) + '</td>' +
        '<td><select data-path="labor.' + idx + '.resp"><option value="T"' + (l.resp === 'T' ? ' selected' : '') + '>Téc.</option><option value="S"' + (l.resp === 'S' ? ' selected' : '') + '>Sup.</option><option value="I"' + (l.resp === 'I' ? ' selected' : '') + '>Ing.</option></select></td>' +
        '<td><button class="del" data-act="del-mo" data-n="' + l.n + '" title="Eliminar">&times;</button></td></tr>';
    });
    h += '<tr class="catgroup"><td colspan="8">' + esc(cat) + ' (' + ops.length + ' ops)</td><td></td></tr>' + body;
    h += '<tr class="catrow"><td colspan="5">Subtotal ' + esc(cat) + '</td><td class="tot">' + money(sub) + '</td><td colspan="3"></td></tr>';
  });
  h += '<tr class="grand"><td colspan="5">TOTAL MANO DE OBRA (' + S.labor.length + ' operaciones)</td><td class="tot">' + money(grand) + '</td><td colspan="3"></td></tr></table>';
  $('#moTable').innerHTML = h;
}

/* ---------- Render: Transporte ---------- */
function renderTransport(){
  const T = S.transport;
  let fields = '';
  if (T.mode === 'items')      fields = '<p class="muted" style="font-size:11.5px">Agregue gastos: transporte local, flete, logística, transporte de materiales u otros.</p>';
  if (T.mode === 'fijo')       fields = '<label>Monto fijo (USD): <input type="number" step="0.01" data-path="transport.fijo" data-num="1" value="' + esc(T.fijo) + '"></label>';
  if (T.mode === 'pct')        fields = '<label>Porcentaje del costo directo (%): <input type="number" step="0.1" data-path="transport.pct" data-num="1" value="' + esc(T.pct) + '"></label>';
  if (T.mode === 'viaje')      fields = '<label>N° de viajes: <input type="number" data-path="transport.viajes" data-num="1" value="' + esc(T.viajes) + '"></label><label>Costo por viaje (USD): <input type="number" step="0.01" data-path="transport.costoViaje" data-num="1" value="' + esc(T.costoViaje) + '"></label>';
  if (T.mode === 'km')         fields = '<label>Kilómetros: <input type="number" step="0.1" data-path="transport.km" data-num="1" value="' + esc(T.km) + '"></label><label>Costo por km (USD): <input type="number" step="0.01" data-path="transport.costoKm" data-num="1" value="' + esc(T.costoKm) + '"></label>';
  if (T.mode === 'manual')     fields = '<label>Monto manual (USD): <input type="number" step="0.01" data-path="transport.manual" data-num="1" value="' + esc(T.manual) + '"></label>';
  const c = calc();
  $('#transPanel').innerHTML =
    '<label class="chk" style="font-size:14px"><input type="checkbox" data-path="transport.enabled"' + (T.enabled ? ' checked' : '') + '> <b>INCLUIR TRANSPORTE</b> <span class="muted">(desactivado = $0.00)</span></label>' +
    (T.enabled ?
      '<label>Modo: <select data-path="transport.mode">' +
      '<option value="items"' + (T.mode === 'items' ? ' selected' : '') + '>Lista de gastos (ítems)</option>' +
      '<option value="fijo"' + (T.mode === 'fijo' ? ' selected' : '') + '>Precio fijo</option>' +
      '<option value="pct"' + (T.mode === 'pct' ? ' selected' : '') + '>Porcentaje del costo directo</option>' +
      '<option value="viaje"' + (T.mode === 'viaje' ? ' selected' : '') + '>Por viaje</option>' +
      '<option value="km"' + (T.mode === 'km' ? ' selected' : '') + '>Por kilómetro</option>' +
      '<option value="manual"' + (T.mode === 'manual' ? ' selected' : '') + '>Manual</option></select></label>' + fields +
      '<div class="badge b-ok" style="margin-top:8px">Transporte actual: USD ' + money(c.ship) + '</div>'
      : '<div class="badge b-na" style="margin-top:8px">Transporte: $0.00 (no incluido en la oferta)</div>');
  if (T.enabled && T.mode === 'items'){
    let h = '<table class="t"><tr><th>Concepto</th><th>Unid.</th><th>Cant.</th><th>Precio U.</th><th class="tot">Subtotal</th><th>Observaciones</th><th></th></tr>';
    T.items.forEach((t, idx) => {
      h += '<tr><td><input data-path="transport.items.' + idx + '.concepto" value="' + esc(t.concepto) + '" style="min-width:210px"></td>' +
        '<td><input data-path="transport.items.' + idx + '.unidad" value="' + esc(t.unidad) + '" style="width:48px"></td>' +
        '<td><input type="number" step="0.5" min="0" data-path="transport.items.' + idx + '.cant" data-num="1" value="' + esc(t.cant) + '"></td>' +
        '<td><input type="number" step="0.01" min="0" data-path="transport.items.' + idx + '.pu" data-num="1" value="' + esc(t.pu) + '"></td>' +
        '<td class="tot">' + money(num(t.cant) * num(t.pu)) + '</td>' +
        '<td><input data-path="transport.items.' + idx + '.obs" value="' + esc(t.obs) + '" style="min-width:150px"></td>' +
        '<td><button class="del" data-act="del-trans" data-i="' + idx + '" title="Eliminar">&times;</button></td></tr>';
    });
    const tot = T.items.reduce((a,t) => a + num(t.cant) * num(t.pu), 0);
    $('#transTable').innerHTML = h + '<tr class="grand"><td colspan="4">TOTAL TRANSPORTE</td><td class="tot">' + money(tot) + '</td><td colspan="2"></td></tr></table>';
  } else $('#transTable').innerHTML = '';
}

/* ---------- Render: Configuración Económica + Seguridad + Datos ---------- */
function renderEcon(){
  const c = S.config;
  $('#econPanel').innerHTML =
    '<div class="card"><h3>Impuesto sobre ventas</h3>' +
      '<label>Impuesto (%): <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input type="number" step="0.5" min="0" data-path="config.taxPct" data-num="1" value="' + esc(c.taxPct) + '" style="max-width:110px">' +
      '<span class="presets"><button class="btn mini" data-act="preset-tax" data-v="0">0</button><button class="btn mini" data-act="preset-tax" data-v="5">5</button><button class="btn mini" data-act="preset-tax" data-v="11">11</button><button class="btn mini" data-act="preset-tax" data-v="15">15</button></span></div></label>' +
      '<p class="muted" style="font-size:11.5px">Por defecto 11%. Editable (0 / 5 / 11 / 15 / personalizado).</p>' +
    '</div>' +
    '<div class="card"><h3>Utilidad</h3>' +
      '<label>Base: <select data-path="config.markupMode"><option value="costo"' + (c.markupMode === 'costo' ? ' selected' : '') + '>MARKUP SOBRE COSTO (oficial)</option><option value="precio"' + (c.markupMode === 'precio' ? ' selected' : '') + '>MARGEN SOBRE PRECIO DE VENTA</option></select></label>' +
      '<label>Utilidad (%): <input type="number" step="0.5" min="0" data-path="config.markupPct" data-num="1" value="' + esc(c.markupPct) + '" style="max-width:110px"></label>' +
      '<p class="muted" style="font-size:11.5px">Por defecto 30% MARKUP SOBRE COSTO. Fórmula: CD + Utilidad = Subtotal de Venta; Subtotal + Impuesto = Total de Oferta.</p>' +
    '</div>';
  $('#pwPanel').innerHTML = '<h3>Seguridad de acceso</h3>' +
    '<div class="grid3">' +
    '<label>Contraseña actual: <input type="password" id="pwCur" autocomplete="off"></label>' +
    '<label>Nueva contraseña: <input type="password" id="pwNew" autocomplete="off"></label>' +
    '<label>Repetir nueva: <input type="password" id="pwNew2" autocomplete="off"></label></div>' +
    '<button class="btn" data-act="change-pw" style="margin-top:8px">Cambiar contraseña</button>' +
    '<p class="muted" style="font-size:11px;margin-top:6px">La contraseña se almacena como hash SHA-256 (nunca en texto plano). Cierre sesión con "Cerrar sesión" en el menú lateral.</p>';
}
/* ---------- Render: Validación Técnica ---------- */
function renderValid(){
  const t = techCalc();
  const row = (lbl, val, ok) => '<tr><td>' + lbl + '</td><td>' + val + '</td><td><span class="badge ' + (ok ? 'b-ok">OK' : 'b-bad">FALTA') + '</span></td></tr>';
  $('#techPanel').innerHTML = '<h3>Análisis técnico automático</h3><table class="t">' +
    row('Cámaras detectadas', t.cams + ' (1 domo + 20 bullet)', t.cams === 21) +
    row('Puertos PoE', t.ports + ' puertos para ' + t.cams + ' cámaras', t.portsOK) +
    row('Presupuesto PoE', money(t.poeLoad) + ' W (mín. ' + money(t.poeLoad * 1.2) + ' W) vs ' + money(t.poeBudget) + ' W', t.poeOK) +
    row('Ancho de banda', t.bw + ' Mbps vs ' + esc(S.tech.nvrBwMbps) + ' Mbps del NVR', t.bwOK) +
    row('Almacenamiento', money(t.days) + ' días (objetivo ' + esc(S.tech.retencionDias) + ', 12 TB @ ' + esc(S.tech.bitrateMbps) + ' Mbps)', t.daysOK) +
    '</table><p class="muted" style="font-size:11.5px">Si se exigen 30 días de retención: ampliar a 2×10 TB o 4×6 TB WD Purple.</p>';

  let p = '<h3>Estado del presupuesto</h3><div class="pipeline">';
  STAGES.forEach((st, i) => {
    const cls = i < S.stage ? 'done' : (i === S.stage ? 'cur' : '');
    p += '<div class="pipe-step ' + cls + '"><span class="pipe-dot">' + (i < S.stage ? '✓' : i + 1) + '</span><span class="pipe-lbl">' + esc(st) + '</span></div>';
  });
  p += '</div>';
  if (S.stage < 3){
    const reason = advanceReason();
    p += (reason ? '<div id="pipeReason">Para avanzar: ' + esc(reason) + '</div>' : '<div id="pipeReason" style="color:var(--success)">Requisitos cumplidos para avanzar a ' + esc(STAGES[S.stage + 1]) + '.</div>') +
      '<div class="toolbar" style="margin-top:10px"><button class="btn" data-act="advance"' + (reason ? ' disabled' : '') + '>Pasar a ' + esc(STAGES[S.stage + 1]) + ' ›</button>' +
      '<button class="btn ghost" data-act="back"' + (S.stage === 0 ? ' disabled' : '') + '>‹ Retroceder</button></div>';
  } else {
    p += '<div class="badge b-ok" style="margin-top:10px">LISTO PARA CLIENTE — las 16 validaciones están aprobadas y la cobertura es 100%.</div><div class="toolbar" style="margin-top:10px"><button class="btn ghost" data-act="back">‹ Retroceder</button></div>';
  }
  $('#statePipeline').innerHTML = p;

  let h = '<table class="t"><tr><th>N°</th><th>Validación</th><th>Auto</th><th>Excepción aprobada</th><th>Nota de excepción</th><th>Estado</th></tr>';
  VALIDATIONS.forEach(v => {
    h += '<tr><td>' + v.n + '</td><td>' + esc(v.desc) + '</td><td id="va-' + v.n + '"></td>' +
      '<td><input type="checkbox" data-ov="' + v.n + '"' + (S.overrides[v.n] ? ' checked' : '') + '></td>' +
      '<td><input data-path="vnotes.' + v.n + '" value="' + esc(S.vnotes[v.n] || '') + '" placeholder="Justificación si es excepción"></td>' +
      '<td id="vs-' + v.n + '"></td></tr>';
  });
  $('#valTable').innerHTML = h + '</table>';
  VALIDATIONS.forEach(v => refreshValBadges(v.n));
}
function refreshValBadges(n){
  const auto = valState(n), sat = valSatisfied(n);
  const va = $('#va-' + n), vs = $('#vs-' + n);
  if (!va || !vs) return;
  va.innerHTML = '<span class="badge ' + (auto ? 'b-ok">CUMPLE' : 'b-warn">NO CUMPLE') + '</span>';
  vs.innerHTML = '<span class="badge ' + (sat ? (auto ? 'b-ok' : 'b-warn') : 'b-bad') + '">' + (sat ? (auto ? 'APROBADA' : 'EXCEPCIÓN') : 'PENDIENTE') + '</span>';
}

/* ---------- Máquina de estados ---------- */
function advanceReason(){
  if (S.stage === 0){
    const t = techCalc(), bad = [];
    if (!t.portsOK) bad.push('puertos PoE insuficientes');
    if (!t.poeOK)   bad.push('presupuesto PoE insuficiente');
    if (!t.bwOK)    bad.push('ancho de banda excedido');
    if (!t.daysOK)  bad.push('retención por debajo del objetivo');
    return bad.length ? bad.join(', ') : null;
  }
  if (S.stage === 1) return calc().cov >= 90 ? null : 'la cobertura A/B debe ser ≥ 90%';
  if (S.stage === 2){
    const f = failedVals();
    return f.length ? 'validaciones pendientes: ' + f.join(', ') + (f.includes(1) ? ' (cobertura debe ser 100%)' : '') : null;
  }
  return null;
}
function renderStage(){
  const b = $('#stageBadge');
  b.textContent = STAGES[S.stage];
  b.className = 'stage st' + S.stage;
}
function advance(){
  const reason = advanceReason();
  if (reason) { toast('Bloqueado — ' + reason); return; }
  S.stage++; save(true); renderAll(); toast('Estado: ' + STAGES[S.stage]);
}
function back(){ if (S.stage > 0) { S.stage--; save(true); renderAll(); } }

/* ---------- Render: Fuentes de Precios ---------- */
function renderFuentes(){
  const c = calc(), cls = covClass(c.cov);
  $('#covHeader').innerHTML = '<h3>Cobertura de precios A/B</h3><div class="mk-row"><span class="mk-lbl">' + c.nAB + ' / ' + c.nElig + ' partidas</span><div class="bar-wrap"><div class="bar-fill" style="width:' + Math.min(100, c.cov) + '%;background:var(--' + (cls === 'ok' ? 'success' : cls === 'warn' ? 'warning' : 'danger') + ')"></div></div><span class="mk-n"><b>' + c.cov.toFixed(1) + '%</b></span></div>' +
    '<p class="muted" style="font-size:11.5px">A = tienda/marca directa (Amazon, Newegg, CDW, Home Depot, B&H, fabricante) · B = distribuidor reconocido con precio público · C/D = no admisible en entrega.</p>' +
    '<label style="max-width:220px;margin-top:8px">Filtrar por grado: <select id="fuentesFilter"><option>TODOS</option><option>A</option><option>B</option><option>C</option><option>D</option></select></label>';
  const sel = $('#fuentesFilter');
  sel.value = fuentesFilter;
  sel.addEventListener('change', () => { fuentesFilter = sel.value; renderFuentes(); });
  let h = '<table class="t"><tr><th>Código</th><th>Descripción</th><th>Costo U.</th><th>Grado</th><th>Fuente</th><th>Disponib.</th><th>URL</th></tr>';
  S.items.filter(i => fuentesFilter === 'TODOS' || i.grade === fuentesFilter).forEach(i => {
    const gc = i.grade === 'A' || i.grade === 'B' ? 'b-ok' : i.grade === 'C' ? 'b-warn' : 'b-bad';
    h += '<tr><td>' + esc(i.code) + '</td><td>' + esc(i.desc) + '</td><td class="tot">' + money(i.cost) + '</td><td><span class="badge ' + gc + '">' + esc(i.grade) + '</span></td><td>' + esc(i.source) + '</td><td>' + esc(i.stock) + '</td><td><a href="' + esc(i.url) + '" target="_blank" rel="noopener" style="color:var(--accent)">Abrir</a></td></tr>';
  });
  $('#fuentesTable').innerHTML = h + '</table>';
}

/* ---------- Render: Análisis de Mercado ---------- */
function renderMercado(){
  const c = calc(), t = techCalc();
  const grades = ['A','B','C','D'];
  const counts = grades.map(g => ({g, n: S.items.filter(i => i.grade === g).length}));
  const total = S.items.length || 1;
  const colors = {A:'var(--success)', B:'var(--primary)', C:'var(--warning)', D:'var(--danger)'};
  let dist = '<div class="card"><h3>Distribución por grado de precio</h3>';
  counts.forEach(x => {
    dist += '<div class="mk-row"><span class="mk-lbl">Grado ' + x.g + '</span><div class="bar-wrap"><div class="bar-fill" style="width:' + (x.n / total * 100) + '%;background:' + colors[x.g] + '"></div></div><span class="mk-n">' + x.n + ' (' + (x.n / total * 100).toFixed(0) + '%)</span></div>';
  });
  dist += '</div>';
  const srcMap = {};
  S.items.forEach(i => { const s = (i.source || 'Sin fuente').split('/')[0].trim(); srcMap[s] = (srcMap[s] || 0) + 1; });
  let srcs = '<div class="card"><h3>Fuentes de abastecimiento</h3>';
  Object.entries(srcMap).sort((a,b) => b[1] - a[1]).forEach(([s, n]) => { srcs += '<div class="mk-row"><span class="mk-lbl" style="width:200px">' + esc(s) + '</span><div class="bar-wrap"><div class="bar-fill" style="width:' + (n / total * 100) + '%;background:var(--accent)"></div></div><span class="mk-n">' + n + '</span></div>'; });
  srcs += '</div>';
  const alerts = S.items.filter(i => ['C','D'].includes(i.grade) || i.stock === 'POR CONFIRMAR' || i.stock === 'AGOTADO' || !String(i.url||'').trim());
  let al = '<div class="card"><h3>Partidas que requieren atención (' + alerts.length + ')</h3>';
  al += alerts.length ? '<table class="t"><tr><th>Código</th><th>Motivo</th><th>Estado</th></tr>' +
    alerts.map(i => {
      const motivos = [];
      if (['C','D'].includes(i.grade)) motivos.push('grado ' + i.grade);
      if (i.stock === 'POR CONFIRMAR' || i.stock === 'AGOTADO') motivos.push('disponibilidad: ' + i.stock);
      if (!String(i.url||'').trim()) motivos.push('sin URL');
      return '<tr><td>' + esc(i.code) + '</td><td>' + motivos.join(' · ') + '</td><td><span class="badge b-warn">REVISAR</span></td></tr>';
    }).join('') + '</table>' : '<p class="muted">Todas las partidas cumplen los requisitos de trazabilidad.</p>';
  al += '</div>';
  const unit = t.cams ? c.equipTotal / t.cams : 0;
  const kpis = '<div class="kpi-grid">' +
    '<div class="kpi"><span class="kpi-l">COSTO DE EQUIPOS POR CÁMARA</span><span class="kpi-v">USD ' + money(unit) + '</span></div>' +
    '<div class="kpi"><span class="kpi-l">COSTO TOTAL POR CÁMARA</span><span class="kpi-v">USD ' + money(t.cams ? c.cd / t.cams : 0) + '</span></div>' +
    '<div class="kpi"><span class="kpi-l">PARTIDAS TRAZABLES (A/B)</span><span class="kpi-v">' + c.nAB + ' / ' + c.nElig + '</span></div>' +
    '<div class="kpi"><span class="kpi-l">ÍTEMS DE SOFTWARE</span><span class="kpi-v">' + S.software.length + '</span></div></div>';
  $('#mercadoPanel').innerHTML = kpis + '<div class="grid2">' + dist + srcs + '</div>' + al;
}

/* ---------- Render: Sustituciones ---------- */
function renderSust(){
  let h = '<table class="t"><tr><th>ID</th><th>Producto original</th><th>Sustituto / equivalente</th><th>Motivo técnico</th><th>Impacto económico</th><th>Estado</th><th></th></tr>';
  S.sust.forEach((s, idx) => {
    h += '<tr><td>' + esc(s.id) + '</td>' +
      '<td><input data-path="sust.' + idx + '.original" value="' + esc(s.original) + '" style="min-width:170px"></td>' +
      '<td><input data-path="sust.' + idx + '.sustituto" value="' + esc(s.sustituto) + '" style="min-width:200px"></td>' +
      '<td><input data-path="sust.' + idx + '.motivo" value="' + esc(s.motivo) + '" style="min-width:230px"></td>' +
      '<td><input data-path="sust.' + idx + '.impacto" value="' + esc(s.impacto) + '" style="min-width:150px"></td>' +
      '<td><select data-path="sust.' + idx + '.estado">' + ['PROPUESTO','APROBADO','RECHAZADO'].map(e => '<option' + (s.estado === e ? ' selected' : '') + '>' + e + '</option>').join('') + '</select></td>' +
      '<td><button class="del" data-act="del-sust" data-id="' + esc(s.id) + '" title="Eliminar">&times;</button></td></tr>';
  });
  $('#sustTable').innerHTML = h + '</table>';
}

/* ---------- Render: Auditoría ---------- */
function renderAudit(){
  let h = '<table class="t"><tr><th>N°</th><th>Área</th><th>Hallazgo</th><th>Estado</th><th>Acción / resolución</th></tr>';
  S.audit.forEach((a, idx) => {
    h += '<tr><td>' + a.n + '</td>' +
      '<td><input data-path="audit.' + idx + '.area" value="' + esc(a.area) + '" style="width:108px"></td>' +
      '<td><input data-path="audit.' + idx + '.hallazgo" value="' + esc(a.hallazgo) + '" style="min-width:250px"></td>' +
      '<td><select data-path="audit.' + idx + '.estado"><option' + (a.estado === 'OK' ? ' selected' : '') + '>OK</option><option' + (a.estado === 'CORREGIDO' ? ' selected' : '') + '>CORREGIDO</option><option' + (a.estado === 'ADVERTENCIA' ? ' selected' : '') + '>ADVERTENCIA</option><option' + (a.estado === 'PENDIENTE' ? ' selected' : '') + '>PENDIENTE</option></select></td>' +
      '<td><input data-path="audit.' + idx + '.accion" value="' + esc(a.accion) + '" style="min-width:270px"></td></tr>';
  });
  $('#audTable').innerHTML = h + '</table>';
}
/* ---------- Bloques dinámicos de responsable (regla: nunca mostrar etiquetas vacías) ---------- */
function respLines(){
  const r = S.meta.responsable || {};
  let h = '';
  if (String(r.nombre || '').trim())   h += '<div>Elaborado por: <b>' + esc(r.nombre) + '</b></div>';
  if (String(r.cargo || '').trim())    h += '<div>' + esc(r.cargo) + '</div>';
  if (String(r.empresa || '').trim())  h += '<div>' + esc(r.empresa) + '</div>';
  if (String(r.telefono || '').trim()) h += '<div>Tel: ' + esc(r.telefono) + '</div>';
  if (String(r.correo || '').trim())   h += '<div>' + esc(r.correo) + '</div>';
  return h ? '<div class="cv-resp">' + h + '</div>' : '';
}
function respBlockDoc(){
  const r = S.meta.responsable || {};
  let h = '';
  if (String(r.nombre || '').trim())  h += '<tr><td>Elaborado por</td><td>' + esc(r.nombre) + '</td></tr>';
  if (String(r.cargo || '').trim())   h += '<tr><td>Cargo / Especialidad</td><td>' + esc(r.cargo) + '</td></tr>';
  if (String(r.empresa || '').trim()) h += '<tr><td>Empresa</td><td>' + esc(r.empresa) + '</td></tr>';
  if (String(r.telefono || '').trim())h += '<tr><td>Teléfono</td><td>' + esc(r.telefono) + '</td></tr>';
  if (String(r.correo || '').trim())  h += '<tr><td>Correo</td><td>' + esc(r.correo) + '</td></tr>';
  return h;
}
function hasResp(){ const r = S.meta.responsable || {}; return !!(String(r.nombre||'').trim() || String(r.cargo||'').trim() || String(r.empresa||'').trim() || String(r.telefono||'').trim() || String(r.correo||'').trim()); }

/* ---------- Render: Vista Cliente ---------- */
function clientHTML(){
  const c = calc(), m = S.meta, k = 1 + num(S.config.markupPct) / 100, t = techCalc();
  let rows = '';
  S.items.filter(i => num(i.qty) > 0 && num(i.cost) > 0).forEach(i => {
    const sale = num(i.cost) * k;
    rows += '<tr><td>' + esc(i.desc) + '</td><td>' + esc(i.qty) + ' ' + esc(i.unit) + '</td><td style="text-align:right">' + money(sale) + '</td><td style="text-align:right">' + money(num(i.qty) * sale) + '</td></tr>';
  });
  S.software.filter(s => num(s.cant) > 0 && num(s.pu) > 0).forEach(s => {
    rows += '<tr><td>Software: ' + esc(s.nombre) + '</td><td>' + esc(s.cant) + ' ' + esc(s.unidad) + '</td><td style="text-align:right">' + money(num(s.pu) * k) + '</td><td style="text-align:right">' + money(num(s.cant) * num(s.pu) * k) + '</td></tr>';
  });
  rows += '<tr><td>Mano de obra: instalación, configuración, pruebas, documentación y capacitación</td><td>1 glob</td><td style="text-align:right">' + money(c.laborTotal * k) + '</td><td style="text-align:right">' + money(c.laborTotal * k) + '</td></tr>';
  if (c.ship > 0) rows += '<tr><td>Transporte y logística</td><td>1</td><td style="text-align:right">' + money(c.ship * k) + '</td><td style="text-align:right">' + money(c.ship * k) + '</td></tr>';
  return '<div class="doc">' +
    '<h1>COTIZACIÓN' + (m.numPresupuesto ? ' Nº ' + esc(m.numPresupuesto) : '') + ' — SISTEMA CCTV</h1>' +
    '<div class="doc-sub">' + esc(m.nombre || '') + (m.obra ? ' · Obra: ' + esc(m.obra) : '') + '<br>' + esc(m.direccion || '') + '<br>Fecha: ' + esc(m.fecha || '') + ' · Vigencia: ' + esc(m.vigencia || '30 días') + ' · Moneda: ' + esc(m.moneda || 'USD') + '</div>' +
    '<h2>Alcance</h2><ul>' +
    '<li>Sistema de videovigilancia IP de <b>' + t.cams + ' puntos</b> (1 domo 4MP + 20 bullet 4MP, H.265+, PoE).</li>' +
    '<li>NVR 32 canales con 2 discos de vigilancia WD Purple de 6 TB (12 TB).</li>' +
    '<li>Gabinete rack 9U, switch PoE, patch panel, 2 monitores 32" 4K, UPS 1500 VA.</li>' +
    '<li>Cableado estructurado Cat6, tubería, aterramiento y protección eléctrica.</li>' +
    '<li>Instalación, configuración, pruebas, capacitación y documentación as-built.</li></ul>' +
    '<h2>Equipos y servicios</h2>' +
    '<table><tr><th>Descripción</th><th>Cant.</th><th>P. Unitario (' + esc(m.moneda || 'USD') + ')</th><th>Total (' + esc(m.moneda || 'USD') + ')</th></tr>' + rows + '</table>' +
    '<table>' +
    '<tr><td>SUBTOTAL DE VENTA</td><td style="text-align:right">' + money(c.sub) + '</td></tr>' +
    '<tr><td>IMPUESTO (' + esc(S.config.taxPct) + '%)</td><td style="text-align:right">' + money(c.imp) + '</td></tr>' +
    '<tr class="grand"><td>TOTAL DE OFERTA (' + esc(m.moneda || 'USD') + ')</td><td style="text-align:right">' + money(c.pf) + '</td></tr></table>' +
    '<h2>Condiciones</h2><ul>' +
    '<li>Forma de pago: 50% anticipo, 50% contra entrega y puesta en servicio.</li>' +
    '<li>Plazo de ejecución estimado: 10 a 15 días hábiles desde el anticipo.</li>' +
    '<li>Precios en ' + esc(m.moneda || 'USD') + '. Oferta válida por ' + esc(m.vigencia || '30 días') + '.</li>' +
    (m.observaciones ? '<li>' + esc(m.observaciones) + '</li>' : '') +
    '<li>La oferta no incluye obra civil mayor ni adecuaciones no descritas en el alcance.</li></ul>' +
    '<h2>Garantía</h2><ul>' +
    '<li>Equipos: 2 años de garantía de fabricante.</li>' +
    '<li>Instalación y configuración: 1 año contra defectos de ejecución.</li></ul>' +
    '<div class="firma"><div>' + (String((m.responsable||{}).nombre||'').trim() ? esc(m.responsable.nombre) + (m.responsable.cargo ? '<br><span style="font-size:10.5px;color:#475569">' + esc(m.responsable.cargo) + '</span>' : '') : '') + '</div><div>Cliente</div></div>' +
    '<div class="conf">Documento comercial — los detalles técnicos, fuentes y costos internos se administran en la versión técnica del presupuesto.</div></div>';
}
function renderCliente(){ $('#clientView').innerHTML = clientHTML(); }

/* ---------- Refresco ligero y render completo ---------- */
function refreshLight(){
  renderDash(); renderStage(); renderCliente();
  VALIDATIONS.forEach(v => refreshValBadges(v.n));
}
function renderAll(){
  renderDash(); renderProyecto(); renderEquip(); renderSoftware(); renderMO();
  renderTransport(); renderEcon(); renderCliente(); renderValid();
  renderFuentes(); renderMercado(); renderSust(); renderAudit(); renderStage();
}

/* ---------- Navegación / Drawer ---------- */
function setSec(id){
  $$('.nav-it').forEach(b => b.classList.toggle('active', b.dataset.sec === id));
  $$('#main > .sec').forEach(s => s.classList.toggle('hidden', s.id !== 'sec-' + id));
  window.scrollTo({top: 0, behavior: 'smooth'});
}
function closeDrawer(){
  $('#sidebar').classList.remove('open');
  $('#overlay').classList.remove('show');
  $('#btnMenu').classList.remove('open');
  $('#btnMenu').setAttribute('aria-expanded', 'false');
}

/* ---------- Altas / bajas ---------- */
function nextId(arr, prefix){ return prefix + String(arr.length + 1).padStart(2, '0'); }
function addRow(){
  S.items.push({id: nextId(S.items, 'EQ-'), cat:'A', code:'', desc:'Nueva partida', qty:1, unit:'pza', cost:0, grade:'D', source:'', url:'', stock:'POR CONFIRMAR', note:''});
  save(true); renderAll(); toast('Partida agregada — complete fuente y grado A/B');
}
function addSw(){
  S.software.push({id: nextId(S.software, 'SW-'), nombre:'Nuevo software', tipo:'Comercial', cant:1, unidad:'lic', pu:0, fuente:'', url:'', obs:''});
  save(true); renderAll(); toast('Software agregado — defina precio o justificación');
}
function addMo(){
  const n = Math.max(0, ...S.labor.map(l => l.n)) + 1;
  S.labor.push({n, cat:'Instalación', op:'Nueva operación', unidad:'h', cant:1, resp:'T', pu:num(S.rates.T)});
  save(true); renderAll(); toast('Operación agregada');
}
function addSust(){
  S.sust.push({id: nextId(S.sust, 'SUS-'), original:'', sustituto:'', motivo:'', impacto:'', estado:'PROPUESTO'});
  save(true); renderAll(); toast('Sustitución agregada');
}
function addTrans(){
  if (!S.transport.enabled){ toast('Active INCLUIR TRANSPORTE primero'); return; }
  S.transport.items.push({concepto:'Transporte local', unidad:'viaje', cant:1, pu:0, obs:''});
  save(true); renderAll();
}

/* ---------- Exportaciones ---------- */
function download(name, content, type){
  const blob = new Blob([content], {type: type || 'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
function exportCSV(){
  const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  const L = [];
  L.push(['TIPO','ID','CAT/CATEGORIA','CODIGO/NOMBRE','DESCRIPCION','CANT','UNIDAD','PRECIO_U','SUBTOTAL','GRADO/FUENTE','URL','NOTA'].map(q).join(';'));
  S.items.forEach(i => L.push(['EQUIPO', i.id, i.cat, i.code, i.desc, i.qty, i.unit, num(i.cost).toFixed(2), (num(i.qty)*num(i.cost)).toFixed(2), i.grade + ' / ' + i.source, i.url, i.note].map(q).join(';')));
  S.software.forEach(s => L.push(['SOFTWARE', s.id, 'E', s.nombre, s.tipo, s.cant, s.unidad, num(s.pu).toFixed(2), (num(s.cant)*num(s.pu)).toFixed(2), s.fuente, s.url || '', s.obs].map(q).join(';')));
  S.labor.forEach(l => L.push(['MO', 'MO-' + l.n, l.cat, '', l.op, l.cant, l.unidad, num(l.pu).toFixed(2), (num(l.cant)*num(l.pu)).toFixed(2), l.resp, '', ''].map(q).join(';')));
  if (S.transport.enabled && S.transport.mode === 'items') S.transport.items.forEach(t => L.push(['TRANSPORTE', '', 'G', '', t.concepto, t.cant, t.unidad, num(t.pu).toFixed(2), (num(t.cant)*num(t.pu)).toFixed(2), '', '', t.obs].map(q).join(';')));
  const c = calc();
  L.push('');
  L.push(['COSTO_DIRECTO', '', '', '', '', '', '', '', c.cd.toFixed(2)].map(q).join(';'));
  L.push(['UTILIDAD_' + S.config.markupPct + '%', '', '', '', '', '', '', '', c.utilidad.toFixed(2)].map(q).join(';'));
  L.push(['SUBTOTAL_DE_VENTA', '', '', '', '', '', '', '', c.sub.toFixed(2)].map(q).join(';'));
  L.push(['IMPUESTO_' + S.config.taxPct + '%', '', '', '', '', '', '', '', c.imp.toFixed(2)].map(q).join(';'));
  L.push(['TOTAL_DE_OFERTA', '', '', '', '', '', '', '', c.pf.toFixed(2)].map(q).join(';'));
  L.push(['COBERTURA_AB', '', '', '', '', '', '', '', c.cov.toFixed(1) + '%'].map(q).join(';'));
  download('PRESUPUESTO_CCTV.csv', '\uFEFF' + L.join('\r\n'), 'text/csv;charset=utf-8');
  toast('CSV exportado');
}
function exportJSON(){ download('PRESUPUESTO_CCTV_datos.json', JSON.stringify(S, null, 2), 'application/json'); toast('Respaldo JSON exportado'); }
function importJSON(inp){
  const f = inp.files && inp.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d.items || !d.labor) throw new Error('formato');
      S = d; save(true); renderAll(); toast('Datos importados');
    } catch(e){ toast('Archivo JSON inválido'); }
  };
  rd.readAsText(f); inp.value = '';
}

/* ---------- Impresión ---------- */
function printDoc(kind){
  $('#printDoc').innerHTML = kind === 'tech' ? techHTML() : clientHTML();
  document.body.classList.add('printing');
  setTimeout(() => window.print(), 60);
}
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));

function techHTML(){
  const c = calc(), m = S.meta, t = techCalc();
  const gradeCls = g => g === 'A' || g === 'B' ? 'b-ok' : g === 'C' ? 'b-warn' : 'b-bad';
  const itemRow = i => '<tr><td>' + esc(i.code) + '</td><td>' + esc(i.desc) + '</td><td>' + esc(i.qty) + ' ' + esc(i.unit) + '</td><td style="text-align:right">' + money(i.cost) + '</td><td style="text-align:right">' + money(num(i.qty)*num(i.cost)) + '</td><td><span class="badge ' + gradeCls(i.grade) + '">' + esc(i.grade) + '</span></td><td>' + esc(i.source) + '</td><td>' + esc(i.stock) + '</td></tr>';
  const eqRows = S.items.filter(i => ['A','B'].includes(i.cat)).map(itemRow).join('');
  const matRows = S.items.filter(i => ['C','D','H'].includes(i.cat)).map(itemRow).join('');
  const swRows = S.software.map(s => '<tr><td>' + esc(s.nombre) + '</td><td>' + esc(s.tipo) + '</td><td>' + esc(s.cant) + ' ' + esc(s.unidad) + '</td><td style="text-align:right">' + money(s.pu) + '</td><td style="text-align:right">' + money(num(s.cant)*num(s.pu)) + '</td><td>' + esc(s.fuente) + '</td><td>' + esc(s.obs) + '</td></tr>').join('');
  let moRows = '';
  MO_CATS.forEach(cat => {
    const ops = S.labor.filter(l => l.cat === cat);
    if (!ops.length) return;
    const sub = ops.reduce((a,l) => a + num(l.cant)*num(l.pu), 0);
    moRows += '<tr class="catrow"><td colspan="5">' + esc(cat) + '</td><td colspan="2" style="text-align:right">' + money(sub) + '</td></tr>';
    ops.forEach(l => { moRows += '<tr><td>' + l.n + '</td><td>' + esc(l.op) + '</td><td>' + esc(l.unidad) + '</td><td>' + num(l.cant) + '</td><td style="text-align:right">' + money(l.pu) + '</td><td style="text-align:right">' + money(num(l.cant)*num(l.pu)) + '</td><td>' + (l.resp === 'T' ? 'Téc.' : l.resp === 'S' ? 'Sup.' : 'Ing.') + '</td></tr>'; });
  });
  const auRows = S.audit.map(a => '<tr><td>' + a.n + '</td><td>' + esc(a.area) + '</td><td>' + esc(a.hallazgo) + '</td><td><b>' + esc(a.estado) + '</b></td><td>' + esc(a.accion) + '</td></tr>').join('');
  const sustRows = S.sust.map(s => '<tr><td>' + esc(s.original) + '</td><td>' + esc(s.sustituto) + '</td><td>' + esc(s.motivo) + '</td><td>' + esc(s.impacto) + '</td><td><b>' + esc(s.estado) + '</b></td></tr>').join('');
  const fuRows = S.items.map(i => '<tr><td>' + esc(i.code) + '</td><td>' + esc(i.desc) + '</td><td><span class="badge ' + gradeCls(i.grade) + '">' + esc(i.grade) + '</span></td><td>' + esc(i.source) + '</td><td>' + esc(i.stock) + '</td><td>' + esc(i.url) + '</td></tr>').join('');
  const valRows = VALIDATIONS.map(v => { const sat = valSatisfied(v.n); return '<tr><td>' + v.n + '</td><td>' + esc(v.desc) + '</td><td><b>' + (sat ? 'CUMPLE' : 'PENDIENTE') + '</b></td></tr>'; }).join('');
  const catSum = k => S.items.filter(i => i.cat === k).reduce((a,i) => a + num(i.qty)*num(i.cost), 0);
  const sm = [['A', catSum('A')],['B', catSum('B')],['C', catSum('C')],['D', catSum('D')],['E', c.swTotal],['F', c.laborTotal],['G', c.ship],['H', catSum('H')],['I', c.utilidad],['J', c.imp]];
  const recs = [];
  if (t.days < 30) recs.push('Retención actual ≈ ' + money(t.days) + ' días: si el cliente exige 30 días, ampliar a 2×10 TB o 4×6 TB WD Purple.');
  if (c.cov < 100) recs.push('Completar fuentes A/B hasta alcanzar 100% de cobertura antes de emitir la orden de compra.');
  if (S.items.some(i => i.stock === 'POR CONFIRMAR' || i.stock === 'AGOTADO')) recs.push('Confirmar disponibilidad de las partidas marcadas POR CONFIRMAR / AGOTADO.');
  recs.push('Verificar las URLs y precios en la fecha de compra; los precios de referencia pueden variar.');
  if (m.observaciones) recs.push(esc(m.observaciones));
  const nOK = S.audit.filter(a => a.estado === 'OK' || a.estado === 'CORREGIDO').length;
  return '<div class="doc">' +
    /* 1. Portada */
    '<div class="cover">' +
      '<div class="cv-kicker">PROYECTO EJECUTIVO</div>' +
      '<div class="cv-big">CORRIENTES DÉBILES</div>' +
      '<div class="cv-sys">Sistema de Circuito Cerrado de Televisión (CCTV)</div>' +
      '<div class="cv-name">' + esc(m.nombre || '') + '</div>' +
      '<div class="cv-meta">' + esc(m.direccion || '') + (m.obra ? '<br>Obra: ' + esc(m.obra) : '') + '<br>Especialidad: ' + esc(m.especialidad || '') + '<br>Nº de presupuesto: ' + (m.numPresupuesto ? esc(m.numPresupuesto) : '—') + ' · ' + esc(m.fecha || '') + ' · Vigencia: ' + esc(m.vigencia || '30 días') + '</div>' +
      respLines() +
      '<div class="cv-meta" style="margin-top:34px">DOCUMENTO TÉCNICO — USO INTERNO</div>' +
    '</div>' +
    '<h1>DOCUMENTO TÉCNICO — PRESUPUESTO CCTV</h1>' +
    '<div class="doc-sub">Versión: 2.0 · Estado: ' + STAGES[S.stage] + ' · Cobertura A/B: ' + c.cov.toFixed(1) + '%</div>' +
    /* 2. Datos del proyecto */
    '<h2>1. Datos del proyecto</h2>' +
    '<table><tr><th>Campo</th><th>Valor</th></tr>' +
    '<tr><td>Proyecto</td><td>' + esc(m.nombre || '') + '</td></tr>' +
    (m.obra ? '<tr><td>Obra</td><td>' + esc(m.obra) + '</td></tr>' : '') +
    '<tr><td>Dirección</td><td>' + esc(m.direccion || '') + '</td></tr>' +
    (m.cliente ? '<tr><td>Cliente</td><td>' + esc(m.cliente) + '</td></tr>' : '') +
    '<tr><td>Especialidad</td><td>' + esc(m.especialidad || '') + '</td></tr>' +
    (m.numPresupuesto ? '<tr><td>Nº de presupuesto</td><td>' + esc(m.numPresupuesto) + '</td></tr>' : '') +
    '<tr><td>Fecha / Vigencia / Moneda</td><td>' + esc(m.fecha || '') + ' · ' + esc(m.vigencia || '') + ' · ' + esc(m.moneda || 'USD') + '</td></tr>' +
    respBlockDoc() + '</table>' +
    /* 3. Resumen ejecutivo */
    '<h2>2. Resumen ejecutivo</h2><ul>' +
    '<li>Sistema CCTV IP de <b>' + t.cams + ' puntos</b> (1 domo + 20 bullet, 4MP H.265+ PoE).</li>' +
    '<li>Grabación en NVR 32 canales con ' + esc(S.tech.hddTB) + ' TB (≈ ' + money(t.days) + ' días de retención).</li>' +
    '<li>Costo directo: USD ' + money(c.cd) + ' · Total de oferta: <b>USD ' + money(c.pf) + '</b>.</li>' +
    '<li>Cobertura de precios A/B: ' + c.cov.toFixed(1) + '% (' + c.nAB + ' de ' + c.nElig + ' partidas).</li></ul>' +
    /* 4-7 */
    '<h2>3. Equipos</h2><table><tr><th>Código</th><th>Descripción</th><th>Cant.</th><th>Costo U.</th><th>Total</th><th>Grado</th><th>Fuente</th><th>Disp.</th></tr>' + eqRows + '</table>' +
    '<h2>4. Materiales</h2><table><tr><th>Código</th><th>Descripción</th><th>Cant.</th><th>Costo U.</th><th>Total</th><th>Grado</th><th>Fuente</th><th>Disp.</th></tr>' + matRows + '</table>' +
    '<h2>5. Software</h2><table><tr><th>Nombre</th><th>Tipo</th><th>Cant.</th><th>P. U.</th><th>Subtotal</th><th>Fuente</th><th>Observaciones</th></tr>' + swRows + '</table>' +
    '<h2>6. Mano de obra</h2><table><tr><th>N°</th><th>Operación</th><th>Unid.</th><th>Cant.</th><th>P. U.</th><th>Subtotal</th><th>Nivel</th></tr>' + moRows + '</table>' +
    /* 8. Transporte */
    '<h2>7. Transporte</h2>' +
    (S.transport.enabled ?
      (S.transport.mode === 'items' ?
        '<table><tr><th>Concepto</th><th>Unid.</th><th>Cant.</th><th>P. U.</th><th>Subtotal</th></tr>' +
        S.transport.items.map(x => '<tr><td>' + esc(x.concepto) + '</td><td>' + esc(x.unidad) + '</td><td>' + num(x.cant) + '</td><td style="text-align:right">' + money(x.pu) + '</td><td style="text-align:right">' + money(num(x.cant)*num(x.pu)) + '</td></tr>').join('') + '</table>'
        : '<p>Modo: ' + esc(S.transport.mode) + ' — importe: USD ' + money(c.ship) + '</p>')
      : '<p>Transporte no incluido en la oferta ($0.00).</p>') +
    /* 9. Resumen económico */
    '<h2>8. Resumen económico (fórmula oficial)</h2>' +
    '<table><tr><th>Cat.</th><th>Concepto</th><th>USD</th></tr>' +
    sm.map(([k, v]) => '<tr><td>' + k + '</td><td>' + esc(CATS[k]) + '</td><td style="text-align:right">' + money(v) + '</td></tr>').join('') +
    '<tr class="catrow"><td colspan="2">COSTO DIRECTO</td><td style="text-align:right">' + money(c.cd) + '</td></tr>' +
    '<tr class="catrow"><td colspan="2">+ UTILIDAD (' + esc(S.config.markupPct) + '%)</td><td style="text-align:right">' + money(c.utilidad) + '</td></tr>' +
    '<tr class="catrow"><td colspan="2">= SUBTOTAL DE VENTA</td><td style="text-align:right">' + money(c.sub) + '</td></tr>' +
    '<tr class="catrow"><td colspan="2">+ IMPUESTO (' + esc(S.config.taxPct) + '%)</td><td style="text-align:right">' + money(c.imp) + '</td></tr>' +
    '<tr class="grand"><td colspan="2">TOTAL DE OFERTA</td><td style="text-align:right">' + money(c.pf) + '</td></tr></table>' +
    /* 10-13 */
    '<h2>9. Validación técnica</h2>' +
    '<table><tr><th>Parámetro</th><th>Valor</th><th>Resultado</th></tr>' +
    '<tr><td>Puertos PoE</td><td>' + t.ports + ' para ' + t.cams + ' cámaras</td><td>' + (t.portsOK ? 'OK' : 'FALTA') + '</td></tr>' +
    '<tr><td>Presupuesto PoE</td><td>' + money(t.poeLoad) + ' W vs ' + money(t.poeBudget) + ' W</td><td>' + (t.poeOK ? 'OK' : 'FALTA') + '</td></tr>' +
    '<tr><td>Ancho de banda</td><td>' + t.bw + ' Mbps vs ' + esc(S.tech.nvrBwMbps) + ' Mbps</td><td>' + (t.bwOK ? 'OK' : 'FALTA') + '</td></tr>' +
    '<tr><td>Almacenamiento</td><td>≈ ' + money(t.days) + ' días (objetivo ' + esc(S.tech.retencionDias) + ')</td><td>' + (t.daysOK ? 'OK' : 'REVISAR') + '</td></tr></table>' +
    '<table><tr><th>N°</th><th>Validación</th><th>Estado</th></tr>' + valRows + '</table>' +
    '<h2>10. Fuentes de precios</h2>' +
    '<p style="font-size:11px">Cobertura A/B: ' + c.cov.toFixed(1) + '%. Grados: A = tienda/marca directa · B = distribuidor reconocido · C/D = no admisible.</p>' +
    '<table><tr><th>Código</th><th>Descripción</th><th>Grado</th><th>Fuente</th><th>Disp.</th><th>URL</th></tr>' + fuRows + '</table>' +
    '<h2>11. Análisis de mercado</h2>' +
    '<table><tr><th>Grado</th><th>Partidas</th><th>%</th></tr>' +
    ['A','B','C','D'].map(g => { const n = S.items.filter(i => i.grade === g).length; return '<tr><td>' + g + '</td><td>' + n + '</td><td>' + (n / (S.items.length || 1) * 100).toFixed(0) + '%</td></tr>'; }).join('') +
    '<tr><td colspan="3">Costo de equipos por cámara: USD ' + money(t.cams ? c.equipTotal / t.cams : 0) + ' · Costo total por cámara: USD ' + money(t.cams ? c.cd / t.cams : 0) + '</td></tr></table>' +
    '<h2>12. Sustituciones y equivalencias</h2>' +
    (S.sust.length ? '<table><tr><th>Original</th><th>Sustituto</th><th>Motivo</th><th>Impacto</th><th>Estado</th></tr>' + sustRows + '</table>' : '<p>No hay sustituciones registradas.</p>') +
    /* 14-15 */
    '<h2>13. Recomendaciones</h2><ul>' + recs.map(r => '<li>' + r + '</li>').join('') + '</ul>' +
    '<h2>14. Control de calidad</h2>' +
    '<table><tr><th>Control</th><th>Resultado</th></tr>' +
    '<tr><td>Fórmula económica verificada (CD → U → Subtotal → Impuesto → Total)</td><td>PASS</td></tr>' +
    '<tr><td>Aritmética de totales</td><td>' + (valState(14) ? 'PASS' : 'REVISAR') + '</td></tr>' +
    '<tr><td>Cobertura A/B</td><td>' + c.cov.toFixed(1) + '% (' + (c.cov >= 100 ? 'PASS' : 'PENDIENTE') + ')</td></tr>' +
    '<tr><td>Auditoría interna</td><td>' + nOK + ' de ' + S.audit.length + ' hallazgos en OK/CORREGIDO</td></tr>' +
    '<tr><td>Validaciones aprobadas</td><td>' + (16 - failedVals().length) + ' de 16</td></tr></table>' +
    '<div class="firma"><div>' + (String((m.responsable||{}).nombre||'').trim() ? esc(m.responsable.nombre) : '') + '</div><div>Revisión</div></div>' +
    '<div class="conf">Documento técnico de uso interno — contiene fuentes de precio, grados y estructura de costos. NO entregar al cliente.</div></div>';
}
/* ---------- Eventos ---------- */
document.addEventListener('input', e => {
  const el = e.target, path = el.dataset.path;
  if (!path) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.type === 'number' || el.dataset.num === '1') v = num(v);
  setPath(path, v);
  save(true); refreshLight();
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.path && (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date')) {
    let v = el.type === 'checkbox' ? el.checked : el.value;
    setPath(el.dataset.path, v);
    save(true); renderAll();
  }
  if (el.dataset.ov != null) {
    const n = +el.dataset.ov;
    if (el.checked) S.overrides[n] = true; else delete S.overrides[n];
    save(true); refreshValBadges(n); renderValid();
  }
  if (el.id === 'importFile') importJSON(el);
});
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'csv') exportCSV();
  else if (act === 'json') exportJSON();
  else if (act === 'import') $('#importFile').click();
  else if (act === 'print-tech') printDoc('tech');
  else if (act === 'print-client') printDoc('client');
  else if (act === 'preview-tech') { $('#pdfTechPreview').innerHTML = techHTML(); toast('Vista previa generada'); }
  else if (act === 'preview-client') { $('#pdfCliPreview').innerHTML = clientHTML(); toast('Vista previa generada'); }
  else if (act === 'add-row') addRow();
  else if (act === 'del-row') { if (confirm('¿Eliminar la partida ' + b.dataset.id + '?')) { S.items = S.items.filter(i => i.id !== b.dataset.id); save(true); renderAll(); } }
  else if (act === 'add-sw') addSw();
  else if (act === 'del-sw') { if (confirm('¿Eliminar este software?')) { S.software = S.software.filter(s => s.id !== b.dataset.id); save(true); renderAll(); } }
  else if (act === 'add-mo') addMo();
  else if (act === 'del-mo') { if (confirm('¿Eliminar esta operación?')) { S.labor = S.labor.filter(l => l.n !== +b.dataset.n); save(true); renderAll(); } }
  else if (act === 'add-trans') addTrans();
  else if (act === 'del-trans') { S.transport.items.splice(+b.dataset.i, 1); save(true); renderAll(); }
  else if (act === 'add-sust') addSust();
  else if (act === 'del-sust') { if (confirm('¿Eliminar este registro de sustitución?')) { S.sust = S.sust.filter(s => s.id !== b.dataset.id); save(true); renderAll(); } }
  else if (act === 'advance') advance();
  else if (act === 'back') back();
  else if (act === 'reset') { if (confirm('¿Restablecer todos los datos a la versión semilla? Se perderán sus ediciones.')) { localStorage.removeItem(LS_KEY); load(); renderAll(); toast('Datos restablecidos'); } }
  else if (act === 'preset-tax') { S.config.taxPct = num(b.dataset.v); save(true); renderAll(); }
  else if (act === 'change-pw') {
    const cur = $('#pwCur').value, n1 = $('#pwNew').value, n2 = $('#pwNew2').value;
    if (n1 !== n2) { toast('Las contraseñas nuevas no coinciden'); return; }
    if (!Auth.changePassword(cur, n1)) { toast('No se pudo cambiar: verifique la contraseña actual (mínimo 4 caracteres)'); return; }
    $('#pwCur').value = $('#pwNew').value = $('#pwNew2').value = '';
    toast('Contraseña actualizada correctamente');
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

/* ---------- Sesión + arranque ---------- */
function enterApp(){
  document.body.classList.remove('locked');
  $('#loginScreen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  load(); renderAll(); setSec('dash');
}
window.__enterApp = enterApp;

(function init(){
  /* Tema: aplicar en topbar */
  const tt = document.getElementById('themeToggle');
  if (tt) tt.addEventListener('click', toggleTheme);
  /* Drawer */
  const menu = document.getElementById('btnMenu');
  if (menu) menu.addEventListener('click', () => {
    const open = $('#sidebar').classList.toggle('open');
    $('#overlay').classList.toggle('show', open);
    menu.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
  });
  const ov = document.getElementById('overlay');
  if (ov) ov.addEventListener('click', closeDrawer);
  /* Nav (delegado: el sidebar es estático) */
  document.getElementById('nav').addEventListener('click', e => {
    const b = e.target.closest('.nav-it'); if (!b) return;
    setSec(b.dataset.sec); closeDrawer();
  });
  /* Logout */
  ['btnLogout', 'btnLogout2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => {
      Auth.logout();
      document.body.classList.add('locked');
      $('#app').classList.add('hidden');
      $('#loginScreen').classList.remove('hidden');
      const pw = document.getElementById('loginPw'); if (pw) pw.focus();
    });
  });
  /* Ruta protegida: si no hay sesión → login */
  if (Auth.valid()) enterApp();
  else { document.getElementById('loginScreen').classList.remove('hidden'); const pw = document.getElementById('loginPw'); if (pw) pw.focus(); }
})();

