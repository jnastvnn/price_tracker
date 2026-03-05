import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import BrandController from '../controllers/brand.controller.js';
import { validateBrandCoordinatesQuery } from '../middleware/validation.js';

const router = express.Router();

router.get('/:brandName/prices', asyncHandler(BrandController.prices));
router.get('/:brandName/analytics', asyncHandler(BrandController.getAnalytics));
router.get('/:brandName/coordinates', validateBrandCoordinatesQuery, asyncHandler(BrandController.getCoordinates));
router.get('/:brandName/categories', asyncHandler(BrandController.getCategories));

export default router; 
