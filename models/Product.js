const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  comparePrice: {
    type: Number,
    min: 0
  },
  stockQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'active'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// 인덱스 (복합 인덱스 최적화)
productSchema.index({ storeId: 1, status: 1, isFeatured: -1, createdAt: -1 }); // 목록 조회 최적화
productSchema.index({ storeId: 1, sku: 1 }, { unique: true });
productSchema.index({ categoryId: 1, status: 1 });
productSchema.index({ price: 1 });
productSchema.index({ name: 'text', description: 'text' }); // 텍스트 검색용

module.exports = mongoose.model('Product', productSchema);