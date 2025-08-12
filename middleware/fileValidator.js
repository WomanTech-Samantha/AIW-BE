const fs = require('fs');

/**
 * 파일 매직 넘버를 확인하여 실제 파일 타입 검증
 */
const fileTypeValidator = {
  // 이미지 파일 매직 넘버
  IMAGE_SIGNATURES: {
    jpg: ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffe8'],
    png: ['89504e47'],
    gif: ['47494638'],
    webp: ['52494646'],
    bmp: ['424d']
  },

  /**
   * 파일의 실제 타입 확인
   */
  validateImageFile: async (filePath) => {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, {
        start: 0,
        end: 8
      });

      stream.on('data', (chunk) => {
        const hex = chunk.toString('hex');
        
        // 각 이미지 타입별로 체크
        for (const [type, signatures] of Object.entries(fileTypeValidator.IMAGE_SIGNATURES)) {
          for (const signature of signatures) {
            if (hex.startsWith(signature)) {
              stream.close();
              return resolve({ valid: true, type });
            }
          }
        }
        
        stream.close();
        resolve({ valid: false, type: null });
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  },

  /**
   * 파일 크기 검증
   */
  validateFileSize: (file, maxSizeInMB = 10) => {
    const maxSize = maxSizeInMB * 1024 * 1024; // MB to bytes
    return file.size <= maxSize;
  },

  /**
   * 파일명 sanitization
   */
  sanitizeFilename: (filename) => {
    // 위험한 문자 제거
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '_')
      .toLowerCase();
  }
};

module.exports = fileTypeValidator;