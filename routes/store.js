const express = require('express');
const router = express.Router();
const Store = require('../models/Store');
const Brand = require('../models/Brand');
const { loadStore } = require('../middleware/subdomain');
const { authenticateToken } = require('../middleware/auth');
const { success, notFound, serverError, badRequest } = require('../utils/response');
const { asyncHandler } = require('../middleware/asyncHandler');

// 사용자의 스토어 정보 가져오기 (인증 필요)
router.get('/my', authenticateToken, async (req, res) => {
    try {
        const store = await Store.findOne({ 
            userId: req.user._id,
            status: 'active'
        }).populate('brandId');

        if (!store) {
            return notFound(res, '스토어를 찾을 수 없습니다.');
        }

        return success(res, {
            store: {
                id: store._id,
                storeName: store.storeName,
                subdomain: store.subdomain,
                description: store.description,
                bannerImageUrl: store.bannerImageUrl,
                templateType: store.templateType,
                templateColor: store.templateColor,
                isPublished: store.isPublished,
                visitorCount: store.visitorCount
            },
            brand: store.brandId ? {
                id: store.brandId._id,
                brandName: store.brandId.brandName,
                slogan: store.brandId.slogan,
                logoUrl: store.brandId.logoUrl,
                category: store.brandId.category,
                description: store.brandId.description,
                brandColor: store.brandId.brandColor,
                targetAudience: store.brandId.targetAudience
            } : null
        });
    } catch (error) {
        console.error('사용자 스토어 조회 오류:', error);
        return serverError(res, '스토어 정보 조회 중 오류가 발생했습니다.');
    }
});

// 서브도메인으로 접속한 스토어 정보 가져오기
router.get('/current', loadStore, async (req, res) => {
    if (!req.store) {
        return notFound(res, '스토어를 찾을 수 없습니다.');
    }

    try {
        return success(res, {
            store: {
                id: req.store._id,
                storeName: req.store.storeName,
                subdomain: req.store.subdomain,
                description: req.store.description,
                bannerImageUrl: req.store.bannerImageUrl,
                templateType: req.store.templateType,
                templateColor: req.store.templateColor,
                visitorCount: req.store.visitorCount
            },
            brand: {
                id: req.brand._id,
                brandName: req.brand.brandName,
                slogan: req.brand.slogan,
                logoUrl: req.brand.logoUrl,
                category: req.brand.category,
                description: req.brand.description,
                brandColor: req.brand.brandColor,
                targetAudience: req.brand.targetAudience
            }
        });
    } catch (error) {
        console.error('스토어 정보 조회 오류:', error);
        return serverError(res, '스토어 정보 조회 중 오류가 발생했습니다.');
    }
});

// 특정 서브도메인의 스토어 정보 가져오기 (관리자용)
router.get('/by-subdomain/:subdomain', async (req, res) => {
    try {
        const store = await Store.findOne({ 
            subdomain: req.params.subdomain.toLowerCase(),
            status: 'active'
        }).populate('brandId');

        if (!store) {
            return notFound(res, '스토어를 찾을 수 없습니다.');
        }

        return success(res, {
            store: {
                id: store._id,
                storeName: store.storeName,
                subdomain: store.subdomain,
                description: store.description,
                bannerImageUrl: store.bannerImageUrl,
                templateType: store.templateType,
                templateColor: store.templateColor,
                isPublished: store.isPublished,
                status: store.status,
                visitorCount: store.visitorCount,
                createdAt: store.createdAt
            },
            brand: store.brandId ? {
                id: store.brandId._id,
                brandName: store.brandId.brandName,
                slogan: store.brandId.slogan,
                logoUrl: store.brandId.logoUrl,
                category: store.brandId.category,
                description: store.brandId.description,
                brandColor: store.brandId.brandColor,
                targetAudience: store.brandId.targetAudience
            } : null
        });
    } catch (error) {
        console.error('스토어 정보 조회 오류:', error);
        return serverError(res, '스토어 정보 조회 중 오류가 발생했습니다.');
    }
});

// 디버깅용: 모든 스토어 목록 조회 (개발 환경에서만)
router.get('/debug/all', async (req, res) => {
    try {
        const stores = await Store.find({})
            .select('subdomain storeName status isPublished userId createdAt')
            .sort('-createdAt');
        
        return success(res, {
            total: stores.length,
            stores: stores.map(s => ({
                subdomain: s.subdomain,
                storeName: s.storeName,
                status: s.status,
                isPublished: s.isPublished,
                userId: s.userId,
                createdAt: s.createdAt
            }))
        });
    } catch (error) {
        console.error('스토어 목록 조회 오류:', error);
        return serverError(res, '스토어 목록 조회 중 오류가 발생했습니다.');
    }
});

// 디버깅용: 스토어가 있는 사용자들의 hasOnboarded 플래그 수정
router.post('/debug/fix-onboarding', async (req, res) => {
    try {
        const User = require('../models/User');
        
        // 스토어가 있는 모든 사용자 ID 조회
        const stores = await Store.find({ status: 'active' }).distinct('userId');
        
        // 해당 사용자들의 hasOnboarded를 true로 업데이트
        const result = await User.updateMany(
            { _id: { $in: stores }, hasOnboarded: false },
            { $set: { hasOnboarded: true } }
        );
        
        return success(res, {
            message: 'hasOnboarded 플래그가 업데이트되었습니다.',
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            updatedUsers: stores.length
        });
    } catch (error) {
        console.error('hasOnboarded 업데이트 오류:', error);
        return serverError(res, 'hasOnboarded 업데이트 중 오류가 발생했습니다.');
    }
});

// 모든 공개 스토어 목록 조회
router.get('/public', asyncHandler(async (req, res) => {
    const stores = await Store.find({ 
        isPublished: true,
        status: 'active'
    })
    .populate('brandId')
    .sort('-createdAt')
    .limit(20);

    const storeList = stores.map(store => ({
        id: store._id,
        storeName: store.storeName,
        subdomain: store.subdomain,
        description: store.description,
        templateType: store.templateType,
        bannerImageUrl: store.bannerImageUrl,
        brandName: store.brandId?.brandName,
        category: store.brandId?.category,
        visitorCount: store.visitorCount,
        createdAt: store.createdAt
    }));

    return success(res, { stores: storeList });
}));

// 템플릿 타입별 스토어 조회
router.get('/by-template/:templateType', asyncHandler(async (req, res) => {
    const { templateType } = req.params;
    
    if (!['Beauty', 'Chic', 'Cozy'].includes(templateType)) {
        return badRequest(res, '유효하지 않은 템플릿 타입입니다.');
    }

    const stores = await Store.find({ 
        templateType,
        isPublished: true,
        status: 'active'
    })
    .populate('brandId')
    .sort('-visitorCount')
    .limit(10);

    const storeList = stores.map(store => ({
        id: store._id,
        storeName: store.storeName,
        subdomain: store.subdomain,
        description: store.description,
        bannerImageUrl: store.bannerImageUrl,
        brandName: store.brandId?.brandName,
        category: store.brandId?.category,
        visitorCount: store.visitorCount
    }));

    return success(res, { 
        templateType,
        stores: storeList 
    });
}));

module.exports = router;