const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  brandName: {
    type: String,
    required: true,
    trim: true
  },
  slogan: {
    type: String,
    trim: true
  },
  logoUrl: {
    type: String
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  brandColor: {
    type: String,
    trim: true
  },
  targetAudience: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  }
}, {
  timestamps: true
});

// 인덱스
brandSchema.index({ brandName: 1 });
brandSchema.index({ category: 1 });
brandSchema.index({ status: 1 });

module.exports = mongoose.model('Brand', brandSchema);