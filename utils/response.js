/**
 * 공통 응답 형식을 위한 유틸리티
 */

// 성공 응답
const success = (res, data = null, message = null, statusCode = 200) => {
  const response = {
    success: true,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  return res.status(statusCode).json(response);
};

// 에러 응답
const error = (res, code, message, details = null, statusCode = 400) => {
  const response = {
    success: false,
    error: {
      code,
      message
    },
    timestamp: new Date().toISOString()
  };

  if (details) {
    response.error.details = details;
  }

  return res.status(statusCode).json(response);
};

// 페이지네이션 응답
const paginated = (res, data, pagination, message = null) => {
  const response = {
    success: true,
    data,
    pagination,
    timestamp: new Date().toISOString()
  };

  if (message) {
    response.message = message;
  }

  return res.status(200).json(response);
};

// 공통 에러 코드
const ERROR_CODES = {
  // 인증 관련
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // 사용자 관련
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_SUSPENDED: 'USER_SUSPENDED',
  
  // 데이터 관련
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  
  // 외부 API 관련
  OPENAI_QUOTA_EXCEEDED: 'OPENAI_QUOTA_EXCEEDED',
  CANVA_TEMPLATE_NOT_FOUND: 'CANVA_TEMPLATE_NOT_FOUND',
  INSTAGRAM_API_ERROR: 'INSTAGRAM_API_ERROR',
  
  // 파일 관련
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  
  // 일반
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST'
};

// 일반적인 에러 처리 함수들
const responses = {
  // 400 Bad Request
  badRequest: (res, message = '잘못된 요청입니다', details = null) =>
    error(res, ERROR_CODES.BAD_REQUEST, message, details, 400),
    
  // 401 Unauthorized
  unauthorized: (res, message = '인증이 필요합니다') =>
    error(res, ERROR_CODES.UNAUTHORIZED, message, null, 401),
    
  // 403 Forbidden
  forbidden: (res, message = '권한이 없습니다') =>
    error(res, ERROR_CODES.FORBIDDEN, message, null, 403),
    
  // 404 Not Found
  notFound: (res, message = '리소스를 찾을 수 없습니다') =>
    error(res, ERROR_CODES.NOT_FOUND, message, null, 404),
    
  // 409 Conflict
  conflict: (res, message = '중복된 리소스입니다') =>
    error(res, ERROR_CODES.DUPLICATE_ENTRY, message, null, 409),
    
  // 422 Unprocessable Entity
  validationError: (res, message = '유효성 검사 실패', details = null) =>
    error(res, ERROR_CODES.VALIDATION_ERROR, message, details, 422),
    
  // 500 Internal Server Error
  serverError: (res, message = '서버 오류가 발생했습니다') =>
    error(res, ERROR_CODES.INTERNAL_ERROR, message, null, 500)
};

module.exports = {
  success,
  error,
  paginated,
  ERROR_CODES,
  ...responses
};