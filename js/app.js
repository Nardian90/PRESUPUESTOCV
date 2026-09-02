/* =========================================================
   PRESUPUESTO CCTV PRO — app.js
   Aplicación 100% local · localStorage · sin dependencias
   ========================================================= */
'use strict';

const LS_KEY = 'PCTV_PRO_V1';
const STAGES = ['BORRADOR', 'REVISIÓN TÉCNICA', 'REVISIÓN COMERCIAL', 'LISTO PARA CLIENTE'];

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const money = n => (Number.isFinite(+n) ? +n : 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

let S = null;

/* ---------- Estado ---------- */
function seedState(){
  return JSON.parse(JSON.stringify({
    meta: PROJECT_META, config: CONFIG, rates: RATES, tech: TECH,
    items: EQUIPMENT, labor: LABOR, audit: AUDIT,
    overrides: {}, vnotes: {}, stage: 0, v: 1
  }));
}
function load(){
  try { const raw = localStorage.getItem(LS_KEY); if (raw) { S = JSON.parse(raw); return; } } catch(e){}
  S = seedState(); save(true);
}
function save(silent){
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch(e){}
  if (!silent) toast('Guardado en este navegador');
}
let toastTimer = null;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function setPath(path, v){
  const ps = path.split('.'); let o = S;
  for (let i = 0; i < ps.length - 1; i++) o = o[ps[i]];
  o[ps[ps.length - 1]] = v;
}
function getPath(path){
  const ps = path.split('.'); let o = S;
  for (let i = 0; i < ps.length - 1; i++) o = o[ps[i]];
  return o[ps[ps.length - 1]];
}

/* ---------- Cálculos económicos ---------- */
function calc(){
  const equipTotal = S.items.reduce((a,i) => a + num(i.qty) * num(i.cost), 0);
  const laborTotal = S.labor.reduce((a,l) => a + num(l.hrs) * num(S.rates[l.resp]), 0);
  const sh = S.config.shipping; let ship = 0;
  if (sh.enabled){
    if (sh.mode === 'fijo')   ship = num(sh.fijo);
    else if (sh.mode === 'pct')    ship = (equipTotal + laborTotal) * num(sh.pct) / 100;
    else if (sh.mode === 'viaje')  ship = num(sh.viajes) * num(sh.costoViaje);
    else if (sh.mode === 'km')     ship = num(sh.km) * num(sh.costoKm);
    else if (sh.mode === 'manual') ship = num(sh.manual);
  }
  const cd = equipTotal + laborTotal + ship;
  const m = num(S.config.markupPct);
  const utilidad = S.config.markupMode === 'costo' ? cd * m / 100 : cd * m / (100 - m);
  const sub = cd + utilidad;
  const imp = sub * num(S.config.taxPct) / 100;
  const pf  = sub + imp;
  const elig = S.items.filter(i => ['A','B','C','D'].includes(i.grade));
  const ab = elig.filter(i => i.grade === 'A' || i.grade === 'B');
  const cov = elig.length ? ab.length / elig.length * 100 : 0;
  return {equipTotal, laborTotal, ship, cd, utilidad, sub, imp, pf, cov, nElig: elig.length, nAB: ab.length};
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

/* ---------- Validaciones ---------- */
function valState(n){
  const c = calc(), t = techCalc();
  switch(n){
    case 1:  return c.cov >= 99.999;
    case 2:  return !S.items.some(i => num(i.cost) === 0 && !/gratuit/i.test((i.note||'') + (i.stock||'')));
    case 3:  return !S.items.some(i => ['C','D'].includes(i.grade));
    case 4:  return t.cams > 0 && t.cams <= num(S.tech.nvrCanal);
    case 5:  return t.poeOK && t.portsOK;
    case 6:  return t.bwOK;
    case 7:  return t.daysOK;
    case 8:  { const h = S.items.find(i => i.code === 'HDD-01'); return !!h && num(h.qty) >= 2 && num(h.cost) > 0; }
    case 9:  return S.items.every(i => !!String(i.url || '').trim());
    case 10: return S.items.every(i => i.stock === 'EN STOCK' || i.stock === 'GRATUITO');
    case 11: return !S.items.some(i => /ebay|ebee|aliexpress|wish|temu|mercado libre/i.test(i.source || ''));
    case 12: return S.items.some(i => i.cat === 'E' && /gratuit|justific/i.test((i.note||'') + (i.desc||'')));
    case 13: return S.labor.length >= 29 && Object.values(S.rates).every(r => num(r) > 0);
    case 14: return calc().pf > 0 && Math.abs((calc().cd + calc().utilidad + calc().imp) - calc().pf) < 0.01;
    case 15: return S.config.taxPct !== '' && num(S.config.taxPct) >= 0;
    case 16: return !!(S.meta.cliente && S.meta.ubicacion && S.meta.elaboradoPor && S.meta.nombre);
  }
  return false;
}
function valSatisfied(n){ return valState(n) || !!S.overrides[n]; }
function failedVals(){
  const f = [];
  VALIDATIONS.forEach(v => { if (!valSatisfied(v.n)) f.push(v.n); });
  return f;
}
function covClass(p){ return p >= 99.999 ? 'ok' : (p >= 90 ? 'warn' : 'bad'); }

/* ---------- Render: KPIs ---------- */
function renderKPIs(){
  const c = calc(), cls = covClass(c.cov);
  $('#kpiCov').textContent = c.cov.toFixed(1) + '%';
  $('#kpiCov').style.color = cls === 'ok' ? 'var(--ok)' : cls === 'warn' ? 'var(--warn)' : 'var(--bad)';
  $('#kpiCovS').textContent = c.nAB + ' de ' + c.nElig + ' partidas con precio A/B';
  $('#kpiCD').textContent = 'USD ' + money(c.cd);
  $('#kpiU').textContent  = 'USD ' + money(c.utilidad);
  $('#kpiI').textContent  = 'USD ' + money(c.imp);
  $('#kpiPF').textContent = 'USD ' + money(c.pf);
  const bar = $('#covBar');
  bar.style.width = Math.min(100, c.cov) + '%';
  bar.parentElement.className = 'covbar cov-' + cls;
  $('#covTxt').textContent = c.cov >= 99.999 ? '100% — HABILITADO PARA ENTREGA' :
    c.cov >= 90 ? 'Cobertura parcial — Complete las fuentes A/B antes de entregar' :
    'COBERTURA INSUFICIENTE — Entrega bloqueada';
}

/* ---------- Render: Resumen A–J ---------- */
function renderSummary(){
  const c = calc();
  const catSum = k => S.items.filter(i => i.cat === k).reduce((a,i) => a + num(i.qty) * num(i.cost), 0);
  const rows = [
    ['A', catSum('A')], ['B', catSum('B')], ['C', catSum('C')], ['D', catSum('D')],
    ['E', catSum('E')], ['F', c.laborTotal], ['G', c.ship], ['H', catSum('H')],
    ['I', c.utilidad], ['J', c.imp]
  ];
  let html = '<table class="t"><tr><th>Cat.</th><th>Concepto</th><th class="tot">USD</th></tr>';
  rows.forEach(([k, v]) => {
    html += '<tr><td><b>' + k + '</b></td><td>' + esc(CATS[k]) + '</td><td class="tot">' + money(v) + '</td></tr>';
  });
  html += '<tr class="grand"><td colspan="2">PRECIO FINAL</td><td class="tot">' + money(c.pf) + '</td></tr></table>';
  $('#summaryTable').innerHTML = html;
}

/* ---------- Render: Dashboard ---------- */
function shippingFields(sh){
  let h = '';
  if (sh.mode === 'fijo')   h += '<label>Precio fijo (USD): <input type="number" step="0.01" data-path="config.shipping.fijo" data-num="1" value="' + esc(sh.fijo) + '"></label>';
  if (sh.mode === 'pct')    h += '<label>Porcentaje (%): <input type="number" step="0.1" data-path="config.shipping.pct" data-num="1" value="' + esc(sh.pct) + '"></label>';
  if (sh.mode === 'viaje')  h += '<label>No. de viajes: <input type="number" step="1" data-path="config.shipping.viajes" data-num="1" value="' + esc(sh.viajes) + '"></label><label>Costo por viaje (USD): <input type="number" step="0.01" data-path="config.shipping.costoViaje" data-num="1" value="' + esc(sh.costoViaje) + '"></label>';
  if (sh.mode === 'km')     h += '<label>Kilómetros: <input type="number" step="0.1" data-path="config.shipping.km" data-num="1" value="' + esc(sh.km) + '"></label><label>Costo por km (USD): <input type="number" step="0.01" data-path="config.shipping.costoKm" data-num="1" value="' + esc(sh.costoKm) + '"></label>';
  if (sh.mode === 'manual') h += '<label>Monto manual (USD): <input type="number" step="0.01" data-path="config.shipping.manual" data-num="1" value="' + esc(sh.manual) + '"></label>';
  return h;
}

function renderDash(){
  const c = S.config, t = S.tech, sh = c.shipping, m = S.meta;
  $('#dashPanels').innerHTML =
  '<div class="card"><h3>Configuración económica</h3>' +
    '<label>Impuesto (%): <div style="display:flex;gap:8px;align-items:center"><input type="number" step="0.5" min="0" data-path="config.taxPct" data-num="1" value="' + esc(c.taxPct) + '">' +
    '<span class="presets"><button class="btn mini" data-act="preset-tax" data-v="0">0</button><button class="btn mini" data-act="preset-tax" data-v="5">5</button><button class="btn mini" data-act="preset-tax" data-v="11">11</button><button class="btn mini" data-act="preset-tax" data-v="15">15</button></span></div></label>' +
    '<label>Base de utilidad: <select data-path="config.markupMode"><option value="costo"' + (c.markupMode === 'costo' ? ' selected' : '') + '>MARKUP SOBRE COSTO (oficial)</option><option value="precio"' + (c.markupMode === 'precio' ? ' selected' : '') + '>MARGEN SOBRE PRECIO DE VENTA</option></select></label>' +
    '<label>Utilidad (%): <input type="number" step="0.5" min="0" data-path="config.markupPct" data-num="1" value="' + esc(c.markupPct) + '"></label>' +
    '<h4>Transporte</h4>' +
    '<label class="chk"><input type="checkbox" data-path="config.shipping.enabled"' + (sh.enabled ? ' checked' : '') + '> Habilitar transporte (desactivado por defecto)</label>' +
    '<label>Modo: <select data-path="config.shipping.mode">' +
      '<option value="fijo"' + (sh.mode === 'fijo' ? ' selected' : '') + '>Precio fijo</option>' +
      '<option value="pct"' + (sh.mode === 'pct' ? ' selected' : '') + '>Porcentaje del costo directo</option>' +
      '<option value="viaje"' + (sh.mode === 'viaje' ? ' selected' : '') + '>Por viaje</option>' +
      '<option value="km"' + (sh.mode === 'km' ? ' selected' : '') + '>Por kilómetro</option>' +
      '<option value="manual"' + (sh.mode === 'manual' ? ' selected' : '') + '>Manual</option></select></label>' + shippingFields(sh) +
  '</div>' +
  '<div class="card"><h3>Datos del proyecto</h3>' +
    '<label>Nombre: <input data-path="meta.nombre" value="' + esc(m.nombre) + '"></label>' +
    '<label>Ubicación: <input data-path="meta.ubicacion" value="' + esc(m.ubicacion) + '"></label>' +
    '<label>Cliente: <input data-path="meta.cliente" value="' + esc(m.cliente) + '" placeholder="Nombre del cliente"></label>' +
    '<label>Elaborado por: <input data-path="meta.elaboradoPor" value="' + esc(m.elaboradoPor) + '"></label>' +
    '<label>Fecha: <input type="date" data-path="meta.fecha" value="' + esc(m.fecha) + '"></label>' +
    '<label>Versión: <input data-path="meta.version" value="' + esc(m.version) + '"></label>' +
  '</div>' +
  '<div class="card"><h3>Parámetros técnicos</h3>' +
    '<label>Bitrate por cámara (Mbps): <input type="number" step="0.5" data-path="tech.bitrateMbps" data-num="1" value="' + esc(t.bitrateMbps) + '"></label>' +
    '<label>Consumo por cámara (W): <input type="number" step="0.1" data-path="tech.camWatts" data-num="1" value="' + esc(t.camWatts) + '"></label>' +
    '<label>NVR: canales / puertos PoE / presupuesto W: <div style="display:flex;gap:6px"><input type="number" data-path="tech.nvrCanal" data-num="1" value="' + esc(t.nvrCanal) + '"><input type="number" data-path="tech.nvrPoePorts" data-num="1" value="' + esc(t.nvrPoePorts) + '"><input type="number" data-path="tech.nvrPoeBudget" data-num="1" value="' + esc(t.nvrPoeBudget) + '"></div></label>' +
    '<label>Switch PoE: puertos / presupuesto W: <div style="display:flex;gap:6px"><input type="number" data-path="tech.swPoePorts" data-num="1" value="' + esc(t.swPoePorts) + '"><input type="number" data-path="tech.swPoeBudget" data-num="1" value="' + esc(t.swPoeBudget) + '"></div></label>' +
    '<label>NVR ancho de banda entrante (Mbps): <input type="number" data-path="tech.nvrBwMbps" data-num="1" value="' + esc(t.nvrBwMbps) + '"></label>' +
    '<label>Almacenamiento total (TB) / retención objetivo (días): <div style="display:flex;gap:6px"><input type="number" step="0.5" data-path="tech.hddTB" data-num="1" value="' + esc(t.hddTB) + '"><input type="number" data-path="tech.retencionDias" data-num="1" value="' + esc(t.retencionDias) + '"></div></label>' +
  '</div>';

  const tc = techCalc();
  const row = (lbl, val, ok) => '<tr><td>' + lbl + '</td><td>' + val + '</td><td><span class="badge ' + (ok ? 'b-ok">OK' : 'b-bad">FALTA') + '</span></td></tr>';
  $('#techPanel').innerHTML = '<h3>Análisis técnico automático</h3><table class="t">' +
    row('Cámaras detectadas', tc.cams + ' (1 domo + 20 bullet)', tc.cams === 21) +
    row('Puertos PoE', tc.ports + ' puertos para ' + tc.cams + ' cámaras', tc.portsOK) +
    row('Presupuesto PoE', money(tc.poeLoad) + ' W de carga (mín. ' + money(tc.poeLoad * 1.2) + ' W) vs ' + money(tc.poeBudget) + ' W disponibles', tc.poeOK) +
    row('Ancho de banda', tc.bw + ' Mbps vs ' + esc(S.tech.nvrBwMbps) + ' Mbps del NVR', tc.bwOK) +
    row('Almacenamiento', money(tc.days) + ' días de retención (objetivo: ' + esc(S.tech.retencionDias) + ' días, 12 TB @ ' + esc(S.tech.bitrateMbps) + ' Mbps)', tc.daysOK) +
    '</table><p class="muted">Si se exigen 30 días de retención: ampliar a 2×10 TB o 4×6 TB WD Purple.</p>';

  const v = calc();
  $('#formulaPanel').innerHTML = '<h3>Fórmula oficial (en vivo)</h3>' +
    '<table class="t"><tr><th>Concepto</th><th class="tot">USD</th></tr>' +
    '<tr><td>COSTO DIRECTO (equipos + mano de obra' + (v.ship > 0 ? ' + transporte' : '') + ')</td><td class="tot">' + money(v.cd) + '</td></tr>' +
    '<tr><td>+ UTILIDAD (' + esc(S.config.markupPct) + '% ' + (S.config.markupMode === 'costo' ? 'sobre costo' : 'sobre precio') + ')</td><td class="tot">' + money(v.utilidad) + '</td></tr>' +
    '<tr class="catrow"><td>= SUBTOTAL</td><td class="tot">' + money(v.sub) + '</td></tr>' +
    '<tr><td>+ IMPUESTO (' + esc(S.config.taxPct) + '%)</td><td class="tot">' + money(v.imp) + '</td></tr>' +
    '<tr class="grand"><td>= PRECIO FINAL</td><td class="tot">' + money(v.pf) + '</td></tr></table>';
}

/* ---------- Render: Equipos ---------- */
function renderEquip(){
  let h = '<table class="t"><tr><th>ID</th><th>Cat.</th><th>Código</th><th>Descripción</th><th>Cant.</th><th>Unid.</th><th>Costo U.</th><th class="tot">Total</th><th>Grado</th><th>Fuente</th><th>Disponib.</th><th>URL</th><th>Nota</th><th></th></tr>';
  S.items.forEach((it, idx) => {
    h += '<tr><td>' + esc(it.id) + '</td>' +
      '<td><select data-path="items.' + idx + '.cat">' + Object.keys(CATS).slice(0, 8).map(k => '<option value="' + k + '"' + (it.cat === k ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></td>' +
      '<td><input data-path="items.' + idx + '.code" value="' + esc(it.code) + '" style="width:90px"></td>' +
      '<td><input data-path="items.' + idx + '.desc" value="' + esc(it.desc) + '" style="min-width:260px"></td>' +
      '<td><input type="number" step="1" min="0" data-path="items.' + idx + '.qty" data-num="1" value="' + esc(it.qty) + '"></td>' +
      '<td><input data-path="items.' + idx + '.unit" value="' + esc(it.unit) + '" style="width:55px"></td>' +
      '<td><input type="number" step="0.01" min="0" data-path="items.' + idx + '.cost" data-num="1" value="' + esc(it.cost) + '"></td>' +
      '<td class="tot">' + money(num(it.qty) * num(it.cost)) + '</td>' +
      '<td><select data-path="items.' + idx + '.grade">' + ['A','B','C','D'].map(g => '<option value="' + g + '"' + (it.grade === g ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></td>' +
      '<td><input data-path="items.' + idx + '.source" value="' + esc(it.source) + '" style="min-width:110px"></td>' +
      '<td><select data-path="items.' + idx + '.stock">' + ['EN STOCK','POR CONFIRMAR','GRATUITO','AGOTADO'].map(s => '<option' + (it.stock === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></td>' +
      '<td><input data-path="items.' + idx + '.url" value="' + esc(it.url) + '" style="min-width:180px"></td>' +
      '<td><input data-path="items.' + idx + '.note" value="' + esc(it.note) + '" style="min-width:140px"></td>' +
      '<td><button class="del" data-act="del-row" data-id="' + esc(it.id) + '" title="Eliminar">&times;</button></td></tr>';
  });
  h += '</table>';
  $('#eqTable').innerHTML = h;
}

/* ---------- Render: Mano de obra ---------- */
function renderLabor(){
  const r = S.rates;
  $('#ratesPanel').innerHTML = '<h3>Tarifas por nivel (USD/hora — editables)</h3><div class="grid3">' +
    '<label>Técnico: <input type="number" step="0.5" data-path="rates.T" data-num="1" value="' + esc(r.T) + '"></label>' +
    '<label>Supervisor: <input type="number" step="0.5" data-path="rates.S" data-num="1" value="' + esc(r.S) + '"></label>' +
    '<label>Ingeniero: <input type="number" step="0.5" data-path="rates.I" data-num="1" value="' + esc(r.I) + '"></label></div>';
  let h = '<table class="t"><tr><th>Nº</th><th>Operación</th><th>Resp.</th><th>Horas</th><th>Tarifa</th><th class="tot">Total</th></tr>';
  let tT = 0, tS = 0, tI = 0;
  S.labor.forEach((l, idx) => {
    const rate = num(S.rates[l.resp]), tot = num(l.hrs) * rate;
    if (l.resp === 'T') tT += tot; else if (l.resp === 'S') tS += tot; else tI += tot;
    h += '<tr><td>' + l.n + '</td>' +
      '<td><input data-path="labor.' + idx + '.op" value="' + esc(l.op) + '" style="min-width:320px"></td>' +
      '<td><select data-path="labor.' + idx + '.resp"><option value="T"' + (l.resp === 'T' ? ' selected' : '') + '>Técnico</option><option value="S"' + (l.resp === 'S' ? ' selected' : '') + '>Supervisor</option><option value="I"' + (l.resp === 'I' ? ' selected' : '') + '>Ingeniero</option></select></td>' +
      '<td><input type="number" step="0.5" min="0" data-path="labor.' + idx + '.hrs" data-num="1" value="' + esc(l.hrs) + '"></td>' +
      '<td class="num">' + money(rate) + '</td><td class="tot">' + money(tot) + '</td></tr>';
  });
  h += '<tr class="catrow"><td colspan="5">Subtotal Técnico</td><td class="tot">' + money(tT) + '</td></tr>';
  h += '<tr class="catrow"><td colspan="5">Subtotal Supervisor</td><td class="tot">' + money(tS) + '</td></tr>';
  h += '<tr class="catrow"><td colspan="5">Subtotal Ingeniero</td><td class="tot">' + money(tI) + '</td></tr>';
  h += '<tr class="grand"><td colspan="5">TOTAL MANO DE OBRA (' + S.labor.length + ' operaciones)</td><td class="tot">' + money(tT + tS + tI) + '</td></tr></table>';
  $('#moTable').innerHTML = h;
}
/* ---------- Render: Auditoría ---------- */
function renderAudit(){
  let h = '<table class="t"><tr><th>Nº</th><th>Área</th><th>Hallazgo</th><th>Estado</th><th>Acción / resolución</th></tr>';
  S.audit.forEach((a, idx) => {
    const cls = a.estado === 'OK' || a.estado === 'CORREGIDO' ? 'b-ok' : a.estado === 'ADVERTENCIA' ? 'b-warn' : 'b-na';
    h += '<tr><td>' + a.n + '</td>' +
      '<td><input data-path="audit.' + idx + '.area" value="' + esc(a.area) + '" style="width:110px"></td>' +
      '<td><input data-path="audit.' + idx + '.hallazgo" value="' + esc(a.hallazgo) + '" style="min-width:260px"></td>' +
      '<td><select data-path="audit.' + idx + '.estado"><option' + (a.estado === 'OK' ? ' selected' : '') + '>OK</option><option' + (a.estado === 'CORREGIDO' ? ' selected' : '') + '>CORREGIDO</option><option' + (a.estado === 'ADVERTENCIA' ? ' selected' : '') + '>ADVERTENCIA</option><option' + (a.estado === 'PENDIENTE' ? ' selected' : '') + '>PENDIENTE</option></select></td>' +
      '<td><input data-path="audit.' + idx + '.accion" value="' + esc(a.accion) + '" style="min-width:280px"></td></tr>';
  });
  h += '</table>';
  $('#audTable').innerHTML = h;
}

/* ---------- Render: Validaciones ---------- */
function renderVals(){
  let h = '<table class="t"><tr><th>Nº</th><th>Validación</th><th>Auto</th><th>Excepción aprobada</th><th>Nota de excepción</th><th>Estado</th></tr>';
  VALIDATIONS.forEach(v => {
    h += '<tr><td>' + v.n + '</td><td>' + esc(v.desc) + '</td>' +
      '<td id="va-' + v.n + '"></td>' +
      '<td><input type="checkbox" data-ov="' + v.n + '"' + (S.overrides[v.n] ? ' checked' : '') + '></td>' +
      '<td><input data-path="vnotes.' + v.n + '" value="' + esc(S.vnotes[v.n] || '') + '" placeholder="Justificación si es excepción"></td>' +
      '<td id="vs-' + v.n + '"></td></tr>';
  });
  h += '</table>';
  $('#valTable').innerHTML = h;
  VALIDATIONS.forEach(v => refreshValBadges(v.n));
}
function refreshValBadges(n){
  const auto = valState(n), sat = valSatisfied(n);
  const va = $('#va-' + n), vs = $('#vs-' + n);
  if (!va || !vs) return;
  va.innerHTML = '<span class="badge ' + (auto ? 'b-ok">CUMPLE' : 'b-warn">NO CUMPLE') + '</span>';
  vs.innerHTML = '<span class="badge ' + (sat ? (auto ? 'b-ok' : 'b-warn') : 'b-bad') + '">' + (sat ? (auto ? 'APROBADA' : 'EXCEPCIÓN') : 'PENDIENTE') + '</span>';
}

/* ---------- Render: Vista cliente (sin URLs / costos / márgenes) ---------- */
function clientHTML(){
  const c = calc(), m = S.meta, k = 1 + num(S.config.markupPct) / 100;
  let rows = '';
  S.items.filter(i => num(i.qty) > 0 && num(i.cost) > 0).forEach(i => {
    const sale = num(i.cost) * k, tot = num(i.qty) * sale;
    rows += '<tr><td>' + esc(i.desc) + '</td><td>' + esc(i.qty) + ' ' + esc(i.unit) + '</td><td style="text-align:right">' + money(sale) + '</td><td style="text-align:right">' + money(tot) + '</td></tr>';
  });
  rows += '<tr><td>Mano de obra: instalación, configuración, pruebas, documentación y capacitación (29 operaciones)</td><td>1 glob</td><td style="text-align:right">' + money(c.laborTotal * k) + '</td><td style="text-align:right">' + money(c.laborTotal * k) + '</td></tr>';
  if (c.ship > 0) rows += '<tr><td>Transporte y logística</td><td>1</td><td style="text-align:right">' + money(c.ship * k) + '</td><td style="text-align:right">' + money(c.ship * k) + '</td></tr>';
  return '<div class="doc">' +
    '<h1>COTIZACIÓN — SISTEMA CCTV</h1>' +
    '<div class="doc-sub">' + esc(m.nombre) + ' · ' + esc(m.ubicacion) + '<br>Fecha: ' + esc(m.fecha) + ' · Versión: ' + esc(m.version) + ' · Válida: 30 días</div>' +
    '<h2>Alcance</h2><ul>' +
    '<li>Sistema de videovigilancia IP de <b>21 puntos</b> (1 domo 4MP + 20 bullet 4MP, H.265+, PoE).</li>' +
    '<li>NVR 32 canales con 2 discos de vigilancia WD Purple de 6 TB (12 TB).</li>' +
    '<li>Gabinete rack 9U, switch PoE, patch panel, 2 monitores 32" 4K, UPS 1500 VA.</li>' +
    '<li>Cableado estructurado Cat6, tubería, aterramiento y protección eléctrica.</li>' +
    '<li>Instalación, configuración, pruebas, capacitación y documentación as-built.</li></ul>' +
    '<h2>Equipos y servicios</h2>' +
    '<table><tr><th>Descripción</th><th>Cant.</th><th>P. Unitario (USD)</th><th>Total (USD)</th></tr>' + rows + '</table>' +
    '<table>' +
    '<tr><td>SUBTOTAL</td><td style="text-align:right">' + money(c.sub) + '</td></tr>' +
    '<tr><td>IMPUESTO (' + esc(S.config.taxPct) + '%)</td><td style="text-align:right">' + money(c.imp) + '</td></tr>' +
    '<tr class="grand"><td>TOTAL GENERAL (USD)</td><td style="text-align:right">' + money(c.pf) + '</td></tr></table>' +
    '<h2>Condiciones</h2><ul>' +
    '<li>Forma de pago: 50% anticipo, 50% contra entrega y puesta en servicio.</li>' +
    '<li>Plazo de ejecución estimado: 10 a 15 días hábiles desde el anticipo.</li>' +
    '<li>Precios en dólares estadounidenses (USD).</li>' +
    '<li>La oferta no incluye obra civil mayor ni adecuaciones no descritas en el alcance.</li></ul>' +
    '<h2>Garantía</h2><ul>' +
    '<li>Equipos: 2 años de garantía de fabricante.</li>' +
    '<li>Instalación y configuración: 1 año contra defectos de ejecución.</li>' +
    '<li>Soporte post-venta y capacitación incluidos.</li></ul>' +
    '<div class="firma"><div>' + esc(m.elaboradoPor) + '</div><div>Cliente</div></div>' +
    '<div class="conf">Documento comercial — los detalles técnicos, fuentes y costos internos se administran en la versión técnica del presupuesto.</div></div>';
}
function renderClient(){ $('#clientView').innerHTML = clientHTML(); }

/* ---------- Render: Estado ---------- */
function renderStage(){
  const b = $('#stageBadge');
  b.textContent = STAGES[S.stage];
  b.className = 'stage st' + S.stage;
  const adv = $('#btnAdvance'), back = $('#btnBack');
  back.disabled = S.stage === 0;
  if (S.stage >= 3) { adv.disabled = true; adv.title = 'Estado final'; }
  else {
    const reason = advanceReason();
    adv.disabled = !!reason;
    adv.title = reason || 'Avanzar a ' + STAGES[S.stage + 1];
    adv.textContent = (reason ? 'Avanzar estado &rsaquo;' : 'Pasar a ' + STAGES[S.stage + 1] + ' &rsaquo;').replace(/&rsaquo;/g, '›');
  }
}
function advanceReason(){
  if (S.stage === 0){
    const t = techCalc(), bad = [];
    if (!t.portsOK) bad.push('puertos PoE insuficientes');
    if (!t.poeOK)   bad.push('presupuesto PoE insuficiente');
    if (!t.bwOK)    bad.push('ancho de banda excedido');
    if (!t.daysOK)  bad.push('retención por debajo del objetivo');
    return bad.length ? 'Pendiente: ' + bad.join(', ') : null;
  }
  if (S.stage === 1) return calc().cov >= 90 ? null : 'Cobertura A/B debe ser ≥ 90%';
  if (S.stage === 2){
    const f = failedVals();
    return f.length ? 'Validaciones pendientes: ' + f.join(', ') + (f.includes(1) ? ' (cobertura debe ser 100%)' : '') : null;
  }
  return null;
}
function advance(){
  const reason = advanceReason();
  if (reason) { toast('Bloqueado — ' + reason); return; }
  S.stage++; save(true); renderAll();
  toast('Estado: ' + STAGES[S.stage]);
}
function back(){ if (S.stage > 0) { S.stage--; save(true); renderAll(); } }

/* ---------- Refresco ligero (sin perder foco al escribir) ---------- */
function refreshLight(){
  renderKPIs(); renderSummary(); renderStage(); renderClient();
  VALIDATIONS.forEach(v => refreshValBadges(v.n));
}

/* ---------- Render completo ---------- */
function renderAll(){
  renderKPIs(); renderDash(); renderSummary(); renderEquip(); renderLabor();
  renderAudit(); renderVals(); renderClient(); renderStage();
}

/* ---------- Tabs ---------- */
function setTab(id){
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  ['dash','eq','mo','aud','val','cli'].forEach(k => $('#sec-' + k).classList.toggle('hidden', k !== id));
}

/* ---------- Filas ---------- */
function addRow(){
  const n = S.items.length + 1;
  S.items.push({id:'EQ-' + String(n).padStart(2,'0'), cat:'A', code:'', desc:'Nueva partida', qty:1, unit:'pza', cost:0, grade:'D', source:'', url:'', stock:'POR CONFIRMAR', note:''});
  save(true); renderAll(); toast('Partida agregada — complete fuente y grado A/B');
}
function delRow(id){
  if (!confirm('¿Eliminar la partida ' + id + '?')) return;
  S.items = S.items.filter(i => i.id !== id);
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
  L.push(['TIPO','ID','CAT','CODIGO','DESCRIPCION','CANT','UNIDAD','COSTO_USD','TOTAL_USD','GRADO','FUENTE','DISPONIBILIDAD','URL','NOTA'].map(q).join(';'));
  S.items.forEach(i => L.push(['EQUIPO', i.id, i.cat, i.code, i.desc, i.qty, i.unit, num(i.cost).toFixed(2), (num(i.qty)*num(i.cost)).toFixed(2), i.grade, i.source, i.stock, i.url, i.note].map(q).join(';')));
  S.labor.forEach(l => L.push(['MO', 'MO-' + String(l.n).padStart(2,'0'), 'F', '', l.op, l.hrs, 'h', num(S.rates[l.resp]).toFixed(2), (num(l.hrs)*num(S.rates[l.resp])).toFixed(2), '', l.resp, '', '', ''].map(q).join(';')));
  const c = calc();
  L.push('');
  L.push(['RESUMEN'].map(q).join(';'));
  L.push(['COSTO_DIRECTO', '', '', '', '', '', '', '', c.cd.toFixed(2)].map(q).join(';'));
  L.push(['UTILIDAD_' + S.config.markupPct + '%', '', '', '', '', '', '', '', c.utilidad.toFixed(2)].map(q).join(';'));
  L.push(['SUBTOTAL', '', '', '', '', '', '', '', c.sub.toFixed(2)].map(q).join(';'));
  L.push(['IMPUESTO_' + S.config.taxPct + '%', '', '', '', '', '', '', '', c.imp.toFixed(2)].map(q).join(';'));
  L.push(['PRECIO_FINAL', '', '', '', '', '', '', '', c.pf.toFixed(2)].map(q).join(';'));
  L.push(['COBERTURA_AB', '', '', '', '', '', '', '', c.cov.toFixed(1) + '%'].map(q).join(';'));
  download('PRESUPUESTO_CCTV_PRO.csv', '\uFEFF' + L.join('\r\n'), 'text/csv;charset=utf-8');
  toast('CSV exportado');
}
function exportJSON(){
  download('PRESUPUESTO_CCTV_PRO_datos.json', JSON.stringify(S, null, 2), 'application/json');
  toast('Respaldo JSON exportado');
}
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
  setTimeout(() => window.print(), 50);
}
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));

function techHTML(){
  const c = calc(), m = S.meta, t = techCalc();
  const gradeCls = g => g === 'A' || g === 'B' ? 'b-ok' : g === 'C' ? 'b-warn' : 'b-bad';
  let eq = '';
  S.items.forEach(i => {
    eq += '<tr><td>' + esc(i.code) + '</td><td>' + esc(i.desc) + '</td><td>' + esc(i.qty) + '</td><td style="text-align:right">' + money(i.cost) + '</td><td style="text-align:right">' + money(num(i.qty)*num(i.cost)) + '</td><td><span class="badge ' + gradeCls(i.grade) + '">' + esc(i.grade) + '</span></td><td>' + esc(i.source) + '</td><td>' + esc(i.stock) + '</td></tr>';
  });
  let mo = '';
  S.labor.forEach(l => {
    mo += '<tr><td>' + l.n + '</td><td>' + esc(l.op) + '</td><td>' + (l.resp === 'T' ? 'Técnico' : l.resp === 'S' ? 'Supervisor' : 'Ingeniero') + '</td><td>' + num(l.hrs) + '</td><td style="text-align:right">' + money(S.rates[l.resp]) + '</td><td style="text-align:right">' + money(num(l.hrs)*num(S.rates[l.resp])) + '</td></tr>';
  });
  let au = '';
  S.audit.forEach(a => { au += '<tr><td>' + a.n + '</td><td>' + esc(a.area) + '</td><td>' + esc(a.hallazgo) + '</td><td><b>' + esc(a.estado) + '</b></td><td>' + esc(a.accion) + '</td></tr>'; });
  const catSum = k => S.items.filter(i => i.cat === k).reduce((a,i) => a + num(i.qty)*num(i.cost), 0);
  const sm = [['A', catSum('A')],['B', catSum('B')],['C', catSum('C')],['D', catSum('D')],['E', catSum('E')],['F', c.laborTotal],['G', c.ship],['H', catSum('H')],['I', c.utilidad],['J', c.imp]];
  return '<div class="doc">' +
    '<h1>DOCUMENTO TÉCNICO — PRESUPUESTO CCTV</h1>' +
    '<div class="doc-sub">' + esc(m.nombre) + ' · ' + esc(m.ubicacion) + '<br>Elaborado por: ' + esc(m.elaboradoPor) + ' · Fecha: ' + esc(m.fecha) + ' · Versión: ' + esc(m.version) + ' · Estado: ' + STAGES[S.stage] + ' · Cobertura A/B: ' + c.cov.toFixed(1) + '%</div>' +
    '<h2>1. Análisis técnico</h2>' +
    '<table><tr><th>Parámetro</th><th>Valor</th><th>Resultado</th></tr>' +
    '<tr><td>Cámaras</td><td>' + t.cams + ' (1 domo + 20 bullet, 4MP H.265+ PoE)</td><td>OK</td></tr>' +
    '<tr><td>Puertos PoE</td><td>' + t.ports + ' (16 NVR + 8 switch) para ' + t.cams + ' cámaras</td><td>' + (t.portsOK ? 'OK' : 'FALTA') + '</td></tr>' +
    '<tr><td>Presupuesto PoE</td><td>' + money(t.poeLoad) + ' W (mín. ' + money(t.poeLoad*1.2) + ' W c/margen) vs ' + money(t.poeBudget) + ' W</td><td>' + (t.poeOK ? 'OK' : 'FALTA') + '</td></tr>' +
    '<tr><td>Ancho de banda</td><td>' + t.bw + ' Mbps vs ' + esc(S.tech.nvrBwMbps) + ' Mbps entrantes NVR</td><td>' + (t.bwOK ? 'OK' : 'FALTA') + '</td></tr>' +
    '<tr><td>Almacenamiento</td><td>12 TB @ ' + esc(S.tech.bitrateMbps) + ' Mbps → ' + money(t.days) + ' días (objetivo ' + esc(S.tech.retencionDias) + ')</td><td>' + (t.daysOK ? 'OK' : 'REVISAR') + '</td></tr></table>' +
    '<h2>2. Partidas de equipo (con fuentes)</h2>' +
    '<table><tr><th>Código</th><th>Descripción</th><th>Cant.</th><th>Costo U.</th><th>Total</th><th>Grado</th><th>Fuente</th><th>Disponib.</th></tr>' + eq + '</table>' +
    '<p style="font-size:10.5px;color:#475569">Grados: A = tienda/marca directa (Amazon, Newegg, CDW, Home Depot, B&amp;H, fabricante) · B = distribuidor reconocido con precio público · C/D = fuente dudosa o sin fuente (no admisible en entrega). URLs completas disponibles en la aplicación.</p>' +
    '<h2>3. Mano de obra (29 operaciones)</h2>' +
    '<table><tr><th>Nº</th><th>Operación</th><th>Nivel</th><th>Horas</th><th>Tarifa USD/h</th><th>Total</th></tr>' + mo + '</table>' +
    '<h2>4. Auditoría de inconsistencias</h2>' +
    '<table><tr><th>Nº</th><th>Área</th><th>Hallazgo</th><th>Estado</th><th>Acción</th></tr>' + au + '</table>' +
    '<h2>5. Resumen económico (fórmula oficial)</h2>' +
    '<table><tr><th>Cat.</th><th>Concepto</th><th>USD</th></tr>' +
    sm.map(([k, v]) => '<tr><td>' + k + '</td><td>' + esc(CATS[k]) + '</td><td style="text-align:right">' + money(v) + '</td></tr>').join('') +
    '<tr class="catrow"><td colspan="2">COSTO DIRECTO</td><td style="text-align:right">' + money(c.cd) + '</td></tr>' +
    '<tr class="catrow"><td colspan="2">+ UTILIDAD (' + esc(S.config.markupPct) + '%)</td><td style="text-align:right">' + money(c.utilidad) + '</td></tr>' +
    '<tr class="catrow"><td colspan="2">= SUBTOTAL</td><td style="text-align:right">' + money(c.sub) + '</td></tr>' +
    '<tr class="catrow"><td colspan="2">+ IMPUESTO (' + esc(S.config.taxPct) + '%)</td><td style="text-align:right">' + money(c.imp) + '</td></tr>' +
    '<tr class="grand"><td colspan="2">PRECIO FINAL</td><td style="text-align:right">' + money(c.pf) + '</td></tr></table>' +
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
    save(true); refreshValBadges(n); renderStage();
  }
  if (el.id === 'importFile') importJSON(el);
});
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'save') save();
  else if (act === 'csv') exportCSV();
  else if (act === 'json') exportJSON();
  else if (act === 'import') $('#importFile').click();
  else if (act === 'print-tech') printDoc('tech');
  else if (act === 'print-client') printDoc('client');
  else if (act === 'add-row') addRow();
  else if (act === 'del-row') delRow(b.dataset.id);
  else if (act === 'advance') advance();
  else if (act === 'back') back();
  else if (act === 'reset') { if (confirm('¿Restablecer todos los datos a la versión semilla? Se perderán sus ediciones.')) { localStorage.removeItem(LS_KEY); load(); renderAll(); toast('Datos restablecidos'); } }
  else if (act === 'tab') setTab(b.dataset.tab);
  else if (act === 'preset-tax') { S.config.taxPct = num(b.dataset.v); save(true); renderAll(); }
});

/* ---------- Init ---------- */
load();
renderAll();

