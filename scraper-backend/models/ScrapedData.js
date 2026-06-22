const mongoose = require('mongoose');

const dataSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true,
  },
  extractedValue: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('ScrapedData', dataSchema);
