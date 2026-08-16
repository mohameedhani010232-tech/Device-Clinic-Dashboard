const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectDatabase } = require('./config/database');
const patientRoutes = require('./routes/patientRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const labRoutes = require('./routes/labRoutes');
const jobRoutes = require('./routes/jobRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'محاولات دخول كثيرة. حاول بعد قليل.' } });

const app = express();
app.set('trust proxy', 1);
const port = Number(process.env.PORT || 5000);

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '8mb' }));

app.use(cors({
  origin: process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*' ? process.env.CORS_ORIGIN.split(',').map(v => v.trim()).filter(Boolean) : true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// Preflight OPTIONS responder
app.options('*', (req, res) => res.sendStatus(200));

app.get('/api/health', async (req, res) => {
  try {
    await connectDatabase();
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, database: 'mongodb', status: 'online', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ success: false, database: 'mongodb', status: 'offline', message: 'قاعدة البيانات غير متاحة حالياً' });
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRoutes);

// Middleware to ensure DB connection on serverless requests
app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  try {
    await connectDatabase();
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ success: false, message: 'تعذر الاتصال بقاعدة البيانات. تأكد من إضافة MONGODB_URI في إعدادات Vercel' });
  }
});
app.use('/api', requireAuth);
app.use('/api/patients', patientRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(path.join(__dirname, '..')));
app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  connectDatabase().then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${port}`));
  }).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = app;
