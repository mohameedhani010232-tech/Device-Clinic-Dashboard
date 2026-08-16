const mongoose = require('mongoose');

let connectionPromise = null;
let indexesEnsured = false;

async function ensurePatientIndexes() {
  if (indexesEnsured) return;

  const Patient = require('../models/Patient');

  // Inspect existing indexes before asking Mongoose to create the schema's
  // indexes. Older deployments may have incompatible uniqueness settings.
  const existing = await Patient.collection.indexes();

  for (const index of existing) {
    if (index.name === '_id_') continue;

    const key = index.key || {};
    const isSingleField = Object.keys(key).length === 1;
    const field = isSingleField ? Object.keys(key)[0] : null;

    // Current app rules:
    // - medicalId must be UNIQUE.
    // - nationalId is optional and must NOT be UNIQUE.
    // Drop stale single-field indexes when their uniqueness conflicts with
    // the current schema, then recreate the correct indexes below.
    const shouldBeUnique = field === 'medicalId';
    const shouldNotBeUnique = field === 'nationalId';

    if ((shouldBeUnique && index.unique !== true) ||
        (shouldNotBeUnique && index.unique === true)) {
      await Patient.collection.dropIndex(index.name);
      console.log(`Dropped incompatible patient index: ${index.name}`);
    }
  }

  // Create/refresh indexes declared by the current schema.
  await Patient.createIndexes();
  indexesEnsured = true;
}

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    if (!indexesEnsured) await ensurePatientIndexes();
    return;
  }

  if (connectionPromise) {
    await connectionPromise;
    if (!indexesEnsured) await ensurePatientIndexes();
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured');

  mongoose.set('strictQuery', true);
  // Disable Mongoose's automatic index build so we can reconcile legacy
  // MongoDB indexes before creating the current schema indexes.
  mongoose.set('autoIndex', false);

  connectionPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 10000,
    maxPoolSize: 10,
    maxConnecting: 2,
  }).then(async () => {
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
    await ensurePatientIndexes();
  }).finally(() => {
    connectionPromise = null;
  });

  await connectionPromise;
}

async function disconnectDatabase() {
  indexesEnsured = false;
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };
