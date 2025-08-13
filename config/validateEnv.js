/**
 * 필수 환경변수 검증
 */
const validateEnv = () => {
  const required = [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
  ];

  const missing = [];
  
  required.forEach(key => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    console.error('❌ 필수 환경변수가 설정되지 않았습니다:');
    missing.forEach(key => {
      console.error(`   - ${key}`);
    });
    console.error('\n.env 파일을 확인하거나 환경변수를 설정해주세요.');
    process.exit(1);
  }

  // 환경변수 기본값 설정
  process.env.PORT = process.env.PORT || '3001';
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
  process.env.REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  process.env.FRONTEND_PORT = process.env.FRONTEND_PORT || '5173';
  
  console.log('✅ 환경변수 검증 완료');
  console.log(`   - 환경: ${process.env.NODE_ENV}`);
  console.log(`   - 포트: ${process.env.PORT}`);
};

module.exports = validateEnv;