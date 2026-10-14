'use strict';

/* =========================================================
   Mis Lucas — lógica de la app
   Todo vive en localStorage. Fechas en hora de Santiago.
   ========================================================= */

/* ---------- Utilidades ---------- */

const TZ = 'America/Santiago';
const KEY = 'mislucas:v1';
const DIA = 864e5;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const money = (n) => { const v = Math.round(Number(n) || 0); return v < 0 ? `−${clp.format(-v)}` : clp.format(v); };
const miles = (n) => (Number(n) || 0).toLocaleString('es-CL');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const toInt = (v) => { const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : 0; };
const sum = (arr, f = (x) => x.monto) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const enDosFrames = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ICON_MINUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>';
const ICON_CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

/* ---------- Fechas (siempre 'YYYY-MM-DD' en hora de Santiago) ---------- */

const partsFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
function hoyISO(d = new Date()) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const pad = (n) => String(n).padStart(2, '0');
const isoDe = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const msDe = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const addDias = (iso, n) => new Date(msDe(iso) + n * DIA).toISOString().slice(0, 10);
const difDias = (a, b) => Math.round((msDe(b) - msDe(a)) / DIA);
const diasMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

const fmtLarga = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtCorta = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtSemana = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', timeZone: 'UTC' });
const fmtInicial = new Intl.DateTimeFormat('es-CL', { weekday: 'narrow', timeZone: 'UTC' });
const fmtHora = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ });
const larga = (iso) => fmtLarga.format(new Date(msDe(iso)));
const corta = (iso) => fmtCorta.format(new Date(msDe(iso))).replace('.', '');
const hora = (ts) => (ts ? fmtHora.format(new Date(ts)) : '');

/** Ciclo = desde el día de pago hasta el día anterior al siguiente pago. */
function cicloDe(iso, diaPago) {
  const dp = Math.min(Math.max(toInt(diaPago) || 1, 1), 31);
  let [y, m, d] = iso.split('-').map(Number);
  if (d < Math.min(dp, diasMes(y, m))) {
    m -= 1;
    if (m < 1) { m = 12; y -= 1; }
  }
  const inicio = isoDe(y, m, Math.min(dp, diasMes(y, m)));
  let ny = y, nm = m + 1;
  if (nm > 12) { nm = 1; ny += 1; }
  const fin = addDias(isoDe(ny, nm, Math.min(dp, diasMes(ny, nm))), -1);
  return { inicio, fin, dias: difDias(inicio, fin) + 1 };
}

/* ---------- Estado ---------- */

const CATEGORIAS = ['Comida / snacks', 'Supermercado', 'Salidas', 'Salud', 'Transporte extra', 'Compras', 'Regalos', 'Imprevisto', 'Otros'];

function estadoInicial() {
  return {
    version: 1,
    config: {
      ingreso: 250000,
      diaPago: 1,
      metaAhorro: 0,
      umbralHormiga: 3000,
      avisoImprevistos: 100000,
      categorias: [...CATEGORIAS],
      ultimaCategoria: 'Comida / snacks',
      creado: Date.now(),
      ultimoRespaldo: null,
    },
    fijos: [
      { id: 'arriendo', nombre: 'Arriendo', monto: 110000, tipo: 'mensual' },
      { id: 'internet', nombre: 'Internet', monto: 13000, tipo: 'mensual' },
      { id: 'suscripciones', nombre: 'Suscripciones / cloud', monto: 20000, tipo: 'mensual' },
      { id: 'transporte', nombre: 'Transporte', monto: 20000, tipo: 'mensual' },
      { id: 'pelo', nombre: 'Corte de pelo', monto: 8000, tipo: 'mensual' },
      { id: 'pastillas-pareja', nombre: 'Pastillas compartidas (pareja)', monto: 9000, tipo: 'mensual' },
      { id: 'pastillas-propias', nombre: 'Pastillas propias', monto: 20000, tipo: 'reserva', fondo: 'pastillas' },
    ],
    gastos: [],
    ingresos: [],
    fondos: [
      { id: 'viaje', nombre: 'Viaje al sur', saldo: 250000, meta: 250000, descripcion: 'Para el viaje. No se usa para gastos del día.', usoGastos: false },
      { id: 'imprev', nombre: 'Imprevistos', saldo: 150000, meta: 250000, descripcion: 'Gastos médicos u otros que no se pueden prever.', usoGastos: true },
      { id: 'pastillas', nombre: 'Reserva pastillas', saldo: 0, meta: 60000, descripcion: 'Se llena con los $20.000 mensuales de pastillas propias.', usoGastos: true },
    ],
    pagados: {},
    deuda: { nombre: 'CMR', saldo: 0, cuotaMensual: 0, pagos: [] },
  };
}

function normalizar(d) {
  const base = estadoInicial();
  if (!d || typeof d !== 'object') return base;
  return {
    ...base,
    ...d,
    config: { ...base.config, ...(d.config || {}) },
    fijos: Array.isArray(d.fijos) ? d.fijos : base.fijos,
    gastos: Array.isArray(d.gastos) ? d.gastos : [],
    ingresos: Array.isArray(d.ingresos) ? d.ingresos : [],
    fondos: Array.isArray(d.fondos) ? d.fondos : base.fondos,
    pagados: d.pagados && typeof d.pagados === 'object' ? d.pagados : {},
    deuda: { ...base.deuda, ...(d.deuda || {}), pagos: Array.isArray(d.deuda?.pagos) ? d.deuda.pagos : [] },
  };
}

function cargar() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizar(JSON.parse(raw));
  } catch (e) {
    console.warn('No se pudieron leer los datos guardados', e);
  }
  return estadoInicial();
}

let S = cargar();

function guardar() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    console.warn('No se pudo guardar', e);
    toast('No se pudo guardar. Exporta un respaldo desde Ajustes.');
  }
}

/** Aplica un cambio destructivo y ofrece "Deshacer" por unos segundos. */
function conDeshacer(mensaje, cambio) {
  const antes = JSON.stringify(S);
  cambio();
  guardar();
  render({ ajustes: true });
  toast(mensaje, {
    label: 'Deshacer',
    fn: () => { S = JSON.parse(antes); guardar(); render({ ajustes: true }); },
  });
}

/* ---------- Cálculos ---------- */

const fondoPorId = (id) => S.fondos.find((f) => f.id === id);
const nombreFondo = (id) => fondoPorId(id)?.nombre || '';
const esHormiga = (g) => toInt(g.monto) < toInt(S.config.umbralHormiga);
const pagadosDe = (ciclo) => S.pagados[ciclo.inicio] || [];

function moverFondo(id, delta) {
  const f = fondoPorId(id);
  if (f) f.saldo = (Number(f.saldo) || 0) + delta;
}

function cuotaDe(ciclo) {
  const pagada = pagadosDe(ciclo).includes('cmr');
  return (Number(S.deuda.saldo) > 0 || pagada) ? toInt(S.deuda.cuotaMensual) : 0;
}

function calcular(iso = hoyISO()) {
  const ciclo = cicloDe(iso, S.config.diaPago);
  const enCiclo = (x) => x.fecha >= ciclo.inicio && x.fecha <= ciclo.fin;

  const extras = sum(S.ingresos.filter(enCiclo));
  const fijos = sum(S.fijos);
  const ahorro = toInt(S.config.metaAhorro);
  const cuota = cuotaDe(ciclo);
  const ingreso = toInt(S.config.ingreso);
  const disponible = ingreso + extras - fijos - ahorro - cuota;

  // Solo los gastos del presupuesto del día (sin fondo) cuentan para el tope.
  const delDia = S.gastos.filter((g) => !g.fondo && enCiclo(g));
  const antes = sum(delDia.filter((g) => g.fecha < iso));
  const gastadoHoy = sum(delDia.filter((g) => g.fecha === iso));
  const restantes = difDias(iso, ciclo.fin) + 1;
  const tope = Math.floor((disponible - antes) / restantes);
  const queda = tope - gastadoHoy;
  const gastadoCiclo = sum(delDia);

  let estado = 'ok';
  if (queda < 0) estado = 'mal';
  else if (tope <= 0 || queda < tope * 0.25) estado = 'ojo';

  return { iso, ciclo, ingreso, extras, fijos, ahorro, cuota, disponible, antes, gastadoHoy, restantes, tope, queda, gastadoCiclo, estado };
}

function diasSinRespaldo() {
  const base = S.config.ultimoRespaldo || S.config.creado || Date.now();
  return Math.floor((Date.now() - base) / DIA);
}

/* ---------- Render ---------- */

const ui = {
  prevQueda: null,
  prevRing: 0,
  semanaSel: 6,
  mesModo: 'cat',
  prevSeg: 0,
  catAbierta: null,
};

function render(opts = {}) {
  const r = calcular();
  renderHoy(r);
  renderMes(r);
  renderFijos(r);
  renderMetas(r);
  // Ajustes se re-dibuja solo cuando no estás escribiendo en él.
  const activo = document.activeElement;
  const escribiendo = activo && activo.closest('#view-ajustes') && activo.matches('input, select, textarea');
  if (opts.ajustes && !escribiendo) renderAjustes();
  observarTitulo();
}

const inicial = (txt) => esc((String(txt || '?').trim()[0] || '?').toUpperCase());

function filaGasto(g, { swipe = true, conFecha = false } = {}) {
  const tags = [];
  if (g.fondo) tags.push(`<span class="tag">${esc(nombreFondo(g.fondo) || 'Fondo')}</span>`);
  else if (g.imprevisto) tags.push('<span class="tag">Imprevisto</span>');
  if (esHormiga(g)) tags.push('<span class="tag">Hormiga</span>');
  const sub = [conFecha ? corta(g.fecha) : hora(g.ts), g.nota].filter(Boolean).map(esc).join(' – ');
  return `
    <li class="${swipe ? 'swipe' : ''}">
      ${swipe ? `<button class="swipe-del" type="button" data-action="borrar-gasto-id" data-id="${esc(g.id)}" tabindex="-1" aria-hidden="true">Borrar</button>` : ''}
      <button class="row" type="button" data-action="editar-gasto" data-id="${esc(g.id)}">
        <span class="avatar ${g.fondo ? 'fund' : ''}" aria-hidden="true">${inicial(g.categoria)}</span>
        <span class="row-main">
          <span class="row-title"><span class="txt">${esc(g.categoria)}</span>${tags.join('')}</span>
          ${sub ? `<span class="row-sub">${sub}</span>` : ''}
        </span>
        <span class="row-amount ${g.fondo ? 'muted' : ''}">${money(g.monto)}</span>
      </button>
    </li>`;
}

function avisoRespaldo() {
  const dias = diasSinRespaldo();
  if (dias <= 7) return '';
  const texto = S.config.ultimoRespaldo ? `Hace ${dias} días que no respaldas.` : 'Aún no respaldas tus datos.';
  return `
    <div class="notice">
      <span>${texto} El navegador podría borrarlos.</span>
      <button class="btn btn-gray btn-sm" type="button" data-action="exportar-json">Respaldar</button>
    </div>`;
}

function anillo(p) {
  const R = 31;
  const C = +(2 * Math.PI * R).toFixed(2);
  return `
    <div class="ring-wrap">
      <svg class="ring" viewBox="0 0 76 76" aria-hidden="true">
        <circle class="ring-track" cx="38" cy="38" r="${R}"/>
        <circle class="ring-fill" cx="38" cy="38" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - ui.prevRing)}" data-to="${C * (1 - p)}"/>
      </svg>
      <span class="ring-pct"><span>${Math.round(p * 100)}%<small>usado</small></span></span>
    </div>`;
}

function renderHoy(r) {
  const el = $('#view-hoy');
  const deHoy = S.gastos.filter((g) => g.fecha === r.iso).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const pct = r.tope > 0 ? clamp01(r.gastadoHoy / r.tope) : (r.gastadoHoy > 0 || r.tope < 0 ? 1 : 0);
  const estadoTxt = { ok: 'Vas bien', ojo: 'Queda poco', mal: 'Te pasaste' }[r.estado];

  let frase;
  if (r.disponible - r.antes < 0) frase = `Ya gastaste ${money(r.antes - r.disponible)} más que el disponible del ciclo.`;
  else if (r.estado === 'mal') frase = `Gastaste ${money(-r.queda)} más que el tope de hoy. Los próximos días se ajustan solos.`;
  else if (r.estado === 'ojo') frase = 'Te queda menos de un cuarto del tope de hoy.';
  else frase = 'Lo que no gastes hoy se reparte en los días que quedan.';

  el.innerHTML = `
    <p class="title-date">${larga(r.iso)}</p>
    <h1 class="large-title" id="hoy-titulo" data-title="Hoy">Hoy</h1>

    <div class="card hero estado-${r.estado}">
      <div class="hero-top">
        <div>
          <p class="hero-label">Disponible hoy</p>
          <p class="hero-num" id="hero-num">${money(r.queda)}</p>
          <span class="pill">${estadoTxt}</span>
        </div>
        ${anillo(pct)}
      </div>
      <p class="hero-note">${frase}</p>
      <dl class="mini-stats">
        <div><dt>Tope</dt><dd>${money(r.tope)}</dd></div>
        <div><dt>Gastado</dt><dd>${money(r.gastadoHoy)}</dd></div>
        <div><dt>Quedan</dt><dd>${plural(r.restantes, 'día', 'días')}</dd></div>
      </dl>
    </div>

    ${avisoRespaldo()}

    <section class="section" aria-labelledby="sem-titulo">
      <div class="section-head"><h2 id="sem-titulo">Últimos 7 días</h2></div>
      <div class="card chart" id="semana"></div>
    </section>

    <section class="section" aria-labelledby="hoy-lista">
      <div class="section-head">
        <h2 id="hoy-lista">Gastos de hoy</h2>
        ${deHoy.length ? `<span class="meta">${money(sum(deHoy))}</span>` : ''}
      </div>
      ${deHoy.length
        ? `<ul class="list">${deHoy.map((g) => filaGasto(g)).join('')}</ul>
           <p class="hint">Toca un gasto para editarlo o deslízalo a la izquierda para borrarlo.</p>`
        : '<p class="empty">Aún no registras gastos hoy. Toca “Agregar gasto” cuando compres algo.</p>'}
    </section>`;

  renderSemana(r);

  // El anillo parte desde el valor anterior para que el cambio se vea.
  const fill = $('.ring-fill', el);
  enDosFrames(() => fill.setAttribute('stroke-dashoffset', fill.dataset.to));
  ui.prevRing = pct;

  // El número reacciona cuando cambia (después de guardar o borrar).
  if (ui.prevQueda !== null && ui.prevQueda !== r.queda) {
    $('#hero-num', el).animate(
      reduceMotion()
        ? [{ opacity: 0.4 }, { opacity: 1 }]
        : [{ opacity: 0.3, filter: 'blur(3px)', transform: 'translateY(4px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }],
      { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
  }
  ui.prevQueda = r.queda;
}

function renderSemana(r) {
  const box = $('#semana');
  if (!box) return;
  const dias = Array.from({ length: 7 }, (_, i) => addDias(r.iso, i - 6));
  const vals = dias.map((d) => sum(S.gastos.filter((g) => !g.fondo && g.fecha === d)));
  const ref = r.disponible > 0 ? Math.round(r.disponible / r.ciclo.dias) : 0;
  const max = Math.max(...vals, ref * 1.3, 1);
  const sel = ui.semanaSel;
  const nombreDia = sel === 6 ? 'Hoy' : sel === 5 ? 'Ayer' : fmtSemana.format(new Date(msDe(dias[sel])));

  box.innerHTML = `
    <div class="chart-detail">
      <span class="d">${nombreDia}</span>
      <span class="n">${money(vals[sel])}</span>
    </div>
    <div class="plot">
      ${ref ? `<div class="ref" style="bottom:${(ref / max) * 100}%"><span>Promedio ${money(ref)}</span></div>` : ''}
      ${dias.map((d, i) => `
        <button class="col ${i === sel ? 'sel' : ''} ${ref && vals[i] > ref ? 'over' : ''}" type="button"
          data-action="dia-semana" data-i="${i}" aria-pressed="${i === sel}" aria-label="${larga(d)}: ${money(vals[i])}">
          <span class="v" style="height:${(vals[i] / max) * 100}%"></span>
        </button>`).join('')}
    </div>
    <div class="days" aria-hidden="true">${dias.map((d, i) => `<span class="${i === sel ? 'sel' : ''}">${fmtInicial.format(new Date(msDe(d))).toUpperCase()}</span>`).join('')}</div>`;
}

function renderMes(r) {
  const el = $('#view-mes');
  const { ciclo } = r;
  const enCiclo = (x) => x.fecha >= ciclo.inicio && x.fecha <= ciclo.fin;
  const gastosCiclo = S.gastos.filter(enCiclo).sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.ts || 0) - (a.ts || 0));

  // Progreso del ciclo
  const pct = r.disponible > 0 ? r.gastadoCiclo / r.disponible : (r.gastadoCiclo > 0 ? 1 : 0);
  const claseBar = pct > 1 ? 'mal' : pct > 0.85 ? 'ojo' : '';
  const resto = r.disponible - r.gastadoCiclo;

  // Por categoría (todos los gastos del ciclo, incluidos los pagados con fondos)
  const porCat = {};
  gastosCiclo.forEach((g) => { (porCat[g.categoria] ||= []).push(g); });
  const cats = Object.entries(porCat).map(([c, gs]) => [c, sum(gs), gs]).sort((a, b) => b[1] - a[1]);
  const maxCat = cats[0]?.[1] || 1;
  const totalCats = sum(cats, (c) => c[1]) || 1;

  // Hormiga e imprevistos
  const hormigas = gastosCiclo.filter(esHormiga);
  const imprevistos = gastosCiclo.filter((g) => g.imprevisto);

  // Comparación con el ciclo anterior, al mismo día del ciclo
  const prev = cicloDe(addDias(ciclo.inicio, -1), S.config.diaPago);
  const prevGastos = S.gastos.filter((g) => !g.fondo && g.fecha >= prev.inicio && g.fecha <= prev.fin);
  const diaN = difDias(ciclo.inicio, r.iso);
  const corte = addDias(prev.inicio, Math.min(diaN, prev.dias - 1));
  const prevAlCorte = sum(prevGastos.filter((g) => g.fecha <= corte));
  const prevTotal = sum(prevGastos);
  const actual = r.antes + r.gastadoHoy;
  const hayPrev = S.gastos.some((g) => g.fecha < ciclo.inicio);
  let compara;
  if (!hayPrev) {
    compara = '<p class="compare-text">Cuando cierres este ciclo vas a ver aquí cómo te fue comparado con el anterior.</p>';
  } else {
    const maxC = Math.max(prevAlCorte, actual, 1);
    const dif = actual - prevAlCorte;
    const lectura = dif === 0
      ? 'Vas igual que el ciclo anterior a esta altura.'
      : dif < 0
        ? `Vas ${money(-dif)} por debajo del ciclo anterior a esta altura.`
        : `Vas ${money(dif)} por encima del ciclo anterior a esta altura.`;
    compara = `
      <div class="compare-row"><span>Este ciclo, hasta hoy</span><strong>${money(actual)}</strong>
        <div class="bar ${dif > 0 ? 'ojo' : 'ok'}"><span style="transform: scaleX(${clamp01(actual / maxC)})"></span></div></div>
      <div class="compare-row"><span>Ciclo anterior, al día ${diaN + 1}</span><strong>${money(prevAlCorte)}</strong>
        <div class="bar muted"><span style="transform: scaleX(${clamp01(prevAlCorte / maxC)})"></span></div></div>
      <p class="compare-text">${lectura} El ciclo anterior cerró en ${money(prevTotal)}.</p>`;
  }

  // Ingresos extra del ciclo
  const extras = S.ingresos.filter(enCiclo).sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Gastos agrupados por día
  const porDia = {};
  gastosCiclo.forEach((g) => { (porDia[g.fecha] ||= []).push(g); });
  const dias = Object.keys(porDia).sort().reverse();

  const segIdx = ui.mesModo === 'cat' ? 0 : 1;
  const vistaCat = cats.length ? `
    <ul class="list">${cats.map(([c, m, gs]) => {
      const abierta = ui.catAbierta === c;
      return `
      <li>
        <button class="row cat-row" type="button" data-action="cat-toggle" data-cat="${esc(c)}" aria-expanded="${abierta}">
          <span class="avatar" aria-hidden="true">${inicial(c)}</span>
          <span class="row-main">
            <span class="cat-line">
              <span class="row-title"><span class="txt">${esc(c)}</span></span>
              <span class="row-amount">${money(m)}<span class="pct">${Math.round((m / totalCats) * 100)}%</span></span>
            </span>
            <span class="bar"><span style="transform: scaleX(${m / maxCat})"></span></span>
          </span>
          ${ICON_CHEV}
        </button>
        ${abierta ? `<ul class="cat-detail">${gs.map((g) => filaGasto(g, { swipe: false, conFecha: true })).join('')}</ul>` : ''}
      </li>`;
    }).join('')}</ul>` : '<p class="empty">Sin gastos en este ciclo todavía.</p>';

  const vistaDias = dias.length ? dias.map((d) => `
      <div class="section-head" style="margin-top:16px"><span class="meta">${d === r.iso ? 'Hoy' : esc(larga(d).replace(/^./, (x) => x.toUpperCase()))}</span><span class="meta">${money(sum(porDia[d]))}</span></div>
      <ul class="list">${porDia[d].map((g) => filaGasto(g)).join('')}</ul>`).join('')
    : '<p class="empty">Aquí vas a ver todos los gastos del ciclo, día por día.</p>';

  el.innerHTML = `
    <h1 class="large-title" id="mes-titulo" data-title="Mes">Mes</h1>
    <p class="title-sub">Del ${corta(ciclo.inicio)} al ${corta(ciclo.fin)}</p>

    <div class="card summary">
      <div class="summary-top">
        <strong>${money(r.gastadoCiclo)}</strong>
        <span>de ${money(r.disponible)}</span>
      </div>
      <div class="bar ${claseBar}"><span style="transform: scaleX(${clamp01(pct)})"></span></div>
      <p class="summary-cap">${resto >= 0
        ? `Te quedan ${money(resto)} para ${plural(r.restantes, 'día', 'días')}.`
        : `Te pasaste ${money(-resto)} del disponible del ciclo.`}</p>
    </div>

    <section class="section" aria-label="Hormiga e imprevistos">
      <div class="facts">
        <div class="fact">
          <p class="fact-label">Hormiga</p>
          <p class="fact-num">${money(sum(hormigas))}</p>
          <p class="fact-text">${plural(hormigas.length, 'gasto', 'gastos')} menores a ${money(S.config.umbralHormiga)}</p>
        </div>
        <div class="fact">
          <p class="fact-label">Imprevistos</p>
          <p class="fact-num">${money(sum(imprevistos))}</p>
          <p class="fact-text">${plural(imprevistos.length, 'gasto', 'gastos')} este ciclo</p>
        </div>
      </div>
    </section>

    <div class="seg" role="tablist" aria-label="Ver gastos por">
      <span class="seg-ind" style="width:calc(50% - 2px);transform:translateX(${ui.prevSeg * 100}%)"></span>
      <button type="button" role="tab" aria-selected="${segIdx === 0}" data-action="mes-modo" data-modo="cat">Categorías</button>
      <button type="button" role="tab" aria-selected="${segIdx === 1}" data-action="mes-modo" data-modo="dias">Días</button>
    </div>
    <div>${segIdx === 0 ? vistaCat : vistaDias}</div>

    <section class="section" aria-labelledby="mes-comp">
      <div class="section-head"><h2 id="mes-comp">Ciclo anterior</h2></div>
      <div class="card compare">${compara}</div>
    </section>

    <section class="section" aria-labelledby="mes-disp">
      <div class="section-head"><h2 id="mes-disp">Disponible del ciclo</h2></div>
      <dl class="card breakdown">
        <dt>Ingreso</dt><dd>${money(r.ingreso)}</dd>
        ${r.extras ? `<dt>Ingresos extra</dt><dd>+ ${money(r.extras)}</dd>` : ''}
        <dt>Gastos fijos</dt><dd>− ${money(r.fijos)}</dd>
        ${r.ahorro ? `<dt>Ahorro del mes</dt><dd>− ${money(r.ahorro)}</dd>` : ''}
        ${r.cuota ? `<dt>Cuota ${esc(S.deuda.nombre)}</dt><dd>− ${money(r.cuota)}</dd>` : ''}
        <dt class="total">Para el día a día</dt><dd class="total">${money(r.disponible)}</dd>
      </dl>
    </section>

    <section class="section" aria-labelledby="mes-extra">
      <div class="section-head">
        <h2 id="mes-extra">Ingresos extra</h2>
        <button class="text-btn" type="button" data-action="ingreso-extra">Agregar</button>
      </div>
      ${extras.length
        ? `<ul class="list plain">${extras.map((i) => `
          <li><div class="row">
            <span class="row-main"><span class="row-title"><span class="txt">${esc(i.nota || 'Ingreso extra')}</span></span><span class="row-sub">${corta(i.fecha)}</span></span>
            <span class="row-amount">+ ${money(i.monto)}</span>
            <button class="icon-btn" type="button" data-action="borrar-ingreso" data-id="${esc(i.id)}" aria-label="Borrar ingreso">${ICON_X}</button>
          </div></li>`).join('')}</ul>`
        : '<p class="empty">¿Te llegó un bono? Agrégalo y se suma al disponible de este ciclo.</p>'}
    </section>`;

  // El indicador del control segmentado se desliza a la opción nueva.
  const ind = $('.seg-ind', el);
  enDosFrames(() => { ind.style.transform = `translateX(${segIdx * 100}%)`; });
  ui.prevSeg = segIdx;
}

function renderFijos(r) {
  const el = $('#view-fijos');
  const pagados = pagadosDe(r.ciclo);
  const items = S.fijos.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    monto: toInt(f.monto),
    sub: f.tipo === 'reserva' ? `Se suma a ${nombreFondo(f.fondo) || 'su fondo'}` : '',
  }));
  if (r.cuota) items.push({ id: 'cmr', nombre: `Cuota ${S.deuda.nombre}`, monto: r.cuota, sub: 'Se descuenta del saldo de la deuda' });

  const total = sum(items);
  const listos = items.filter((i) => pagados.includes(i.id));
  const pagado = sum(listos);
  const reservas = S.fijos.filter((f) => f.tipo === 'reserva' && fondoPorId(f.fondo));

  el.innerHTML = `
    <h1 class="large-title" id="fijos-titulo" data-title="Fijos">Fijos</h1>
    <p class="title-sub">Ya están descontados del disponible. Márcalos a medida que pagas.</p>

    <div class="progress-line"><span><strong>${listos.length} de ${items.length}</strong> pagados</span><span>${money(pagado)} de ${money(total)}</span></div>
    <div class="bar ${listos.length === items.length ? 'ok' : ''}"><span style="transform: scaleX(${total ? pagado / total : 0})"></span></div>

    <section class="section" style="margin-top:16px" aria-label="Lista de fijos">
      <ul class="list">${items.map((i) => `
        <li>
          <label class="check-row">
            <input type="checkbox" data-fijo="${esc(i.id)}" ${pagados.includes(i.id) ? 'checked' : ''}>
            <span class="check-circle">${ICON_CHECK}</span>
            <span class="row-main">
              <span class="row-title"><span class="txt">${esc(i.nombre)}</span></span>
              ${i.sub ? `<span class="row-sub">${esc(i.sub)}</span>` : ''}
            </span>
            <span class="row-amount">${money(i.monto)}</span>
          </label>
        </li>`).join('')}
      </ul>
    </section>

    ${reservas.length ? `
    <section class="section" aria-labelledby="fijos-res">
      <div class="section-head"><h2 id="fijos-res">Reservas</h2></div>
      ${reservas.map((f) => {
        const fondo = fondoPorId(f.fondo);
        const meta = toInt(fondo.meta);
        const p = meta ? clamp01(fondo.saldo / meta) : 0;
        const meses = toInt(f.monto) > 0 && meta > fondo.saldo ? Math.ceil((meta - fondo.saldo) / toInt(f.monto)) : 0;
        return `
        <div class="fund">
          <div class="fund-head"><span class="fund-name">${esc(fondo.nombre)}</span><span class="fund-pct">${Math.round(p * 100)}%</span></div>
          <p class="fund-saldo ${fondo.saldo < 0 ? 'neg' : ''}">${money(fondo.saldo)}</p>
          <div class="bar ${p >= 1 ? 'ok' : ''}"><span style="transform: scaleX(${p})"></span></div>
          <p class="fund-meta"><span>${p >= 1 ? 'Ya te alcanza para la compra' : meses ? `Faltan ${plural(meses, 'mes', 'meses')}` : ''}</span><span>Meta ${money(meta)}</span></p>
          <div class="btn-row"><button class="btn btn-gray btn-sm" type="button" data-action="compra-reserva" data-id="${esc(fondo.id)}">Registrar compra</button></div>
        </div>`;
      }).join('')}
      <p class="hint">La compra se paga desde la reserva y no toca tu tope diario.</p>
    </section>` : ''}`;
}

function renderMetas() {
  const el = $('#view-metas');
  const imprev = fondoPorId('imprev');
  const aviso = toInt(S.config.avisoImprevistos);
  const bajo = imprev && aviso && imprev.saldo < aviso;
  const totalFondos = sum(S.fondos, (f) => f.saldo);

  const d = S.deuda;
  const pagadoDeuda = sum(d.pagos);
  const original = (Number(d.saldo) || 0) + pagadoDeuda;
  const pDeuda = original > 0 ? clamp01(pagadoDeuda / original) : 0;
  const cuota = toInt(d.cuotaMensual);
  const meses = cuota > 0 && d.saldo > 0 ? Math.ceil(d.saldo / cuota) : null;
  const sinDeuda = !d.saldo && !cuota && !d.pagos.length;

  el.innerHTML = `
    <h1 class="large-title" id="metas-titulo" data-title="Metas">Metas</h1>
    <p class="title-sub">${money(totalFondos)} guardados en total</p>

    ${bajo ? `<div class="notice mal"><span>Imprevistos bajó de ${money(aviso)}. Trata de reponerlo antes de usar el resto de tus ahorros.</span></div>` : ''}

    <section class="section" style="margin-top:16px" aria-label="Fondos">
      ${S.fondos.map((f) => {
        const meta = toInt(f.meta);
        const p = meta ? clamp01(f.saldo / meta) : 0;
        const falta = meta - f.saldo;
        return `
        <article class="fund">
          <div class="fund-head">
            <div><h2 class="fund-name">${esc(f.nombre)}</h2>${f.descripcion ? `<p class="fund-desc">${esc(f.descripcion)}</p>` : ''}</div>
            ${meta ? `<span class="fund-pct">${Math.round(p * 100)}%</span>` : ''}
          </div>
          <p class="fund-saldo ${f.saldo < 0 ? 'neg' : ''}">${money(f.saldo)}</p>
          ${meta ? `
          <div class="bar ${p >= 1 ? 'ok' : ''}"><span style="transform: scaleX(${p})"></span></div>
          <p class="fund-meta"><span>${falta > 0 ? `Faltan ${money(falta)}` : 'Meta cumplida'}</span><span>Meta ${money(meta)}</span></p>` : ''}
          <div class="btn-row">
            <button class="btn btn-gray btn-sm" type="button" data-action="fondo-sumar" data-id="${esc(f.id)}">Sumar</button>
            <button class="btn btn-gray btn-sm" type="button" data-action="fondo-sacar" data-id="${esc(f.id)}">Sacar</button>
          </div>
        </article>`;
      }).join('')}
    </section>

    <section class="section" aria-labelledby="metas-deuda">
      <div class="section-head"><h2 id="metas-deuda">Deuda ${esc(d.nombre)}</h2></div>
      ${sinDeuda ? `
        <div class="fund">
          <p class="fund-desc">Ingresa el saldo y la cuota en Ajustes. La cuota se descuenta sola del disponible de cada ciclo.</p>
          <div class="btn-row"><a class="btn btn-gray btn-sm" href="#ajustes">Configurar deuda</a></div>
        </div>` : `
        <div class="fund">
          <div class="fund-head"><p class="fund-desc">Saldo por pagar</p><span class="fund-pct">${Math.round((d.saldo <= 0 ? 1 : pDeuda) * 100)}% pagado</span></div>
          <p class="fund-saldo">${money(d.saldo)}</p>
          <div class="bar ${d.saldo <= 0 ? 'ok' : ''}"><span style="transform: scaleX(${d.saldo <= 0 ? 1 : pDeuda})"></span></div>
          <p class="fund-meta">
            <span>${d.saldo <= 0 ? 'Quedaste en cero' : meses ? `Unos ${plural(meses, 'mes', 'meses')} para quedar en cero` : 'Define una cuota para estimar'}</span>
            <span>Cuota ${money(cuota)}</span>
          </p>
          <div class="btn-row"><button class="btn btn-gray btn-sm" type="button" data-action="pago-cmr" ${d.saldo <= 0 ? 'disabled' : ''}>Registrar pago</button></div>
        </div>`}
    </section>`;
}

function renderAjustes() {
  const el = $('#view-ajustes');
  const c = S.config;
  const dias = diasSinRespaldo();
  const respaldo = c.ultimoRespaldo
    ? (dias === 0 ? 'Último respaldo: hoy' : `Último respaldo: hace ${plural(dias, 'día', 'días')}`)
    : 'Aún no haces un respaldo';

  const campoMonto = (bind, valor, label, ayuda = '') => `
    <label class="setting">
      <span class="setting-label">${label}${ayuda ? `<small>${ayuda}</small>` : ''}</span>
      <input class="inline-input" type="text" inputmode="numeric" data-bind="${bind}" data-tipo="monto" value="${money(valor)}" aria-label="${esc(label)}">
    </label>`;

  const opcionesTipo = (f) => [
    `<option value="mensual" ${f.tipo !== 'reserva' ? 'selected' : ''}>Gasto mensual</option>`,
    ...S.fondos.filter((x) => x.usoGastos !== false).map((x) =>
      `<option value="reserva:${esc(x.id)}" ${f.tipo === 'reserva' && f.fondo === x.id ? 'selected' : ''}>Reserva para ${esc(x.nombre)}</option>`),
  ].join('');

  el.innerHTML = `
    <h1 class="large-title" id="ajustes-titulo" data-title="Ajustes">Ajustes</h1>
    <p class="title-sub">Todo se guarda solo en este teléfono.</p>

    ${avisoRespaldo()}

    <section class="section" aria-labelledby="aj-pres">
      <div class="section-head"><h2 id="aj-pres">Presupuesto</h2></div>
      <div class="group">
        ${campoMonto('config.ingreso', c.ingreso, 'Ingreso mensual')}
        <label class="setting">
          <span class="setting-label">Día de pago<small>Si el mes es más corto, se usa el último día</small></span>
          <input class="inline-input day" type="text" inputmode="numeric" maxlength="2" data-bind="config.diaPago" data-tipo="dia" value="${toInt(c.diaPago) || 1}" aria-label="Día de pago">
        </label>
        ${campoMonto('config.metaAhorro', c.metaAhorro, 'Ahorro mensual', 'Se descuenta del disponible')}
        ${campoMonto('config.umbralHormiga', c.umbralHormiga, 'Gasto hormiga', 'Gastos menores a este monto')}
        ${campoMonto('config.avisoImprevistos', c.avisoImprevistos, 'Aviso de Imprevistos', 'Te aviso si el fondo baja de aquí')}
      </div>
    </section>

    <section class="section" aria-labelledby="aj-fijos">
      <div class="section-head">
        <h2 id="aj-fijos">Gastos fijos</h2>
        <span class="meta">${money(sum(S.fijos))} al mes</span>
      </div>
      <div class="group">
        ${S.fijos.map((f) => `
          <div class="fijo-row">
            <button class="minus-btn" type="button" data-action="borrar-fijo" data-id="${esc(f.id)}" aria-label="Borrar ${esc(f.nombre)}"><span>${ICON_MINUS}</span></button>
            <div class="fijo-main">
              <input class="inline-input left" type="text" data-bind="fijos.${esc(f.id)}.nombre" data-tipo="texto" value="${esc(f.nombre)}" aria-label="Nombre del fijo" maxlength="40">
              <select class="fijo-tipo" data-fijo-tipo="${esc(f.id)}" aria-label="Tipo de ${esc(f.nombre)}">${opcionesTipo(f)}</select>
            </div>
            <input class="inline-input" type="text" inputmode="numeric" data-bind="fijos.${esc(f.id)}.monto" data-tipo="monto" value="${money(f.monto)}" aria-label="Monto de ${esc(f.nombre)}">
          </div>`).join('')}
        <button class="action-row strong" type="button" data-action="agregar-fijo">Agregar fijo</button>
      </div>
    </section>

    <section class="section" aria-labelledby="aj-fondos">
      <div class="section-head"><h2 id="aj-fondos">Fondos</h2></div>
      <div class="group">
        ${S.fondos.map((f) => `
          <div class="fund-edit">
            <label class="setting"><input class="inline-input left" type="text" data-bind="fondos.${esc(f.id)}.nombre" data-tipo="texto" value="${esc(f.nombre)}" aria-label="Nombre del fondo" maxlength="40" style="font-weight:600"></label>
            <label class="setting"><span class="setting-label">Saldo</span><input class="inline-input" type="text" inputmode="numeric" data-bind="fondos.${esc(f.id)}.saldo" data-tipo="monto" value="${money(Math.max(0, f.saldo))}" aria-label="Saldo de ${esc(f.nombre)}"></label>
            <label class="setting"><span class="setting-label">Meta</span><input class="inline-input" type="text" inputmode="numeric" data-bind="fondos.${esc(f.id)}.meta" data-tipo="monto" value="${money(f.meta)}" aria-label="Meta de ${esc(f.nombre)}"></label>
          </div>`).join('')}
      </div>
    </section>

    <section class="section" aria-labelledby="aj-deuda">
      <div class="section-head"><h2 id="aj-deuda">Deuda ${esc(S.deuda.nombre)}</h2></div>
      <div class="group">
        ${campoMonto('deuda.saldo', S.deuda.saldo, 'Saldo por pagar')}
        ${campoMonto('deuda.cuotaMensual', S.deuda.cuotaMensual, 'Cuota mensual', 'Se descuenta del disponible')}
      </div>
    </section>

    <section class="section" aria-labelledby="aj-cats">
      <div class="section-head"><h2 id="aj-cats">Categorías</h2></div>
      <div class="group">
        <div class="cat-chips">
          ${c.categorias.map((cat, i) => `
            <span class="cat-chip">${esc(cat)}
              <button class="icon-btn" type="button" data-action="borrar-cat" data-i="${i}" aria-label="Quitar ${esc(cat)}">${ICON_X}</button>
            </span>`).join('')}
        </div>
        <form class="add-line" id="form-cat">
          <input class="inline-input left" type="text" id="nueva-cat" placeholder="Nueva categoría" aria-label="Nueva categoría" maxlength="30" enterkeyhint="done" autocomplete="off">
          <button class="text-btn" type="submit">Agregar</button>
        </form>
      </div>
    </section>

    <section class="section" aria-labelledby="aj-resp">
      <div class="section-head"><h2 id="aj-resp">Respaldo</h2><span class="meta">${respaldo}</span></div>
      <div class="group">
        <button class="action-row strong" type="button" data-action="exportar-json">Exportar respaldo ${ICON_CHEV}</button>
        <button class="action-row" type="button" data-action="importar-json">Importar respaldo ${ICON_CHEV}</button>
        <button class="action-row" type="button" data-action="exportar-csv">Exportar gastos en CSV ${ICON_CHEV}</button>
      </div>
      <p class="hint">Guarda el archivo en Drive o mándatelo por WhatsApp. Si cambias de teléfono, lo importas y listo.</p>
    </section>

    <section class="section">
      <div class="group">
        <button class="action-row danger" type="button" data-action="reset">Borrar todos los datos</button>
      </div>
    </section>

    <p class="foot-note">Mis Lucas no envía tus datos a ningún lado: todo queda en este teléfono.</p>`;
}

/* ---------- Navegación ---------- */

const VISTAS = ['hoy', 'mes', 'fijos', 'metas', 'ajustes'];
const vistaActual = () => { const h = location.hash.slice(1); return VISTAS.includes(h) ? h : 'hoy'; };

function mostrarVista() {
  const v = vistaActual();
  VISTAS.forEach((n) => { $(`#view-${n}`).hidden = n !== v; });
  $$('.tabbar a').forEach((a) => {
    if (a.dataset.tab === v) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.body.classList.toggle('con-fab', v === 'hoy');
  if (v === 'ajustes') renderAjustes();
  window.scrollTo(0, 0);
  observarTitulo();
}

/* Título grande que pasa a la barra superior al hacer scroll (como en iOS). */
const navObserver = new IntersectionObserver(([entry]) => {
  $('#navbar').classList.toggle('scrolled', !entry.isIntersecting);
}, { rootMargin: '-52px 0px 0px 0px' });

function observarTitulo() {
  navObserver.disconnect();
  const t = $(`#view-${vistaActual()} .large-title`);
  if (!t) return;
  $('#navbar-title').textContent = t.dataset.title || t.textContent;
  navObserver.observe(t);
}

/* ---------- Hojas (bottom sheets) ---------- */

function abrirSheet(d) {
  if (d.open) return;
  d.classList.remove('closing');
  d.showModal();
  enDosFrames(() => d.classList.add('open'));
}

function cerrarSheet(d) {
  if (!d.open || d.classList.contains('closing')) return;
  const panel = $('.sheet-panel', d);
  d.classList.add('closing');
  d.classList.remove('open');
  panel.style.transform = '';
  let hecho = false;
  const fin = () => {
    if (hecho) return;
    hecho = true;
    d.close();
    d.classList.remove('closing');
  };
  panel.addEventListener('transitionend', fin, { once: true });
  setTimeout(fin, 300);
}

$$('dialog.sheet').forEach((d) => {
  d.addEventListener('cancel', (e) => { e.preventDefault(); cerrarSheet(d); });
  d.addEventListener('click', (e) => { if (e.target === d) cerrarSheet(d); });
  activarArrastre(d);
});

/** Arrastrar hacia abajo para cerrar (por distancia o por velocidad). */
function activarArrastre(d) {
  const panel = $('.sheet-panel', d);
  let y0 = 0, t0 = 0, dy = 0, arrastrando = false;

  const mover = (e) => {
    if (!arrastrando) return;
    dy = e.clientY - y0;
    // Hacia arriba ofrece resistencia en vez de un tope duro.
    const y = dy > 0 ? dy : -Math.sqrt(-dy) * 2;
    panel.style.transform = `translateY(${y}px)`;
  };
  const soltar = () => {
    if (!arrastrando) return;
    arrastrando = false;
    panel.style.transition = '';
    const vel = dy / Math.max(1, Date.now() - t0);
    if (dy > panel.offsetHeight * 0.3 || (dy > 24 && vel > 0.5)) cerrarSheet(d);
    else panel.style.transform = '';
  };

  $$('[data-drag]', d).forEach((h) => {
    h.addEventListener('pointerdown', (e) => {
      if (arrastrando || e.target.closest('button')) return;
      arrastrando = true;
      y0 = e.clientY; t0 = Date.now(); dy = 0;
      panel.style.transition = 'none';
      h.setPointerCapture(e.pointerId);
    });
    h.addEventListener('pointermove', mover);
    h.addEventListener('pointerup', soltar);
    h.addEventListener('pointercancel', soltar);
  });
}

/* ---------- Deslizar un gasto para borrarlo ---------- */

const ABIERTO = -88;
let swipe = null;       // gesto en curso
let filaAbierta = null; // fila que quedó mostrando "Borrar"
let ignorarClick = false;

function cerrarFila(row, anim = true) {
  if (!row) return;
  row.classList.toggle('anim', anim);
  row.style.transform = '';
  if (filaAbierta === row) filaAbierta = null;
  setTimeout(() => { if (!row.style.transform) row.parentElement?.classList.remove('swiping'); }, anim ? 300 : 0);
}

document.addEventListener('pointerdown', (e) => {
  const row = e.target.closest('.swipe > .row');
  if (filaAbierta && filaAbierta !== row) cerrarFila(filaAbierta);
  if (!row || e.button > 0) return;
  const base = filaAbierta === row ? ABIERTO : 0;
  swipe = { row, x0: e.clientX, y0: e.clientY, base, dx: 0, modo: 'espera', t0: Date.now(), id: e.pointerId };
});

document.addEventListener('pointermove', (e) => {
  if (!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x0;
  const dy = e.clientY - swipe.y0;
  if (swipe.modo === 'espera') {
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      swipe.modo = 'arrastre';
      swipe.row.classList.remove('anim');
      swipe.row.parentElement.classList.add('swiping');
      try { swipe.row.setPointerCapture(e.pointerId); } catch {}
    } else if (Math.abs(dy) > 8) {
      swipe = null;
      return;
    } else return;
  }
  swipe.dx = dx;
  let x = Math.min(0, swipe.base + dx);
  const ancho = swipe.row.offsetWidth;
  if (x < -ancho * 0.75) x = -ancho * 0.75 + (x + ancho * 0.75) * 0.3; // resistencia al final
  swipe.row.style.transform = `translateX(${x}px)`;
});

function terminarSwipe() {
  if (!swipe) return;
  const s = swipe;
  swipe = null;
  if (s.modo !== 'arrastre') return;
  ignorarClick = true;
  setTimeout(() => { ignorarClick = false; }, 50);
  const x = Math.min(0, s.base + s.dx);
  const ancho = s.row.offsetWidth;
  const vel = s.dx / Math.max(1, Date.now() - s.t0);
  s.row.classList.add('anim');
  if (x < -ancho * 0.55) {
    // Deslizó casi todo: borrar.
    s.row.style.transform = `translateX(${-ancho}px)`;
    const id = s.row.dataset.id;
    setTimeout(() => borrarGasto(id), 180);
  } else if (x < ABIERTO / 2 || vel < -0.5) {
    s.row.style.transform = `translateX(${ABIERTO}px)`;
    filaAbierta = s.row;
  } else {
    cerrarFila(s.row);
  }
}
document.addEventListener('pointerup', terminarSwipe);
document.addEventListener('pointercancel', terminarSwipe);

/* ---------- Hoja de gasto ---------- */

let draft = null;

function abrirGasto(g = null, preset = {}) {
  const hoy = hoyISO();
  draft = g
    ? { id: g.id, monto: String(g.monto), categoria: g.categoria, nota: g.nota || '', imprevisto: !!g.imprevisto, fondo: g.fondo || null, fecha: g.fecha }
    : {
        id: null, monto: '', nota: '', imprevisto: false, fondo: null, fecha: hoy,
        categoria: S.config.categorias.includes(S.config.ultimaCategoria) ? S.config.ultimaCategoria : S.config.categorias[0] || 'Otros',
        ...preset,
      };
  $('#g-titulo').textContent = g ? 'Editar gasto' : 'Nuevo gasto';
  $('#g-borrar').hidden = !g;
  $('#g-nota').value = draft.nota;
  $('#g-fecha').value = draft.fecha;
  $('#g-fecha').max = hoy;
  $('#g-mas').open = !!(draft.imprevisto || draft.fondo || draft.fecha !== hoy);
  pintarGasto();
  $('.sheet-body', $('#sheet-gasto')).scrollTop = 0;
  abrirSheet($('#sheet-gasto'));
}

function pintarGasto() {
  const m = toInt(draft.monto);
  const out = $('#g-monto');
  out.textContent = money(m);
  out.classList.toggle('vacio', !m);

  let hint = 'Sale de tu presupuesto del día';
  if (draft.fondo) {
    const f = fondoPorId(draft.fondo);
    const original = draft.id ? S.gastos.find((x) => x.id === draft.id) : null;
    const devuelto = original && original.fondo === draft.fondo ? toInt(original.monto) : 0;
    hint = f ? `Sale de ${f.nombre}: quedarían ${money(f.saldo + devuelto - m)}` : 'Sale de un fondo';
  }
  if (m && m < toInt(S.config.umbralHormiga)) hint += ' · hormiga';
  $('#g-hint').textContent = hint;

  const cats = [...S.config.categorias];
  if (draft.categoria && !cats.includes(draft.categoria)) cats.push(draft.categoria);
  $('#g-cats').innerHTML = cats.map((c) =>
    `<button class="chip" type="button" role="radio" aria-checked="${c === draft.categoria}" data-action="cat" data-cat="${esc(c)}">${esc(c)}</button>`).join('');

  $('#g-imprevisto').checked = draft.imprevisto;
  const opciones = [{ id: '', nombre: 'Mi presupuesto del día' }, ...S.fondos.filter((f) => f.usoGastos !== false)];
  $('#g-fondos').innerHTML = opciones.map((f) =>
    `<button class="chip" type="button" role="radio" aria-checked="${(draft.fondo || '') === f.id}" data-action="fondo-gasto" data-fondo="${esc(f.id)}">${esc(f.nombre)}</button>`).join('');
}

function tecla(k) {
  let m = draft.monto;
  if (k === 'back') m = m.slice(0, -1);
  else if (k === '000') { if (m) m += '000'; }
  else m += k;
  draft.monto = m.replace(/^0+/, '').slice(0, 9);
  pintarGasto();
}

function guardarGasto() {
  const monto = toInt(draft.monto);
  if (!monto) {
    $('#g-monto').animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
      { duration: 260, easing: 'ease-out' },
    );
    $('#g-hint').textContent = 'Escribe un monto con el teclado.';
    return;
  }
  draft.nota = $('#g-nota').value.trim();
  const fecha = $('#g-fecha').value && $('#g-fecha').value <= hoyISO() ? $('#g-fecha').value : hoyISO();

  if (draft.id) {
    const g = S.gastos.find((x) => x.id === draft.id);
    if (g) {
      if (g.fondo) moverFondo(g.fondo, toInt(g.monto)); // devolver lo anterior
      Object.assign(g, { monto, categoria: draft.categoria, nota: draft.nota, imprevisto: draft.imprevisto, fondo: draft.fondo || null, fecha });
      if (g.fondo) moverFondo(g.fondo, -monto);
    }
  } else {
    const g = { id: uid(), fecha, ts: Date.now(), monto, categoria: draft.categoria, nota: draft.nota, imprevisto: draft.imprevisto, fondo: draft.fondo || null };
    S.gastos.push(g);
    if (g.fondo) moverFondo(g.fondo, -monto);
  }
  S.config.ultimaCategoria = draft.categoria;
  ui.semanaSel = 6;
  guardar();
  cerrarSheet($('#sheet-gasto'));
  navigator.vibrate?.(8);
  render();
  toast(draft.id ? 'Gasto actualizado' : `${money(monto)} en ${draft.categoria}`);
}

function borrarGasto(id) {
  const g = S.gastos.find((x) => x.id === id);
  if (!g) return;
  if ($('#sheet-gasto').open) cerrarSheet($('#sheet-gasto'));
  filaAbierta = null;
  conDeshacer(g.fondo ? `Borrado. ${money(g.monto)} volvieron a ${nombreFondo(g.fondo)}` : 'Gasto borrado', () => {
    if (g.fondo) moverFondo(g.fondo, toInt(g.monto));
    S.gastos = S.gastos.filter((x) => x.id !== id);
  });
}

$('#g-imprevisto').addEventListener('change', (e) => {
  draft.imprevisto = e.target.checked;
  if (draft.imprevisto && !draft.fondo && fondoPorId('imprev')) draft.fondo = 'imprev';
  if (!draft.imprevisto && draft.fondo === 'imprev') draft.fondo = null;
  pintarGasto();
});

document.addEventListener('keydown', (e) => {
  const d = $('#sheet-gasto');
  if (!d.open || e.target.matches('input, textarea, select')) return;
  if (/^[0-9]$/.test(e.key)) { tecla(e.key); e.preventDefault(); }
  else if (e.key === 'Backspace') { tecla('back'); e.preventDefault(); }
  else if (e.key === 'Enter' && !e.target.closest('button')) { guardarGasto(); e.preventDefault(); }
});

/* ---------- Hoja de monto (fondos, ingresos, pagos) ---------- */

let alConfirmarMonto = null;

function pedirMonto({ titulo, boton, ayuda = '', conNota = false, onOk }) {
  $('#m-titulo').textContent = titulo;
  $('#m-ayuda').textContent = ayuda;
  $('#m-ayuda').hidden = !ayuda;
  $('#m-input').value = '';
  $('#m-nota').value = '';
  $('#m-nota-wrap').hidden = !conNota;
  $('#m-ok').textContent = boton;
  alConfirmarMonto = onOk;
  abrirSheet($('#sheet-monto'));
}

$('#m-input').addEventListener('input', (e) => {
  const n = toInt(e.target.value);
  e.target.value = n ? miles(n) : '';
});

$('#form-monto').addEventListener('submit', (e) => {
  e.preventDefault();
  const monto = toInt($('#m-input').value);
  if (!monto) { $('#m-input').focus(); return; }
  const nota = $('#m-nota').value.trim();
  cerrarSheet($('#sheet-monto'));
  alConfirmarMonto?.(monto, nota);
  guardar();
  render({ ajustes: true });
});

/* ---------- Fijos ---------- */

function toggleFijo(id, marcado) {
  const ciclo = cicloDe(hoyISO(), S.config.diaPago);
  const set = new Set(S.pagados[ciclo.inicio] || []);
  if (marcado === set.has(id)) return;

  if (id === 'cmr') {
    const pid = `cmr-${ciclo.inicio}`;
    if (marcado) {
      const monto = Math.min(toInt(S.deuda.cuotaMensual), Number(S.deuda.saldo) || 0);
      S.deuda.pagos.push({ id: pid, fecha: hoyISO(), monto });
      S.deuda.saldo = (Number(S.deuda.saldo) || 0) - monto;
      toast(`Pago de ${money(monto)} registrado en ${S.deuda.nombre}`);
    } else {
      const p = S.deuda.pagos.find((x) => x.id === pid);
      if (p) {
        S.deuda.saldo = (Number(S.deuda.saldo) || 0) + toInt(p.monto);
        S.deuda.pagos = S.deuda.pagos.filter((x) => x.id !== pid);
      }
    }
  } else {
    const f = S.fijos.find((x) => x.id === id);
    if (f?.tipo === 'reserva' && fondoPorId(f.fondo)) {
      moverFondo(f.fondo, marcado ? toInt(f.monto) : -toInt(f.monto));
      toast(marcado ? `+${money(f.monto)} a ${nombreFondo(f.fondo)}` : `−${money(f.monto)} de ${nombreFondo(f.fondo)}`);
    }
  }
  if (marcado) set.add(id); else set.delete(id);
  S.pagados[ciclo.inicio] = [...set];
  if (marcado) navigator.vibrate?.(6);
  guardar();
  // Se re-dibuja un poco después para que se vea el check antes del cambio.
  setTimeout(render, 160);
}

/* ---------- Respaldo ---------- */

function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportarJSON() {
  S.config.ultimoRespaldo = Date.now();
  guardar();
  descargar(`mis-lucas-respaldo-${hoyISO()}.json`, JSON.stringify(S, null, 2), 'application/json');
  render({ ajustes: true });
  toast('Respaldo exportado');
}

function exportarCSV() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cab = ['fecha', 'hora', 'monto', 'categoria', 'nota', 'imprevisto', 'fondo', 'hormiga'];
  const filas = [...S.gastos]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.ts || 0) - (b.ts || 0))
    .map((g) => [g.fecha, hora(g.ts), g.monto, g.categoria, g.nota, g.imprevisto ? 'sí' : 'no', nombreFondo(g.fondo), esHormiga(g) ? 'sí' : 'no'].map(q).join(';'));
  // Punto y coma: Excel en español usa la coma como decimal.
  descargar(`mis-lucas-gastos-${hoyISO()}.csv`, '﻿' + [cab.join(';'), ...filas].join('\r\n'), 'text/csv;charset=utf-8');
  toast(`${plural(S.gastos.length, 'gasto exportado', 'gastos exportados')} a CSV`);
}

$('#file-import').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || !data.config || !Array.isArray(data.gastos)) throw new Error('formato');
    conDeshacer(`Importaste ${plural(data.gastos.length, 'gasto', 'gastos')}`, () => { S = normalizar(data); });
  } catch {
    toast('Ese archivo no es un respaldo de Mis Lucas.');
  }
});

/* ---------- Ajustes: edición en línea ---------- */

function aplicarBind(input) {
  const [col, key, campo] = input.dataset.bind.split('.');
  const tipo = input.dataset.tipo;
  let val;
  if (tipo === 'texto') {
    val = input.value.trim();
    if (!val) { input.value = col === 'fijos' ? S.fijos.find((x) => x.id === key)?.nombre : fondoPorId(key)?.nombre; return; }
  } else if (tipo === 'dia') {
    val = Math.min(31, Math.max(1, toInt(input.value) || 1));
    input.value = val;
  } else {
    val = toInt(input.value);
    input.value = money(val);
  }
  if (col === 'config') S.config[key] = val;
  else if (col === 'deuda') S.deuda[key] = val;
  else {
    const item = (S[col] || []).find((x) => x.id === key);
    if (item) item[campo] = val;
  }
  guardar();
  render();
}

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('[data-fijo]')) toggleFijo(t.dataset.fijo, t.checked);
  else if (t.matches('[data-bind]')) aplicarBind(t);
  else if (t.matches('[data-fijo-tipo]')) {
    const f = S.fijos.find((x) => x.id === t.dataset.fijoTipo);
    if (!f) return;
    if (t.value === 'mensual') { f.tipo = 'mensual'; delete f.fondo; }
    else { f.tipo = 'reserva'; f.fondo = t.value.split(':')[1]; }
    guardar();
    render();
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.matches('[data-bind][data-tipo="monto"]')) {
    const n = toInt(t.value);
    t.value = n ? money(n) : '';
  }
});

// Al tocar un monto en Ajustes, se selecciona para escribir encima.
document.addEventListener('focusin', (e) => {
  if (e.target.matches('.inline-input[inputmode="numeric"]')) setTimeout(() => e.target.select(), 0);
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'form-cat') return;
  e.preventDefault();
  const input = $('#nueva-cat');
  const nombre = input.value.trim();
  if (!nombre) return;
  if (S.config.categorias.some((c) => c.toLowerCase() === nombre.toLowerCase())) {
    toast('Esa categoría ya existe');
    return;
  }
  S.config.categorias.push(nombre);
  guardar();
  input.value = '';
  input.blur();
  renderAjustes();
  toast(`Agregaste ${nombre}`);
});

/* ---------- Clicks ---------- */

let resetArmado = null;

document.addEventListener('click', (e) => {
  if (ignorarClick) { e.preventDefault(); e.stopPropagation(); return; }
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled) return;
  const id = b.dataset.id;

  // Con una fila abierta, el primer toque solo la cierra.
  if (filaAbierta && b === filaAbierta) { cerrarFila(filaAbierta); return; }

  switch (b.dataset.action) {
    case 'nuevo-gasto': abrirGasto(); break;
    case 'editar-gasto': {
      const g = S.gastos.find((x) => x.id === id);
      if (g) abrirGasto(g);
      break;
    }
    case 'cerrar': cerrarSheet(b.closest('dialog')); break;
    case 'tecla': tecla(b.dataset.k); break;
    case 'cat':
      draft.categoria = b.dataset.cat;
      if (draft.categoria === 'Imprevisto' && !draft.imprevisto) {
        draft.imprevisto = true;
        if (!draft.fondo && fondoPorId('imprev')) draft.fondo = 'imprev';
        $('#g-mas').open = true;
      }
      pintarGasto();
      break;
    case 'fondo-gasto': draft.fondo = b.dataset.fondo || null; pintarGasto(); break;
    case 'guardar-gasto': guardarGasto(); break;
    case 'borrar-gasto': if (draft?.id) borrarGasto(draft.id); break;
    case 'borrar-gasto-id': borrarGasto(id); break;

    case 'dia-semana':
      ui.semanaSel = Number(b.dataset.i);
      renderSemana(calcular());
      break;
    case 'mes-modo':
      ui.mesModo = b.dataset.modo;
      renderMes(calcular());
      break;
    case 'cat-toggle':
      ui.catAbierta = ui.catAbierta === b.dataset.cat ? null : b.dataset.cat;
      renderMes(calcular());
      break;

    case 'fondo-sumar': {
      const f = fondoPorId(id);
      pedirMonto({ titulo: `Sumar a ${f.nombre}`, boton: 'Sumar', ayuda: `Saldo actual: ${money(f.saldo)}`, onOk: (m) => { moverFondo(id, m); toast(`+${money(m)} a ${f.nombre}`); } });
      break;
    }
    case 'fondo-sacar': {
      const f = fondoPorId(id);
      pedirMonto({ titulo: `Sacar de ${f.nombre}`, boton: 'Sacar', ayuda: `Saldo actual: ${money(f.saldo)}. Esto no toca tu tope diario.`, onOk: (m) => { moverFondo(id, -m); toast(`−${money(m)} de ${f.nombre}`); } });
      break;
    }
    case 'compra-reserva': {
      const f = fondoPorId(id);
      const cat = S.config.categorias.includes('Salud') ? 'Salud' : undefined;
      abrirGasto(null, { monto: String(toInt(f?.meta) || ''), fondo: id, nota: 'Compra de pastillas (3 meses)', ...(cat ? { categoria: cat } : {}) });
      break;
    }
    case 'ingreso-extra':
      pedirMonto({
        titulo: 'Ingreso extra', boton: 'Agregar ingreso', conNota: true,
        ayuda: 'Se suma al disponible de este ciclo y sube tu tope diario.',
        onOk: (m, nota) => { S.ingresos.push({ id: uid(), fecha: hoyISO(), monto: m, nota: nota || 'Ingreso extra' }); toast(`+${money(m)} al ciclo`); },
      });
      break;
    case 'borrar-ingreso':
      conDeshacer('Ingreso borrado', () => { S.ingresos = S.ingresos.filter((x) => x.id !== id); });
      break;
    case 'pago-cmr':
      pedirMonto({
        titulo: `Pago ${S.deuda.nombre}`, boton: 'Registrar pago',
        ayuda: `Saldo actual: ${money(S.deuda.saldo)}. Si es la cuota del mes, márcala en Fijos.`,
        onOk: (m) => {
          S.deuda.pagos.push({ id: uid(), fecha: hoyISO(), monto: m });
          S.deuda.saldo = Math.max(0, (Number(S.deuda.saldo) || 0) - m);
          toast(`Pago de ${money(m)} registrado`);
        },
      });
      break;

    case 'agregar-fijo': {
      const nuevo = { id: uid(), nombre: 'Nuevo fijo', monto: 0, tipo: 'mensual' };
      S.fijos.push(nuevo);
      guardar();
      render({ ajustes: true });
      const input = $(`[data-bind="fijos.${nuevo.id}.nombre"]`);
      input?.focus();
      input?.select();
      break;
    }
    case 'borrar-fijo': {
      const f = S.fijos.find((x) => x.id === id);
      conDeshacer(`Borraste ${f?.nombre || 'el fijo'}`, () => { S.fijos = S.fijos.filter((x) => x.id !== id); });
      break;
    }
    case 'borrar-cat': {
      const i = Number(b.dataset.i);
      const cat = S.config.categorias[i];
      conDeshacer(`Quitaste ${cat}`, () => { S.config.categorias.splice(i, 1); });
      break;
    }
    case 'exportar-json': exportarJSON(); break;
    case 'exportar-csv': exportarCSV(); break;
    case 'importar-json': $('#file-import').click(); break;
    case 'reset':
      if (!resetArmado) {
        b.textContent = 'Toca de nuevo para borrar todo';
        resetArmado = setTimeout(() => { resetArmado = null; b.textContent = 'Borrar todos los datos'; }, 3500);
      } else {
        clearTimeout(resetArmado);
        resetArmado = null;
        conDeshacer('Borraste todos los datos', () => { S = estadoInicial(); });
      }
      break;
  }
}, true);

/* ---------- Toast ---------- */

let toastTimer = null;

function toast(msg, accion) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${accion ? `<button class="toast-btn" type="button">${esc(accion.label)}</button>` : ''}`;
  if (accion) $('.toast-btn', t).addEventListener('click', () => { accion.fn(); ocultarToast(); });
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(ocultarToast, accion ? 6000 : 2400);
}

function ocultarToast() {
  $('#toast').classList.remove('show');
}

/* ---------- Arranque ---------- */

let diaMostrado = hoyISO();

function revisarCambioDeDia() {
  const hoy = hoyISO();
  if (hoy !== diaMostrado) {
    diaMostrado = hoy;
    render({ ajustes: true });
  }
}

window.addEventListener('hashchange', mostrarVista);
document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarCambioDeDia(); });
setInterval(revisarCambioDeDia, 20000);

// Si otra pestaña cambia los datos, recargarlos.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) { S = cargar(); render({ ajustes: true }); }
});

render();
mostrarVista();

// Pedir al navegador que no borre los datos locales.
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker no registrado', err));
  });
}
