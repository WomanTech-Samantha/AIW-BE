/**
 * 비동기 라우트 핸들러를 위한 래퍼
 * try-catch 보일러플레이트 코드를 제거하고 에러를 자동으로 처리
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 트랜잭션을 포함한 비동기 핸들러
 */
const withTransaction = (fn) => async (req, res, next) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    req.session = session;
    
    const result = await fn(req, res, next);
    
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

module.exports = {
  asyncHandler,
  withTransaction
};