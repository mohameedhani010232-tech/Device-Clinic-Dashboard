const express = require('express');
const c = require('../controllers/jobController');
const asyncHandler = require('../middleware/asyncHandler');
const r = express.Router();

r.get('/', asyncHandler(c.list));
r.post('/', asyncHandler(c.create));
r.patch('/:id', asyncHandler(c.update));
r.delete('/:id', asyncHandler(c.remove));

module.exports = r;
