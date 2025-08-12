const Store = require('../models/Store');

// 서브도메인 파싱 미들웨어
const parseSubdomain = (req, res, next) => {
    const host = req.get('host');
    
    // 1. 쿼리 파라미터에서 subdomain 확인
    if (req.query.store) {
        req.subdomain = req.query.store.toLowerCase();
        return next();
    }
    
    // 2. 호스트에서 서브도메인 추출 (기존 방식)
    if (host) {
        // sslip.io 형식: subdomain.127.0.0.1.sslip.io:3001
        const parts = host.split('.');
        
        // localhost 서브도메인 형식: subdomain.localhost
        if (host.includes('.localhost')) {
            req.subdomain = parts[0].toLowerCase();
        }
        // 또는 첫 번째 부분이 숫자로 시작하지 않으면 서브도메인으로 간주
        else if (parts.length > 1 && !/^\d/.test(parts[0]) && parts[0] !== 'www' && parts[0] !== 'localhost') {
            req.subdomain = parts[0].toLowerCase();
        }
    }
    
    next();
};

// 스토어 정보 로드 미들웨어
const loadStore = async (req, res, next) => {
    if (!req.subdomain) {
        return next();
    }

    try {
        const store = await Store.findOne({ 
            subdomain: req.subdomain,
            status: 'active',
            isPublished: true
        }).populate('brandId');
        
        if (!store) {
            // 개발 환경에서만 디버그 정보 포함
            const isDev = process.env.NODE_ENV !== 'production';
            
            if (isDev) {
                // 디버깅용: 해당 서브도메인이 존재하는지 확인
                const anyStore = await Store.findOne({ subdomain: req.subdomain });
                
                if (anyStore && !anyStore.isPublished) {
                    return res.status(404).json({ 
                        message: '스토어가 아직 공개되지 않았습니다.',
                        subdomain: req.subdomain
                    });
                } else if (anyStore && anyStore.status !== 'active') {
                    return res.status(404).json({ 
                        message: '스토어가 비활성화 상태입니다.',
                        subdomain: req.subdomain
                    });
                }
            }
            
            return res.status(404).json({ 
                message: '스토어를 찾을 수 없습니다.',
                subdomain: req.subdomain
            });
        }

        // 방문자 수 증가
        await Store.findByIdAndUpdate(store._id, {
            $inc: { visitorCount: 1 }
        });

        req.store = store;
        req.brand = store.brandId;
        next();
    } catch (error) {
        console.error('스토어 로드 오류:', error);
        res.status(500).json({ 
            message: '스토어 로드 중 오류가 발생했습니다.' 
        });
    }
};

module.exports = {
    parseSubdomain,
    loadStore
};