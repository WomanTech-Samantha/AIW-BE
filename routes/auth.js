const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { generateTokens, authenticateToken, verifyRefreshToken } = require('../middleware/auth');
const { success, error, badRequest, unauthorized, conflict, notFound } = require('../utils/response');

const router = express.Router();

// 회원가입
router.post('/signup', async (req, res) => {
  console.log('[SIGNUP] Request received:', { email: req.body.email, name: req.body.name });
  try {
    const { email, password, name, phone } = req.body;

    // 필수 필드 검증
    if (!email || !password || !name) {
      return badRequest(res, '이메일, 비밀번호, 이름은 필수입니다');
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return badRequest(res, '올바른 이메일 형식이 아닙니다');
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      return badRequest(res, '비밀번호는 최소 6자 이상이어야 합니다');
    }

    // 중복 이메일 확인
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return conflict(res, '이미 가입된 이메일입니다');
    }

    // 사용자 생성
    const user = new User({
      email,
      password,
      name,
      phone: phone || undefined,
      loginType: 'email'
    });

    await user.save();

    // 토큰 생성
    const { accessToken, refreshToken } = generateTokens(user._id);

    // 응답 (비밀번호 제외)
    const userResponse = user.toJSON();

    console.log('[SIGNUP] Success:', { userId: user._id, email: user.email });
    
    success(res, {
      token: accessToken,
      refreshToken,
      user: userResponse
    }, '회원가입이 완료되었습니다', 201);

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SIGNUP_FAILED',
        message: '회원가입 중 오류가 발생했습니다'
      }
    });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  console.log('[LOGIN] Request received:', { email: req.body.email });
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return badRequest(res, '이메일과 비밀번호를 입력하세요');
    }

    // 사용자 찾기
    const user = await User.findOne({ email, loginType: 'email' });
    if (!user) {
      return unauthorized(res, '이메일 또는 비밀번호가 일치하지 않습니다');
    }

    // 계정 상태 확인
    if (user.status !== 'active') {
      return unauthorized(res, '계정이 비활성화되었습니다');
    }

    // 비밀번호 검증
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return unauthorized(res, '이메일 또는 비밀번호가 일치하지 않습니다');
    }

    // 마지막 로그인 시간 업데이트
    user.lastLoginAt = new Date();
    await user.save();

    // 토큰 생성
    const { accessToken, refreshToken } = generateTokens(user._id);

    console.log('[LOGIN] Success:', { userId: user._id, email: user.email });

    success(res, {
      token: accessToken,
      refreshToken,
      user: user.toJSON()
    }, '로그인되었습니다');

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: '로그인 중 오류가 발생했습니다'
      }
    });
  }
});

// 토큰 갱신
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return badRequest(res, '리프레시 토큰이 필요합니다');
    }

    // 리프레시 토큰 검증
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId);

    if (!user || user.status !== 'active') {
      return unauthorized(res, '유효하지 않은 토큰입니다');
    }

    // 새 토큰 생성
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);

    success(res, {
      token: accessToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return unauthorized(res, '유효하지 않은 리프레시 토큰입니다');
    }
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: '토큰 갱신 중 오류가 발생했습니다'
      }
    });
  }
});

// 토큰 검증
router.get('/validate', authenticateToken, async (req, res) => {
  success(res, {
    user: req.user
  }, '유효한 토큰입니다');
});

// 로그아웃 (클라이언트에서 토큰 삭제 처리)
router.post('/logout', authenticateToken, async (req, res) => {
  success(res, null, '로그아웃되었습니다');
});

// 이메일 중복 확인
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return badRequest(res, '이메일을 입력하세요');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return badRequest(res, '올바른 이메일 형식이 아닙니다');
    }

    const existingUser = await User.findOne({ email });
    const available = !existingUser;

    success(res, {
      available,
      message: available ? '사용 가능한 이메일입니다' : '이미 사용 중인 이메일입니다'
    });

  } catch (error) {
    console.error('Email check error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EMAIL_CHECK_FAILED',
        message: '이메일 확인 중 오류가 발생했습니다'
      }
    });
  }
});

// 비밀번호 변경 (로그인 상태)
router.patch('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return badRequest(res, '모든 필드를 입력하세요');
    }

    if (newPassword !== confirmPassword) {
      return badRequest(res, '새 비밀번호가 일치하지 않습니다');
    }

    if (newPassword.length < 6) {
      return badRequest(res, '비밀번호는 최소 6자 이상이어야 합니다');
    }

    const user = await User.findById(req.user._id);
    
    // 현재 비밀번호 확인
    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      return unauthorized(res, '현재 비밀번호가 일치하지 않습니다');
    }

    // 새 비밀번호 설정
    user.password = newPassword;
    await user.save();

    success(res, null, '비밀번호가 성공적으로 변경되었습니다');

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PASSWORD_CHANGE_FAILED',
        message: '비밀번호 변경 중 오류가 발생했습니다'
      }
    });
  }
});

module.exports = router;