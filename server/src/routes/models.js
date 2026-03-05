import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import ModelController from '../controllers/model.controller.js';

const router = express.Router();

router.get('/:modelName/prices', asyncHandler(ModelController.pricesByModelName));
router.get('/prices', asyncHandler(ModelController.prices));

// Return the best image URL for a given model (and optional categoryId)
router.get('/image', asyncHandler(ModelController.image));

// Return canonical product info (name, brand, specs, images) by model_key or model name
router.get('/info', asyncHandler(ModelController.info));

export default router;
