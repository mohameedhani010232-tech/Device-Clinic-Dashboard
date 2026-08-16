const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  medicalId: { type: String, required: true, trim: true, unique: true },
  nationalId: { type: String, trim: true, default: '' },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 150 },
  system: { type: String, trim: true, default: '' },
  job: { type: String, trim: true, default: '' },
  doctorName: { type: String, trim: true, default: '' },
  imageUrl: { type: String, trim: true, default: '' },
}, { timestamps: true, versionKey: false });

patientSchema.index({ name: 1 });
patientSchema.index({ nationalId: 1 });
patientSchema.index({ system: 1 });
patientSchema.index({ doctorName: 1 });
// Text index for smart search across name and numbers
patientSchema.index({ name: 'text', medicalId: 'text', nationalId: 'text', doctorName: 'text' });

module.exports = mongoose.model('Patient', patientSchema, 'patients');
