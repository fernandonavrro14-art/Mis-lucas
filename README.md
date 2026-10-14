# Mis Lucas

App personal de gastos diarios. Al abrirla ves cuánto te queda para gastar hoy y registras un gasto en tres toques.

- HTML, CSS y JavaScript sin frameworks ni build.
- Los datos viven solo en el navegador del teléfono (`localStorage`). Nada se sube a ningún lado.
- Funciona sin internet una vez abierta la primera vez.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | Estructura de la app y las hojas de gasto / monto |
| `styles.css` | Diseño (modo claro y oscuro automático) |
| `app.js` | Lógica del presupuesto, pantallas y respaldo |
| `sw.js` | Service worker: permite usarla offline |
| `manifest.json` + `icons/` | Para instalarla en la pantalla de inicio |

## Probar en el computador

```bash
python -m http.server 5173
```

Abre http://localhost:5173.

## Publicar en GitHub Pages

1. Crea una cuenta en github.com (gratis) si no tienes.
2. Arriba a la derecha: **+ → New repository**. Nombre: `mis-lucas`. Déjalo **Public** y crea el repositorio.
3. En la página del repositorio vacío, toca **uploading an existing file**.
4. Arrastra `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.json`, `README.md` y la carpeta `icons` completa. Luego **Commit changes**.
5. Ve a **Settings → Pages**. En *Branch* elige `main` y carpeta `/ (root)`. Guarda.
6. Espera 1 a 2 minutos. La app queda en `https://TU-USUARIO.github.io/mis-lucas/`.

Para actualizar después: sube los archivos modificados de la misma forma (reemplazan a los anteriores). El teléfono toma la versión nueva la próxima vez que abras la app con internet. Si agregas archivos nuevos, súmalos a la lista `SHELL` de `sw.js` y sube `VERSION`.

## Instalar en el celular

**Android (Chrome):** abre la URL, toca el menú ⋮ → **Agregar a la pantalla principal** (o **Instalar app**).

**iPhone (Safari):** abre la URL, toca el botón Compartir → **Agregar a inicio**.

Ábrela una vez con internet para que quede guardada para usar offline.

## Respaldo

El navegador puede borrar datos locales si el teléfono se queda sin espacio. La app te avisa si pasan más de 7 días sin respaldo.

- **Ajustes → Exportar respaldo (JSON):** descarga todo. Guárdalo en Drive o mándatelo por WhatsApp.
- **Ajustes → Importar JSON:** restaura todo (también sirve para pasar a otro teléfono).
- **Ajustes → Gastos en CSV:** para abrir en Excel o Google Sheets.
