# Mis Lucas

App personal de gastos diarios. Al abrirla ves cuánto te queda para gastar hoy y anotas un gasto en tres toques (o en uno, con un atajo).

- HTML, CSS y JavaScript sin frameworks ni build.
- Los datos viven solo en el navegador del teléfono (`localStorage`). Nada se sube a ningún lado.
- Funciona sin internet una vez abierta la primera vez.

## Uso diario

**Hoy.** El número grande es lo que te queda para gastar hoy. Si un día gastas menos, el tope de los días siguientes sube solo; si te pasas, baja.

- **Agregar gasto:** escribe el monto con el teclado, toca la categoría (viene marcada la última que usaste) y **Guardar**.
  - Mantén apretado **⌫** para borrar todo el monto.
  - **Fecha y más:** gasto de ayer u otro día, pagarlo con un fondo (Imprevistos, por ejemplo), marcarlo como imprevisto o **guardarlo como atajo**.
  - Para cerrar la hoja: la ✕, arrastrarla hacia abajo o tocar fuera.
- **Atajos:** los gastos que repites (el café, la micro) se anotan con un toque desde Hoy. Si anotas lo mismo 3 veces, la app te ofrece guardarlo como atajo. Siempre puedes **Deshacer**.
- **Pendientes:** los avisos (algo que toca pagar este mes, respaldo, Imprevistos bajo) se juntan en una tarjeta. **Ocultar por hoy** lo esconde hasta mañana.
- **Últimos 7 días:** cada barra es lo que gastaste; la rayita es el tope de ese día. Abajo ves cuántos días seguidos llevas dentro del tope.
- Toca un gasto para cambiarlo o desliza a la izquierda para borrarlo.

**Mes.** Cuánto llevas del ciclo, por categoría o por día, gastos hormiga, imprevistos, comparación con el ciclo anterior e ingresos extra (bonos).

**Pagos.**
- *Todos los meses:* tus gastos fijos. Márcalos a medida que los pagas.
- *De vez en cuando:* gastos que no son mensuales (pastillas cada 3 meses, ropa, dentista, regalos). La app aparta un poco cada ciclo y lo descuenta de tu tope diario, para que cuando toque pagarlo ya tengas la plata. Cuando lo pagues, toca **Lo pagué**: queda registrado y se programa la próxima vez. Si pagaste más de lo apartado, la diferencia se recupera de a poco en los meses siguientes. Abajo ves los próximos 6 meses.

**Metas.** Tus fondos (Viaje al sur, Imprevistos y los que crees) y la deuda CMR.

**Ajustes.** Todo se guarda solo (ves "Guardado ✓" arriba a la derecha). Secciones: Presupuesto, Atajos, Categorías (ícono, nombre y orden), Gastos fijos, Fondos y deuda, Apariencia (claro, oscuro o automático), Instalar y Respaldo.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | Estructura de la app y las hojas (gasto, monto, gasto de vez en cuando, bienvenida) |
| `styles.css` | Diseño (modo claro y oscuro) |
| `app.js` | Lógica del presupuesto, pantallas, respaldo y migración de datos |
| `sw.js` | Service worker: permite usarla offline y avisa cuando hay versión nueva |
| `manifest.json` + `icons/` | Para instalarla en la pantalla de inicio |
| `tests/`, `playwright.config.js`, `package.json` | Pruebas automáticas (solo desarrollo; la app no las carga) |

## Probar en el computador

```bash
python -m http.server 5173
```

Abre http://localhost:5173.

## Pruebas automáticas

Necesitas [Node.js](https://nodejs.org). La primera vez:

```bash
npm install
npm run test:instalar
```

Después, cada vez que cambies algo:

```bash
npm test
```

Recorren los flujos principales (primer uso, anotar con teclado, atajo y "Fecha y más", editar y borrar con Deshacer, gastos de vez en cuando, Ajustes) y restauran un respaldo antiguo y uno actual para confirmar que no se pierden datos ni cambia el disponible.

## Publicar una versión nueva en GitHub Pages

La app vive en `https://fernandonavrro14-art.github.io/Mis-lucas/`.

1. Sube los cambios a la rama `main` del repositorio (con `git push` o arrastrando los archivos en github.com → **Add file → Upload files**).
2. GitHub Pages publica solo en 1 a 2 minutos (lo ves en la pestaña **Actions**).
3. Abre la app en el teléfono con internet. Arriba aparece **"Hay una versión nueva de Mis Lucas"**: toca **Actualizar**. Si no aparece, ciérrala del todo y ábrela de nuevo.

Si agregas archivos nuevos a la app, súmalos a la lista `SHELL` de `sw.js`. Siempre sube `VERSION` en `sw.js` para que los teléfonos detecten el cambio.

Tus datos no se tocan al actualizar: siguen en el teléfono y la app los convierte sola al formato nuevo.

## Instalar en el celular

**Android (Chrome):** abre la URL, toca el menú ⋮ → **Instalar app** (o **Agregar a la pantalla principal**).

**iPhone (Safari):** abre la URL, toca el botón Compartir → **Agregar a inicio**.

También está explicado en la app: **Ajustes → Instalar en el teléfono** (solo aparece si aún no la instalas).

## Respaldo

El navegador puede borrar datos locales si el teléfono se queda sin espacio. La app te avisa si pasan más de 7 días sin respaldo.

- **Ajustes → Respaldo → Exportar respaldo:** descarga todo en un archivo JSON. Guárdalo en Drive o mándatelo por WhatsApp.
- **Importar respaldo:** restaura todo (también sirve para pasar a otro teléfono). Los respaldos de versiones anteriores se convierten solos.
- **Exportar gastos en CSV:** para abrir en Excel o Google Sheets.

---

**Al día** (el check-in diario) tiene su propio repositorio y dirección: https://fernandonavrro14-art.github.io/al-dia/. La carpeta `dia/` de este repo solo redirige ahí a quien tenga guardada la dirección antigua (`/Mis-lucas/dia/`). Las dos apps comparten el sitio github.io, por eso el `sw.js` de Mis Lucas solo borra cachés que empiezan con `mislucas-` y no atiende nada dentro de `dia/`.
