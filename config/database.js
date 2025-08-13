const mongoose = require('mongoose');

require('dotenv').config();

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다. .env 파일을 확인해주세요.');
    }
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      }
    });
    
    // 연결 확인을 위한 ping
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log(`MongoDB Atlas Connected: ${conn.connection.host}`);
    console.log("Pinged your deployment. You successfully connected to MongoDB Atlas!");
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// 연결 상태 모니터링
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.log('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
});

// 앱 종료시 연결 정리
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed through app termination');
  process.exit(0);
});

module.exports = connectDB;