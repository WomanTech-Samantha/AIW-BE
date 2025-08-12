const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  storeName: {
    type: String,
    required: true,
    trim: true
  },
  subdomain: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  description: {
    type: String
  },
  bannerImageUrl: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  templateType: {
    type: String,
    required: true,
    trim: true
  },
  templateColor: {
    type: String,
    required: true,
    trim: true
  },
  visitorCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 인덱스 (복합 인덱스 최적화)
storeSchema.index({ subdomain: 1, status: 1, isPublished: 1 }); // 서브도메인 조회 최적화
storeSchema.index({ userId: 1, status: 1 });
storeSchema.index({ brandId: 1 });
storeSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Store', storeSchema);