const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// 환경변수 검증
const validateEnv = require('./config/validateEnv');
validateEnv();

// Database connection
const connectDB = require('./config/database');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const instagramRoutes = require('./routes/instagram');
const onboardingRoutes = require('./routes/onboarding');
const storeRoutes = require('./routes/store');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Subdomain middleware
const { parseSubdomain } = require('./middleware/subdomain');

// Middleware  
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
  originAgentCluster: false
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : true, // 개발 환경에서는 모든 origin 허용
  credentials: true
}));
app.use(parseSubdomain);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (for uploaded images)
app.use('/uploads', express.static('uploads'));

// Serve frontend build files
const frontendPath = path.join(__dirname, '../AIW-FE/dist');
app.use(express.static(frontendPath));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/instagram', instagramRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/store', storeRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/categories', categoryRoutes);

// 404 handler 전에 모든 라우트 처리가 끝나면 React 앱 서빙
app.get('*', (req, res, next) => {
  // API 요청인 경우 다음 미들웨어로
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // React 앱의 index.html 서빙
  const indexPath = path.join(__dirname, '../AIW-FE/dist/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // 빌드 파일이 없는 경우 기본 응답
      res.json({
        message: 'All-in-WOM Backend API',
        version: '1.0.0',
        status: 'OK',
        endpoints: {
          auth: '/api/v1/auth',
          users: '/api/v1/users',
          instagram: '/api/v1/instagram',
          onboarding: '/api/v1/onboarding',
          store: '/api/v1/store',
          products: '/api/v1/products',
          categories: '/api/v1/categories',
          health: '/api/v1/health'
        },
        note: 'Frontend build not found. Run npm run build in AIW-FE directory.'
      });
    }
  });
});

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `${req.method} ${req.originalUrl} is not a valid endpoint`
    },
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력 데이터가 유효하지 않습니다',
        details: err.errors
      },
      timestamp: new Date().toISOString()
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: '중복된 데이터입니다'
      },
      timestamp: new Date().toISOString()
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: '유효하지 않은 토큰입니다'
      },
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: '토큰이 만료되었습니다'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : '서버 오류가 발생했습니다'
    },
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API Base URL: http://localhost:${PORT}/api/v1`);
});