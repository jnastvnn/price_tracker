import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import CategoryController from '../controllers/category.controller.js';
import { 
  validateCategoryQuery as validateCategoryId,
  validateSubcategoriesQuery,
  validateModelsQuery,
  validateBrandsQuery 
} from '../middleware/validation.js';

const router = express.Router();

router.get('/', asyncHandler(CategoryController.listLevel1));
router.get('/:id', validateCategoryId, asyncHandler(CategoryController.getOne));
router.get('/:id/subcategories', validateSubcategoriesQuery, asyncHandler(CategoryController.subcategories));
router.get('/:id/models', validateModelsQuery, asyncHandler(CategoryController.modelsWithAvgPrice));
router.get('/:id/brands', validateBrandsQuery, asyncHandler(CategoryController.brandsWithAvgPrice));

export default router;