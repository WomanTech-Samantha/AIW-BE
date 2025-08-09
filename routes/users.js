const express = require('express');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { success, badRequest, notFound } = require('../utils/response');

const router = express.Router();

// 현재 사용자 정보 조회
router.get('/me', authenticateToken, async (req, res) => {
  try {
    success(res, {
      user: req.user
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_USER_FAILED',
        message: '사용자 정보 조회 중 오류가 발생했습니다'
      }
    });
  }
});

// 사용자 정보 수정
router.patch('/me', authenticateToken, async (req, res) => {
  try {
    const { name, phone, profileImage } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return notFound(res, '사용자를 찾을 수 없습니다');
    }

    // 업데이트할 필드들
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (profileImage !== undefined) updates.profileImage = profileImage;

    // 업데이트 실행
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    success(res, {
      user: updatedUser
    }, '사용자 정보가 수정되었습니다');

  } catch (error) {
    console.error('Update user error:', error);
    if (error.name === 'ValidationError') {
      return badRequest(res, '입력 데이터가 유효하지 않습니다', error.errors);
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_USER_FAILED',
        message: '사용자 정보 수정 중 오류가 발생했습니다'
      }
    });
  }
});

// 사용자 설정 조회
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences');
    
    success(res, {
      preferences: user.preferences
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_PREFERENCES_FAILED',
        message: '설정 조회 중 오류가 발생했습니다'
      }
    });
  }
});

// 사용자 설정 수정
router.patch('/preferences', authenticateToken, async (req, res) => {
  try {
    const { notifications, language, timezone } = req.body;
    
    const updates = {};
    if (notifications) {
      updates['preferences.notifications'] = {
        ...req.user.preferences.notifications,
        ...notifications
      };
    }
    if (language) updates['preferences.language'] = language;
    if (timezone) updates['preferences.timezone'] = timezone;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    success(res, {
      preferences: updatedUser.preferences
    }, '설정이 저장되었습니다');

  } catch (error) {
    console.error('Update preferences error:', error);
    if (error.name === 'ValidationError') {
      return badRequest(res, '설정 데이터가 유효하지 않습니다', error.errors);
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PREFERENCES_FAILED',
        message: '설정 수정 중 오류가 발생했습니다'
      }
    });
  }
});

// 사용자 통계
router.get('/me/stats', authenticateToken, async (req, res) => {
  try {
    const Store = require('../models/Store');
    const Analytics = require('../models/Analytics');

    // 기본 사용자 정보
    const user = req.user;

    // 스토어 수
    const totalStores = await Store.countDocuments({ userId: user._id });

    // 최근 30일 분석 데이터 (임시 데이터)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 실제로는 Analytics 모델에서 데이터를 가져와야 함
    const stats = {
      joinedAt: user.createdAt,
      lastLogin: user.lastLoginAt,
      totalStores,
      totalProducts: 0, // Product 모델 생성 후 구현
      totalOrders: 0,   // Order 모델 생성 후 구현
      totalRevenue: 0,  // Order 모델 생성 후 구현
      instagramPosts: 0, // Instagram 연동 후 구현
      contentGenerated: 0 // Asset Studio 사용량
    };

    success(res, stats);

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_STATS_FAILED',
        message: '통계 조회 중 오류가 발생했습니다'
      }
    });
  }
});

// 계정 삭제
router.delete('/me', authenticateToken, async (req, res) => {
  try {
    const { password, reason, confirmation } = req.body;

    if (!password || confirmation !== 'DELETE_MY_ACCOUNT') {
      return badRequest(res, '계정 삭제 확인이 필요합니다');
    }

    const user = await User.findById(req.user._id);
    
    // 비밀번호 확인 (소셜 로그인 사용자는 스킵)
    if (user.loginType === 'email') {
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return badRequest(res, '비밀번호가 일치하지 않습니다');
      }
    }

    // 관련 데이터 삭제 (실제로는 더 복잡한 로직 필요)
    const Store = require('../models/Store');
    await Store.deleteMany({ userId: user._id });

    // 사용자 계정 삭제
    await User.findByIdAndDelete(user._id);

    success(res, {
      message: '계정이 삭제되었습니다',
      deletedAt: new Date()
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_ACCOUNT_FAILED',
        message: '계정 삭제 중 오류가 발생했습니다'
      }
    });
  }
});

module.exports = router;