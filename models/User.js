const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: function() {
      return this.loginType === 'email';
    }
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String
  },
  hasOnboarded: {
    type: Boolean,
    default: false
  },
  storeName: {
    type: String,
    trim: true
  },
  loginType: {
    type: String,
    enum: ['email', 'google', 'kakao', 'naver'],
    default: 'email'
  },
  socialId: {
    type: String,
    sparse: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationCode: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  twoFactorSecret: {
    type: String
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    language: {
      type: String,
      enum: ['ko', 'en'],
      default: 'ko'
    },
    timezone: {
      type: String,
      default: 'Asia/Seoul'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  lastLoginAt: {
    type: Date
  }
}, {
  timestamps: true
});

// 인덱스 (이미 email은 unique로 생성됨)
userSchema.index({ socialId: 1, loginType: 1 });

// 비밀번호 해싱 미들웨어
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 비밀번호 검증 메서드
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// JSON 변환시 민감한 정보 제거
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.emailVerificationCode;
  delete user.resetPasswordToken;
  delete user.twoFactorSecret;
  delete user.__v;
  return user;
};

module.exports = mongoose.model('User', userSchema);