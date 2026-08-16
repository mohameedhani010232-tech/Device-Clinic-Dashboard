const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  qty: { type: String, default: '' },
  localPt: { type: String, default: '' },
  localEgp: { type: String, default: '' },
  impPt: { type: String, default: '' },
  impEgp: { type: String, default: '' },
  totalPt: { type: String, default: '' },
  totalEgp: { type: String, default: '' },
  qtrPt: { type: String, default: '' },
  qtrEgp: { type: String, default: '' },
  devPt: { type: String, default: '' },
  devEgp: { type: String, default: '' },
}, { _id: false, strict: true });

const prescriptionSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  prescriptionDate: { type: Date, default: null, index: true },
  doctor: { type: String, trim: true, default: 'غير محدد', maxlength: 150 },
  medicines: { type: [medicineSchema], default: [] },
}, { timestamps: true, versionKey: false });

prescriptionSchema.index({ patientId: 1, prescriptionDate: -1 });

module.exports = mongoose.model('Prescription', prescriptionSchema, 'prescriptions');
