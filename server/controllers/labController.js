const { z } = require('zod');
const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const LabRequest = require('../models/LabRequest');

const item = z.object({
  description: z.string().trim().min(1).max(500),
  value: z.string().trim().max(300).optional().default('')
}).passthrough();

const input = z.object({
  requestDate: z.coerce.date().nullable().optional(),
  doctor: z.string().trim().max(200).optional().default(''),
  specialist: z.string().trim().max(200).optional().default(''),
  address: z.string().trim().max(500).optional().default(''),
  items: z.array(item).min(1).default([]),
  notes: z.string().trim().max(5000).optional().default('')
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
  const data = await LabRequest.find({ patientId: patient._id }).populate('patientId').sort({ requestDate: -1, createdAt: -1 }).lean();
  res.json({ success: true, data });
}

async function listAll(req, res) {
  const data = await LabRequest.find({}).populate('patientId').sort({ requestDate: -1, createdAt: -1 }).lean();
  res.json({ success: true, data });
}

async function create(req, res) {
  const payload = input.parse(req.body);
  const patient = await getPatientRef(req.params.patientId);
  if (!patient) {
    return res.status(404).json({ success: false, message: 'المريض غير موجود. اختر المريض من سجل المرضى أولاً.' });
  }
  const data = await LabRequest.create({ patientId: patient._id, ...payload });
  res.status(201).json({ success: true, data });
}

async function update(req, res) {
  const payload = input.partial().parse(req.body);
  const data = await LabRequest.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }).lean();
  if (!data) return res.status(404).json({ success: false, message: 'طلب التحليل غير موجود' });
  res.json({ success: true, data });
}

async function remove(req, res) {
  const data = await LabRequest.findByIdAndDelete(req.params.id);
  if (!data) return res.status(404).json({ success: false, message: 'طلب التحليل غير موجود' });
  res.json({ success: true });
}

module.exports = { list, listAll, create, update, remove };

