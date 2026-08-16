function notFound(req, res) {
  res.status(404).json({ success: false, message: 'المسار المطلوب غير موجود' });
}

function duplicateFieldMessage(err) {
  const keyPattern = err?.keyPattern || {};
  const keyValue = err?.keyValue || {};

  if (keyPattern.medicalId || Object.prototype.hasOwnProperty.call(keyValue, 'medicalId')) {
    return `الرقم الطبي (${keyValue.medicalId || ''}) مستخدم بالفعل لمريض آخر.`;
  }
  if (keyPattern.nationalId || Object.prototype.hasOwnProperty.call(keyValue, 'nationalId')) {
    return `رقم البطاقة (${keyValue.nationalId || ''}) مستخدم بالفعل لمريض آخر.`;
  }
  if (keyPattern.name || Object.prototype.hasOwnProperty.call(keyValue, 'name')) {
    return `القيمة (${keyValue.name || ''}) مستخدمة بالفعل.`;
  }
  return 'هناك بيانات مكررة في قاعدة البيانات. راجع الرقم الطبي ورقم البطاقة وحاول مرة أخرى.';
}

function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}]`, err);
  if (err?.name === 'ZodError') {
    return res.status(400).json({ success: false, message: 'بيانات غير صالحة', errors: err.issues?.map(i => i.message) || [] });
  }
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: 'بيانات غير صالحة', errors: Object.values(err.errors || {}).map(e => e.message) });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'معرّف غير صالح' });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ success: false, message: duplicateFieldMessage(err), code: 'DUPLICATE_KEY' });
  }
  res.status(err?.statusCode || 500).json({ success: false, message: err?.message || 'حدث خطأ في الخادم' });
}

module.exports = { notFound, errorHandler };
