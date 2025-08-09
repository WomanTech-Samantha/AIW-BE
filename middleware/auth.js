const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT 토큰 생성
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

// JWT 토큰 검증 미들웨어
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '액세스 토큰이 필요합니다'
        }
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '사용자를 찾을 수 없습니다'
        }
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'USER_SUSPENDED',
          message: '계정이 비활성화되었습니다'
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: '토큰이 만료되었습니다'
        }
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: '유효하지 않은 토큰입니다'
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다'
      }
    });
  }
};

// 리프레시 토큰 검증
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw error;
  }
};

// 옵셔널 인증 (토큰이 있으면 검증, 없어도 통과)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (user && user.status === 'active') {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // 토큰 검증 실패해도 계속 진행
    next();
  }
};

// 관리자 권한 체크 (나중에 확장용)
const requireAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '인증이 필요합니다'
      }
    });
  }

  // 관리자 체크 로직 (User 모델에 role 필드 추가 필요)
  // if (req.user.role !== 'admin') {
  //   return res.status(403).json({
  //     success: false,
  //     error: {
  //       code: 'FORBIDDEN',
  //       message: '관리자 권한이 필요합니다'
  //     }
  //   });
  // }

  next();
};

module.exports = {
  generateTokens,
  authenticateToken,
  verifyRefreshToken,
  optionalAuth,
  requireAdmin
};