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

### v1.6 — Documentación técnica y guía de deploy
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
