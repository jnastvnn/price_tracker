import express from 'express';
import ProductModel from '../models/ProductModel.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();

router.get('/:modelName/prices', asyncHandler(async (req, res) => {
  const { modelName } = req.params;
  const { categoryId } = req.query;
  const decodedModelName = decodeURIComponent(modelName);
  const priceHistory = await ProductModel.getModelPriceHistory(decodedModelName, categoryId);
  res.json({ success: true, data: priceHistory });
}));

router.get('/prices', asyncHandler(async (req, res) => {
  const { model: modelQuery, categoryId } = req.query;
  if (!modelQuery) {
    return res.status(400).json({ success: false, error: 'Model parameter is required' });
  }
  const modelName = decodeURIComponent(modelQuery);
  const priceHistory = await ProductModel.getModelPriceHistory(modelName, categoryId);
  res.json({ success: true, data: priceHistory });
}));

export default router;
