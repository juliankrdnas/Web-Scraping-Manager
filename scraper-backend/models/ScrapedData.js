const mongoose = require('mongoose');

// Retención configurable: días definidos en DATA_RETENTION_DAYS (default 90)
const RETENTION_SECONDS = parseInt(process.env.DATA_RETENTION_DAYS || '90', 10) * 24 * 60 * 60;

const dataSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true,
  },
  extractedValue: { type: String, required: true, maxlength: 10000 },
  timestamp: { type: Date, default: Date.now, expires: RETENTION_SECONDS },
});

module.exports = mongoose.model('ScrapedData', dataSchema);
