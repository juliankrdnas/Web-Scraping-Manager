const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    targetUrl:    { type: String, required: true, trim: true }, // Soporta el comodín {{PAGE_PARAM}}
    cssSelector:  { type: String, required: true, trim: true },
    cronSchedule: { type: String, required: true, trim: true },
    isActive:     { type: Boolean, default: true },
    lastRun:      { type: Date, default: null },
    lastStatus:   { type: String, enum: ['success', 'error', 'pending', 'never'], default: 'never' },
    lastErrorCode:    { type: String, default: null },  // 'SELECTOR_NOT_FOUND' | 'NETWORK_ERROR' | 'BLOCKED' | 'TIMEOUT' | 'UNKNOWN'
    lastErrorMessage: { type: String, default: null },  // mensaje legible del último fallo

    // ── Paginación dinámica ──────────────────────────────────
    isPaginated:     { type: Boolean, default: false },
    paginationStart: { type: Number, default: 1 },   // 1 (páginas normales) ó 0 (offsets)
    paginationStep:  { type: Number, default: 1 },   // 1 (?page=2), 50 (offset ML), etc.
    maxPages:        { type: Number, default: 1 },   // Límite de seguridad (máx 10)
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
