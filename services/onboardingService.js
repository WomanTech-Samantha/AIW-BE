const Brand = require('../models/Brand');
const Store = require('../models/Store');
const User = require('../models/User');

class OnboardingService {
  /**
   * 온보딩 완료 처리 (브랜드 + 스토어 생성/업데이트)
   */
  static async completeOnboarding(userId, data) {
    const {
      business,
      storeName,
      theme,
      template,
      subdomain,
      brandImageUrl,
      tagline
    } = data;

    // 필수 필드 검증
    if (!business || !storeName || !theme || !template || !subdomain) {
      throw new Error('필수 정보가 누락되었습니다');
    }

    // 서브도메인 유효성 검사
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(subdomain)) {
      throw new Error('서브도메인은 영문 소문자, 숫자, 하이픈(-)만 사용 가능합니다');
    }

    // 서브도메인 중복 체크 (다른 사용자가 사용 중인지 확인)
    const existingStore = await Store.findOne({ 
      subdomain: subdomain.toLowerCase(),
      userId: { $ne: userId }
    });
    
    if (existingStore) {
      throw new Error('이미 사용 중인 서브도메인입니다');
    }

    // Brand 생성 또는 업데이트
    let brand = await Brand.findOne({ userId });
    
    if (!brand) {
      brand = new Brand({
        userId,
        brandName: business,
        slogan: tagline || '',
        logoUrl: brandImageUrl || '',
        category: 'general',
        brandColor: theme || '#000000',
        targetAudience: '',
        status: 'active'
      });
      await brand.save();
    } else {
      brand.brandName = business;
      brand.slogan = tagline || brand.slogan;
      brand.logoUrl = brandImageUrl || brand.logoUrl;
      brand.brandColor = theme || brand.brandColor;
      await brand.save();
    }

    // Store 생성 또는 업데이트
    let store = await Store.findOne({ userId });
    
    if (!store) {
      store = new Store({
        brandId: brand._id,
        userId,
        storeName,
        subdomain: subdomain.toLowerCase(),
        description: tagline || '',
        templateType: template,
        templateColor: theme || '#000000',
        bannerImageUrl: brandImageUrl || '',
        status: 'active',
        isPublished: true
      });
      await store.save();
    } else {
      store.storeName = storeName;
      store.subdomain = subdomain.toLowerCase();
      store.description = tagline || store.description;
      store.templateType = template;
      store.templateColor = theme || store.templateColor;
      store.bannerImageUrl = brandImageUrl || store.bannerImageUrl;
      store.isPublished = true;
      await store.save();
    }

    // 사용자 온보딩 상태 업데이트
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { hasOnboarded: true } },
      { new: true, runValidators: true }
    );

    return {
      user: updatedUser,
      brand,
      store
    };
  }

  /**
   * 사용자의 온보딩 상태 확인
   */
  static async getOnboardingStatus(userId) {
    const brand = await Brand.findOne({ userId });
    const store = await Store.findOne({ userId });

    return {
      hasBrand: !!brand,
      hasStore: !!store,
      isPublished: store?.isPublished || false,
      brand,
      store
    };
  }

  /**
   * 사용자 정보와 함께 스토어, 브랜드 정보 조회
   */
  static async getUserWithStoreAndBrand(user) {
    const store = await Store.findOne({ 
      userId: user._id,
      status: 'active' 
    });
    
    const brand = await Brand.findOne({ 
      userId: user._id,
      status: 'active' 
    });

    return {
      user: {
        ...user.toObject(),
        storeName: store?.storeName || null,
        subdomain: store?.subdomain || null,
        template: store?.templateType || null,
        theme: store?.templateColor || null,
        business: brand?.brandName || null,
        tagline: brand?.slogan || null,
        brandImageUrl: brand?.logoUrl || null,
        color: brand?.brandColor || null
      },
      store: store ? {
        id: store._id,
        storeName: store.storeName,
        subdomain: store.subdomain,
        isPublished: store.isPublished,
        templateType: store.templateType
      } : null,
      brand: brand ? {
        id: brand._id,
        brandName: brand.brandName,
        slogan: brand.slogan
      } : null
    };
  }
}

module.exports = OnboardingService;