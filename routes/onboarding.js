const express = require('express');
const router = express.Router();
const Brand = require('../models/Brand');
const Store = require('../models/Store');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const OnboardingService = require('../services/onboardingService');
const { success, badRequest, notFound, serverError } = require('../utils/response');

// 온보딩 - 브랜드 생성
router.post('/brand', authenticateToken, asyncHandler(async (req, res) => {
    const {
        brandName,
        slogan,
        category,
        description,
        brandColor,
        targetAudience
    } = req.body;

    // 기존 브랜드 확인
    const existingBrand = await Brand.findOne({ userId: req.user._id });
    if (existingBrand) {
        return badRequest(res, '이미 브랜드가 존재합니다.');
    }

    // 브랜드 생성
    const brand = new Brand({
        userId: req.user._id,
        brandName,
        slogan,
        category,
        description,
        brandColor,
        targetAudience,
        status: 'active'
    });

    await brand.save();

    success(res, { brand }, '브랜드가 성공적으로 생성되었습니다.', 201);
}));

// 온보딩 - 스토어 생성 및 템플릿 선택
router.post('/store', authenticateToken, asyncHandler(async (req, res) => {
    const {
        storeName,
        subdomain,
        description,
        templateType, // 'Beauty', 'Chic', 'Cozy'
        templateColor,
        bannerImageUrl
    } = req.body;

    // 브랜드 확인
    const brand = await Brand.findOne({ userId: req.user._id });
    if (!brand) {
        return notFound(res, '먼저 브랜드를 생성해주세요.');
    }

    // 서브도메인 중복 확인
    const existingStore = await Store.findOne({ subdomain });
    if (existingStore) {
        return badRequest(res, '이미 사용 중인 서브도메인입니다.');
    }

    // 서브도메인 유효성 검사 (영문 소문자, 숫자, 하이픈만 허용)
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(subdomain)) {
        return badRequest(res, '서브도메인은 영문 소문자, 숫자, 하이픈(-)만 사용 가능합니다.');
    }

    // 스토어 생성
    const store = new Store({
        brandId: brand._id,
        userId: req.user._id,
        storeName,
        subdomain: subdomain.toLowerCase(),
        description,
        templateType,
        templateColor,
        bannerImageUrl,
        status: 'active',
        isPublished: false
    });

    await store.save();

    success(res, {
        store,
        storeUrl: `http://${subdomain}.${process.env.STORE_DOMAIN || 'localhost'}:${process.env.STORE_PORT || '3001'}`
    }, '스토어가 성공적으로 생성되었습니다.', 201);
}));

// 온보딩 완료 - 스토어 퍼블리시
router.post('/publish/:storeId', authenticateToken, asyncHandler(async (req, res) => {
    const store = await Store.findOne({
        _id: req.params.storeId,
        userId: req.user._id
    });

    if (!store) {
        return notFound(res, '스토어를 찾을 수 없습니다.');
    }

    store.isPublished = true;
    await store.save();

    success(res, {
        storeUrl: `http://${store.subdomain}.${process.env.STORE_DOMAIN || 'localhost'}:${process.env.STORE_PORT || '3001'}`
    }, '스토어가 성공적으로 공개되었습니다.');
}));

// 온보딩 상태 확인
router.get('/status', authenticateToken, asyncHandler(async (req, res) => {
    const status = await OnboardingService.getOnboardingStatus(req.user._id);
    success(res, status);
}));

// 온보딩 완료 - 통합 API (브랜드 + 스토어 한번에 생성)
router.post('/complete', authenticateToken, asyncHandler(async (req, res) => {
    const result = await OnboardingService.completeOnboarding(req.user._id, req.body);
    
    success(res, {
        message: '온보딩이 완료되었습니다.',
        brand: result.brand,
        store: {
            id: result.store._id,
            storeName: result.store.storeName,
            subdomain: result.store.subdomain,
            isPublished: result.store.isPublished,
            templateType: result.store.templateType
        },
        // 로컬 개발용 URL (쿼리 파라미터 방식)
        storeUrl: `http://localhost:${process.env.FRONTEND_PORT || '5173'}/?store=${result.store.subdomain}`,
        // 나중에 배포시 사용할 URL (서브도메인 방식)
        productionUrl: `https://${result.store.subdomain}.${process.env.MAIN_DOMAIN || 'yourdomain.com'}`
    });
}));

module.exports = router;