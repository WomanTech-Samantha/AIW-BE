const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const { loadStore } = require('../middleware/subdomain');
const { success, notFound, serverError } = require('../utils/response');
const { asyncHandler } = require('../middleware/asyncHandler');
const ProductService = require('../services/productService');

// 모든 카테고리 조회 (N+1 문제 해결)
router.get('/', asyncHandler(async (req, res) => {
    const categoriesWithCount = await ProductService.getCategoriesWithProductCount();
    return success(res, { categories: categoriesWithCount });
}));

// 특정 카테고리의 상품 조회
router.get('/:categoryId/products', async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { page = 1, limit = 12 } = req.query;
        
        const category = await Category.findById(categoryId);
        if (!category) {
            return notFound(res, '카테고리를 찾을 수 없습니다.');
        }
        
        const skip = (page - 1) * limit;
        
        const products = await Product.find({ 
            categoryId, 
            status: 'active' 
        })
        .populate('storeId')
        .sort({ isFeatured: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
        
        const total = await Product.countDocuments({ 
            categoryId, 
            status: 'active' 
        });
        
        return success(res, {
            category: {
                id: category._id,
                name: category.name,
                parentId: category.parentId
            },
            products: products.map(product => ({
                id: product._id,
                name: product.name,
                description: product.description,
                price: product.price,
                comparePrice: product.comparePrice,
                stockQuantity: product.stockQuantity,
                store: product.storeId,
                isFeatured: product.isFeatured,
                viewCount: product.viewCount,
                createdAt: product.createdAt
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('카테고리별 상품 조회 오류:', error);
        return serverError(res, '카테고리별 상품 조회 중 오류가 발생했습니다.');
    }
});

// 카테고리 상세 조회
router.get('/:categoryId', async (req, res) => {
    try {
        const { categoryId } = req.params;
        
        const category = await Category.findById(categoryId)
            .populate('parentId');
        
        if (!category) {
            return notFound(res, '카테고리를 찾을 수 없습니다.');
        }
        
        // 하위 카테고리 조회
        const subCategories = await Category.find({ 
            parentId: categoryId, 
            status: 'active' 
        }).sort({ sortOrder: 1, name: 1 });
        
        // 카테고리의 상품 수 계산
        const productCount = await Product.countDocuments({ 
            categoryId: category._id, 
            status: 'active' 
        });
        
        return success(res, {
            category: {
                id: category._id,
                name: category.name,
                parentId: category.parentId,
                sortOrder: category.sortOrder,
                productCount,
                subCategories: subCategories.map(sub => ({
                    id: sub._id,
                    name: sub.name,
                    sortOrder: sub.sortOrder
                })),
                createdAt: category.createdAt,
                updatedAt: category.updatedAt
            }
        });
    } catch (error) {
        console.error('카테고리 상세 조회 오류:', error);
        return serverError(res, '카테고리 정보 조회 중 오류가 발생했습니다.');
    }
});

module.exports = router;