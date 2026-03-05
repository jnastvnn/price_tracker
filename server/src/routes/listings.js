import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import ListingController from '../controllers/listing.controller.js';
import { validateListingsQuery, validatePriceRange, validateId } from '../middleware/validation.js';

const router = express.Router();

router.get('/', validateListingsQuery, validatePriceRange, asyncHandler(ListingController.list));
router.get('/brands', asyncHandler(ListingController.brands));
router.get('/by-model-key', asyncHandler(ListingController.byModelKey));
router.get('/grouped-by-model-key', asyncHandler(ListingController.listByModelKey));
router.get('/:id', validateId(), asyncHandler(ListingController.getOne));

export default router; 