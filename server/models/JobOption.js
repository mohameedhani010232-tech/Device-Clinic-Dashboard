const mongoose = require('mongoose');

const jobOptionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true, maxlength: 150 },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('JobOption', jobOptionSchema, 'job_options');
