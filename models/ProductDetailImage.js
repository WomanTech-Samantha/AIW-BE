const mongoose = require('mongoose');

const productDetailImageSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  imageUrl: {
    type: String,
    required: true,
    trim: true
  },
  imageType: {
    type: String,
    enum: ['main', 'detail', 'thumbnail'],
    default: 'main'
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  altText: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// 인덱스
productDetailImageSchema.index({ productId: 1, sortOrder: 1 });

module.exports = mongoose.model('ProductDetailImage', productDetailImageSchema);