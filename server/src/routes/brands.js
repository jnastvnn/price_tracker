import express from 'express';
import Brand from '../models/Brand.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();

router.get('/:brandName/prices', asyncHandler(async (req, res) => {
  const { brandName } = req.params;
  const { categoryId } = req.query;
  const decodedBrandName = decodeURIComponent(brandName);
  const priceHistory = await Brand.getBrandPriceHistory(decodedBrandName, categoryId);
  res.json({ success: true, data: priceHistory });
}));

export default router; 