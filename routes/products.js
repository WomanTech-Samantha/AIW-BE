const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const ProductDetailImage = require('../models/ProductDetailImage');
const Store = require('../models/Store');
const { loadStore } = require('../middleware/subdomain');
const { success, notFound, serverError, badRequest } = require('../utils/response');
const { asyncHandler } = require('../middleware/asyncHandler');
const ProductService = require('../services/productService');

// 특정 스토어의 상품 목록 조회
router.get('/store/:storeId', asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    const { category, featured, page = 1, limit = 12 } = req.query;
    
    const query = { 
        storeId, 
        status: 'active' 
    };
    
    if (category) {
        query.categoryId = category;
    }
    
    if (featured === 'true') {
        query.isFeatured = true;
    }
    
    const result = await ProductService.getProductsWithImages(query, { page, limit });
    return success(res, result);
}));

// 서브도메인 기반 상품 목록 조회
router.get('/current', loadStore, asyncHandler(async (req, res) => {
    if (!req.store) {
        return notFound(res, '스토어를 찾을 수 없습니다.');
    }
    
    const { category, featured, page = 1, limit = 12 } = req.query;
    
    const query = { 
        storeId: req.store._id, 
        status: 'active' 
    };
    
    if (category) {
        query.categoryId = category;
    }
    
    if (featured === 'true') {
        query.isFeatured = true;
    }
    
    const result = await ProductService.getProductsWithImages(query, { page, limit });
    return success(res, result);
}));

// 특정 상품 상세 조회
router.get('/:productId', asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const product = await ProductService.getProductDetail(productId);
    
    if (!product) {
        return notFound(res, '상품을 찾을 수 없습니다.');
    }
    
    return success(res, { product });
}));

module.exports = router;