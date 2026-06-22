# Orquestador de Extracción de Datos Web

Plataforma centralizada para programar, ejecutar y monitorear bots de scraping web. Los datos fluyen directamente desde la fuente hasta el panel administrativo, sin archivos intermedios.

---

## Requisitos Previos

- **Node.js** v18+
- **MongoDB** corriendo localmente en `mongodb://localhost:27017`
- **Angular CLI** v17: `npm install -g @angular/cli`

---

## Arranque Rápido

### 1. Backend

```bash
cd scraper-backend
# Ajusta MONGO_URI en .env si es necesario
npm start          # producción
npm run dev        # desarrollo con nodemon (hot-reload)
```

El servidor queda en **http://localhost:3000**

### 2. Frontend

```bash
cd scraper-frontend
npm start          # ng serve → http://localhost:4200
```

---

## API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`    | `/api/tasks`           | Listar todas las tareas |
| `POST`   | `/api/tasks`           | Crear nueva tarea |
| `GET`    | `/api/tasks/:id`       | Obtener tarea por ID |
| `PUT`    | `/api/tasks/:id`       | Actualizar tarea |
| `DELETE` | `/api/tasks/:id`       | Eliminar tarea y sus datos |
| `POST`   | `/api/tasks/:id/run`   | Ejecutar tarea manualmente |
| `GET`    | `/api/data/:taskId`    | Obtener datos paginados |

### Cuerpo de una Tarea (POST/PUT)

```json
{
  "name": "Precio Bitcoin",
  "targetUrl": "https://coinmarketcap.com/currencies/bitcoin/",
  "cssSelector": ".priceValue span",
  "cronSchedule": "*/5 * * * *",
  "isActive": true
}
```

---

## Estructura del Proyecto

```
Orquestador/
├── scraper-backend/
│   ├── models/
│   │   ├── Task.js          # Esquema de tareas
│   │   └── ScrapedData.js   # Esquema de resultados
│   ├── services/
│   │   └── scraperEngine.js # Motor Puppeteer
│   ├── server.js            # API Express + cron scheduler
│   ├── .env                 # Variables de entorno
│   └── package.json
│
└── scraper-frontend/
    └── src/app/
        ├── core/services/
        │   └── api.service.ts       # Cliente HTTP tipado
        └── features/
            ├── task-manager/        # Gestión de bots (CRUD)
            └── data-viewer/         # Visualización de datos
```

---

## Expresiones Cron de Ejemplo

| Expresión | Frecuencia |
|-----------|------------|
| `* * * * *`   | Cada minuto |
| `*/5 * * * *` | Cada 5 minutos |
| `0 * * * *`   | Cada hora |
| `0 */6 * * *` | Cada 6 horas |
| `0 0 * * *`   | Diario a medianoche |
| `0 9 * * 1-5` | Días laborales a las 9:00 |
