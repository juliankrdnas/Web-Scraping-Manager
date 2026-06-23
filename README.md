# Web Scraping Manager

Plataforma centralizada para programar, ejecutar y monitorear bots de scraping web. Soporta extracción desde páginas HTML (Puppeteer + Stealth) y APIs REST (fetch nativo), con paginación dinámica configurable desde la UI.

---

## Requisitos Previos

- **Node.js** v18+
- **MongoDB** local o remoto (Atlas). Configurar `MONGO_URI` en `.env`
- **Chromium** para Puppeteer — instalar una sola vez:
  ```bash
  cd scraper-backend
  npx puppeteer browsers install chrome
  ```
- **Angular CLI** v17: `npm install -g @angular/cli`

---

## Variables de Entorno

Copiar `scraper-backend/.env.example` como `scraper-backend/.env` y completar:

```env
MONGO_URI=mongodb://localhost:27017/scraper_db
PORT=3000
ALLOWED_ORIGIN=http://localhost:4200
DATA_RETENTION_DAYS=90
```

| Variable | Descripción | Default |
|---|---|---|
| `MONGO_URI` | Cadena de conexión a MongoDB | `mongodb://localhost:27017/scraper_db` |
| `PORT` | Puerto del servidor Express | `3000` |
| `ALLOWED_ORIGIN` | Origen permitido por CORS | `http://localhost:4200` |
| `DATA_RETENTION_DAYS` | TTL automático de datos scrapeados en días | `90` |

---

## Arranque

### 1. Backend

```bash
cd scraper-backend
npm install
npm start          # producción
npm run dev        # desarrollo con nodemon (hot-reload)
```

Servidor disponible en **http://localhost:3000**

### 2. Frontend

```bash
cd scraper-frontend
npm install
npm start          # ng serve → http://localhost:4200
```

---

## API REST

| Método | Ruta | Descripción |
|---|---|---|
| `GET`    | `/api/tasks`           | Listar todas las tareas |
| `POST`   | `/api/tasks`           | Crear nueva tarea |
| `GET`    | `/api/tasks/:id`       | Obtener tarea por ID |
| `PUT`    | `/api/tasks/:id`       | Actualizar tarea |
| `DELETE` | `/api/tasks/:id`       | Eliminar tarea y todos sus datos |
| `POST`   | `/api/tasks/:id/run`   | Ejecutar tarea manualmente |
| `GET`    | `/api/data/:taskId`    | Obtener datos scrapeados (paginados) |

### Cuerpo de una Tarea — sin paginación

```json
{
  "name": "Libros más baratos",
  "targetUrl": "https://books.toscrape.com/catalogue/category/books_1/index.html",
  "cssSelector": "article.product_pod h3 a",
  "cronSchedule": "0 * * * *",
  "isActive": true
}
```

### Cuerpo de una Tarea — con paginación dinámica

Usar el comodín `{{PAGE_PARAM}}` en la URL. El motor lo reemplaza matemáticamente en cada iteración.

```json
{
  "name": "Libros - 3 páginas",
  "targetUrl": "https://books.toscrape.com/catalogue/page-{{PAGE_PARAM}}.html",
  "cssSelector": "article.product_pod h3 a",
  "cronSchedule": "0 0 * * *",
  "isActive": true,
  "isPaginated": true,
  "paginationStart": 1,
  "paginationStep": 1,
  "maxPages": 3
}
```

### Parámetros de paginación

| Campo | Tipo | Descripción |
|---|---|---|
| `isPaginated` | boolean | Activa el modo paginado |
| `paginationStart` | number | Valor inicial del parámetro (ej: `1` para páginas, `0` para offsets) |
| `paginationStep` | number | Incremento por iteración (ej: `1` para `?page=2`, `50` para offsets) |
| `maxPages` | number | Máximo de páginas a recorrer (tope: 10) |

---

## Modos de Extracción

El motor detecta automáticamente el modo según la URL:

| Modo | Condición | Campo `cssSelector` |
|---|---|---|
| **HTML (Puppeteer)** | Cualquier URL que no empiece con `api.` | Selector CSS — ej: `.price`, `h1.title` |
| **API REST (fetch)** | URL con hostname `api.*` | Ruta JSON — ej: `results[].title`, `data.items[].name` |

### Notación de rutas JSON

| Patrón | Ejemplo | Resultado |
|---|---|---|
| Propiedad simple | `title` | Valor de `json.title` |
| Ruta anidada | `data.name` | Valor de `json.data.name` |
| Array completo | `results[].title` | Array con todos los `title` de `results` |
| Índice específico | `results[0].title` | Solo el primer elemento |

---

## Estructura del Proyecto

```
Orquestador/
├── scraper-backend/
│   ├── models/
│   │   ├── Task.js           # Esquema con campos de paginación y TTL
│   │   └── ScrapedData.js    # Esquema con TTL automático configurable
│   ├── services/
│   │   └── scraperEngine.js  # Motor dual: Puppeteer-Stealth + fetch API
│   ├── server.js             # API Express + cron scheduler
│   ├── .env                  # Variables de entorno (no incluido en git)
│   ├── .env.example          # Plantilla de variables
│   └── package.json
│
└── scraper-frontend/
    └── src/
        ├── environments/
        │   ├── environment.ts       # Config desarrollo (apiUrl local)
        │   └── environment.prod.ts  # Config producción (apiUrl remota)
        └── app/
            ├── core/services/
            │   └── api.service.ts        # Cliente HTTP tipado
            └── features/
                ├── task-manager/         # CRUD de tareas + config paginación
                └── data-viewer/          # Visualización y exportación de datos
```

---

## Expresiones Cron

| Expresión | Frecuencia |
|---|---|
| `* * * * *`   | Cada minuto |
| `*/5 * * * *` | Cada 5 minutos |
| `0 * * * *`   | Cada hora |
| `0 */6 * * *` | Cada 6 horas |
| `0 0 * * *`   | Diario a medianoche |
| `0 9 * * 1-5` | Días laborales a las 9:00 |

---

## Notas de Seguridad

- El archivo `.env` está en `.gitignore` — nunca se sube al repositorio
- CORS restringido al origen configurado en `ALLOWED_ORIGIN`
- Los campos del body en POST/PUT son desestructurados explícitamente (no se pasa `req.body` directo a Mongoose)
- Los datos scrapeados se eliminan automáticamente tras `DATA_RETENTION_DAYS` días vía índice TTL de MongoDB
