const { z } = require('zod');
const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const Prescription = require('../models/Prescription');

const medicine = z.object({
  name: z.string().trim().min(1).max(300),
  qty: z.string().max(100).optional().default(''),
  localPt: z.string().max(100).optional().default(''), localEgp: z.string().max(100).optional().default(''),
  impPt: z.string().max(100).optional().default(''), impEgp: z.string().max(100).optional().default(''),
  totalPt: z.string().max(100).optional().default(''), totalEgp: z.string().max(100).optional().default(''),
  qtrPt: z.string().max(100).optional().default(''), qtrEgp: z.string().max(100).optional().default(''),
  devPt: z.string().max(100).optional().default(''), devEgp: z.string().max(100).optional().default(''),
}).passthrough();

const input = z.object({
  prescriptionDate: z.coerce.date().nullable().optional(),
  doctor: z.string().trim().max(200).optional().default('غير محدد'),
  medicines: z.array(medicine).min(1).default([]),
}).passthrough();

async function getPatientRef(idOrMedical) {
  const query = [];
  if (mongoose.Types.ObjectId.isValid(idOrMedical)) query.push({ _id: idOrMedical });
  query.push({ medicalId: String(idOrMedical) }, { nationalId: String(idOrMedical) });
  return await Patient.findOne({ $or: query });
}

async function list(req, res) {
  const patient = await getPatientRef(req.params.patientId);
  if (!patient) return res.json({ success: true, data: [] });
  const data = await Prescription.find({ patientId: patient._id }).populate('patientId').sort({ prescriptionDate: -1, createdAt: -1 }).lean();
  res.json({ success: true, data });
}

async function listAll(req, res) {
  const data = await Prescription.find({}).populate('patientId').sort({ prescriptionDate: -1, createdAt: -1 }).lean();
  res.json({ success: true, data });
}

async function create(req, res) {
  const payload = input.parse(req.body);
  const patient = await getPatientRef(req.params.patientId);
  if (!patient) {
    return res.status(404).json({ success: false, message: 'المريض غير موجود. اختر المريض من سجل المرضى أولاً.' });
  }
  const data = await Prescription.create({ patientId: patient._id, ...payload });
  res.status(201).json({ success: true, data });
}

async function update(req, res) {
  const payload = input.partial().parse(req.body);
  const data = await Prescription.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }).lean();
  if (!data) return res.status(404).json({ success: false, message: 'الروشتة غير موجودة' });
  res.json({ success: true, data });
}

async function remove(req, res) {
  const data = await Prescription.findByIdAndDelete(req.params.id);
  if (!data) return res.status(404).json({ success: false, message: 'الروشتة غير موجودة' });
  res.json({ success: true });
}

module.exports = { list, listAll, create, update, remove };

