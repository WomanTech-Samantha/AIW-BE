const Product = require('../models/Product');
const ProductDetailImage = require('../models/ProductDetailImage');
const mongoose = require('mongoose');

class ProductService {
  /**
   * 상품 목록 조회 (이미지 포함, N+1 문제 해결)
   */
  static async getProductsWithImages(query, options = {}) {
    const { page = 1, limit = 12, sort = { isFeatured: -1, createdAt: -1 } } = options;
    const skip = (page - 1) * limit;

    // 상품 목록 조회
    const products = await Product.find(query)
      .populate('categoryId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    // 모든 상품 ID 수집
    const productIds = products.map(p => p._id);

    // 한 번의 쿼리로 모든 이미지 가져오기 (N+1 문제 해결)
    const allImages = await ProductDetailImage.find({
      productId: { $in: productIds }
    }).sort({ productId: 1, sortOrder: 1 });

    // 이미지를 상품별로 그룹화
    const imagesByProduct = {};
    allImages.forEach(img => {
      const productId = img.productId.toString();
      if (!imagesByProduct[productId]) {
        imagesByProduct[productId] = [];
      }
      imagesByProduct[productId].push({
        url: img.imageUrl,
        type: img.imageType,
        alt: img.altText
      });
    });

    // 상품 데이터와 이미지 결합
    const productsWithImages = products.map(product => ({
      id: product._id,
      name: product.name,
      description: product.description,
      price: product.price,
      comparePrice: product.comparePrice,
      stockQuantity: product.stockQuantity,
      category: product.categoryId,
      isFeatured: product.isFeatured,
      viewCount: product.viewCount,
      images: imagesByProduct[product._id.toString()] || [],
      createdAt: product.createdAt
    }));

    return {
      products: productsWithImages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 카테고리별 상품 수 계산 (aggregation 사용)
   */
  static async getCategoriesWithProductCount(categoryFilter = { status: 'active' }) {
    const categories = await Product.aggregate([
      { $match: { status: 'active' } },
      { 
        $group: {
          _id: '$categoryId',
          count: { $sum: 1 }
        }
      }
    ]);

    // 카테고리 정보와 카운트 결합
    const categoryCountMap = {};
    categories.forEach(c => {
      if (c._id) {
        categoryCountMap[c._id.toString()] = c.count;
      }
    });

    const Category = require('../models/Category');
    const allCategories = await Category.find(categoryFilter)
      .populate('parentId')
      .sort({ sortOrder: 1, name: 1 });

    return allCategories.map(category => ({
      id: category._id,
      name: category.name,
      parentId: category.parentId,
      sortOrder: category.sortOrder,
      productCount: categoryCountMap[category._id.toString()] || 0,
      createdAt: category.createdAt
    }));
  }

  /**
   * 상품 상세 조회 (조회수 증가 포함)
   */
  static async getProductDetail(productId) {
    // 조회수 증가와 상품 조회를 동시에 처리
    const [product, _] = await Promise.all([
      Product.findById(productId)
        .populate('categoryId')
        .populate('storeId'),
      Product.findByIdAndUpdate(productId, { $inc: { viewCount: 1 } })
    ]);

    if (!product) {
      return null;
    }

    // 상품 이미지 조회
    const images = await ProductDetailImage.find({ 
      productId: product._id 
    }).sort({ sortOrder: 1 });

    return {
      id: product._id,
      name: product.name,
      description: product.description,
      price: product.price,
      comparePrice: product.comparePrice,
      stockQuantity: product.stockQuantity,
      category: product.categoryId,
      store: product.storeId,
      isFeatured: product.isFeatured,
      viewCount: product.viewCount + 1,
      images: images.map(img => ({
        url: img.imageUrl,
        type: img.imageType,
        alt: img.altText
      })),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };
  }

  /**
   * 대량 상품 조회 최적화 (aggregation pipeline)
   */
  static async getProductsOptimized(storeId, filters = {}) {
    const pipeline = [
      // 1. 스토어와 상태 필터
      { 
        $match: { 
          storeId: mongoose.Types.ObjectId(storeId),
          status: 'active',
          ...filters
        }
      },
      // 2. 카테고리 조인
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      // 3. 이미지 조인
      {
        $lookup: {
          from: 'productdetailimages',
          localField: '_id',
          foreignField: 'productId',
          as: 'images'
        }
      },
      // 4. 정렬
      { $sort: { isFeatured: -1, createdAt: -1 } },
      // 5. 필드 정리
      {
        $project: {
          name: 1,
          description: 1,
          price: 1,
          comparePrice: 1,
          stockQuantity: 1,
          category: { $arrayElemAt: ['$category', 0] },
          isFeatured: 1,
          viewCount: 1,
          images: {
            $map: {
              input: '$images',
              as: 'img',
              in: {
                url: '$$img.imageUrl',
                type: '$$img.imageType',
                alt: '$$img.altText'
              }
            }
          },
          createdAt: 1
        }
      }
    ];

    return await Product.aggregate(pipeline);
  }
}

module.exports = ProductService;