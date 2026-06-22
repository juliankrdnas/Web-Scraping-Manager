require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const cors = require('cors');

const Task = require('./models/Task');
const ScrapedData = require('./models/ScrapedData');
const { extractData } = require('./services/scraperEngine');

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// Middlewares
// ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// Conexión a MongoDB
// ─────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/scraper_db')
  .then(() => {
    console.log('[DB] Conectado a MongoDB');
    initCronScheduler();
  })
  .catch((err) => console.error('[DB] Error de conexión:', err));

// ─────────────────────────────────────────────
// API REST — Tareas
// ─────────────────────────────────────────────

// Crear tarea
app.post('/api/tasks', async (req, res) => {
  try {
    const { name, targetUrl, cssSelector, cronSchedule } = req.body;
    if (!name || !targetUrl || !cssSelector || !cronSchedule) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }
    if (!cron.validate(cronSchedule)) {
      return res.status(400).json({ error: 'Expresión cron inválida.' });
    }
    const newTask = new Task(req.body);
    await newTask.save();
    scheduleTask(newTask); // Inyectar en memoria inmediatamente
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar todas las tareas
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener tarea por ID
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada.' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar tarea
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { cronSchedule } = req.body;
    if (cronSchedule && !cron.validate(cronSchedule)) {
      return res.status(400).json({ error: 'Expresión cron inválida.' });
    }
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada.' });

    // Reiniciar tarea en memoria si cambió
    removeScheduledTask(task._id.toString());
    if (task.isActive) scheduleTask(task);

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar tarea
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada.' });
    removeScheduledTask(req.params.id);
    await ScrapedData.deleteMany({ taskId: req.params.id });
    res.json({ message: 'Tarea y datos eliminados correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ejecutar tarea manualmente
app.post('/api/tasks/:id/run', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada.' });
    const result = await runTask(task);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// API REST — Datos Extraídos
// ─────────────────────────────────────────────

// Obtener datos de una tarea (paginados)
app.get('/api/data/:taskId', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      ScrapedData.find({ taskId: req.params.taskId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ScrapedData.countDocuments({ taskId: req.params.taskId }),
    ]);

    res.json({ data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// Scheduler (node-cron)
// ─────────────────────────────────────────────
const scheduledJobs = new Map(); // taskId → cron.ScheduledTask

/**
 * Ejecuta el motor de scraping para una tarea y guarda el resultado.
 */
async function runTask(task) {
  console.log(`[Cron] Ejecutando tarea: "${task.name}" (${task._id})`);
  const value = await extractData(task.targetUrl, task.cssSelector);
  const status = value !== null ? 'success' : 'error';

  await Task.findByIdAndUpdate(task._id, { lastRun: new Date(), lastStatus: status });

  if (value !== null) {
    await ScrapedData.create({ taskId: task._id, extractedValue: value });
    console.log(`[Cron] ✓ Dato guardado para "${task.name}": ${value.substring(0, 80)}`);
  } else {
    console.warn(`[Cron] ✗ Sin dato para "${task.name}"`);
  }

  return { status, value };
}

/**
 * Registra una tarea en el scheduler en memoria.
 */
function scheduleTask(task) {
  if (!cron.validate(task.cronSchedule)) {
    console.warn(`[Scheduler] Expresión cron inválida para "${task.name}": ${task.cronSchedule}`);
    return;
  }

  const job = cron.schedule(task.cronSchedule, () => runTask(task));
  scheduledJobs.set(task._id.toString(), job);
  console.log(`[Scheduler] Tarea programada: "${task.name}" → ${task.cronSchedule}`);
}

/**
 * Elimina una tarea del scheduler en memoria.
 */
function removeScheduledTask(taskId) {
  const job = scheduledJobs.get(taskId);
  if (job) {
    job.destroy();
    scheduledJobs.delete(taskId);
    console.log(`[Scheduler] Tarea eliminada del scheduler: ${taskId}`);
  }
}

/**
 * Al iniciar, carga todas las tareas activas de MongoDB y las programa.
 */
async function initCronScheduler() {
  const activeTasks = await Task.find({ isActive: true });
  console.log(`[Scheduler] Cargando ${activeTasks.length} tarea(s) activa(s)...`);
  activeTasks.forEach(scheduleTask);
}

// ─────────────────────────────────────────────
// Arranque
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] Servidor corriendo en http://localhost:${PORT}`);
});
