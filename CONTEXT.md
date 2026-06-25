# CONTEXT — Historial de Desarrollo

Este archivo registra el avance completo del proyecto **Web Scraping Manager** a lo largo de su desarrollo. Se actualiza con cada cambio significativo.

---

## Estado Actual

| Ítem | Detalle |
|---|---|
| **Backend** | Node.js + Express + Mongoose + node-cron + puppeteer-extra |
| **Frontend** | Angular 17 standalone + Angular Material (dark theme) |
| **Base de datos** | MongoDB Atlas |
| **Motor de scraping** | Puppeteer-Extra + Stealth Plugin (HTML) / fetch nativo (API REST) |
| **Paginación** | Dinámica con comodín `{{PAGE_PARAM}}` |
| **TTL de datos** | Configurable via `DATA_RETENTION_DAYS` (default 90 días) |
| **Backend en producción** | https://web-scraping-manager-api.onrender.com |
| **Frontend en producción** | https://datavore.netlify.app |

---

## Historial de Cambios

### v1.0 — Commit inicial
**Archivos:** todos los archivos base del proyecto

- Estructura inicial con Express API, modelos Mongoose (`Task`, `ScrapedData`), motor Puppeteer básico y frontend Angular 17
- Scheduler `node-cron` que carga tareas activas al iniciar y las ejecuta según su expresión cron
- Dos vistas en el frontend: `task-manager` (CRUD de tareas) y `data-viewer` (visualización paginada)
- Angular Material con tema oscuro glassmorphism y design tokens CSS custom properties
- `ApiService` con interfaces TypeScript para `Task`, `ScrapedData` y `PaginatedData`

---

### v1.1 — Fixes de seguridad, TTL y environments
**Commit:** `fix: security, TTL, environments and form field UI improvements`

**Problemas resueltos:**

**CORS abierto** — `app.use(cors())` reemplazado por:
```js
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:4200' }));
```

**Inyección de campos en Mongoose** — POST y PUT pasaban `req.body` directo al modelo. Ahora se desestructuran solo los campos permitidos:
```js
const { name, targetUrl, cssSelector, cronSchedule, isActive } = req.body;
```

**URL hardcodeada en frontend** — `'http://localhost:3000/api'` movido a `environment.ts` / `environment.prod.ts`. Se configuró `fileReplacements` en `angular.json` para swap automático en build de producción.

**TTL en ScrapedData** — agregado `expires` al campo `timestamp` calculado desde `DATA_RETENTION_DAYS`:
```js
const RETENTION_SECONDS = parseInt(process.env.DATA_RETENTION_DAYS || '90', 10) * 24 * 60 * 60;
timestamp: { type: Date, default: Date.now, expires: RETENTION_SECONDS }
```

**Límite de longitud** en `extractedValue`: `maxlength: 10000`

**Tipado estricto en frontend:**
- `deleteTask` pasó de `Observable<any>` a `Observable<{ message: string }>`
- `runTask` retorna `Observable<{ status: 'success' | 'error'; values: string[] }>`
- Eliminado `as any` en `task.lastStatus = res.status`

**Archivos modificados:**
- `scraper-backend/.env` — agregadas variables `ALLOWED_ORIGIN` y `DATA_RETENTION_DAYS`
- `scraper-backend/.env.example` — actualizado con nuevas variables
- `scraper-backend/server.js` — CORS restringido, sanitización de body
- `scraper-backend/models/ScrapedData.js` — TTL y maxlength
- `scraper-frontend/angular.json` — fileReplacements para environments
- `scraper-frontend/src/environments/environment.ts` — creado
- `scraper-frontend/src/environments/environment.prod.ts` — creado
- `scraper-frontend/src/app/core/services/api.service.ts` — tipado estricto, uso de environment
- `scraper-frontend/src/app/features/task-manager/task-manager.component.ts` — eliminado `as any`

---

### v1.2 — Headers anti-bot en Puppeteer
**Commit:** `fix: add anti-bot headers to Puppeteer to bypass ML detection`

**Problema:** MercadoLibre y otros sitios detectaban el browser headless y redirigían al login.

**Solución aplicada en `scraperEngine.js`:**
```js
args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...')
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
});
```

---

### v1.3 — Motor dual: HTML + API REST
**Commit:** `fix: use networkidle2 and allow stylesheets for SPA scraping`  
**Commit:** (mismo ciclo) Motor dual implementado

**Problema:** SPAs como MercadoLibre renderizan contenido vía JS después del HTML inicial. `domcontentloaded` no esperaba ese proceso.

**Cambio:** `waitUntil: 'networkidle2'` con fallback a `domcontentloaded`. Stylesheets ya no se bloquean (necesarios para SPAs).

**Motor dual agregado:**
- Si `hostname.startsWith('api.')` → modo **fetch** (JSON, sin Puppeteer)
- Resto → modo **Puppeteer**
- Extracción JSON por ruta con notación de punto y corchetes: `results[].title`, `data.items[0].name`

**Instalación de Chromium:** se detectó que el binario no estaba instalado. Solución: `npx puppeteer browsers install chrome`

**Archivos modificados:**
- `scraper-backend/services/scraperEngine.js` — motor dual completo con logging detallado

---

### v1.4 — Paginación dinámica + Puppeteer-Extra Stealth
**Commit:** `feat: dynamic pagination + puppeteer-extra stealth plugin`

**Problema raíz detectado:** MercadoLibre requiere Access Token para todos sus endpoints API (403 Forbidden). No hay scraping posible sin autenticación. Caso de uso redirigido a sitios públicos como `books.toscrape.com`.

**Implementación de paginación:**

Nuevo comodín en la URL: `{{PAGE_PARAM}}`
- El motor calcula: `paramValue = paginationStart + (i * paginationStep)` por cada página
- Reemplaza `{{PAGE_PARAM}}` en la URL antes de cada `goto`
- Si una página no devuelve datos, detiene la iteración anticipadamente
- Delay aleatorio entre páginas: `Math.random() * 2500 + 1500` ms (anti-ban)

**Función `autoScroll`:** simula scroll humano para forzar lazy loading:
```js
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}
```

**Puppeteer-Extra + Stealth Plugin:**
```js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
```
Reemplaza técnicas manuales de evasión. Stealth parchea ~20 propiedades del browser para evitar detección.

**Cambio en firma de `extractData`:** ahora recibe el objeto `task` completo en lugar de `(url, selector)`, para que el motor tenga acceso a todos los campos de paginación.

**Nuevos campos en el modelo `Task`:**
```js
isPaginated:     { type: Boolean, default: false }
paginationStart: { type: Number, default: 1 }
paginationStep:  { type: Number, default: 1 }
maxPages:        { type: Number, default: 1 }  // tope: 10
```

**Frontend — nuevos campos en el formulario:**
- Toggle "Habilitar Paginación Dinámica" (oculta/muestra los 3 campos)
- Campos: Valor Inicial, Salto (Step), Páginas Máximas
- Propiedad `pageParamToken = '{{PAGE_PARAM}}'` en el componente para mostrar el comodín en el hint sin que Angular lo interpole
- Reset del formulario incluye valores default de paginación

**Archivos modificados:**
- `scraper-backend/models/Task.js` — 4 campos nuevos
- `scraper-backend/services/scraperEngine.js` — reescritura completa con stealth, autoScroll, paginación
- `scraper-backend/server.js` — POST/PUT aceptan campos de paginación, `runTask` pasa objeto `task` completo
- `scraper-backend/package.json` — `puppeteer-extra` y `puppeteer-extra-plugin-stealth`
- `scraper-frontend/src/app/core/services/api.service.ts` — interfaz `Task` con campos de paginación
- `scraper-frontend/src/app/features/task-manager/task-manager.component.ts` — `buildForm` y `resetForm` con nuevos campos
- `scraper-frontend/src/app/features/task-manager/task-manager.component.html` — sección de paginación con `ng-container`
- `scraper-frontend/src/app/features/task-manager/task-manager.component.scss` — estilos para `.pagination-hint` y `.pagination-grid`

---

### v1.5 — Corrección de autoría en git + README y CONTEXT
**Commits:** force push de historial reescrito + `docs: update README and add CONTEXT`

**Problema de autoría:** todos los commits históricos tenían `user.email = julia@orquestador.dev` por una config local del repo que sobreescribía la cuenta global. Los commits no aparecían en el calendario de GitHub del usuario real.

**Solución:**
1. Eliminada la config local: `git config --unset user.name && git config --unset user.email`
2. Reescritura del historial con `git rebase --root --exec "git commit --amend --reset-author --no-edit"` con variables de entorno seteadas al usuario correcto
3. Force push: `git push --force-with-lease origin master`

**Resultado:** todos los commits ahora aparecen bajo `Julian Cardenas <juliankrdnas@gmail.com>`

**Documentación:**
- `README.md` — actualizado completamente: requisitos, variables de entorno, modos de extracción, paginación, notación JSON, notas de seguridad
- `CONTEXT.md` — creado: historial completo de desarrollo con código, motivación y archivos de cada cambio

---

### v1.7 — Deploy completo a producción
**Commits:** `config: add Render deployment files` · `config: set production API URL to Render deployment` · `fix: increase Angular build budgets for production deploy`

**Infraestructura desplegada:**

| Capa | Plataforma | URL |
|---|---|---|
| Frontend (Angular) | Netlify | https://datavore.netlify.app |
| Backend (Node.js) | Render | https://web-scraping-manager-api.onrender.com |
| Base de datos | MongoDB Atlas | Sin cambios (ya estaba en la nube) |

**Archivos creados para Render:**
- `render.yaml` — configuración del servicio: rootDir, buildCommand, startCommand y variables de entorno base
- `scraper-backend/.puppeteerrc.cjs` — indica a Puppeteer el directorio de cache de Chromium en Render (`/opt/render/.cache/puppeteer`)

**Build command en Render:**
```
npm install && npx puppeteer browsers install chrome
```
Descarga Chromium durante cada deploy ya que Render no lo incluye preinstalado.

**Variables de entorno configuradas en Render:**
- `MONGO_URI` — cadena de conexión a MongoDB Atlas
- `PORT` — 3000
- `ALLOWED_ORIGIN` — `https://datavore.netlify.app` (actualizado tras obtener la URL de Netlify)
- `DATA_RETENTION_DAYS` — 90
- `NODE_ENV` — production
- `PUPPETEER_CACHE_DIR` — `/opt/render/.cache/puppeteer`

**Problema encontrado y resuelto durante el deploy de Netlify:**
El build falló con error de budget de Angular:
```
✘ [ERROR] task-manager.component.scss exceeded maximum budget.
  Budget 4.00 kB was not met by 2.31 kB with a total of 6.31 kB.
```
Los estilos del componente crecieron con la sección de paginación agregada en v1.4.
Solución: actualizar los budgets en `angular.json`:
- `anyComponentStyle`: warning 6kb / error 10kb (antes 2kb / 4kb)
- `initial`: warning 800kb / error 2mb (antes 500kb / 1mb)

**Configuración de Netlify:**
- Base directory: `scraper-frontend`
- Build command: `npm run build`
- Publish directory: `scraper-frontend/dist/scraper-frontend/browser`
- Angular usa automáticamente `environment.prod.ts` en el build de producción gracias al `fileReplacements` configurado en `angular.json`

**Archivos modificados:**
- `render.yaml` — creado
- `scraper-backend/.puppeteerrc.cjs` — creado
- `scraper-frontend/src/environments/environment.prod.ts` — URL actualizada a `https://web-scraping-manager-api.onrender.com/api`
- `scraper-frontend/angular.json` — budgets de build aumentados

---
**Commit:** `docs: add technical context and Render deployment guide`

**Archivos creados:**
- `docs/contexto-tecnico.txt` — documento completo con explicación de todos los conceptos técnicos del proyecto: web scraping, Puppeteer, Stealth Plugin, selectores CSS, node-cron, MongoDB/Mongoose, TTL, Express/REST, CORS, Angular standalone, Reactive Forms, Observables, arquitectura completa, seguridad implementada, dependencias, y conceptos de deployment
- `docs/deploy-backend-render.txt` — guía paso a paso para desplegar el backend en Render.com: preparación del repo (render.yaml + .puppeteerrc.cjs), configuración de MongoDB Atlas para IPs dinámicas, creación del servicio en Render, variables de entorno, verificación del deploy, y troubleshooting de problemas comunes

**Decisión de arquitectura documentada:**
- Netlify requiere solo el frontend estático. No tiene ninguna relación con la base de datos.
- MongoDB Atlas sigue siendo válido en producción sin necesidad de migrar a Supabase.
- La migración a Supabase es una decisión independiente del despliegue, recomendada solo cuando se quieran agregar autenticación de usuarios o Realtime.
- Render es el host elegido para el backend porque soporta instalación de Chromium para Puppeteer.

| Sitio | URL | Selector CSS |
|---|---|---|
| Books to Scrape (sin paginación) | `https://books.toscrape.com/catalogue/category/books_1/index.html` | `article.product_pod h3 a` |
| Books to Scrape (con paginación) | `https://books.toscrape.com/catalogue/page-{{PAGE_PARAM}}.html` | `article.product_pod h3 a` |
| Quotes to Scrape | `https://quotes.toscrape.com` | `.quote .text` |
| Hacker News (titulares) | `https://news.ycombinator.com` | `.titleline > a` |

---

### v1.8 — Guía de deploy frontend, fix SPA routing y documentación ampliada
**Commits:** `fix: add Netlify _redirects for SPA client-side routing` · `fix: include _redirects in Angular build output for Netlify SPA routing` · `docs: add frontend deploy guide, expand technical context`

**Problema resuelto — 404 al recargar en Netlify:**
Al recargar cualquier ruta (ej: `/tasks`), Netlify buscaba un archivo físico
que no existe y devolvía 404. Causa: Angular maneja el routing del lado del
cliente (SPA), pero el servidor no sabe eso.

Solución en dos partes:
1. Crear `scraper-frontend/public/_redirects` con el contenido:
   `/*    /index.html   200`
2. Agregar entrada en `angular.json` para copiar el archivo al output del build:
   ```json
   { "glob": "_redirects", "input": "public", "output": "." }
   ```

**Archivos creados:**
- `docs/deploy-frontend-netlify.txt` — guía completa para deployar el frontend:
  concepto de SPA y el problema del refresco, verificación de archivos previos,
  configuración en Netlify (base directory, build command, publish directory),
  configuración de CORS en Render post-deploy, deploy automático, y troubleshooting

**Documentación ampliada en `docs/contexto-tecnico.txt`:**
- Sección 13: Flexibilidad NoSQL vs SQL para web scraping — comparación directa,
  por qué MongoDB es ideal cuando cada sitio tiene estructura diferente, cuándo
  sí conviene PostgreSQL (JSONB)
- Sección 14: SPA, routing del lado del cliente y el problema del refresco —
  por qué F5 da 404 en Netlify, cómo funciona _redirects y por qué el código
  200 (no 301) es importante
- Sección 15: CORS en producción — qué es un origen, configuración en Render
- Sección 16: Netlify vs Vercel vs GitHub Pages para Angular

---

### v1.9 — Fixes de producción: node-cron, Chromium en Render, CDK overlay
**Commits:** múltiples fixes post-deploy

**Fix 1 — `job.destroy is not a function` al editar tareas:**
En `node-cron` v3 el método para detener un job cambió de `.destroy()` a `.stop()`.
Cualquier operación de editar, desactivar o eliminar una tarea lanzaba este error.

```js
// Antes
job.destroy();
// Ahora
job.stop();
```
Archivo: `scraper-backend/server.js` → función `removeScheduledTask`

**Fix 2 — Chromium no encontrado en Render (producción):**
Render descarga Chromium durante el build pero ese cache no persiste entre
reinicios del servidor en el tier gratuito. Cuando el servidor dormía y despertaba,
Chromium desaparecía.

Solución: `ensureChromium()` al arrancar el servidor — verifica si el ejecutable
existe y lo descarga si no:
```js
function ensureChromium() {
  try {
    require('puppeteer').executablePath();
    console.log('[Chromium] Ejecutable encontrado.');
  } catch {
    execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' });
  }
}
ensureChromium();
```
Durante este proceso se introdujo accidentalmente una declaración duplicada de
`const app = express()` que se corrigió en el commit siguiente.

**Fix 3 — Dropdown de mat-select aparecía al fondo/arriba de la pantalla:**
Este fue el bug más complejo del proyecto. Diagnóstico paso a paso via DevTools:

Síntoma: el panel de opciones del `mat-select` en data-viewer aparecía en una
posición incorrecta (primero al final, luego arriba) en lugar de debajo del campo.

Diagnóstico con `getComputedStyle`:
- `.cdk-overlay-container` → `position: static` (debería ser `fixed`)
- `.cdk-overlay-pane` → `position: static` (debería ser `absolute`)
- `.cdk-overlay-backdrop` → `position: static` (debería ser `fixed`)

Causa raíz: el reset CSS global `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }` en `styles.scss` tiene especificidad 0-0-0, igual que las clases `.cdk-overlay-*` de Angular Material. Como el reset se bundlea DESPUÉS del CSS del CDK en el archivo final `styles.css`, termina pisando el `position` de todos los elementos del CDK overlay.

Solución en `styles.scss` — restaurar explícitamente `position` en cada clase CDK:
```scss
.cdk-overlay-container,
.cdk-global-overlay-wrapper {
  position: fixed !important;
  top: 0 !important; left: 0 !important;
  pointer-events: none; z-index: 1000;
}
.cdk-overlay-container     { width: 100vw; height: 100vh; }
.cdk-overlay-connected-position-bounding-box { position: absolute !important; pointer-events: none; }
.cdk-overlay-pane          { position: absolute !important; pointer-events: auto; }
.cdk-overlay-backdrop      { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; pointer-events: auto; }
.cdk-visually-hidden       { position: absolute !important; }
```

Intentos fallidos durante el diagnóstico (documentados para referencia futura):
- Mover `mat-select` fuera del `mat-card` (no era el problema)
- Agregar `disableOptionCentering` al select (no era el problema)
- Quitar `backdrop-filter` del toolbar (no era el problema)
- Agregar `::before` pseudo-elemento al toolbar (empeoró)
- Forzar `width/height: 100%` en el container sin `position: fixed` en el pane (panel en y:0)

**Fix 4 — Mejoras visuales en data-viewer:**
- Campo selector de tarea agrandado con `::ng-deep` (height: 64px, mismo patrón que task-manager)
- Label en reposo con `padding-left: 40px` para no solaparse con el ícono prefix
- Botón "Crear mi primera tarea" con texto invisible arreglado — forzado `color: #ffffff` con `::ng-deep`

**Archivos modificados:**
- `scraper-backend/server.js` — `job.stop()`, `ensureChromium()`, fix duplicate declarations
- `scraper-frontend/src/styles.scss` — fix CDK overlay positioning
- `scraper-frontend/src/app/features/data-viewer/data-viewer.component.scss` — campo selector agrandado, botón texto blanco
- `scraper-frontend/src/app/features/data-viewer/data-viewer.component.html` — `panelClass`, `disableOptionCentering`, refactor a `selector-wrapper`
- `scraper-frontend/src/app/app.component.ts` — remoción de `backdrop-filter` del toolbar (fix provisional, causa descartada)

---

## Decisiones de Diseño

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| `puppeteer-extra` + Stealth | Headers manuales `setUserAgent` | Stealth parchea ~20 propiedades, más robusto |
| TTL index en MongoDB | Cron job de limpieza manual | Nativo en Mongo, sin código adicional |
| `environment.ts` para apiUrl | Variable en `AppModule` | Patrón estándar Angular para multi-env |
| Desestructurar `req.body` | Schema validation (Joi/Zod) | Solución mínima viable; Joi/Zod es el next step |
| Comodín `{{PAGE_PARAM}}` en URL | Query params separados | Flexible para cualquier patrón de URL (paths, query strings, offsets) |
| Fetch nativo para APIs JSON | axios | Node 22 incluye fetch nativo, sin dependencia extra |

---

## Pendiente / Roadmap (Fase 4)

- **Cola de trabajos con BullMQ + Redis** — desacoplar el scheduler del servidor HTTP, evitar que múltiples Puppeteer simultáneos saturen la RAM
- **Supabase Realtime** — reemplazar polling manual en `data-viewer` por actualizaciones en tiempo real via websocket
- **Autenticación** — proteger la API con JWT o API keys
- **Tests** — `supertest` para rutas del backend, `jest` para el motor de scraping
- **Validación de body con Zod** — reemplazar desestructuración manual por schema validation
- **Exportación de datos** — CSV/JSON desde `data-viewer`
