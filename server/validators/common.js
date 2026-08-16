const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'معرّف غير صالح');

const patientInput = z.object({
  medicalId: z.string().trim().min(1).max(100),
  nationalId: z.string().trim().max(100).optional().default(''),
  name: z.string().trim().min(2).max(150),
  system: z.string().trim().max(200).optional().default(''),
  job: z.string().trim().max(150).optional().default(''),
  doctorName: z.string().trim().max(150).optional().default(''),
  imageUrl: z.string().trim().optional().default(''),
});

module.exports = { objectId, patientInput };

