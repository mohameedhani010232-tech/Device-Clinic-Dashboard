const express = require('express');
const controller = require('../controllers/patientController');
const asyncHandler = require('../middleware/asyncHandler');
const router = express.Router();

router.get('/', asyncHandler(controller.listPatients));
router.get('/:id', asyncHandler(controller.getPatient));
router.post('/', asyncHandler(controller.createPatient));
router.patch('/:id', asyncHandler(controller.updatePatient));
router.delete('/:id', asyncHandler(controller.deletePatient));

module.exports = router;
