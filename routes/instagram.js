const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const querystring = require('querystring');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// HTTP 요청 헬퍼 함수
const httpRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (options.body && typeof options.body === 'string') {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: () => Promise.resolve(result)
          });
        } catch (err) {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: () => Promise.resolve(data)
          });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
};

// 업로드 디렉토리 설정
const uploadDir = path.join(__dirname, '..', 'uploads', 'instagram');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
    }
  }
});


// Instagram 미디어 게시
router.post('/media', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { caption, access_token } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '이미지 파일이 필요합니다.'
      });
    }

    if (!caption) {
      return res.status(400).json({
        success: false,
        message: '캡션이 필요합니다.'
      });
    }

    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: 'Instagram 액세스 토큰이 필요합니다.'
      });
    }

    // 1. 토큰 유효성 및 계정 유형 검증
    console.log('토큰 유효성 검증 시작...');
    const tokenValidationResponse = await httpRequest(`https://graph.instagram.com/me?fields=id,username,account_type&access_token=${access_token}`);
    const tokenValidationData = await tokenValidationResponse.json();
    
    if (tokenValidationData.error) {
      console.error('토큰 유효성 검증 실패:', tokenValidationData.error);
      
      // 401 에러 처리
      if (tokenValidationData.error.code === 190) {
        return res.status(401).json({
          success: false,
          message: 'Instagram 액세스 토큰이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.',
          error: tokenValidationData.error,
          error_type: 'INVALID_TOKEN'
        });
      }
      
      // 권한 부족 에러 처리
      if (tokenValidationData.error.code === 200 || tokenValidationData.error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: 'Instagram 콘텐츠 게시 권한이 없습니다. 앱 권한을 확인해주세요.',
          error: tokenValidationData.error,
          error_type: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      return res.status(400).json({
        success: false,
        message: `토큰 검증 실패: ${tokenValidationData.error.message}`,
        error: tokenValidationData.error,
        error_type: 'TOKEN_VALIDATION_ERROR'
      });
    }

    // 계정 유형 검증 (비즈니스 또는 크리에이터 계정인지 확인)
    console.log('사용자 계정 정보:', tokenValidationData);
    if (!tokenValidationData.account_type || (tokenValidationData.account_type !== 'BUSINESS' && tokenValidationData.account_type !== 'CREATOR')) {
      return res.status(403).json({
        success: false,
        message: 'Instagram 비즈니스 또는 크리에이터 계정이 필요합니다. 설정 → 계정 → 계정 유형 전환에서 변경하세요.',
        error_type: 'ACCOUNT_TYPE_ERROR',
        current_account_type: tokenValidationData.account_type || 'PERSONAL',
        required_account_types: ['BUSINESS', 'CREATOR']
      });
    }

    // 업로드된 이미지의 공개 URL 생성 (실제 배포시에는 HTTPS URL 필요)
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/instagram/${req.file.filename}`;

    // 2. Instagram 컨테이너 생성 (Instagram Login API 형식)
    console.log('Instagram 컨테이너 생성 중...', { imageUrl, captionLength: caption.length });
    
    const containerUrl = `https://graph.instagram.com/me/media?access_token=${access_token}`;
    const containerResponse = await httpRequest(containerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: querystring.stringify({
        image_url: imageUrl,
        caption: caption,
        media_type: 'IMAGE'
      })
    });

    const containerData = await containerResponse.json();
    console.log('컨테이너 생성 응답:', containerData);
    
    if (containerData.error) {
      console.error('컨테이너 생성 실패:', containerData.error);
      
      // 401/403 에러 상세 처리
      if (containerData.error.code === 190) {
        return res.status(401).json({
          success: false,
          message: '액세스 토큰이 만료되었거나 유효하지 않습니다.',
          error: containerData.error,
          error_type: 'INVALID_TOKEN'
        });
      }
      
      if (containerData.error.code === 200 || containerData.error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: 'Instagram 콘텐츠 게시 권한이 부족합니다. instagram_business_content_publish 권한을 확인하세요.',
          error: containerData.error,
          error_type: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      if (containerData.error.message.includes('image_url')) {
        return res.status(400).json({
          success: false,
          message: '이미지 URL에 접근할 수 없습니다. HTTPS URL이 필요할 수 있습니다.',
          error: containerData.error,
          error_type: 'IMAGE_URL_ERROR',
          provided_url: imageUrl
        });
      }
      
      return res.status(400).json({
        success: false,
        message: `Instagram API 오류: ${containerData.error.message}`,
        error: containerData.error,
        error_type: 'CONTAINER_CREATION_ERROR'
      });
    }

    if (!containerData.id) {
      return res.status(500).json({
        success: false,
        message: '컨테이너 ID를 받지 못했습니다.',
        error_type: 'MISSING_CONTAINER_ID'
      });
    }

    const containerId = containerData.id;
    console.log('컨테이너 생성 완료:', containerId);

    // 3. 미디어 게시 (Instagram Login API 형식)
    console.log('미디어 게시 중...');
    
    const publishUrl = `https://graph.instagram.com/me/media_publish?access_token=${access_token}`;
    const publishResponse = await httpRequest(publishUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: querystring.stringify({
        creation_id: containerId
      })
    });

    const publishData = await publishResponse.json();
    console.log('미디어 게시 응답:', publishData);
    
    if (publishData.error) {
      console.error('미디어 게시 실패:', publishData.error);
      
      // 401/403 에러 상세 처리
      if (publishData.error.code === 190) {
        return res.status(401).json({
          success: false,
          message: '액세스 토큰이 만료되었거나 유효하지 않습니다.',
          error: publishData.error,
          error_type: 'INVALID_TOKEN'
        });
      }
      
      if (publishData.error.code === 200 || publishData.error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: 'Instagram 콘텐츠 게시 권한이 부족합니다.',
          error: publishData.error,
          error_type: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      if (publishData.error.message.includes('container')) {
        return res.status(400).json({
          success: false,
          message: '컨테이너 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          error: publishData.error,
          error_type: 'CONTAINER_PROCESSING_ERROR'
        });
      }
      
      return res.status(400).json({
        success: false,
        message: `게시 오류: ${publishData.error.message}`,
        error: publishData.error,
        error_type: 'PUBLISH_ERROR'
      });
    }

    if (!publishData.id) {
      return res.status(500).json({
        success: false,
        message: '게시된 미디어 ID를 받지 못했습니다.',
        error_type: 'MISSING_MEDIA_ID'
      });
    }

    console.log('Instagram 게시 완료:', publishData.id);

    res.json({
      success: true,
      message: '콘텐츠가 성공적으로 게시되었습니다.',
      data: {
        media_id: publishData.id,
        container_id: containerId,
        uploaded_file: req.file.filename
      }
    });

  } catch (error) {
    console.error('Instagram 게시 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// Instagram 미디어 목록 조회
router.get('/media', authenticateToken, async (req, res) => {
  try {
    const { access_token, user_id } = req.query;
    
    if (!access_token || !user_id) {
      return res.status(400).json({
        success: false,
        message: 'access_token과 user_id가 필요합니다.'
      });
    }

    // Instagram Graph API로 미디어 목록 조회
    const mediaUrl = `https://graph.instagram.com/${user_id}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count&limit=50&access_token=${access_token}`;
    
    const response = await httpRequest(mediaUrl);
    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({
        success: false,
        message: `Instagram API 오류: ${data.error.message}`,
        error: data.error
      });
    }

    res.json({
      success: true,
      data: data.data || [],
      paging: data.paging
    });

  } catch (error) {
    console.error('미디어 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// Instagram 댓글 조회
router.get('/comments', authenticateToken, async (req, res) => {
  try {
    const { access_token, media_id } = req.query;
    
    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: 'access_token이 필요합니다.'
      });
    }

    let comments = [];

    if (media_id) {
      // 특정 미디어의 댓글 조회
      console.log(`미디어 ${media_id}의 댓글 조회 시도...`);
      
      const commentsUrl = `https://graph.instagram.com/${media_id}/comments?fields=id,text,username,timestamp,like_count&access_token=${access_token}`;
      
      const response = await httpRequest(commentsUrl);
      const data = await response.json();
      
      console.log('Instagram 댓글 API 응답:', data);
      
      if (data.error) {
        console.warn('Instagram 댓글 API 오류:', data.error);
        
        // Instagram Basic Display API의 경우 댓글 접근이 제한될 수 있음
        // 테스터 계정이어도 특정 권한이 필요함
        if (data.error.code === 100 || data.error.message.includes('permission')) {
          return res.json({
            success: true,
            data: [],
            message: 'Instagram Basic Display API에서는 댓글 접근이 제한됩니다. Instagram Business API가 필요합니다.',
            limitation: true
          });
        }
        
        return res.status(400).json({
          success: false,
          message: `Instagram API 오류: ${data.error.message}`,
          error: data.error
        });
      }

      comments = data.data || [];
    } else {
      // 모든 미디어의 댓글 조회 (최근 미디어부터)
      const { user_id } = req.query;
      
      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: 'media_id 또는 user_id가 필요합니다.'
        });
      }

      console.log(`사용자 ${user_id}의 모든 미디어 댓글 조회 시도...`);

      // 먼저 최근 미디어 목록 조회
      const mediaUrl = `https://graph.instagram.com/${user_id}/media?fields=id,caption,permalink&limit=10&access_token=${access_token}`;
      const mediaResponse = await httpRequest(mediaUrl);
      const mediaData = await mediaResponse.json();

      if (mediaData.error) {
        return res.status(400).json({
          success: false,
          message: `미디어 조회 오류: ${mediaData.error.message}`,
          error: mediaData.error
        });
      }

      let hasPermissionError = false;

      // 각 미디어의 댓글 조회
      for (const media of (mediaData.data || [])) {
        try {
          console.log(`미디어 ${media.id} 댓글 조회 중...`);
          
          const commentsUrl = `https://graph.instagram.com/${media.id}/comments?fields=id,text,username,timestamp,like_count&access_token=${access_token}`;
          const commentsResponse = await httpRequest(commentsUrl);
          const commentsData = await commentsResponse.json();
          
          if (commentsData.error) {
            console.warn(`미디어 ${media.id} 댓글 조회 오류:`, commentsData.error);
            
            if (commentsData.error.code === 100 || commentsData.error.message.includes('permission')) {
              hasPermissionError = true;
              continue;
            }
          }
          
          if (commentsData.data) {
            const mediaComments = commentsData.data.map(comment => ({
              ...comment,
              media_id: media.id,
              media_permalink: media.permalink,
              media_caption: media.caption
            }));
            comments = [...comments, ...mediaComments];
          }
        } catch (err) {
          console.warn(`미디어 ${media.id} 댓글 조회 실패:`, err.message);
        }
      }

      // 시간순 정렬 (최신 순)
      comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // 권한 오류가 있었다면 메시지 포함
      if (hasPermissionError && comments.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'Instagram Basic Display API에서는 댓글 접근이 제한됩니다. Instagram Business API가 필요합니다.',
          limitation: true
        });
      }
    }

    console.log(`총 ${comments.length}개의 댓글을 조회했습니다.`);

    res.json({
      success: true,
      data: comments
    });

  } catch (error) {
    console.error('댓글 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// Instagram 댓글 답글 작성
router.post('/comments/:commentId/reply', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { message, access_token } = req.body;
    
    if (!message || !access_token) {
      return res.status(400).json({
        success: false,
        message: 'message와 access_token이 필요합니다.'
      });
    }

    // Instagram Graph API로 답글 작성
    const replyUrl = `https://graph.instagram.com/${commentId}/replies`;
    
    const response = await httpRequest(replyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        access_token: access_token
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({
        success: false,
        message: `답글 작성 오류: ${data.error.message}`,
        error: data.error
      });
    }

    res.json({
      success: true,
      message: '답글이 성공적으로 작성되었습니다.',
      data: {
        reply_id: data.id
      }
    });

  } catch (error) {
    console.error('답글 작성 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// Instagram 댓글 삭제
router.delete('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { access_token } = req.body;
    
    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: 'access_token이 필요합니다.'
      });
    }

    // Instagram Graph API로 댓글 삭제
    const deleteUrl = `https://graph.instagram.com/${commentId}?access_token=${access_token}`;
    
    const response = await httpRequest(deleteUrl, {
      method: 'DELETE'
    });

    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({
        success: false,
        message: `댓글 삭제 오류: ${data.error.message}`,
        error: data.error
      });
    }

    res.json({
      success: true,
      message: '댓글이 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('댓글 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// Instagram 인사이트 조회
router.get('/insights', authenticateToken, async (req, res) => {
  try {
    const { access_token, media_id, user_id } = req.query;
    
    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: 'access_token이 필요합니다.'
      });
    }

    if (media_id) {
      // 특정 미디어의 인사이트 조회
      const insightsUrl = `https://graph.instagram.com/${media_id}/insights?metric=impressions,reach,engagement&access_token=${access_token}`;
      
      const response = await httpRequest(insightsUrl);
      const data = await response.json();
      
      if (data.error) {
        return res.status(400).json({
          success: false,
          message: `인사이트 조회 오류: ${data.error.message}`,
          error: data.error
        });
      }

      res.json({
        success: true,
        data: data.data || []
      });

    } else if (user_id) {
      // 계정 전체 인사이트 조회
      const insightsUrl = `https://graph.instagram.com/${user_id}/insights?metric=impressions,reach,profile_views&period=day&access_token=${access_token}`;
      
      const response = await httpRequest(insightsUrl);
      const data = await response.json();
      
      if (data.error) {
        return res.status(400).json({
          success: false,
          message: `인사이트 조회 오류: ${data.error.message}`,
          error: data.error
        });
      }

      res.json({
        success: true,
        data: data.data || []
      });

    } else {
      return res.status(400).json({
        success: false,
        message: 'media_id 또는 user_id가 필요합니다.'
      });
    }

  } catch (error) {
    console.error('인사이트 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;