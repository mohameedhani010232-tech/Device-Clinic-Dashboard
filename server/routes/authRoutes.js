const express = require('express');
const { login, requireAuth } = require('../middleware/auth');
const router = express.Router();
router.post('/login', login);
router.get('/me', requireAuth, (req, res) => res.json({ success: true, authenticated: true, expiresAt: req.auth.exp }));
module.exports = router;
