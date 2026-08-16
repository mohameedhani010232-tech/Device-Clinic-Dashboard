require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectDatabase } = require('../config/database');
const Patient = require('../models/Patient');

async function main() {
  const file = process.argv[2] || path.join(process.cwd(), 'app-data', 'clinic-data.json');
  if (!fs.existsSync(file)) throw new Error(`Migration source not found: ${file}`);
  const source = JSON.parse(fs.readFileSync(file, 'utf8'));
  const patients = Array.isArray(source) ? source : source.patients || [];
  await connectDatabase();

  let imported = 0;
  for (const item of patients) {
    const medicalId = String(item.medicalId ?? item.nationalId ?? item.national_id ?? '').trim();
    if (!medicalId || !item.name) continue;
    await Patient.updateOne(
      { medicalId },
      { $set: {
        medicalId,
        nationalId: String(item.nationalId ?? item.national_id ?? item.idCard ?? item.id_card ?? ''),
        name: String(item.name).trim(),
        system: String(item.system ?? ''),
        job: String(item.job ?? ''),
        doctorName: String(item.doctorName ?? item.doctor_name ?? ''),
        imageUrl: String(item.imageUrl ?? item.image_url ?? item.image ?? ''),
      } },
      { upsert: true }
    );
    imported++;
  }
  console.log(`Imported/updated ${imported} patients.`);
  process.exit(0);
}

main().catch(error => { console.error(error); process.exit(1); });
