'use strict';

/* =========================================================
   Mis Lucas — lógica de la app
   Todo vive en localStorage. Fechas en hora de Santiago.
   ========================================================= */

/* ---------- Utilidades ---------- */

const TZ = 'America/Santiago';
const KEY = 'mislucas:v1'; // No cambiar: aquí están los datos de siempre.
const VERSION_DATOS = 3;
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
const vibrar = (ms) => { try { navigator.vibrate?.(ms); } catch {} };
const mayus = (s) => String(s).replace(/^./, (x) => x.toUpperCase());

const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ICON_MINUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>';
const ICON_CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const ICON_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14l6-6 6 6"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10l6 6 6-6"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

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
function sumarMeses(iso, n) {
  let [y, m, d] = iso.split('-').map(Number);
  m += n;
  y += Math.floor((m - 1) / 12);
  m = (((m - 1) % 12) + 12) % 12 + 1;
  return isoDe(y, m, Math.min(d, diasMes(y, m)));
}

const fmtLarga = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtCorta = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtSemana = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', timeZone: 'UTC' });
const fmtInicial = new Intl.DateTimeFormat('es-CL', { weekday: 'narrow', timeZone: 'UTC' });
const fmtMes = new Intl.DateTimeFormat('es-CL', { month: 'long', timeZone: 'UTC' });
const fmtMesCorto = new Intl.DateTimeFormat('es-CL', { month: 'short', timeZone: 'UTC' });
const fmtHora = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ });
const larga = (iso) => fmtLarga.format(new Date(msDe(iso)));
const corta = (iso) => fmtCorta.format(new Date(msDe(iso))).replace('.', '');
const mesDe = (iso) => fmtMes.format(new Date(msDe(iso)));
const mesCorto = (iso) => fmtMesCorto.format(new Date(msDe(iso))).replace('.', '');
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
const siguienteCiclo = (c, diaPago = S.config.diaPago) => cicloDe(addDias(c.fin, 1), diaPago);
const cicloActual = () => cicloDe(hoyISO(), S.config.diaPago);

/* ---------- Estado ---------- */

const CATEGORIAS = ['Comida / snacks', 'Supermercado', 'Salidas', 'Salud', 'Transporte extra', 'Compras', 'Regalos', 'Imprevisto', 'Otros'];
const ICONOS = {
  'Comida / snacks': '🍔', Supermercado: '🛒', Salidas: '🍻', Salud: '💊', 'Transporte extra': '🚕',
  Compras: '🛍️', Regalos: '🎁', Imprevisto: '⚠️', Otros: '📦',
};

/** Plantillas para crear un gasto de vez en cuando con un toque. */
const PLANTILLAS = [
  { nombre: 'Ropa', monto: 60000, cadaMeses: 6, categoria: 'Compras', icono: '👕' },
  { nombre: 'Dentista', monto: 40000, cadaMeses: 6, categoria: 'Salud', icono: '🦷' },
  { nombre: 'Regalo de cumpleaños', monto: 20000, cadaMeses: 12, categoria: 'Regalos', icono: '🎂' },
  { nombre: 'Seguro', monto: 120000, cadaMeses: 12, categoria: 'Otros', icono: '🛡️' },
  { nombre: 'Renovación anual', monto: 30000, cadaMeses: 12, categoria: 'Otros', icono: '🔁' },
];

function estadoInicial() {
  const ciclo = cicloDe(hoyISO(), 1);
  return {
    version: VERSION_DATOS,
    config: {
      ingreso: 250000,
      diaPago: 1,
      metaAhorro: 0,
      umbralHormiga: 3000,
      avisoImprevistos: 100000,
      categorias: [...CATEGORIAS],
      iconos: { ...ICONOS },
      ultimaCategoria: 'Comida / snacks',
      creado: Date.now(),
      ultimoRespaldo: null,
      tema: 'auto',
      bienvenida: false,
      descartados: { fecha: '', ids: [] },
      sugerenciasNo: [],
    },
    fijos: [
      { id: 'arriendo', nombre: 'Arriendo', monto: 110000, tipo: 'mensual' },
      { id: 'internet', nombre: 'Internet', monto: 13000, tipo: 'mensual' },
      { id: 'suscripciones', nombre: 'Suscripciones / cloud', monto: 20000, tipo: 'mensual' },
      { id: 'transporte', nombre: 'Transporte', monto: 20000, tipo: 'mensual' },
      { id: 'pelo', nombre: 'Corte de pelo', monto: 8000, tipo: 'mensual' },
      { id: 'pastillas-pareja', nombre: 'Pastillas compartidas (pareja)', monto: 9000, tipo: 'mensual' },
    ],
    gastos: [],
    ingresos: [],
    fondos: [
      { id: 'viaje', nombre: 'Viaje al sur', saldo: 250000, meta: 250000, descripcion: 'Para el viaje. No se usa para gastos del día.', usoGastos: false },
      { id: 'imprev', nombre: 'Imprevistos', saldo: 150000, meta: 250000, descripcion: 'Gastos médicos u otros que no se pueden prever.', usoGastos: true },
    ],
    // Gastos de vez en cuando: la app aparta un poco cada ciclo hasta que toca pagarlos.
    pasajeros: [
      { id: 'pastillas-propias', nombre: 'Pastillas propias', monto: 60000, cadaMeses: 3, proxima: sumarMeses(ciclo.inicio, 2), modo: 'juntar', apartado: 0, categoria: 'Salud' },
    ],
    apartes: {},  // { [inicioCiclo]: { [idPasajero]: monto apartado ese ciclo } }
    atajos: [],
    pagados: {},
    deuda: { nombre: 'CMR', saldo: 0, cuotaMensual: 0, pagos: [] },
  };
}

const lista = (v, def) => (Array.isArray(v) ? v : def);
const objeto = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** Lleva cualquier respaldo (v1, v2 o v3) al formato actual sin perder datos. */
function normalizar(d) {
  const base = estadoInicial();
  if (!d || typeof d !== 'object') return base;
  const version = Number(d.version) || 1;
  const s = {
    ...base,
    ...d,
    config: { ...base.config, ...objeto(d.config) },
    fijos: lista(d.fijos, base.fijos),
    gastos: lista(d.gastos, []),
    ingresos: lista(d.ingresos, []),
    fondos: lista(d.fondos, base.fondos),
    pasajeros: lista(d.pasajeros, version < 3 ? [] : base.pasajeros),
    apartes: objeto(d.apartes),
    atajos: lista(d.atajos, []),
    pagados: objeto(d.pagados),
    deuda: { ...base.deuda, ...objeto(d.deuda), pagos: lista(d.deuda?.pagos, []) },
  };
  const c = s.config;
  if (!Array.isArray(c.categorias)) c.categorias = [...CATEGORIAS];
  c.iconos = { ...(version < 3 ? ICONOS : {}), ...objeto(d.config?.iconos) };
  if (!['auto', 'claro', 'oscuro'].includes(c.tema)) c.tema = 'auto';
  if (!c.descartados || !Array.isArray(c.descartados.ids)) c.descartados = { fecha: '', ids: [] };
  if (!Array.isArray(c.sugerenciasNo)) c.sugerenciasNo = [];

  if (version < 3) {
    migrarReservas(s);
    c.bienvenida = true; // ya venía usando la app
  }

  s.pasajeros.forEach((p) => {
    p.monto = toInt(p.monto);
    p.cadaMeses = Math.max(1, toInt(p.cadaMeses) || 1);
    p.apartado = Number(p.apartado) || 0;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.proxima || '')) p.proxima = hoyISO();
    if (p.modo !== 'mes') p.modo = 'juntar';
  });
  s.atajos.forEach((a) => { a.monto = toInt(a.monto); a.fondo = a.fondo || null; });
  s.version = VERSION_DATOS;
  return s;
}

/**
 * v1/v2 → v3: los fijos "reserva" (pastillas propias: $20.000 al mes a un fondo)
 * pasan a gastos de vez en cuando ($60.000 cada 3 meses). El disponible del ciclo
 * actual no cambia: lo que antes era fijo ahora se aparta como pasajero.
 */
function migrarReservas(s) {
  const ciclo = cicloDe(hoyISO(), s.config.diaPago);
  const marcados = s.pagados[ciclo.inicio] || [];
  const reservas = s.fijos.filter((f) => f.tipo === 'reserva');
  reservas.forEach((f) => {
    const fondo = s.fondos.find((x) => x.id === f.fondo);
    const propio = fondo && !['viaje', 'imprev'].includes(fondo.id) && reservas.filter((r) => r.fondo === fondo.id).length === 1;
    const mensual = toInt(f.monto);
    const meta = (propio && toInt(fondo.meta)) || mensual * 3;
    let apartado = propio ? Number(fondo.saldo) || 0 : 0;
    // Si este ciclo aún no lo marcabas, ahora se aparta solo.
    if (!marcados.includes(f.id) || !propio) apartado += mensual;
    const falta = meta - apartado;
    const ciclosQueFaltan = falta > 0 && mensual > 0 ? Math.ceil(falta / mensual) : 0;
    const id = s.pasajeros.some((p) => p.id === f.id) ? uid() : f.id;
    s.pasajeros.push({
      id,
      nombre: f.nombre,
      monto: meta,
      cadaMeses: Math.max(1, Math.round(meta / Math.max(1, mensual))),
      proxima: sumarMeses(ciclo.inicio, ciclosQueFaltan),
      modo: 'juntar',
      apartado,
      categoria: s.config.categorias.includes('Salud') ? 'Salud' : (s.config.categorias[0] || 'Otros'),
    });
    (s.apartes[ciclo.inicio] ||= {})[id] = mensual;
    if (propio) {
      s.gastos.forEach((g) => { if (g.fondo === fondo.id) { g.fondo = null; g.pasajero = id; } });
      s.atajos.forEach((a) => { if (a.fondo === fondo.id) a.fondo = null; });
      s.fondos = s.fondos.filter((x) => x !== fondo);
    }
  });
  s.fijos = s.fijos.filter((f) => f.tipo !== 'reserva');
}

let datosIlegibles = false;

function cargar() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        return normalizar(JSON.parse(raw));
      } catch (e) {
        // Nunca pisar datos que no se pudieron leer: se guardan aparte.
        datosIlegibles = true;
        try { localStorage.setItem(`${KEY}:ilegible:${Date.now()}`, raw); } catch {}
        console.warn('No se pudieron leer los datos guardados', e);
      }
    }
  } catch (e) {
    console.warn('No se pudo abrir el almacenamiento', e);
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
  ensureCiclo();
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
const pasajeroPorId = (id) => S.pasajeros.find((p) => p.id === id);
const esHormiga = (g) => toInt(g.monto) < toInt(S.config.umbralHormiga);
const pagadosDe = (ciclo) => S.pagados[ciclo.inicio] || [];
/** Solo los gastos del día a día (sin fondo ni pasajero) cuentan para el tope. */
const delPresupuesto = (g) => !g.fondo && !g.pasajero;
const iconoDe = (cat) => S.config.iconos?.[cat] || '';

function moverFondo(id, delta) {
  const f = fondoPorId(id);
  if (f) f.saldo = (Number(f.saldo) || 0) + delta;
}

function cuotaDe(ciclo) {
  const pagada = pagadosDe(ciclo).includes('cmr');
  return (Number(S.deuda.saldo) > 0 || pagada) ? toInt(S.deuda.cuotaMensual) : 0;
}

/** Cuántos ciclos quedan, contando el actual, hasta el ciclo en que toca pagar. */
function ciclosHasta(ciclo, fecha) {
  let c = ciclo, n = 1;
  while (fecha > c.fin && n < 120) { c = siguienteCiclo(c); n += 1; }
  return n;
}

/** Cuánto apartar este ciclo para un gasto de vez en cuando. */
function cuotaPara(p, ciclo) {
  const falta = toInt(p.monto) - (Number(p.apartado) || 0);
  if (falta <= 0) return 0;
  const n = ciclosHasta(ciclo, p.proxima);
  if (p.modo === 'mes') return n === 1 ? falta : 0;
  return Math.ceil(falta / n);
}

/** Al empezar un ciclo (o al crear un pasajero), aparta su cuota una sola vez. */
function ensureCiclo() {
  const ciclo = cicloActual();
  const reg = S.apartes[ciclo.inicio] ||= {};
  let cambio = false;
  S.pasajeros.forEach((p) => {
    if (reg[p.id] !== undefined) return;
    const c = cuotaPara(p, ciclo);
    reg[p.id] = c;
    p.apartado = (Number(p.apartado) || 0) + c;
    cambio = true;
  });
  return cambio;
}

/** Devuelve lo apartado este ciclo (de uno o de todos) para volver a calcularlo. */
function quitarApartes(pid = null) {
  const reg = S.apartes[cicloActual().inicio];
  if (!reg) return;
  Object.keys(reg).forEach((id) => {
    if (pid && id !== pid) return;
    const p = pasajeroPorId(id);
    if (p) p.apartado -= reg[id];
    delete reg[id];
  });
}

function recalcOc(pid = null) {
  quitarApartes(pid);
  ensureCiclo();
}

function calcular(iso = hoyISO()) {
  const ciclo = cicloDe(iso, S.config.diaPago);
  const enCiclo = (x) => x.fecha >= ciclo.inicio && x.fecha <= ciclo.fin;

  const extras = sum(S.ingresos.filter(enCiclo));
  const fijos = sum(S.fijos);
  const ahorro = toInt(S.config.metaAhorro);
  const cuota = cuotaDe(ciclo);
  const pasajeros = sum(Object.values(S.apartes[ciclo.inicio] || {}), (x) => x);
  const ingreso = toInt(S.config.ingreso);
  const disponible = ingreso + extras - fijos - ahorro - cuota - pasajeros;

  const delDia = S.gastos.filter((g) => delPresupuesto(g) && enCiclo(g));
  const antes = sum(delDia.filter((g) => g.fecha < iso));
  const gastadoHoy = sum(delDia.filter((g) => g.fecha === iso));
  const restantes = difDias(iso, ciclo.fin) + 1;
  const tope = Math.floor((disponible - antes) / restantes);
  const queda = tope - gastadoHoy;
  const gastadoCiclo = sum(delDia);

  let estado = 'ok';
  if (queda < 0) estado = 'mal';
  else if (tope <= 0 || queda < tope * 0.25) estado = 'ojo';

  return { iso, ciclo, ingreso, extras, fijos, ahorro, cuota, pasajeros, disponible, antes, gastadoHoy, restantes, tope, queda, gastadoCiclo, estado };
}

function diasSinRespaldo() {
  const base = S.config.ultimoRespaldo || S.config.creado || Date.now();
  return Math.floor((Date.now() - base) / DIA);
}

/** Días seguidos (hasta ayer) en que lo gastado no pasó el tope del día. */
function racha(r) {
  const primerGasto = S.gastos.reduce((m, g) => (g.fecha < m ? g.fecha : m), r.iso);
  const creado = hoyISO(new Date(S.config.creado || Date.now()));
  const inicio = primerGasto < creado ? primerGasto : creado;
  let n = 0;
  for (let i = 1; i <= 120; i++) {
    const d = addDias(r.iso, -i);
    if (d < inicio) break;
    const c = calcular(d);
    if (c.gastadoHoy > Math.max(0, c.tope)) break;
    n += 1;
  }
  return n;
}

/* ---------- Render ---------- */

const ui = {
  prevQueda: null,
  prevRing: 0,
  semanaSel: 6,
  mesModo: 'cat',
  prevSeg: 0,
  catAbierta: null,
  pagosModo: 'fijos',
  prevSegPagos: 0,
  pendAbierto: false,
  ajAbiertos: new Set(),
  paso: 0,
  scroll: {},
  vista: null,
  installEvt: null,
};

function render(opts = {}) {
  if (ensureCiclo()) guardar();
  aplicarTema();
  const r = calcular();
  renderHoy(r);
  renderMes(r);
  renderPagos(r);
  renderMetas(r);
  // Ajustes y la bienvenida se re-dibujan solo cuando no estás escribiendo en ellos.
  const activo = document.activeElement;
  const escribiendo = (sel) => activo && activo.closest(sel) && activo.matches('input, select, textarea');
  if (opts.ajustes && !escribiendo('#view-ajustes')) renderAjustes();
  if (opts.ajustes && $('#sheet-bienvenida').open && !escribiendo('#sheet-bienvenida')) renderBienvenida();
  observarTitulo();
}

const inicial = (txt) => esc((String(txt || '?').trim()[0] || '?').toUpperCase());
const avatarCat = (cat, clase = '') => {
  const ico = iconoDe(cat);
  return `<span class="avatar ${clase} ${ico ? 'emoji' : ''}" aria-hidden="true">${ico ? esc(ico) : inicial(cat)}</span>`;
};

function filaGasto(g, { swipe = true, conFecha = false } = {}) {
  const tags = [];
  if (g.pasajero) tags.push(`<span class="tag">${esc(pasajeroPorId(g.pasajero)?.nombre || 'De vez en cuando')}</span>`);
  else if (g.fondo) tags.push(`<span class="tag">${esc(nombreFondo(g.fondo) || 'Fondo')}</span>`);
  else if (g.imprevisto) tags.push('<span class="tag">Imprevisto</span>');
  if (esHormiga(g)) tags.push('<span class="tag">Hormiga</span>');
  const sub = [conFecha ? corta(g.fecha) : hora(g.ts), g.nota].filter(Boolean).map(esc).join(' – ');
  const aparte = g.fondo || g.pasajero;
  return `
    <li class="${swipe ? 'swipe' : ''}">
      ${swipe ? `<button class="swipe-del" type="button" data-action="borrar-gasto-id" data-id="${esc(g.id)}" tabindex="-1" aria-hidden="true">Borrar</button>` : ''}
      <button class="row" type="button" data-action="editar-gasto" data-id="${esc(g.id)}" aria-label="Editar ${esc(g.categoria)}, ${money(g.monto)}${g.nota ? `, ${esc(g.nota)}` : ''}">
        ${avatarCat(g.categoria, aparte ? 'fund' : '')}
        <span class="row-main">
          <span class="row-title"><span class="txt">${esc(g.categoria)}</span>${tags.join('')}</span>
          ${sub ? `<span class="row-sub">${sub}</span>` : ''}
        </span>
        <span class="row-amount ${aparte ? 'muted' : ''}">${money(g.monto)}</span>
      </button>
    </li>`;
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

/* Avisos de Hoy: se juntan en una sola tarjeta "Pendientes". */

function descartadoHoy(id) {
  const d = S.config.descartados;
  return d.fecha === hoyISO() && d.ids.includes(id);
}

function avisosHoy(r) {
  const avisos = [];
  S.pasajeros
    .filter((p) => p.proxima <= r.ciclo.fin)
    .forEach((p) => {
      const apartado = Math.max(0, p.apartado);
      avisos.push({
        id: `pas:${p.id}:${p.proxima}`,
        texto: `Este mes toca <strong>${esc(p.nombre)}</strong> (${money(p.monto)}). Tienes ${money(apartado)} apartados.`,
        accion: { label: 'Lo pagué', action: 'pagar-pas', id: p.id },
      });
    });
  const imprev = fondoPorId('imprev');
  const aviso = toInt(S.config.avisoImprevistos);
  if (imprev && aviso && imprev.saldo < aviso) {
    avisos.push({
      id: 'imprev',
      texto: `Imprevistos tiene ${money(imprev.saldo)}, menos de los ${money(aviso)} que te propusiste.`,
      accion: { label: 'Ver fondos', href: '#metas' },
    });
  }
  const dias = diasSinRespaldo();
  if (dias > 7) {
    avisos.push({
      id: 'respaldo',
      texto: S.config.ultimoRespaldo
        ? `Hace ${dias} días que no respaldas. Si el teléfono borra datos, el respaldo los trae de vuelta.`
        : 'Aún no tienes un respaldo. Guárdalo en Drive o mándatelo por WhatsApp.',
      accion: { label: 'Respaldar', action: 'exportar-json' },
    });
  }
  return avisos.filter((a) => !descartadoHoy(a.id));
}

function tarjetaPendientes(r) {
  const avisos = avisosHoy(r);
  if (!avisos.length) return '';
  const visibles = ui.pendAbierto ? avisos : avisos.slice(0, 1);
  const boton = (a) => (a.accion.href
    ? `<a class="btn btn-gray btn-sm" href="${a.accion.href}">${a.accion.label}</a>`
    : `<button class="btn btn-gray btn-sm" type="button" data-action="${a.accion.action}" ${a.accion.id ? `data-id="${esc(a.accion.id)}"` : ''}>${a.accion.label}</button>`);
  return `
    <section class="card pend" aria-labelledby="pend-titulo">
      <h2 class="pend-titulo" id="pend-titulo">Pendientes${avisos.length > 1 ? ` <span class="pend-n">${avisos.length}</span>` : ''}</h2>
      <ul>
        ${visibles.map((a) => `
          <li class="pend-item">
            <p>${a.texto}</p>
            <div class="pend-actions">
              ${boton(a)}
              <button class="text-btn quiet" type="button" data-action="descartar" data-id="${esc(a.id)}">Ocultar por hoy</button>
            </div>
          </li>`).join('')}
      </ul>
      ${avisos.length > 1 ? `<button class="pend-more" type="button" data-action="pend-toggle" aria-expanded="${ui.pendAbierto}">${ui.pendAbierto ? 'Ver menos' : `Ver ${avisos.length - 1} más`}</button>` : ''}
    </section>`;
}

function seccionAtajos() {
  const atajos = S.atajos.filter((a) => toInt(a.monto) > 0);
  if (!atajos.length) return '';
  return `
    <section class="section atajos" aria-labelledby="hoy-atajos">
      <div class="section-head">
        <h2 id="hoy-atajos">Atajos</h2>
        <button class="text-btn" type="button" data-action="ir-ajustes" data-sec="atajos">Editar</button>
      </div>
      <div class="atajos-row">
        ${atajos.map((a) => `
          <button class="atajo" type="button" data-action="usar-atajo" data-id="${esc(a.id)}" aria-label="Anotar ${esc(a.nota || a.categoria)}, ${money(a.monto)}">
            <span class="atajo-ico" aria-hidden="true">${esc(iconoDe(a.categoria) || inicial(a.categoria))}</span>
            <span class="atajo-txt"><span>${esc(a.nota || a.categoria)}</span><strong>${money(a.monto)}</strong></span>
          </button>`).join('')}
      </div>
    </section>`;
}

function renderHoy(r) {
  const el = $('#view-hoy');
  const deHoy = S.gastos.filter((g) => g.fecha === r.iso).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const pct = r.tope > 0 ? clamp01(r.gastadoHoy / r.tope) : (r.gastadoHoy > 0 || r.tope < 0 ? 1 : 0);
  const estadoTxt = { ok: 'Vas bien', ojo: 'Queda poco', mal: 'Pasaste el tope' }[r.estado];

  let frase;
  if (r.disponible - r.antes < 0) frase = `Este ciclo ya usaste ${money(r.antes - r.disponible)} más que el disponible. Un ingreso extra o un fondo pueden ayudar.`;
  else if (r.estado === 'mal') frase = `Usaste ${money(-r.queda)} más que el tope de hoy. Los próximos días se ajustan solos.`;
  else if (r.estado === 'ojo') frase = 'Te queda menos de un cuarto del tope de hoy.';
  else frase = 'Lo que no gastes hoy se reparte en los días que quedan.';

  el.innerHTML = `
    <p class="title-date">${larga(r.iso)}</p>
    <h1 class="large-title" id="hoy-titulo" data-title="Hoy">Hoy</h1>

    <div class="card hero estado-${r.estado}">
      <div class="hero-top">
        <div>
          <p class="hero-label" id="hero-label">Hoy te quedan</p>
          <p class="hero-num" id="hero-num" aria-live="polite" aria-describedby="hero-label">${money(r.queda)}</p>
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

    ${tarjetaPendientes(r)}
    ${seccionAtajos()}

    <section class="section" aria-labelledby="hoy-lista">
      <div class="section-head">
        <h2 id="hoy-lista">Gastos de hoy</h2>
        ${deHoy.length ? `<span class="meta">${money(sum(deHoy))}</span>` : ''}
      </div>
      ${deHoy.length
        ? `<ul class="list">${deHoy.map((g) => filaGasto(g)).join('')}</ul>
           <p class="hint">Toca un gasto para cambiarlo. También puedes deslizarlo a la izquierda para borrarlo.</p>`
        : `<p class="empty">Todavía no anotas nada hoy. Cuando compres algo, toca <strong>Agregar gasto</strong>: son tres toques.</p>`}
    </section>

    <section class="section" aria-labelledby="sem-titulo">
      <div class="section-head"><h2 id="sem-titulo">Últimos 7 días</h2></div>
      <div class="card chart" id="semana"></div>
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
  const datos = dias.map((d) => { const c = d === r.iso ? r : calcular(d); return { d, gasto: c.gastadoHoy, tope: Math.max(0, c.tope) }; });
  const max = Math.max(...datos.map((x) => Math.max(x.gasto, x.tope)), 1) * 1.08;
  const sel = ui.semanaSel;
  const x = datos[sel];
  const nombreDia = sel === 6 ? 'Hoy' : sel === 5 ? 'Ayer' : fmtSemana.format(new Date(msDe(x.d)));
  const n = racha(r);
  const hayHistoria = S.gastos.some((g) => g.fecha < r.iso);
  let rachaTxt = '';
  if (n >= 2) rachaTxt = `Llevas <strong>${n} días seguidos</strong> dentro del tope.`;
  else if (n === 1) rachaTxt = 'Ayer cerraste dentro del tope.';
  else if (hayHistoria) rachaTxt = 'Cada día parte de cero: hoy es buen día para empezar una racha.';

  box.innerHTML = `
    <div class="chart-detail">
      <span class="d">${nombreDia}</span>
      <span class="n">${money(x.gasto)}<small> de ${money(x.tope)}</small></span>
    </div>
    <div class="plot">
      ${datos.map((v, i) => `
        <button class="col ${i === sel ? 'sel' : ''} ${v.gasto > v.tope ? 'over' : ''}" type="button"
          data-action="dia-semana" data-i="${i}" aria-pressed="${i === sel}" aria-label="${larga(v.d)}: gastaste ${money(v.gasto)}, tope ${money(v.tope)}">
          <span class="v" style="height:${(v.gasto / max) * 100}%"></span>
          ${v.tope ? `<span class="tick" style="bottom:${(v.tope / max) * 100}%"></span>` : ''}
        </button>`).join('')}
    </div>
    <div class="days" aria-hidden="true">${dias.map((d, i) => `<span class="${i === sel ? 'sel' : ''}">${fmtInicial.format(new Date(msDe(d))).toUpperCase()}</span>`).join('')}</div>
    <p class="chart-legend"><span class="tick-key" aria-hidden="true"></span>Tope de cada día${rachaTxt ? `<span class="racha">${rachaTxt}</span>` : ''}</p>`;
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
  const prevGastos = S.gastos.filter((g) => delPresupuesto(g) && g.fecha >= prev.inicio && g.fecha <= prev.fin);
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

  const extras = S.ingresos.filter(enCiclo).sort((a, b) => b.fecha.localeCompare(a.fecha));

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
          ${avatarCat(c)}
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
    }).join('')}</ul>` : '<p class="empty">Este ciclo todavía no tiene gastos. Cuando anotes alguno, aquí vas a ver en qué se va la plata.</p>';

  const vistaDias = dias.length ? dias.map((d) => `
      <div class="section-head" style="margin-top:16px"><span class="meta">${d === r.iso ? 'Hoy' : esc(mayus(larga(d)))}</span><span class="meta">${money(sum(porDia[d]))}</span></div>
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
        : `Usaste ${money(-resto)} más que el disponible del ciclo.`}</p>
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
        ${r.pasajeros ? `<dt>Apartado para lo de vez en cuando</dt><dd>− ${money(r.pasajeros)}</dd>` : ''}
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
            <button class="icon-btn" type="button" data-action="borrar-ingreso" data-id="${esc(i.id)}" aria-label="Borrar ${esc(i.nota || 'ingreso extra')}">${ICON_X}</button>
          </div></li>`).join('')}</ul>`
        : '<p class="empty">¿Te llegó un bono? Agrégalo y se suma al disponible de este ciclo.</p>'}
    </section>`;

  const ind = $('.seg-ind', el);
  enDosFrames(() => { ind.style.transform = `translateX(${segIdx * 100}%)`; });
  ui.prevSeg = segIdx;
}

/* ---------- Pagos: fijos (todos los meses) y pasajeros (de vez en cuando) ---------- */

function renderPagos(r) {
  const el = $('#view-pagos');
  const idx = ui.pagosModo === 'fijos' ? 0 : 1;
  el.innerHTML = `
    <h1 class="large-title" id="pagos-titulo" data-title="Pagos">Pagos</h1>
    <div class="seg" role="tablist" aria-label="Tipo de pago">
      <span class="seg-ind" style="width:calc(50% - 2px);transform:translateX(${ui.prevSegPagos * 100}%)"></span>
      <button type="button" role="tab" aria-selected="${idx === 0}" data-action="pagos-modo" data-modo="fijos">Todos los meses</button>
      <button type="button" role="tab" aria-selected="${idx === 1}" data-action="pagos-modo" data-modo="pas">De vez en cuando</button>
    </div>
    ${idx === 0 ? htmlFijos(r) : htmlPasajeros(r)}`;
  const ind = $('.seg-ind', el);
  enDosFrames(() => { ind.style.transform = `translateX(${idx * 100}%)`; });
  ui.prevSegPagos = idx;
}

function htmlFijos(r) {
  const pagados = pagadosDe(r.ciclo);
  const items = S.fijos.map((f) => ({ id: f.id, nombre: f.nombre, monto: toInt(f.monto), sub: '' }));
  if (r.cuota) items.push({ id: 'cmr', nombre: `Cuota ${S.deuda.nombre}`, monto: r.cuota, sub: 'Se descuenta del saldo de la deuda' });
  const total = sum(items);
  const listos = items.filter((i) => pagados.includes(i.id));
  const pagado = sum(listos);

  if (!items.length) {
    return `<p class="empty">No tienes gastos fijos. Agrégalos en Ajustes: arriendo, internet, cuentas.</p>`;
  }
  return `
    <p class="title-sub">Ya están descontados de lo que tienes para el día a día. Márcalos a medida que los pagas.</p>
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
      <p class="hint">Para cambiar montos o agregar uno nuevo, ve a Ajustes → Gastos fijos.</p>
    </section>`;
}

/** Simula los próximos 6 ciclos: cuánto se aparta y qué toca pagar en cada uno. */
function lineaDeTiempo() {
  let c = cicloActual();
  const reg = S.apartes[c.inicio] || {};
  const sim = S.pasajeros.map((p) => ({ ...p }));
  const meses = [];
  for (let i = 0; i < 6; i++) {
    let aparte = 0;
    const tocan = [];
    sim.forEach((p) => {
      const cuota = i === 0 ? (reg[p.id] || 0) : cuotaPara(p, c);
      if (i > 0) p.apartado += cuota;
      aparte += cuota;
      if (p.proxima <= c.fin) {
        tocan.push({ nombre: p.nombre, monto: p.monto });
        p.apartado -= p.monto;
        p.proxima = sumarMeses(p.proxima, p.cadaMeses);
        while (p.proxima <= c.fin) p.proxima = sumarMeses(p.proxima, p.cadaMeses);
      }
    });
    meses.push({ ciclo: c, aparte, tocan });
    c = siguienteCiclo(c);
  }
  return meses;
}

function htmlPasajeros(r) {
  const ciclo = r.ciclo;
  const reg = S.apartes[ciclo.inicio] || {};
  const lista = [...S.pasajeros].sort((a, b) => a.proxima.localeCompare(b.proxima));

  if (!lista.length) {
    return `
      <p class="title-sub">Lo que no pagas todos los meses: ropa, dentista, regalos. La app aparta un poco cada mes para que no te pille.</p>
      <div class="empty empty-cta">
        <p>Aún no tienes gastos de vez en cuando.</p>
        <button class="btn btn-primary" type="button" data-action="nuevo-pas">${ICON_PLUS}Agregar uno</button>
      </div>`;
  }

  const meses = lineaDeTiempo();
  const maxAparte = Math.max(...meses.map((m) => m.aparte), 1);

  return `
    <p class="title-sub">La app aparta un poco cada mes para que no te pillen. Este ciclo: <strong>${money(r.pasajeros)}</strong>.</p>

    <section class="section" style="margin-top:16px" aria-label="Gastos de vez en cuando">
      ${lista.map((p) => {
        const toca = p.proxima <= ciclo.fin;
        const pApartado = p.monto ? clamp01(p.apartado / p.monto) : 0;
        const cuando = toca ? 'Toca este mes' : `Próxima vez: ${mesDe(p.proxima)}${p.proxima.slice(0, 4) !== ciclo.inicio.slice(0, 4) ? ` ${p.proxima.slice(0, 4)}` : ''}`;
        const cada = p.cadaMeses === 1 ? 'todos los meses' : p.cadaMeses === 12 ? 'una vez al año' : `cada ${p.cadaMeses} meses`;
        return `
        <article class="fund pas ${toca ? 'toca' : ''}">
          <div class="fund-head">
            <div>
              <h2 class="fund-name">${esc(p.nombre)}</h2>
              <p class="fund-desc">${money(p.monto)} ${cada}. ${p.modo === 'mes' ? 'Se descuenta completo el mes que toca.' : 'Se junta de a poco.'}</p>
            </div>
            <span class="fund-pct ${toca ? 'toca' : ''}">${cuando}</span>
          </div>
          <p class="fund-saldo ${p.apartado < 0 ? 'neg' : ''}">${money(p.apartado)}<small> apartados</small></p>
          <div class="bar ${pApartado >= 1 ? 'ok' : ''}"><span style="transform: scaleX(${pApartado})"></span></div>
          <p class="fund-meta"><span>${reg[p.id] ? `Este ciclo se apartaron ${money(reg[p.id])}` : p.apartado >= p.monto ? 'Ya está todo juntado' : 'Este ciclo no se aparta nada'}</span><span>Meta ${money(p.monto)}</span></p>
          <div class="btn-row">
            <button class="btn ${toca ? 'btn-primary' : 'btn-gray'} btn-sm" type="button" data-action="pagar-pas" data-id="${esc(p.id)}">Lo pagué</button>
            <button class="btn btn-gray btn-sm" type="button" data-action="editar-pas" data-id="${esc(p.id)}">Editar</button>
          </div>
        </article>`;
      }).join('')}
      <button class="btn btn-gray btn-block add-pas" type="button" data-action="nuevo-pas">${ICON_PLUS}Agregar gasto de vez en cuando</button>
    </section>

    <section class="section" aria-labelledby="pas-tl">
      <div class="section-head"><h2 id="pas-tl">Próximos 6 meses</h2></div>
      <ol class="card timeline">
        ${meses.map((m, i) => `
          <li class="${m.tocan.length ? 'con-pago' : ''}">
            <div class="tl-mes"><strong>${mayus(i === 0 ? 'este mes' : mesDe(m.ciclo.inicio))}</strong><span>${corta(m.ciclo.inicio)}</span></div>
            <div class="tl-main">
              <div class="tl-bar" aria-hidden="true"><span style="transform: scaleX(${m.aparte / maxAparte})"></span></div>
              <p class="tl-aparte">Apartas ${money(m.aparte)}</p>
              ${m.tocan.length ? `<p class="tl-toca">Toca pagar: ${m.tocan.map((t) => `${esc(t.nombre)} ${money(t.monto)}`).join(', ')}</p>` : ''}
            </div>
          </li>`).join('')}
      </ol>
      <p class="hint">Es una estimación con los montos de hoy. Si pagas más o menos, la diferencia se reparte sola en los meses siguientes.</p>
    </section>`;
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

    ${bajo ? `<div class="notice mal"><span>Imprevistos bajó de ${money(aviso)}. Si puedes, repónlo antes de usar el resto de tus ahorros.</span></div>` : ''}

    <section class="section" style="margin-top:16px" aria-label="Fondos">
      ${S.fondos.length ? S.fondos.map((f) => {
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
            <button class="btn btn-gray btn-sm" type="button" data-action="fondo-sumar" data-id="${esc(f.id)}">+ Sumar</button>
            <button class="btn btn-gray btn-sm" type="button" data-action="fondo-sacar" data-id="${esc(f.id)}">− Sacar</button>
          </div>
        </article>`;
      }).join('') : '<p class="empty">No tienes fondos. Crea uno en Ajustes → Fondos y deuda.</p>'}
    </section>

    <section class="section" aria-labelledby="metas-deuda">
      <div class="section-head"><h2 id="metas-deuda">Deuda ${esc(d.nombre)}</h2></div>
      ${sinDeuda ? `
        <div class="fund">
          <p class="fund-desc">Si tienes deuda en la tarjeta, anota el saldo y la cuota en Ajustes. La cuota se descuenta sola cada ciclo.</p>
          <div class="btn-row"><button class="btn btn-gray btn-sm" type="button" data-action="ir-ajustes" data-sec="fondos">Anotar deuda</button></div>
        </div>` : `
        <div class="fund">
          <div class="fund-head"><p class="fund-desc">Saldo por pagar</p><span class="fund-pct">${Math.round((d.saldo <= 0 ? 1 : pDeuda) * 100)}% pagado</span></div>
          <p class="fund-saldo">${money(d.saldo)}</p>
          <div class="bar ${d.saldo <= 0 ? 'ok' : ''}"><span style="transform: scaleX(${d.saldo <= 0 ? 1 : pDeuda})"></span></div>
          <p class="fund-meta">
            <span>${d.saldo <= 0 ? 'Quedaste en cero' : meses ? `Unos ${plural(meses, 'mes', 'meses')} para quedar en cero` : 'Anota una cuota para estimar'}</span>
            <span>Cuota ${money(cuota)}</span>
          </p>
          <div class="btn-row"><button class="btn btn-gray btn-sm" type="button" data-action="pago-cmr" ${d.saldo <= 0 ? 'disabled' : ''}>Registrar pago</button></div>
        </div>`}
    </section>`;
}

/* ---------- Ajustes ---------- */

const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function campoMonto(bind, valor, label, ayuda = '') {
  return `
    <label class="setting">
      <span class="setting-label">${label}${ayuda ? `<small>${ayuda}</small>` : ''}</span>
      <input class="inline-input" type="text" inputmode="numeric" data-bind="${bind}" data-tipo="monto" value="${money(valor)}" aria-label="${esc(label)}">
    </label>`;
}

function filasFijos() {
  return `${S.fijos.map((f) => `
    <div class="fijo-row">
      <button class="minus-btn" type="button" data-action="borrar-fijo" data-id="${esc(f.id)}" aria-label="Borrar ${esc(f.nombre)}"><span>${ICON_MINUS}</span></button>
      <input class="inline-input left" type="text" data-bind="fijos.${esc(f.id)}.nombre" data-tipo="texto" value="${esc(f.nombre)}" aria-label="Nombre del fijo" maxlength="40">
      <input class="inline-input" type="text" inputmode="numeric" data-bind="fijos.${esc(f.id)}.monto" data-tipo="monto" value="${money(f.monto)}" aria-label="Monto de ${esc(f.nombre)}">
    </div>`).join('')}
    <button class="action-row strong" type="button" data-action="agregar-fijo">Agregar gasto fijo ${ICON_PLUS}</button>`;
}

function filasFondosSaldo() {
  return S.fondos.map((f) => campoMonto(`fondos.${esc(f.id)}.saldo`, Math.max(0, f.saldo), esc(f.nombre), f.meta ? `Meta ${money(f.meta)}` : '')).join('');
}

function seccionAjustes(id, titulo, resumen, contenido) {
  return `
    <details class="aj" data-sec="${id}" ${ui.ajAbiertos.has(id) ? 'open' : ''}>
      <summary>
        <span class="aj-title">${titulo}</span>
        <span class="aj-sum">${resumen}</span>
        ${ICON_CHEV}
      </summary>
      <div class="aj-body">${contenido}</div>
    </details>`;
}

function renderAjustes() {
  const el = $('#view-ajustes');
  const c = S.config;
  const dias = diasSinRespaldo();
  const respaldo = c.ultimoRespaldo
    ? (dias === 0 ? 'Último respaldo: hoy' : `Último respaldo: hace ${plural(dias, 'día', 'días')}`)
    : 'Aún no haces un respaldo';
  const opcionesCat = (sel) => c.categorias.map((cat) => `<option value="${esc(cat)}" ${cat === sel ? 'selected' : ''}>${esc(cat)}</option>`).join('');

  const presupuesto = `
    <div class="group">
      ${campoMonto('config.ingreso', c.ingreso, 'Sueldo mensual')}
      <label class="setting">
        <span class="setting-label">Día de pago<small>Si el mes es más corto, se usa el último día</small></span>
        <input class="inline-input day" type="text" inputmode="numeric" maxlength="2" data-bind="config.diaPago" data-tipo="dia" value="${toInt(c.diaPago) || 1}" aria-label="Día de pago">
      </label>
      ${campoMonto('config.metaAhorro', c.metaAhorro, 'Ahorro mensual', 'Se descuenta de lo disponible')}
      ${campoMonto('config.umbralHormiga', c.umbralHormiga, 'Gasto hormiga', 'Gastos menores a este monto')}
      ${campoMonto('config.avisoImprevistos', c.avisoImprevistos, 'Aviso de Imprevistos', 'Te aviso si el fondo baja de aquí')}
    </div>`;

  const atajos = `
    <div class="group">
      ${S.atajos.map((a) => `
        <div class="atajo-edit">
          <button class="minus-btn" type="button" data-action="borrar-atajo" data-id="${esc(a.id)}" aria-label="Borrar atajo ${esc(a.nota || a.categoria)}"><span>${ICON_MINUS}</span></button>
          <div class="atajo-edit-main">
            <input class="inline-input left" type="text" data-bind="atajos.${esc(a.id)}.nota" data-tipo="texto-libre" value="${esc(a.nota)}" placeholder="Nombre (ej: Café)" aria-label="Nombre del atajo" maxlength="30">
            <select class="mini-select" data-bind="atajos.${esc(a.id)}.categoria" data-tipo="select" aria-label="Categoría del atajo">${opcionesCat(a.categoria)}</select>
          </div>
          <input class="inline-input" type="text" inputmode="numeric" data-bind="atajos.${esc(a.id)}.monto" data-tipo="monto" value="${money(a.monto)}" aria-label="Monto del atajo">
        </div>`).join('')}
      <button class="action-row strong" type="button" data-action="agregar-atajo">Agregar atajo ${ICON_PLUS}</button>
    </div>
    <p class="hint">Un atajo anota un gasto con un solo toque desde Hoy. También puedes crearlo al anotar: abre “Fecha y más” y activa “Guardar como atajo”.</p>`;

  const categorias = `
    <div class="group">
      ${c.categorias.map((cat, i) => `
        <div class="cat-edit">
          <input class="emoji-input" type="text" data-cat-icono="${i}" value="${esc(iconoDe(cat))}" aria-label="Ícono de ${esc(cat)}" maxlength="8" autocomplete="off">
          <input class="inline-input left" type="text" data-cat-nombre="${i}" value="${esc(cat)}" aria-label="Nombre de la categoría ${esc(cat)}" maxlength="30">
          <button class="icon-btn" type="button" data-action="cat-mover" data-i="${i}" data-dir="-1" aria-label="Subir ${esc(cat)}" ${i === 0 ? 'disabled' : ''}>${ICON_UP}</button>
          <button class="icon-btn" type="button" data-action="cat-mover" data-i="${i}" data-dir="1" aria-label="Bajar ${esc(cat)}" ${i === c.categorias.length - 1 ? 'disabled' : ''}>${ICON_DOWN}</button>
          <button class="minus-btn" type="button" data-action="borrar-cat" data-i="${i}" aria-label="Quitar ${esc(cat)}"><span>${ICON_MINUS}</span></button>
        </div>`).join('')}
      <form class="add-line" id="form-cat">
        <input class="inline-input left" type="text" id="nueva-cat" placeholder="Nueva categoría" aria-label="Nueva categoría" maxlength="30" enterkeyhint="done" autocomplete="off">
        <button class="text-btn" type="submit">Agregar</button>
      </form>
    </div>
    <p class="hint">El orden de aquí es el orden en la hoja para anotar. Al renombrar una categoría, sus gastos anteriores también cambian.</p>`;

  const fondos = `
    <div class="group">
      ${S.fondos.map((f) => `
        <div class="fund-edit">
          <div class="fund-edit-head">
            <input class="inline-input left strong" type="text" data-bind="fondos.${esc(f.id)}.nombre" data-tipo="texto" value="${esc(f.nombre)}" aria-label="Nombre del fondo" maxlength="40">
            <button class="minus-btn" type="button" data-action="borrar-fondo" data-id="${esc(f.id)}" aria-label="Borrar fondo ${esc(f.nombre)}"><span>${ICON_MINUS}</span></button>
          </div>
          <label class="setting"><span class="setting-label">Saldo</span><input class="inline-input" type="text" inputmode="numeric" data-bind="fondos.${esc(f.id)}.saldo" data-tipo="monto" value="${money(Math.max(0, f.saldo))}" aria-label="Saldo de ${esc(f.nombre)}"></label>
          <label class="setting"><span class="setting-label">Meta</span><input class="inline-input" type="text" inputmode="numeric" data-bind="fondos.${esc(f.id)}.meta" data-tipo="monto" value="${money(f.meta)}" aria-label="Meta de ${esc(f.nombre)}"></label>
          <label class="setting switch-setting"><span class="setting-label">Se puede usar para pagar gastos<small>Aparece en “Se paga con” al anotar</small></span><input type="checkbox" class="switch" data-bind="fondos.${esc(f.id)}.usoGastos" data-tipo="bool" ${f.usoGastos !== false ? 'checked' : ''}></label>
        </div>`).join('')}
      <button class="action-row strong" type="button" data-action="agregar-fondo">Crear fondo ${ICON_PLUS}</button>
    </div>
    <div class="group" style="margin-top:12px">
      ${campoMonto('deuda.saldo', S.deuda.saldo, `Deuda ${esc(S.deuda.nombre)}: saldo`)}
      ${campoMonto('deuda.cuotaMensual', S.deuda.cuotaMensual, 'Cuota mensual', 'Se descuenta de lo disponible')}
    </div>`;

  const tema = c.tema;
  const temaIdx = { auto: 0, claro: 1, oscuro: 2 }[tema];
  const apariencia = `
    <div class="seg seg-3" role="radiogroup" aria-label="Tema">
      <span class="seg-ind" style="width:calc(33.333% - 1.33px);transform:translateX(${temaIdx * 100}%)"></span>
      <button type="button" role="radio" aria-checked="${tema === 'auto'}" data-action="tema" data-tema="auto">Automático</button>
      <button type="button" role="radio" aria-checked="${tema === 'claro'}" data-action="tema" data-tema="claro">Claro</button>
      <button type="button" role="radio" aria-checked="${tema === 'oscuro'}" data-action="tema" data-tema="oscuro">Oscuro</button>
    </div>
    <p class="hint">Automático sigue el modo claro u oscuro de tu teléfono.</p>`;

  const ios = esIOS();
  const instalar = instalada() ? '' : seccionAjustes('instalar', 'Instalar en el teléfono', '', `
    <div class="group install">
      ${ui.installEvt ? '<button class="action-row strong" type="button" data-action="instalar">Instalar Mis Lucas ' + ICON_CHEV + '</button>' : ''}
      ${ios ? `
        <ol class="pasos">
          <li>Ábrela en <strong>Safari</strong> (no funciona desde otras apps).</li>
          <li>Toca el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</li>
          <li>Elige <strong>Agregar a inicio</strong> y luego <strong>Agregar</strong>.</li>
        </ol>` : `
        <ol class="pasos">
          <li>Ábrela en <strong>Chrome</strong>.</li>
          <li>Toca el menú <strong>⋮</strong> arriba a la derecha.</li>
          <li>Elige <strong>Instalar app</strong> o <strong>Agregar a la pantalla principal</strong>.</li>
        </ol>`}
    </div>
    <p class="hint">Una vez instalada funciona sin internet y se abre como cualquier app.</p>`);

  const respaldoSec = `
    <div class="group">
      <button class="action-row strong" type="button" data-action="exportar-json">Exportar respaldo ${ICON_CHEV}</button>
      <button class="action-row" type="button" data-action="importar-json">Importar respaldo ${ICON_CHEV}</button>
      <button class="action-row" type="button" data-action="exportar-csv">Exportar gastos en CSV ${ICON_CHEV}</button>
    </div>
    <p class="hint">Guarda el archivo en Drive o mándatelo por WhatsApp. Si cambias de teléfono, lo importas y listo.</p>`;

  el.innerHTML = `
    <h1 class="large-title" id="ajustes-titulo" data-title="Ajustes">Ajustes</h1>
    <p class="title-sub">Todo se guarda solo, y solo en este teléfono.</p>

    <div class="aj-list">
      ${seccionAjustes('pres', 'Presupuesto', `${money(c.ingreso)}, día ${toInt(c.diaPago) || 1}`, presupuesto)}
      ${seccionAjustes('atajos', 'Atajos', S.atajos.length ? plural(S.atajos.length, 'atajo', 'atajos') : 'Ninguno', atajos)}
      ${seccionAjustes('cats', 'Categorías', plural(c.categorias.length, 'categoría', 'categorías'), categorias)}
      ${seccionAjustes('fijos', 'Gastos fijos', `${money(sum(S.fijos))} al mes`, `<div class="group">${filasFijos()}</div>`)}
      ${seccionAjustes('fondos', 'Fondos y deuda', plural(S.fondos.length, 'fondo', 'fondos'), fondos)}
      ${seccionAjustes('apariencia', 'Apariencia', { auto: 'Automático', claro: 'Claro', oscuro: 'Oscuro' }[tema], apariencia)}
      ${instalar}
      ${seccionAjustes('respaldo', 'Respaldo', respaldo, respaldoSec)}
    </div>

    <section class="section">
      <div class="group">
        <button class="action-row" type="button" data-action="bienvenida">Repetir la configuración guiada ${ICON_CHEV}</button>
        <button class="action-row danger" type="button" data-action="reset">Borrar todos los datos</button>
      </div>
    </section>

    <p class="foot-note">Mis Lucas no envía tus datos a ningún lado: todo queda en este teléfono.</p>`;

  $$('.seg-ind', el).forEach((ind) => { ind.style.transform = `translateX(${temaIdx * 100}%)`; });
}

/* ---------- Tema ---------- */

function aplicarTema() {
  const t = S.config.tema;
  const root = document.documentElement;
  if (t === 'claro') root.dataset.theme = 'light';
  else if (t === 'oscuro') root.dataset.theme = 'dark';
  else delete root.dataset.theme;
  // La barra de estado del teléfono sigue al tema elegido.
  const oscuro = t === 'oscuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $$('meta[name="theme-color"]').forEach((m) => {
    if (t === 'auto') m.content = m.media.includes('dark') ? '#000000' : '#F2F2F7';
    else m.content = oscuro ? '#000000' : '#F2F2F7';
  });
}

/* ---------- Navegación ---------- */

const VISTAS = ['hoy', 'mes', 'pagos', 'metas', 'ajustes'];
const ALIAS = { fijos: ['pagos', 'fijos'], pasajeros: ['pagos', 'pas'] };

function vistaActual() {
  const h = location.hash.slice(1);
  if (ALIAS[h]) return ALIAS[h][0];
  return VISTAS.includes(h) ? h : 'hoy';
}

function mostrarVista() {
  const h = location.hash.slice(1);
  if (ALIAS[h]) {
    ui.pagosModo = ALIAS[h][1];
    history.replaceState(null, '', '#pagos');
    renderPagos(calcular());
  }
  const v = vistaActual();
  // Cada pestaña recuerda dónde quedaste.
  if (ui.vista && ui.vista !== v) ui.scroll[ui.vista] = window.scrollY;
  VISTAS.forEach((n) => { $(`#view-${n}`).hidden = n !== v; });
  $$('.tabbar a').forEach((a) => {
    if (a.dataset.tab === v) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.body.classList.toggle('con-fab', v === 'hoy');
  if (v === 'ajustes') renderAjustes();
  const y = ui.vista === v ? window.scrollY : (ui.scroll[v] || 0);
  ui.vista = v;
  window.scrollTo(0, y);
  observarTitulo();
}

function irAjustes(sec) {
  ui.ajAbiertos.add(sec);
  ui.scroll.ajustes = 0;
  if (location.hash === '#ajustes') renderAjustes();
  else location.hash = '#ajustes';
  setTimeout(() => $(`details.aj[data-sec="${sec}"]`)?.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' }), 80);
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

let ultimoOrigen = null; // botón que abrió la hoja, para devolverle el foco

function abrirSheet(d) {
  if (d.open) return;
  d._origen = ultimoOrigen || document.activeElement;
  d.classList.remove('closing');
  d.showModal();
  document.documentElement.classList.add('sheet-abierta');
  enDosFrames(() => { if (d.open && !d.classList.contains('closing')) d.classList.add('open'); });
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
    if (!$$('dialog.sheet').some((x) => x.open)) document.documentElement.classList.remove('sheet-abierta');
    // El foco vuelve al botón que abrió la hoja (o al botón principal si ya no existe).
    const origen = d._origen && d._origen.isConnected ? d._origen : (vistaActual() === 'hoy' ? $('#btn-add') : null);
    origen?.focus?.({ preventScroll: true });
    d._origen = null;
  };
  panel.addEventListener('transitionend', fin, { once: true });
  setTimeout(fin, 300);
}

$$('dialog.sheet').forEach((d) => {
  d.addEventListener('cancel', (e) => { e.preventDefault(); if (d.id !== 'sheet-bienvenida') cerrarSheet(d); });
  d.addEventListener('click', (e) => { if (e.target === d && d.id !== 'sheet-bienvenida') cerrarSheet(d); });
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
    if (dy > panel.offsetHeight * 0.25 || (dy > 24 && vel > 0.5)) cerrarSheet(d);
    else panel.style.transform = '';
  };

  $$('[data-drag]', d).forEach((h) => {
    h.addEventListener('pointerdown', (e) => {
      if (arrastrando || e.target.closest('button, input, a')) return;
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

function categoriaInicial() {
  const cats = S.config.categorias;
  return cats.includes(S.config.ultimaCategoria) ? S.config.ultimaCategoria : cats[0] || 'Otros';
}

function abrirGasto(g = null, preset = {}) {
  const hoy = hoyISO();
  draft = g
    ? { id: g.id, monto: String(g.monto), categoria: g.categoria, nota: g.nota || '', imprevisto: !!g.imprevisto, fondo: g.fondo || null, pasajero: g.pasajero || null, fecha: g.fecha, comoAtajo: false }
    : { id: null, monto: '', nota: '', imprevisto: false, fondo: null, pasajero: null, fecha: hoy, categoria: categoriaInicial(), comoAtajo: false, ...preset };
  draft.fechaOtra = draft.fecha !== hoy && draft.fecha !== addDias(hoy, -1);
  $('#g-titulo').textContent = g ? 'Editar gasto' : 'Nuevo gasto';
  $('#g-borrar').hidden = !g;
  $('#g-atajo-row').hidden = !!g;
  $('#g-nota').value = draft.nota;
  $('#g-fecha').value = draft.fecha;
  $('#g-fecha').max = hoy;
  $('#g-mas').open = !!(draft.imprevisto || draft.fondo || draft.pasajero || draft.fecha !== hoy);
  pintarGasto();
  $('.sheet-body', $('#sheet-gasto')).scrollTop = 0;
  abrirSheet($('#sheet-gasto'));
  // La categoría marcada queda a la vista.
  requestAnimationFrame(() => $('#g-cats [aria-checked="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' }));
}

function pintarGasto() {
  const m = toInt(draft.monto);
  const hoy = hoyISO();
  const out = $('#g-monto');
  out.textContent = money(m);
  out.classList.toggle('vacio', !m);

  let hint = 'Sale de tu presupuesto del día';
  if (draft.pasajero) {
    const p = pasajeroPorId(draft.pasajero);
    hint = `Sale de lo apartado para ${p?.nombre || 'un gasto de vez en cuando'}`;
  } else if (draft.fondo) {
    const f = fondoPorId(draft.fondo);
    const original = draft.id ? S.gastos.find((x) => x.id === draft.id) : null;
    const devuelto = original && original.fondo === draft.fondo ? toInt(original.monto) : 0;
    hint = f ? `Sale de ${f.nombre}: quedarían ${money(f.saldo + devuelto - m)}` : 'Sale de un fondo';
  }
  if (m && m < toInt(S.config.umbralHormiga)) hint += ' (hormiga)';
  $('#g-hint').textContent = hint;

  const cats = [...S.config.categorias];
  if (draft.categoria && !cats.includes(draft.categoria)) cats.push(draft.categoria);
  $('#g-cats').innerHTML = cats.map((c) => {
    const ico = iconoDe(c);
    return `<button class="cat-btn" type="button" role="radio" aria-checked="${c === draft.categoria}" data-action="cat" data-cat="${esc(c)}">
      <span class="cat-ico" aria-hidden="true">${ico ? esc(ico) : inicial(c)}</span><span class="cat-name">${esc(c)}</span></button>`;
  }).join('');

  // Fecha
  const ayer = addDias(hoy, -1);
  const fechaSel = draft.fechaOtra ? 'otra' : draft.fecha === ayer ? 'ayer' : 'hoy';
  $$('#g-fechas .chip').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.fecha === fechaSel)));
  $('#g-fecha-wrap').hidden = fechaSel !== 'otra';

  // Se paga con
  $('#g-imprevisto').checked = draft.imprevisto;
  $('#g-pagocon').hidden = !!draft.pasajero;
  if (!draft.pasajero) {
    const opciones = [{ id: '', nombre: 'Mi presupuesto del día' }, ...S.fondos.filter((f) => f.usoGastos !== false || f.id === draft.fondo)];
    $('#g-fondos').innerHTML = opciones.map((f) =>
      `<button class="chip" type="button" role="radio" aria-checked="${(draft.fondo || '') === f.id}" data-action="fondo-gasto" data-fondo="${esc(f.id)}">${esc(f.nombre)}</button>`).join('');
  }
  $('#g-atajo').checked = !!draft.comoAtajo;

  // Resumen de "Fecha y más" para ver lo elegido sin abrirlo.
  const res = [];
  if (fechaSel === 'ayer') res.push('Ayer');
  else if (fechaSel === 'otra') res.push(corta(draft.fecha));
  if (draft.pasajero) res.push(pasajeroPorId(draft.pasajero)?.nombre || 'Apartado');
  else if (draft.fondo) res.push(nombreFondo(draft.fondo));
  if (draft.imprevisto) res.push('Imprevisto');
  if (draft.comoAtajo) res.push('Atajo');
  $('#g-mas-sum').textContent = res.join(', ');
}

function tecla(k) {
  let m = draft.monto;
  if (k === 'back') m = m.slice(0, -1);
  else if (k === '000') { if (m) m += '000'; }
  else m += k;
  draft.monto = m.replace(/^0+/, '').slice(0, 9);
  vibrar(8);
  pintarGasto();
}

/* Mantener apretado ⌫ borra todo el monto. */
let borrarTodoTimer = null;
let borradoLargo = false;
$('.keypad').addEventListener('pointerdown', (e) => {
  if (!e.target.closest('[data-k="back"]')) return;
  borradoLargo = false;
  clearTimeout(borrarTodoTimer);
  borrarTodoTimer = setTimeout(() => {
    borradoLargo = true;
    if (draft && draft.monto) { draft.monto = ''; vibrar(20); pintarGasto(); }
  }, 450);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => $('.keypad').addEventListener(t, () => clearTimeout(borrarTodoTimer)));
$('.keypad').addEventListener('contextmenu', (e) => e.preventDefault());

function sacudirMonto(texto) {
  $('#g-monto').animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
    { duration: 260, easing: 'ease-out' },
  );
  $('#g-hint').textContent = texto;
}

function guardarGasto() {
  const monto = toInt(draft.monto);
  if (!monto) { sacudirMonto('Escribe un monto con el teclado.'); return; }
  draft.nota = $('#g-nota').value.trim();
  const hoy = hoyISO();
  const fecha = draft.fecha && draft.fecha <= hoy ? draft.fecha : hoy;
  let nuevo = null;

  if (draft.id) {
    const g = S.gastos.find((x) => x.id === draft.id);
    if (g) {
      if (g.fondo) moverFondo(g.fondo, toInt(g.monto)); // devolver lo anterior
      if (g.pasajero) { const p = pasajeroPorId(g.pasajero); if (p) p.apartado += toInt(g.monto) - monto; }
      Object.assign(g, { monto, categoria: draft.categoria, nota: draft.nota, imprevisto: draft.imprevisto, fondo: g.pasajero ? null : (draft.fondo || null), fecha });
      if (g.fondo) moverFondo(g.fondo, -monto);
    }
  } else {
    nuevo = { id: uid(), fecha, ts: Date.now(), monto, categoria: draft.categoria, nota: draft.nota, imprevisto: draft.imprevisto, fondo: draft.fondo || null };
    S.gastos.push(nuevo);
    if (nuevo.fondo) moverFondo(nuevo.fondo, -monto);
    if (draft.comoAtajo) S.atajos.push({ id: uid(), monto, categoria: draft.categoria, nota: draft.nota, fondo: draft.fondo || null });
  }
  S.config.ultimaCategoria = draft.categoria;
  ui.semanaSel = 6;
  guardar();
  cerrarSheet($('#sheet-gasto'));
  vibrar(8);
  render({ ajustes: true });
  if (draft.id) toast('Gasto actualizado');
  else if (draft.comoAtajo) toast(`Anotado y guardado como atajo`);
  else if (!sugerirAtajo(nuevo)) toast(`${money(monto)} en ${draft.categoria}`);
}

function borrarGasto(id) {
  const g = S.gastos.find((x) => x.id === id);
  if (!g) return;
  if ($('#sheet-gasto').open) cerrarSheet($('#sheet-gasto'));
  filaAbierta = null;
  const p = g.pasajero ? pasajeroPorId(g.pasajero) : null;
  const msg = g.fondo
    ? `Borrado. ${money(g.monto)} volvieron a ${nombreFondo(g.fondo)}`
    : p ? `Borrado. ${money(g.monto)} volvieron a lo apartado para ${p.nombre}` : 'Gasto borrado';
  conDeshacer(msg, () => {
    if (g.fondo) moverFondo(g.fondo, toInt(g.monto));
    if (p) p.apartado += toInt(g.monto);
    S.gastos = S.gastos.filter((x) => x.id !== id);
  });
}

/* Atajos */

const claveGasto = (g) => `${(g.nota || '').trim().toLowerCase()}|${toInt(g.monto)}|${g.categoria}`;

function usarAtajo(a) {
  const monto = toInt(a.monto);
  if (!monto) return;
  vibrar(8);
  ui.semanaSel = 6;
  conDeshacer(`${money(monto)} en ${a.nota || a.categoria}`, () => {
    const fondo = a.fondo && fondoPorId(a.fondo) ? a.fondo : null;
    S.gastos.push({ id: uid(), fecha: hoyISO(), ts: Date.now(), monto, categoria: a.categoria, nota: a.nota || '', imprevisto: false, fondo });
    if (fondo) moverFondo(fondo, -monto);
  });
}

/** Si el mismo gasto (nota y monto) se anota 3 veces, ofrece guardarlo como atajo. */
function sugerirAtajo(g) {
  if (!g || g.fondo) return false;
  const clave = claveGasto(g);
  if (S.config.sugerenciasNo.includes(clave)) return false;
  if (S.atajos.some((a) => claveGasto(a) === clave)) return false;
  const iguales = S.gastos.filter((x) => !x.pasajero && !x.fondo && claveGasto(x) === clave).length;
  if (iguales < 3) return false;
  const nombre = g.nota || g.categoria;
  toast(`Ya anotaste ${nombre} (${money(g.monto)}) ${iguales} veces. ¿Lo guardo como atajo?`, {
    label: 'Guardar',
    fn: () => {
      S.atajos.push({ id: uid(), monto: toInt(g.monto), categoria: g.categoria, nota: g.nota || '', fondo: null });
      guardar();
      render({ ajustes: true });
      toast(`Listo: ${nombre} quedó en Atajos`);
    },
  }, {
    duracion: 9000,
    alCerrar: () => { S.config.sugerenciasNo.push(clave); guardar(); },
  });
  return true;
}

$('#g-imprevisto').addEventListener('change', (e) => {
  draft.imprevisto = e.target.checked;
  if (draft.imprevisto && !draft.fondo && fondoPorId('imprev')) draft.fondo = 'imprev';
  if (!draft.imprevisto && draft.fondo === 'imprev') draft.fondo = null;
  pintarGasto();
});
$('#g-atajo').addEventListener('change', (e) => { draft.comoAtajo = e.target.checked; pintarGasto(); });
$('#g-fecha').addEventListener('change', (e) => {
  const v = e.target.value;
  if (v && v <= hoyISO()) draft.fecha = v;
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

function pedirMonto({ titulo, boton, ayuda = '', conNota = false, valor = 0, onOk }) {
  $('#m-titulo').textContent = titulo;
  $('#m-ayuda').textContent = ayuda;
  $('#m-ayuda').hidden = !ayuda;
  $('#m-input').value = valor ? miles(valor) : '';
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

/* ---------- Gastos de vez en cuando (pasajeros) ---------- */

let pasEditando = null;

function abrirPasajero(p = null) {
  pasEditando = p ? p.id : null;
  const ciclo = cicloActual();
  $('#p-titulo').textContent = p ? 'Editar' : 'Nuevo gasto de vez en cuando';
  $('#p-borrar').hidden = !p;
  $('#p-plantillas').hidden = !!p;
  $('#p-chips').innerHTML = PLANTILLAS.map((t, i) =>
    `<button class="chip" type="button" data-action="plantilla" data-i="${i}"><span aria-hidden="true">${t.icono}</span> ${esc(t.nombre)}</button>`).join('');
  $('#p-cat').innerHTML = S.config.categorias.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  const datos = p || { nombre: '', monto: 0, cadaMeses: 3, proxima: sumarMeses(ciclo.inicio, 2), modo: 'juntar', categoria: S.config.categorias.includes('Otros') ? 'Otros' : S.config.categorias[0] };
  llenarPasajero(datos);
  abrirSheet($('#sheet-pas'));
}

function llenarPasajero(d) {
  $('#p-nombre').value = d.nombre;
  $('#p-monto').value = d.monto ? miles(d.monto) : '';
  $('#p-cada').value = String(d.cadaMeses);
  if (!$('#p-cada').value) {
    $('#p-cada').insertAdjacentHTML('beforeend', `<option value="${d.cadaMeses}">Cada ${d.cadaMeses} meses</option>`);
    $('#p-cada').value = String(d.cadaMeses);
  }
  $('#p-proxima').value = d.proxima.slice(0, 7);
  $('#p-proxima').min = cicloActual().inicio.slice(0, 7);
  $$('input[name="p-modo"]').forEach((r) => { r.checked = r.value === d.modo; });
  if (d.categoria && !S.config.categorias.includes(d.categoria)) {
    $('#p-cat').insertAdjacentHTML('beforeend', `<option value="${esc(d.categoria)}">${esc(d.categoria)}</option>`);
  }
  $('#p-cat').value = d.categoria || S.config.categorias[0];
  vistaPreviaPasajero();
}

/** "Próxima vez" se elige por mes; se guarda como el día de pago de ese mes. */
function proximaDeMes(valor) {
  const [y, m] = String(valor || '').split('-').map(Number);
  if (!y || !m) return null;
  return isoDe(y, m, Math.min(toInt(S.config.diaPago) || 1, diasMes(y, m)));
}

function leerPasajero() {
  return {
    nombre: $('#p-nombre').value.trim(),
    monto: toInt($('#p-monto').value),
    cadaMeses: Math.max(1, toInt($('#p-cada').value) || 1),
    proxima: proximaDeMes($('#p-proxima').value) || cicloActual().inicio,
    modo: $('input[name="p-modo"]:checked')?.value === 'mes' ? 'mes' : 'juntar',
    categoria: $('#p-cat').value,
  };
}

function vistaPreviaPasajero() {
  const d = leerPasajero();
  const ciclo = cicloActual();
  const actual = pasEditando ? pasajeroPorId(pasEditando) : null;
  const reg = S.apartes[ciclo.inicio] || {};
  const apartado = actual ? actual.apartado - (reg[actual.id] || 0) : 0;
  const cuota = d.monto ? cuotaPara({ ...d, apartado }, ciclo) : 0;
  const n = ciclosHasta(ciclo, d.proxima);
  let txt = '';
  if (!d.monto) txt = 'Escribe cuánto cuesta y te digo cuánto apartar cada mes.';
  else if (d.modo === 'mes') txt = n === 1 ? `Toca este mes: se descuentan ${money(cuota)} de este ciclo.` : `No se aparta nada hasta ${mesDe(d.proxima)}; ese mes se descuentan ${money(Math.max(0, d.monto - apartado))}.`;
  else txt = `Vas a apartar unos <strong>${money(cuota)}</strong> por mes${n > 1 ? ` durante ${n} meses` : ''}.`;
  $('#p-calc').innerHTML = txt;
}

$('#form-pas').addEventListener('input', vistaPreviaPasajero);
$('#form-pas').addEventListener('change', vistaPreviaPasajero);
$('#p-monto').addEventListener('input', (e) => { const n = toInt(e.target.value); e.target.value = n ? miles(n) : ''; });

$('#form-pas').addEventListener('submit', (e) => {
  e.preventDefault();
  const d = leerPasajero();
  if (!d.nombre) { $('#p-nombre').focus(); return; }
  if (!d.monto) { $('#p-monto').focus(); return; }
  if (pasEditando) {
    const p = pasajeroPorId(pasEditando);
    if (p) { quitarApartes(p.id); Object.assign(p, d); }
  } else {
    S.pasajeros.push({ id: uid(), apartado: 0, ...d });
  }
  ensureCiclo();
  guardar();
  cerrarSheet($('#sheet-pas'));
  ui.pagosModo = 'pas';
  render({ ajustes: true });
  toast(pasEditando ? 'Cambios guardados' : `Listo: ${d.nombre} quedó agregado`);
});

function pagarPasajero(p) {
  const hoy = hoyISO();
  pedirMonto({
    titulo: `Pagar ${p.nombre}`,
    boton: 'Registrar pago',
    valor: p.monto,
    ayuda: `Tienes ${money(Math.max(0, p.apartado))} apartados. Si pagaste otro monto, cámbialo: la diferencia se ajusta en los próximos meses.`,
    onOk: (monto) => {
      S.gastos.push({ id: uid(), fecha: hoy, ts: Date.now(), monto, categoria: p.categoria || 'Otros', nota: p.nombre, imprevisto: false, fondo: null, pasajero: p.id });
      p.apartado -= monto;
      p.proxima = sumarMeses(p.proxima, p.cadaMeses);
      while (p.proxima <= hoy) p.proxima = sumarMeses(p.proxima, p.cadaMeses);
      const prox = `${mesDe(p.proxima)}${p.proxima.slice(0, 4) !== hoy.slice(0, 4) ? ` ${p.proxima.slice(0, 4)}` : ''}`;
      if (p.apartado < 0) toast(`Pagado. Faltaron ${money(-p.apartado)}: se recuperan de a poco. Próxima vez: ${prox}`, null, { duracion: 6000 });
      else toast(`Pagado. Próxima vez: ${prox}`);
    },
  });
}

/* ---------- Primer uso: configuración guiada ---------- */

const PASOS = [
  { titulo: 'Tu sueldo', texto: 'Cuéntame cuánto te llega al mes y qué día te pagan. Con eso calculo cuánto puedes gastar cada día.' },
  { titulo: 'Gastos fijos', texto: 'Lo que pagas todos los meses: arriendo, internet, cuentas. Ya vienen algunos; corrige lo que haga falta.' },
  { titulo: 'De vez en cuando', texto: 'Lo que no pagas todos los meses, como unas pastillas cada 3 meses o la ropa. La app aparta un poco cada mes para que no te pille.' },
  { titulo: 'Ahorros y deuda', texto: 'Lo que tienes guardado y lo que debes en la tarjeta. Si no tienes deuda, deja todo en $0.' },
];

function abrirBienvenida() {
  ui.paso = 0;
  renderBienvenida();
  abrirSheet($('#sheet-bienvenida'));
}

function renderBienvenida() {
  const paso = ui.paso;
  const c = S.config;
  $('#b-paso').textContent = `Paso ${paso + 1} de ${PASOS.length}`;
  $('#b-titulo').textContent = PASOS[paso].titulo;
  $$('#b-dots span').forEach((s, i) => s.classList.toggle('on', i <= paso));
  let cuerpo = '';
  if (paso === 0) {
    cuerpo = `
      <div class="group">
        ${campoMonto('config.ingreso', c.ingreso, 'Sueldo mensual')}
        <label class="setting">
          <span class="setting-label">Día de pago<small>Del 1 al 31</small></span>
          <input class="inline-input day" type="text" inputmode="numeric" maxlength="2" data-bind="config.diaPago" data-tipo="dia" value="${toInt(c.diaPago) || 1}" aria-label="Día de pago">
        </label>
      </div>
      <p class="hint">¿Te llega un bono? No lo pongas aquí: lo agregas el mes que llegue, en Mes → Ingresos extra.</p>`;
  } else if (paso === 1) {
    cuerpo = `<div class="group">${filasFijos()}</div><p class="hint">Total: ${money(sum(S.fijos))} al mes.</p>`;
  } else if (paso === 2) {
    cuerpo = `
      <div class="group">
        ${S.pasajeros.map((p) => `
          <div class="fijo-row">
            <button class="minus-btn" type="button" data-action="borrar-pas" data-id="${esc(p.id)}" aria-label="Quitar ${esc(p.nombre)}"><span>${ICON_MINUS}</span></button>
            <span class="fijo-main"><span class="row-title"><span class="txt">${esc(p.nombre)}</span></span><span class="row-sub">${p.cadaMeses === 12 ? 'Una vez al año' : `Cada ${plural(p.cadaMeses, 'mes', 'meses')}`}</span></span>
            <input class="inline-input" type="text" inputmode="numeric" data-bind="pasajeros.${esc(p.id)}.monto" data-tipo="monto" value="${money(p.monto)}" aria-label="Monto de ${esc(p.nombre)}">
          </div>`).join('') || '<p class="empty">Ninguno por ahora.</p>'}
      </div>
      <p class="field-label" style="margin:16px 4px 8px">Agregar con un toque</p>
      <div class="chips">${PLANTILLAS.filter((t) => !S.pasajeros.some((p) => p.nombre === t.nombre)).map((t) => `
        <button class="chip" type="button" data-action="plantilla-rapida" data-nombre="${esc(t.nombre)}"><span aria-hidden="true">${t.icono}</span> ${esc(t.nombre)}</button>`).join('')}</div>
      <p class="hint">Después puedes cambiar la frecuencia y la fecha en Pagos → De vez en cuando.</p>`;
  } else {
    cuerpo = `
      <div class="group">${filasFondosSaldo()}</div>
      <div class="group" style="margin-top:12px">
        ${campoMonto('deuda.saldo', S.deuda.saldo, `Deuda ${esc(S.deuda.nombre)}`, 'Lo que te falta pagar')}
        ${campoMonto('deuda.cuotaMensual', S.deuda.cuotaMensual, 'Cuota mensual')}
      </div>`;
  }
  $('#b-body').innerHTML = `<p class="sheet-help">${PASOS[paso].texto}</p>${cuerpo}`;
  $('#b-atras').hidden = paso === 0;
  $('#b-sig').textContent = paso === PASOS.length - 1 ? 'Empezar' : 'Siguiente';
}

function terminarBienvenida() {
  S.config.bienvenida = true;
  guardar();
  cerrarSheet($('#sheet-bienvenida'));
  setTimeout(() => { if (!$('#sheet-bienvenida').open) $('#b-body').innerHTML = ''; }, 400); // sin campos duplicados escondidos
  render({ ajustes: true });
  toast(`Listo. Hoy te quedan ${money(calcular().queda)}`);
}

/* ---------- Fijos ---------- */

function toggleFijo(id, marcado) {
  const ciclo = cicloActual();
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
  }
  if (marcado) set.add(id); else set.delete(id);
  S.pagados[ciclo.inicio] = [...set];
  if (marcado) vibrar(6);
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
  setTimeout(() => URL.revokeObjectURL(url), 60000); // los teléfonos lentos tardan en tomar el archivo
}

function exportarJSON() {
  S.config.ultimoRespaldo = Date.now();
  guardar();
  descargar(`mis-lucas-respaldo-${hoyISO()}.json`, JSON.stringify(S, null, 2), 'application/json');
  render({ ajustes: true });
  toast('Respaldo descargado. Guárdalo en Drive o mándatelo.');
}

function exportarCSV() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cab = ['fecha', 'hora', 'monto', 'categoria', 'nota', 'imprevisto', 'fondo', 'de_vez_en_cuando', 'hormiga'];
  const filas = [...S.gastos]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.ts || 0) - (b.ts || 0))
    .map((g) => [g.fecha, hora(g.ts), g.monto, g.categoria, g.nota, g.imprevisto ? 'sí' : 'no', nombreFondo(g.fondo), g.pasajero ? (pasajeroPorId(g.pasajero)?.nombre || 'sí') : '', esHormiga(g) ? 'sí' : 'no'].map(q).join(';'));
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
    toast('Ese archivo no es un respaldo de Mis Lucas. Busca uno que se llame mis-lucas-respaldo-….json');
  }
});

/* ---------- Ajustes: edición en línea con autoguardado ---------- */

let guardadoTimer = null;
function guardadoOk() {
  const el = $('#guardado');
  el.textContent = 'Guardado ✓';
  el.classList.add('show');
  clearTimeout(guardadoTimer);
  guardadoTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

function aplicarBind(input) {
  const [col, key, campo] = input.dataset.bind.split('.');
  const tipo = input.dataset.tipo;
  const item = col === 'config' ? S.config : col === 'deuda' ? S.deuda : (S[col] || []).find((x) => x.id === key);
  const prop = col === 'config' || col === 'deuda' ? key : campo;
  if (!item) return;
  let val;
  if (tipo === 'texto') {
    val = input.value.trim();
    if (!val) { input.value = item[prop]; return; }
  } else if (tipo === 'texto-libre' || tipo === 'select') {
    val = input.value.trim();
  } else if (tipo === 'bool') {
    val = input.checked;
  } else if (tipo === 'dia') {
    val = Math.min(31, Math.max(1, toInt(input.value) || 1));
    input.value = val;
  } else {
    val = toInt(input.value);
    input.value = money(val);
  }
  if (item[prop] === val) return;

  if (col === 'config' && prop === 'diaPago') {
    // Cambia el ciclo: lo apartado este ciclo se vuelve a calcular con el ciclo nuevo.
    quitarApartes();
    item[prop] = val;
    ensureCiclo();
  } else if (col === 'pasajeros') {
    item[prop] = val;
    recalcOc(item.id);
  } else {
    item[prop] = val;
  }
  guardar();
  render();
  guardadoOk();
  // Los resúmenes de Ajustes se actualizan cuando dejas de escribir.
  if (!$('#view-ajustes').hidden) setTimeout(() => {
    const a = document.activeElement;
    if (!(a && a.closest('#view-ajustes') && a.matches('input, select, textarea'))) renderAjustes();
  }, 0);
}

const primerGrafema = (s) => {
  const t = String(s || '').trim();
  if (!t) return '';
  if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(t)][0]?.segment || '';
  return [...t][0];
};

function renombrarCategoria(i, nuevo) {
  const cats = S.config.categorias;
  const viejo = cats[i];
  nuevo = nuevo.trim();
  if (!nuevo || nuevo === viejo) return false;
  if (cats.some((c, j) => j !== i && c.toLowerCase() === nuevo.toLowerCase())) { toast('Ya tienes una categoría con ese nombre'); return false; }
  cats[i] = nuevo;
  const ico = S.config.iconos[viejo];
  delete S.config.iconos[viejo];
  if (ico) S.config.iconos[nuevo] = ico;
  S.gastos.forEach((g) => { if (g.categoria === viejo) g.categoria = nuevo; });
  S.atajos.forEach((a) => { if (a.categoria === viejo) a.categoria = nuevo; });
  S.pasajeros.forEach((p) => { if (p.categoria === viejo) p.categoria = nuevo; });
  if (S.config.ultimaCategoria === viejo) S.config.ultimaCategoria = nuevo;
  return true;
}

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('[data-fijo]')) toggleFijo(t.dataset.fijo, t.checked);
  else if (t.matches('[data-bind]')) aplicarBind(t);
  else if (t.matches('[data-cat-nombre]')) {
    const i = Number(t.dataset.catNombre);
    if (renombrarCategoria(i, t.value)) { guardar(); render({ ajustes: true }); guardadoOk(); }
    else t.value = S.config.categorias[i];
  } else if (t.matches('[data-cat-icono]')) {
    const cat = S.config.categorias[Number(t.dataset.catIcono)];
    const ico = primerGrafema(t.value);
    if (ico) S.config.iconos[cat] = ico; else delete S.config.iconos[cat];
    t.value = ico;
    guardar();
    render();
    guardadoOk();
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.matches('[data-bind][data-tipo="monto"]')) {
    const n = toInt(t.value);
    t.value = n ? money(n) : '';
  }
});

// Al tocar un monto, se selecciona para escribir encima.
document.addEventListener('focusin', (e) => {
  if (e.target.matches('.inline-input[inputmode="numeric"], .emoji-input')) setTimeout(() => e.target.select(), 0);
});

// Las secciones de Ajustes recuerdan si estaban abiertas.
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (!d.matches?.('details.aj')) return;
  if (d.open) ui.ajAbiertos.add(d.dataset.sec); else ui.ajAbiertos.delete(d.dataset.sec);
}, true);

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'form-cat') return;
  e.preventDefault();
  const input = $('#nueva-cat');
  const nombre = input.value.trim();
  if (!nombre) return;
  if (S.config.categorias.some((c) => c.toLowerCase() === nombre.toLowerCase())) {
    toast('Ya tienes una categoría con ese nombre');
    return;
  }
  S.config.categorias.push(nombre);
  guardar();
  input.value = '';
  input.blur();
  renderAjustes();
  guardadoOk();
});

/* ---------- Clicks ---------- */

let resetArmado = null;

document.addEventListener('click', (e) => {
  if (ignorarClick) { e.preventDefault(); e.stopPropagation(); return; }
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled) return;
  const id = b.dataset.id;
  ultimoOrigen = b.closest('dialog') ? null : b;

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
    case 'tecla':
      if (b.dataset.k === 'back' && borradoLargo) { borradoLargo = false; break; }
      tecla(b.dataset.k);
      break;
    case 'cat':
      draft.categoria = b.dataset.cat;
      if (draft.categoria === 'Imprevisto' && !draft.imprevisto) {
        draft.imprevisto = true;
        if (!draft.fondo && !draft.pasajero && fondoPorId('imprev')) draft.fondo = 'imprev';
        $('#g-mas').open = true;
      }
      vibrar(6);
      pintarGasto();
      break;
    case 'fecha-gasto': {
      const hoy = hoyISO();
      const f = b.dataset.fecha;
      draft.fechaOtra = f === 'otra';
      if (f === 'hoy') draft.fecha = hoy;
      else if (f === 'ayer') draft.fecha = addDias(hoy, -1);
      else { draft.fecha = $('#g-fecha').value && $('#g-fecha').value <= hoy ? $('#g-fecha').value : addDias(hoy, -2); $('#g-fecha').value = draft.fecha; }
      pintarGasto();
      if (f === 'otra') $('#g-fecha').focus();
      break;
    }
    case 'fondo-gasto': draft.fondo = b.dataset.fondo || null; pintarGasto(); break;
    case 'guardar-gasto': guardarGasto(); break;
    case 'borrar-gasto': if (draft?.id) borrarGasto(draft.id); break;
    case 'borrar-gasto-id': borrarGasto(id); break;
    case 'usar-atajo': {
      const a = S.atajos.find((x) => x.id === id);
      if (a) usarAtajo(a);
      break;
    }

    case 'descartar': {
      const d = S.config.descartados;
      if (d.fecha !== hoyISO()) { d.fecha = hoyISO(); d.ids = []; }
      d.ids.push(id);
      guardar();
      renderHoy(calcular());
      toast('Lo vuelvo a mostrar mañana');
      break;
    }
    case 'pend-toggle':
      ui.pendAbierto = !ui.pendAbierto;
      renderHoy(calcular());
      break;

    case 'dia-semana':
      ui.semanaSel = Number(b.dataset.i);
      renderSemana(calcular());
      $(`#semana [data-i="${ui.semanaSel}"]`)?.focus({ preventScroll: true });
      break;
    case 'mes-modo':
      ui.mesModo = b.dataset.modo;
      renderMes(calcular());
      break;
    case 'pagos-modo':
      ui.pagosModo = b.dataset.modo;
      renderPagos(calcular());
      break;
    case 'cat-toggle':
      ui.catAbierta = ui.catAbierta === b.dataset.cat ? null : b.dataset.cat;
      renderMes(calcular());
      break;

    case 'nuevo-pas': abrirPasajero(); break;
    case 'editar-pas': { const p = pasajeroPorId(id); if (p) abrirPasajero(p); break; }
    case 'pagar-pas': { const p = pasajeroPorId(id); if (p) pagarPasajero(p); break; }
    case 'plantilla': {
      const t = PLANTILLAS[Number(b.dataset.i)];
      const ciclo = cicloActual();
      llenarPasajero({ nombre: t.nombre, monto: t.monto, cadaMeses: t.cadaMeses, proxima: sumarMeses(ciclo.inicio, t.cadaMeses - 1), modo: 'juntar', categoria: S.config.categorias.includes(t.categoria) ? t.categoria : S.config.categorias[0] });
      $('#p-monto').focus();
      break;
    }
    case 'plantilla-rapida': {
      const t = PLANTILLAS.find((x) => x.nombre === b.dataset.nombre);
      if (!t) break;
      const ciclo = cicloActual();
      S.pasajeros.push({ id: uid(), nombre: t.nombre, monto: t.monto, cadaMeses: t.cadaMeses, proxima: sumarMeses(ciclo.inicio, t.cadaMeses - 1), modo: 'juntar', apartado: 0, categoria: S.config.categorias.includes(t.categoria) ? t.categoria : S.config.categorias[0] });
      ensureCiclo();
      guardar();
      render({ ajustes: true });
      break;
    }
    case 'borrar-pas': {
      const p = pasajeroPorId(id);
      if (!p) break;
      if ($('#sheet-pas').open) cerrarSheet($('#sheet-pas'));
      conDeshacer(`Quitaste ${p.nombre}`, () => { quitarApartes(p.id); S.pasajeros = S.pasajeros.filter((x) => x.id !== p.id); });
      break;
    }
    case 'borrar-pas-editando': {
      const p = pasajeroPorId(pasEditando);
      if (!p) break;
      cerrarSheet($('#sheet-pas'));
      conDeshacer(`Quitaste ${p.nombre}`, () => { quitarApartes(p.id); S.pasajeros = S.pasajeros.filter((x) => x.id !== p.id); });
      break;
    }

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
    case 'ingreso-extra':
      pedirMonto({
        titulo: 'Ingreso extra', boton: 'Agregar ingreso', conNota: true,
        ayuda: 'Se suma al disponible de este ciclo y sube tu tope diario.',
        onOk: (m, nota) => { S.ingresos.push({ id: uid(), fecha: hoyISO(), monto: m, nota: nota || 'Ingreso extra' }); toast(`+${money(m)} a este ciclo`); },
      });
      break;
    case 'borrar-ingreso':
      conDeshacer('Ingreso borrado', () => { S.ingresos = S.ingresos.filter((x) => x.id !== id); });
      break;
    case 'pago-cmr':
      pedirMonto({
        titulo: `Pago ${S.deuda.nombre}`, boton: 'Registrar pago',
        ayuda: `Saldo actual: ${money(S.deuda.saldo)}. Si es la cuota del mes, márcala en Pagos.`,
        onOk: (m) => {
          S.deuda.pagos.push({ id: uid(), fecha: hoyISO(), monto: m });
          S.deuda.saldo = Math.max(0, (Number(S.deuda.saldo) || 0) - m);
          toast(`Pago de ${money(m)} registrado`);
        },
      });
      break;

    case 'ir-ajustes': irAjustes(b.dataset.sec); break;
    case 'agregar-fijo': {
      const nuevo = { id: uid(), nombre: 'Nuevo fijo', monto: 0, tipo: 'mensual' };
      S.fijos.push(nuevo);
      guardar();
      render({ ajustes: true });
      const cont = b.closest('dialog') || $('#view-ajustes');
      const input = $(`[data-bind="fijos.${nuevo.id}.nombre"]`, cont);
      input?.focus();
      input?.select();
      break;
    }
    case 'borrar-fijo': {
      const f = S.fijos.find((x) => x.id === id);
      conDeshacer(`Borraste ${f?.nombre || 'el fijo'}`, () => { S.fijos = S.fijos.filter((x) => x.id !== id); });
      break;
    }
    case 'agregar-atajo': {
      const nuevo = { id: uid(), monto: 0, categoria: categoriaInicial(), nota: '', fondo: null };
      S.atajos.push(nuevo);
      guardar();
      renderAjustes();
      $(`[data-bind="atajos.${nuevo.id}.nota"]`)?.focus();
      break;
    }
    case 'borrar-atajo': {
      const a = S.atajos.find((x) => x.id === id);
      conDeshacer(`Borraste el atajo ${a?.nota || a?.categoria || ''}`.trim(), () => { S.atajos = S.atajos.filter((x) => x.id !== id); });
      break;
    }
    case 'borrar-cat': {
      const i = Number(b.dataset.i);
      const cat = S.config.categorias[i];
      if (S.config.categorias.length <= 1) { toast('Necesitas al menos una categoría'); break; }
      conDeshacer(`Quitaste ${cat}. Sus gastos anteriores no cambian.`, () => { S.config.categorias.splice(i, 1); });
      break;
    }
    case 'cat-mover': {
      const i = Number(b.dataset.i);
      const j = i + Number(b.dataset.dir);
      const cats = S.config.categorias;
      if (j < 0 || j >= cats.length) break;
      [cats[i], cats[j]] = [cats[j], cats[i]];
      guardar();
      renderAjustes();
      guardadoOk();
      $(`[data-action="cat-mover"][data-i="${j}"][data-dir="${b.dataset.dir}"]`)?.focus();
      break;
    }
    case 'agregar-fondo': {
      const nuevo = { id: uid(), nombre: 'Nuevo fondo', saldo: 0, meta: 0, descripcion: '', usoGastos: true };
      S.fondos.push(nuevo);
      guardar();
      render({ ajustes: true });
      const input = $(`[data-bind="fondos.${nuevo.id}.nombre"]`);
      input?.focus();
      input?.select();
      break;
    }
    case 'borrar-fondo': {
      const f = fondoPorId(id);
      if (!f) break;
      if (Math.round(f.saldo) !== 0) { toast(`Para borrar ${f.nombre}, primero déjalo en $0 (Metas → Sacar).`, null, { duracion: 5000 }); break; }
      conDeshacer(`Borraste ${f.nombre}`, () => {
        S.fondos = S.fondos.filter((x) => x.id !== id);
        S.atajos.forEach((a) => { if (a.fondo === id) a.fondo = null; });
      });
      break;
    }
    case 'tema':
      S.config.tema = b.dataset.tema;
      guardar();
      aplicarTema();
      renderAjustes();
      guardadoOk();
      break;
    case 'instalar':
      ui.installEvt?.prompt();
      ui.installEvt?.userChoice?.finally(() => { ui.installEvt = null; renderAjustes(); });
      break;
    case 'bienvenida': abrirBienvenida(); break;
    case 'b-sig':
      if (ui.paso < PASOS.length - 1) { ui.paso += 1; renderBienvenida(); $('#b-body').scrollTop = 0; }
      else terminarBienvenida();
      break;
    case 'b-atras':
      if (ui.paso > 0) { ui.paso -= 1; renderBienvenida(); }
      break;
    case 'b-saltar': terminarBienvenida(); break;
    case 'actualizar': actualizarApp(); break;
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
        conDeshacer('Borraste todos los datos', () => { S = estadoInicial(); S.config.bienvenida = true; });
      }
      break;
  }
}, true);

/* ---------- Toast: uno a la vez, arriba, y se puede cerrar ---------- */

let toastTimer = null;
let toastAlCerrar = null;

function toast(msg, accion = null, { duracion, alCerrar } = {}) {
  const t = $('#toast');
  toastAlCerrar = alCerrar || null;
  t.innerHTML = `<span class="toast-msg">${esc(msg)}</span>${accion ? `<button class="toast-btn" type="button">${esc(accion.label)}</button>` : ''}<button class="toast-x" type="button" aria-label="Cerrar aviso">${ICON_X}</button>`;
  if (accion) $('.toast-btn', t).addEventListener('click', () => { toastAlCerrar = null; accion.fn(); ocultarToast(); });
  $('.toast-x', t).addEventListener('click', () => { const f = toastAlCerrar; toastAlCerrar = null; f?.(); ocultarToast(); });
  t.classList.remove('show');
  void t.offsetWidth; // reinicia la animación si ya había uno
  t.classList.add('show');
  toastMs = duracion || (accion ? 6000 : 2600);
  programarToast(toastMs);
}

let toastMs = 2600;
function programarToast(ms) {
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastAlCerrar = null; ocultarToast(); }, ms);
}

// Mientras lo tocas o tiene el foco, el aviso no se va.
['pointerenter', 'focusin'].forEach((t) => $('#toast').addEventListener(t, () => clearTimeout(toastTimer)));
['pointerleave', 'focusout'].forEach((t) => $('#toast').addEventListener(t, () => { if ($('#toast').classList.contains('show')) programarToast(2000); }));

function ocultarToast() {
  clearTimeout(toastTimer);
  $('#toast').classList.remove('show');
}

/* ---------- Actualización de la app ---------- */

let swEsperando = null;
let recargando = false;

function mostrarActualizacion(w) {
  swEsperando = w;
  $('#update-bar').hidden = false;
  document.body.classList.add('con-update');
}

function actualizarApp() {
  if (!swEsperando) { location.reload(); return; }
  recargando = true;
  swEsperando.postMessage('actualizar');
  setTimeout(() => location.reload(), 1500); // por si el navegador no avisa
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
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', aplicarTema);

// Si otra pestaña cambia los datos, recargarlos.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) { S = cargar(); render({ ajustes: true }); }
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ui.installEvt = e;
  if (!$('#view-ajustes').hidden) renderAjustes();
});
window.addEventListener('appinstalled', () => { ui.installEvt = null; renderAjustes(); });

if (!datosIlegibles) guardar(); // deja guardada la migración, si la hubo
render();
mostrarVista();
if (datosIlegibles) toast('No pude leer tus datos guardados. Los dejé apartados; importa tu último respaldo desde Ajustes.', null, { duracion: 12000 });
if (!S.config.bienvenida && !datosIlegibles) abrirBienvenida();

// Pedir al navegador que no borre los datos locales.
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      if (!reg) return;
      const avisar = (w) => { if (w && navigator.serviceWorker.controller) mostrarActualizacion(w); };
      if (reg.waiting) avisar(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => { if (w.state === 'installed') avisar(w); });
      });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch((err) => console.warn('Service worker no registrado', err));
  });
}
