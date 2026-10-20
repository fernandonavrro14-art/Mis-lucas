// Pruebas de los flujos principales de Mis Lucas.
// Correr con: npm test   (la primera vez: npm install && npm run test:instalar)
const { test, expect } = require('@playwright/test');

const KEY = 'mislucas:v1';

/** Abre la app con datos dados (o vacía) una sola vez por prueba. */
async function abrir(page, datos = null, { saltarBienvenida = true } = {}) {
  await page.addInitScript(([key, d]) => {
    if (sessionStorage.getItem('__prueba')) return;
    sessionStorage.setItem('__prueba', '1');
    localStorage.clear();
    if (d) localStorage.setItem(key, JSON.stringify(d));
  }, [KEY, datos]);
  await page.goto('/');
  if (saltarBienvenida && await page.locator('#sheet-bienvenida[open]').count()) {
    await page.click('[data-action="b-saltar"]');
    await expect(page.locator('#sheet-bienvenida')).not.toHaveAttribute('open', '');
  }
}

const estado = (page) => page.evaluate(() => JSON.parse(JSON.stringify(S)));
const calculo = (page) => page.evaluate(() => calcular());

async function anotar(page, digitos, { nota = '' } = {}) {
  await page.click('#btn-add');
  await expect(page.locator('#sheet-gasto')).toHaveClass(/open/);
  for (const d of digitos) await page.click(`#sheet-gasto [data-k="${d}"]`);
  if (nota) await page.fill('#g-nota', nota);
}

async function guardarHoja(page) {
  await page.click('[data-action="guardar-gasto"]');
  await expect(page.locator('#sheet-gasto')).not.toHaveAttribute('open', '');
}

test('primer uso: aparece la configuración guiada y se puede saltar', async ({ page }) => {
  await abrir(page, null, { saltarBienvenida: false });
  await expect(page.locator('#b-titulo')).toHaveText('Tu sueldo');
  await page.click('#b-sig');
  await expect(page.locator('#b-titulo')).toHaveText('Gastos fijos');
  await page.click('#b-sig');
  await expect(page.locator('#b-titulo')).toHaveText('De vez en cuando');
  await page.click('[data-action="plantilla-rapida"][data-nombre="Dentista"]');
  await page.click('#b-sig');
  await expect(page.locator('#b-titulo')).toHaveText('Ahorros y deuda');
  await page.click('#b-sig');
  await expect(page.locator('#hero-num')).toBeVisible();
  const s = await estado(page);
  expect(s.config.bienvenida).toBe(true);
  expect(s.pasajeros.map((p) => p.nombre)).toContain('Dentista');
});

test('"Hoy te quedan" se ve sin desplazar en 360×640, aunque haya avisos', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await abrir(page);
  // Forzar avisos: sin respaldo hace mucho, Imprevistos bajo y un pasajero que toca.
  await page.evaluate(() => {
    S.config.creado = Date.now() - 30 * 864e5;
    fondoPorId('imprev').saldo = 1000;
    S.pasajeros[0].proxima = cicloActual().inicio;
    guardar(); render();
  });
  await expect(page.locator('.pend')).toBeVisible();
  await expect(page.locator('.pend-more')).toHaveText(/Ver 2 más/);
  const caja = await page.locator('#hero-num').boundingBox();
  expect(caja.y + caja.height).toBeLessThan(640 - 56);
  // Descartar un aviso por hoy
  await page.click('[data-action="descartar"]');
  await expect(page.locator('.pend-more')).toHaveText(/Ver 1 más/);
});

test('anotar un gasto: abrir, monto y guardar (3 toques más el monto)', async ({ page }) => {
  await abrir(page);
  const antes = await calculo(page);
  await anotar(page, ['4', '5', '0', '0']);
  await guardarHoja(page);
  const despues = await calculo(page);
  expect(despues.gastadoHoy).toBe(antes.gastadoHoy + 4500);
  expect(despues.queda).toBe(antes.queda - 4500);
  await expect(page.locator('#view-hoy .list .row')).toHaveCount(1);
});

test('la categoría marcada es la última usada', async ({ page }) => {
  await abrir(page);
  await anotar(page, ['1', '0', '0', '0']);
  await page.click('#g-cats [data-cat="Salud"]');
  await guardarHoja(page);
  await page.click('#btn-add');
  await expect(page.locator('#g-cats [aria-checked="true"]')).toHaveAttribute('data-cat', 'Salud');
});

test('mantener apretado ⌫ borra todo el monto', async ({ page }) => {
  await abrir(page);
  await anotar(page, ['1', '2', '3', '4']);
  await expect(page.locator('#g-monto')).toHaveText('$1.234');
  const back = page.locator('#sheet-gasto [data-k="back"]');
  await back.hover();
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect(page.locator('#g-monto')).toHaveText('$0');
});

test('la hoja se cierra arrastrando hacia abajo y el fondo no se desplaza', async ({ page }) => {
  await abrir(page);
  await page.click('#btn-add');
  await expect(page.locator('#sheet-gasto')).toHaveClass(/open/);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
  const grip = await page.locator('#sheet-gasto .sheet-grip').boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 5);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 400, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#sheet-gasto')).not.toHaveAttribute('open', '');
  // El foco vuelve al botón que la abrió
  await expect(page.locator('#btn-add')).toBeFocused();
});

test('"Fecha y más": anotar un gasto de ayer y guardarlo como atajo', async ({ page }) => {
  await abrir(page);
  await anotar(page, ['2', '0', '0', '0'], { nota: 'Café' });
  await page.click('#g-mas summary');
  await page.click('[data-fecha="ayer"]');
  await page.check('#g-atajo', { force: true });
  await expect(page.locator('#g-mas-sum')).toHaveText('Ayer, Atajo');
  await guardarHoja(page);
  const s = await estado(page);
  const hoy = await page.evaluate(() => hoyISO());
  expect(s.gastos[0].fecha).toBe(await page.evaluate(() => addDias(hoyISO(), -1)));
  expect(s.gastos[0].fecha).not.toBe(hoy);
  expect(s.atajos).toHaveLength(1);
  // El atajo anota con un toque, y se puede deshacer
  await page.click('[data-action="usar-atajo"]');
  expect((await estado(page)).gastos).toHaveLength(2);
  await page.click('#toast .toast-btn');
  expect((await estado(page)).gastos).toHaveLength(1);
});

test('atajo sugerido después de anotar lo mismo 3 veces', async ({ page }) => {
  await abrir(page);
  for (let i = 0; i < 3; i++) {
    await anotar(page, ['1', '5', '0', '0'], { nota: 'Pan' });
    await guardarHoja(page);
  }
  await expect(page.locator('#toast')).toContainText('¿Lo guardo como atajo?');
  await page.click('#toast .toast-btn');
  expect((await estado(page)).atajos).toHaveLength(1);
  await expect(page.locator('[data-action="usar-atajo"]')).toHaveCount(1);
});

test('editar y borrar un gasto, con Deshacer', async ({ page }) => {
  await abrir(page);
  await anotar(page, ['3', '0', '0', '0']);
  await guardarHoja(page);
  await page.click('#view-hoy [data-action="editar-gasto"]');
  await page.click('#sheet-gasto [data-k="0"]');
  await guardarHoja(page);
  expect((await estado(page)).gastos[0].monto).toBe(30000);
  await page.click('#view-hoy [data-action="editar-gasto"]');
  await page.click('#g-borrar');
  await expect(page.locator('#view-hoy .list')).toHaveCount(0);
  await page.click('#toast .toast-btn');
  await expect(page.locator('#view-hoy .list .row')).toHaveCount(1);
});

test('el toast tiene botón para cerrarlo y no tapa el botón principal', async ({ page }) => {
  await abrir(page);
  await anotar(page, ['9', '0', '0']);
  await guardarHoja(page);
  const toast = await page.locator('#toast').boundingBox();
  const fab = await page.locator('#btn-add').boundingBox();
  expect(toast.y + toast.height).toBeLessThan(fab.y);
  // Un aviso largo para tener tiempo de cerrarlo con la ✕
  await page.evaluate(() => toast('Aviso de prueba', null, { duracion: 60000 }));
  await page.click('#toast .toast-x');
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
});

test('gasto de vez en cuando: crear con plantilla y pagarlo con "Lo pagué"', async ({ page }) => {
  await abrir(page);
  await page.goto('/#pagos');
  await page.click('[data-action="pagos-modo"][data-modo="pas"]');
  await page.click('#view-pagos [data-action="nuevo-pas"] >> nth=0');
  await page.click('[data-action="plantilla"] >> text=Ropa');
  await expect(page.locator('#p-calc')).toContainText('$10.000');
  const antes = await calculo(page);
  await page.click('#form-pas [type="submit"]');
  const despues = await calculo(page);
  expect(despues.pasajeros).toBe(antes.pasajeros + 10000);
  const ropa = (await estado(page)).pasajeros.find((p) => p.nombre === 'Ropa');
  expect(ropa.apartado).toBe(10000);

  // Pagarlo: no toca el tope del día y programa la próxima vez
  await page.click(`[data-action="pagar-pas"][data-id="${ropa.id}"]`);
  await page.fill('#m-input', '55000');
  await page.click('#m-ok');
  const s = await estado(page);
  const pagada = s.pasajeros.find((p) => p.id === ropa.id);
  expect(pagada.apartado).toBe(10000 - 55000);
  expect(pagada.proxima > ropa.proxima).toBe(true);
  expect(s.gastos.find((g) => g.pasajero === ropa.id).monto).toBe(55000);
  expect((await calculo(page)).gastadoHoy).toBe(despues.gastadoHoy);
  await expect(page.locator('.timeline li')).toHaveCount(6);
});

test('Ajustes: secciones plegables, tema, categorías y fondos con autoguardado', async ({ page }) => {
  await abrir(page);
  await page.goto('/#ajustes');
  await page.click('details.aj[data-sec="apariencia"] summary');
  await page.click('[data-action="tema"][data-tema="oscuro"]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#guardado')).toHaveClass(/show/);

  await page.click('details.aj[data-sec="cats"] summary');
  const nombre = page.locator('[data-cat-nombre="0"]');
  await nombre.fill('Comida');
  await nombre.press('Tab');
  let s = await estado(page);
  expect(s.config.categorias[0]).toBe('Comida');
  expect(s.config.iconos.Comida).toBe('🍔');

  await page.click('details.aj[data-sec="fondos"] summary');
  await page.click('[data-action="agregar-fondo"]');
  s = await estado(page);
  expect(s.fondos).toHaveLength(3);

  await page.click('details.aj[data-sec="pres"] summary');
  const ingreso = page.locator('#view-ajustes [data-bind="config.ingreso"]');
  await ingreso.fill('300000');
  await ingreso.press('Tab');
  expect((await estado(page)).config.ingreso).toBe(300000);
});

test('ningún campo hace zoom en iPhone (16 px o más) y no hay scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await abrir(page);
  for (const v of ['hoy', 'mes', 'pagos', 'metas', 'ajustes']) {
    await page.goto(`/#${v}`);
    await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho, `scroll horizontal en ${v}`).toBeLessThanOrEqual(360);
  }
  const chicos = await page.evaluate(() => [...document.querySelectorAll('input, select, textarea')]
    .filter((el) => el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'file')
    .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
    .map((el) => el.id || el.dataset.bind || el.className));
  expect(chicos).toEqual([]);
});

/* ---------- Respaldos: v1/v2 (antes de los pasajeros) y v3 ---------- */

/** Respaldo con el formato antiguo: pastillas propias como fijo "reserva" a un fondo. */
function respaldoAntiguo(hoy, inicioCiclo, { marcado }) {
  const ayer = new Date(Date.parse(hoy) - 864e5).toISOString().slice(0, 10);
  return {
    version: 1,
    config: { ingreso: 250000, diaPago: 1, metaAhorro: 5000, umbralHormiga: 3000, avisoImprevistos: 100000, categorias: ['Comida / snacks', 'Salud', 'Otros'], ultimaCategoria: 'Salud', creado: Date.now() - 40 * 864e5, ultimoRespaldo: Date.now() },
    fijos: [
      { id: 'arriendo', nombre: 'Arriendo', monto: 110000, tipo: 'mensual' },
      { id: 'internet', nombre: 'Internet', monto: 13000, tipo: 'mensual' },
      { id: 'pastillas-propias', nombre: 'Pastillas propias', monto: 20000, tipo: 'reserva', fondo: 'pastillas' },
    ],
    gastos: [
      { id: 'g1', fecha: ayer >= inicioCiclo ? ayer : hoy, ts: 1, monto: 2500, categoria: 'Comida / snacks', nota: 'Café', imprevisto: false, fondo: null },
      { id: 'g2', fecha: hoy, ts: 2, monto: 7000, categoria: 'Otros', nota: '', imprevisto: true, fondo: 'imprev' },
      { id: 'g3', fecha: hoy, ts: 3, monto: 15000, categoria: 'Salud', nota: 'Pastillas', imprevisto: false, fondo: 'pastillas' },
    ],
    ingresos: [{ id: 'i1', fecha: hoy, monto: 30000, nota: 'Bono' }],
    fondos: [
      { id: 'viaje', nombre: 'Viaje al sur', saldo: 250000, meta: 250000, usoGastos: false },
      { id: 'imprev', nombre: 'Imprevistos', saldo: 143000, meta: 250000, usoGastos: true },
      { id: 'pastillas', nombre: 'Reserva pastillas', saldo: 25000, meta: 60000, usoGastos: true },
    ],
    pagados: marcado ? { [inicioCiclo]: ['pastillas-propias', 'arriendo'] } : { [inicioCiclo]: ['arriendo'] },
    deuda: { nombre: 'CMR', saldo: 100000, cuotaMensual: 10000, pagos: [] },
  };
}

/** Disponible y tope con las reglas del formato antiguo (para comparar). */
function calculoAntiguo(d, hoy, ciclo) {
  const en = (x) => x.fecha >= ciclo.inicio && x.fecha <= ciclo.fin;
  const disponible = d.config.ingreso + d.ingresos.filter(en).reduce((a, x) => a + x.monto, 0)
    - d.fijos.reduce((a, f) => a + f.monto, 0) - d.config.metaAhorro - d.deuda.cuotaMensual;
  const delDia = d.gastos.filter((g) => !g.fondo && en(g));
  const antes = delDia.filter((g) => g.fecha < hoy).reduce((a, g) => a + g.monto, 0);
  const restantes = Math.round((Date.parse(ciclo.fin) - Date.parse(hoy)) / 864e5) + 1;
  return { disponible, tope: Math.floor((disponible - antes) / restantes) };
}

for (const marcado of [false, true]) {
  test(`migración de un respaldo antiguo (pastillas ${marcado ? 'ya marcadas' : 'sin marcar'}): mismo disponible, sin perder datos`, async ({ page }) => {
    await abrir(page);
    const { hoy, ciclo } = await page.evaluate(() => ({ hoy: hoyISO(), ciclo: cicloActual() }));
    const viejo = respaldoAntiguo(hoy, ciclo.inicio, { marcado });
    const esperado = calculoAntiguo(viejo, hoy, ciclo);

    // Restaurar el respaldo desde Ajustes → Importar
    await page.goto('/#ajustes');
    await page.setInputFiles('#file-import', { name: 'mis-lucas-respaldo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(viejo)) });
    await expect(page.locator('#toast')).toContainText('Importaste 3 gastos');

    const r = await calculo(page);
    expect(r.disponible).toBe(esperado.disponible);
    expect(r.tope).toBe(esperado.tope);

    const s = await estado(page);
    expect(s.version).toBe(3);
    expect(s.gastos).toHaveLength(3);
    expect(s.ingresos).toHaveLength(1);
    expect(s.fijos.map((f) => f.id)).toEqual(['arriendo', 'internet']);
    expect(s.fondos.map((f) => f.id)).toEqual(['viaje', 'imprev']);
    expect(s.fondos.find((f) => f.id === 'imprev').saldo).toBe(143000);
    const pas = s.pasajeros.find((p) => p.nombre === 'Pastillas propias');
    expect(pas.monto).toBe(60000);
    expect(pas.cadaMeses).toBe(3);
    expect(pas.apartado).toBe(marcado ? 25000 : 45000);
    expect(s.gastos.find((g) => g.id === 'g3').pasajero).toBe(pas.id);
    expect(s.config.bienvenida).toBe(true);

    // Recargar no cambia nada (no se aparta dos veces)
    await page.reload();
    expect((await calculo(page)).disponible).toBe(esperado.disponible);
    expect((await estado(page)).pasajeros.find((p) => p.id === pas.id).apartado).toBe(pas.apartado);
  });
}

test('un respaldo v3 exportado se restaura sin pérdida', async ({ page }) => {
  await abrir(page);
  await anotar(page, ['5', '0', '0', '0'], { nota: 'Almuerzo' });
  await guardarHoja(page);
  await page.evaluate(() => {
    S.atajos.push({ id: 'a1', monto: 1200, categoria: 'Otros', nota: 'Micro', fondo: null });
    S.config.tema = 'oscuro';
    guardar();
  });
  const original = await estado(page);
  const r0 = await calculo(page);

  await page.goto('/#ajustes');
  await page.click('details.aj[data-sec="respaldo"] summary');
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('#view-ajustes [data-action="exportar-json"]')]);
  const archivo = await descarga.path();

  // Borrar todo e importar
  await page.click('[data-action="reset"]');
  await page.click('[data-action="reset"]');
  expect((await estado(page)).gastos).toHaveLength(0);
  await page.setInputFiles('#file-import', archivo);
  const restaurado = await estado(page);
  expect(restaurado.gastos).toEqual(original.gastos);
  expect(restaurado.atajos).toEqual(original.atajos);
  expect(restaurado.pasajeros).toEqual(original.pasajeros);
  expect(restaurado.fondos).toEqual(original.fondos);
  expect(restaurado.config.tema).toBe('oscuro');
  expect((await calculo(page)).disponible).toBe(r0.disponible);
});
