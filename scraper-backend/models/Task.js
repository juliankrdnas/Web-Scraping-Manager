const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    targetUrl: { type: String, required: true, trim: true },
    cssSelector: { type: String, required: true, trim: true },
    cronSchedule: {
      type: String,
      required: true,
      trim: true,
      // Ej: '0 * * * *' para cada hora, '*/5 * * * *' para cada 5 min
    },
    isActive: { type: Boolean, default: true },
    lastRun: { type: Date, default: null },
    lastStatus: {
      type: String,
      enum: ['success', 'error', 'pending', 'never'],
      default: 'never',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
