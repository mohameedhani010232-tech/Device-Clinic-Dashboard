const Patient = require('../models/Patient');
const Prescription = require('../models/Prescription');
const LabRequest = require('../models/LabRequest');
const { patientInput } = require('../validators/common');

function parsePagination(req) {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = req.query.all === 'true' || req.query.limit === 'all' 
    ? 10000 
    : (requestedLimit ? Math.min(Math.max(requestedLimit, 1), 1000) : 10000);
  return { page, limit, skip: (page - 1) * limit };
}

async function listPatients(req, res) {
  const { page, limit, skip } = parsePagination(req);
  const search = String(req.query.search || '').trim();
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filter = escapedSearch ? { $or: [
    { name: { $regex: escapedSearch, $options: 'i' } },
    { medicalId: { $regex: escapedSearch, $options: 'i' } },
    { nationalId: { $regex: escapedSearch, $options: 'i' } },
  ] } : {};

  const [data, total] = await Promise.all([
    Patient.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Patient.countDocuments(filter),
  ]);

  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

async function getPatient(req, res) {
  const patient = await Patient.findById(req.params.id).lean();
  if (!patient) return res.status(404).json({ success: false, message: 'المريض غير موجود' });
  res.json({ success: true, data: patient });
}

async function createPatient(req, res) {
  const payload = patientInput.parse(req.body);

  const existingByMedicalId = await Patient.findOne({ medicalId: payload.medicalId }).lean();
  if (existingByMedicalId) {
    return res.status(409).json({
      success: false,
      message: `الرقم الطبي (${payload.medicalId}) مستخدم بالفعل للمريض "${existingByMedicalId.name}". استخدم رقمًا طبيًا مختلفًا.`,
      code: 'MEDICAL_ID_EXISTS'
    });
  }

  // Prevent accidental duplication when the same card number belongs to a
  // different patient, while still allowing an empty optional card field.
  if (payload.nationalId) {
    const existingByNationalId = await Patient.findOne({ nationalId: payload.nationalId }).lean();
    if (existingByNationalId) {
      return res.status(409).json({
        success: false,
        message: `رقم البطاقة (${payload.nationalId}) مستخدم بالفعل للمريض "${existingByNationalId.name}".`,
        code: 'NATIONAL_ID_EXISTS'
      });
    }
  }

  const patient = await Patient.create(payload);
  res.status(201).json({ success: true, data: patient.toObject() });
}

async function updatePatient(req, res) {
  const payload = patientInput.partial().parse(req.body);
  const current = await Patient.findById(req.params.id).lean();
  if (!current) return res.status(404).json({ success: false, message: 'المريض غير موجود' });

  if (payload.medicalId && payload.medicalId !== current.medicalId) {
    const duplicateMedical = await Patient.findOne({ medicalId: payload.medicalId, _id: { $ne: req.params.id } }).lean();
    if (duplicateMedical) {
      return res.status(409).json({
        success: false,
        message: `الرقم الطبي (${payload.medicalId}) مستخدم بالفعل للمريض "${duplicateMedical.name}".`,
        code: 'MEDICAL_ID_EXISTS'
      });
    }
  }

  if (payload.nationalId && payload.nationalId !== current.nationalId) {
    const duplicateNational = await Patient.findOne({ nationalId: payload.nationalId, _id: { $ne: req.params.id } }).lean();
    if (duplicateNational) {
      return res.status(409).json({
        success: false,
        message: `رقم البطاقة (${payload.nationalId}) مستخدم بالفعل للمريض "${duplicateNational.name}".`,
        code: 'NATIONAL_ID_EXISTS'
      });
    }
  }

  const patient = await Patient.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }).lean();
  res.json({ success: true, data: patient });
}

async function deletePatient(req, res) {
  const session = await Patient.startSession();
  try {
    let deleted = null;
    await session.withTransaction(async () => {
      deleted = await Patient.findByIdAndDelete(req.params.id, { session });
      if (!deleted) throw Object.assign(new Error('المريض غير موجود'), { statusCode: 404 });
      await Promise.all([
        Prescription.deleteMany({ patientId: deleted._id }, { session }),
        LabRequest.deleteMany({ patientId: deleted._id }, { session }),
      ]);
    });
    res.json({ success: true, message: 'تم حذف المريض والبيانات المرتبطة به' });
  } finally {
    await session.endSession();
  }
}

module.exports = { listPatients, getPatient, createPatient, updatePatient, deletePatient };
