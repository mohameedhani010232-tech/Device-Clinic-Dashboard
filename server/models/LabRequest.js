const mongoose = require('mongoose');

const labItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true, maxlength: 300 },
  value: { type: String, trim: true, default: '' },
}, { _id: false });

const labRequestSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  requestDate: { type: Date, default: null, index: true },
  doctor: { type: String, trim: true, default: '' },
  specialist: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  items: { type: [labItemSchema], default: [] },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
}, { timestamps: true, versionKey: false });

labRequestSchema.index({ patientId: 1, requestDate: -1 });

module.exports = mongoose.model('LabRequest', labRequestSchema, 'lab_requests');
