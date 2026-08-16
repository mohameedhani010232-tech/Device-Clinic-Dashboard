const express = require('express');
const c = require('../controllers/labController');
const asyncHandler = require('../middleware/asyncHandler');
const r = express.Router();

r.get('/', asyncHandler(c.listAll));
r.get('/patient/:patientId', asyncHandler(c.list));
r.post('/patient/:patientId', asyncHandler(c.create));
r.patch('/:id', asyncHandler(c.update));
r.delete('/:id', asyncHandler(c.remove));

module.exports = r;
