require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectDatabase } = require('../server/config/database');
const patientRoutes = require('../server/routes/patientRoutes');
const prescriptionRoutes = require('../server/routes/prescriptionRoutes');
const labRoutes = require('../server/routes/labRoutes');
const jobRoutes = require('../server/routes/jobRoutes');
const { notFound, errorHandler } = require('../server/middleware/errorHandler');
const { requireAuth } = require('../server/middleware/auth');
const authRoutes = require('../server/routes/authRoutes');
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'محاولات دخول كثيرة. حاول بعد قليل.' } });

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
const allowedOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Browser requests from the same origin have no Origin header.
    if (!origin) return callback(null, true);
    if (!allowedOrigins.length || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin غير مسموح به'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '7mb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.options('*', (req, res) => res.sendStatus(200));

app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await connectDatabase();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json({ success: true, database: 'mongodb', status: 'online' });
  } catch (err) {
    console.error('Health check database error:', err);
    res.status(503).json({ success: false, database: 'mongodb', status: 'offline', message: 'قاعدة البيانات غير متاحة حالياً' });
  }
});

app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  try {
    await connectDatabase();
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ success: false, message: 'تعذر الاتصال بقاعدة البيانات: ' + (err.message || err) });
  }
});

app.use('/api', requireAuth);
app.use('/api/patients', patientRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/jobs', jobRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
