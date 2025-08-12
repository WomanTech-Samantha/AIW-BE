const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('../models/Product');
const ProductDetailImage = require('../models/ProductDetailImage');
const Category = require('../models/Category');
const Store = require('../models/Store');

const connectDB = require('../config/database');

async function seedData() {
    try {
        await connectDB();
        console.log('Connected to MongoDB');

        // 기존 데이터 삭제
        await Product.deleteMany({});
        await ProductDetailImage.deleteMany({});
        await Category.deleteMany({});
        console.log('Existing data cleared');

        // 카테고리 생성
        const categories = [
            { name: '침구류', sortOrder: 1 },
            { name: '커튼', sortOrder: 2 },
            { name: '홈데코', sortOrder: 3 },
            { name: '세일', sortOrder: 4 },
            { name: '신상품', sortOrder: 5 }
        ];

        const createdCategories = await Category.insertMany(categories);
        console.log('Categories created:', createdCategories.length);

        // 스토어 조회 (기존 스토어 사용)
        const stores = await Store.find({ status: 'active' }).limit(3);
        if (stores.length === 0) {
            console.log('No active stores found. Please create a store first.');
            return;
        }

        // 각 스토어별로 상품 생성
        for (const store of stores) {
            const storeProducts = [];
            
            // 침구류 상품
            for (let i = 1; i <= 5; i++) {
                const product = {
                    storeId: store._id,
                    sku: `${store.subdomain}-bedding-${i}`,
                    name: `프리미엄 침구 세트 ${i}`,
                    description: `편안하고 부드러운 프리미엄 침구 세트입니다. 고급 면 소재로 제작되어 쾌적한 잠자리를 제공합니다.`,
                    price: 89000 + (i * 10000),
                    comparePrice: 120000 + (i * 15000),
                    stockQuantity: Math.floor(Math.random() * 50) + 10,
                    categoryId: createdCategories[0]._id,
                    status: 'active',
                    isFeatured: i <= 2
                };
                storeProducts.push(product);
            }

            // 커튼 상품
            for (let i = 1; i <= 4; i++) {
                const product = {
                    storeId: store._id,
                    sku: `${store.subdomain}-curtain-${i}`,
                    name: `모던 암막 커튼 ${i}`,
                    description: `완벽한 차광 효과의 모던 암막 커튼입니다. 세련된 디자인으로 공간을 더욱 아름답게 만듭니다.`,
                    price: 65000 + (i * 8000),
                    comparePrice: 85000 + (i * 12000),
                    stockQuantity: Math.floor(Math.random() * 30) + 5,
                    categoryId: createdCategories[1]._id,
                    status: 'active',
                    isFeatured: i === 1
                };
                storeProducts.push(product);
            }

            // 홈데코 상품
            for (let i = 1; i <= 6; i++) {
                const product = {
                    storeId: store._id,
                    sku: `${store.subdomain}-deco-${i}`,
                    name: `홈데코 아이템 ${i}`,
                    description: `집안 분위기를 한층 더 따뜻하게 만들어 줄 홈데코 아이템입니다.`,
                    price: 25000 + (i * 5000),
                    comparePrice: 35000 + (i * 8000),
                    stockQuantity: Math.floor(Math.random() * 20) + 1,
                    categoryId: createdCategories[2]._id,
                    status: 'active',
                    isFeatured: false
                };
                storeProducts.push(product);
            }

            // 상품 일괄 생성
            const createdProducts = await Product.insertMany(storeProducts);
            console.log(`Products created for ${store.storeName}:`, createdProducts.length);

            // 각 상품에 이미지 추가
            for (const product of createdProducts) {
                const images = [
                    {
                        productId: product._id,
                        imageUrl: `https://via.placeholder.com/600x400?text=${encodeURIComponent(product.name)}`,
                        imageType: 'main',
                        sortOrder: 1,
                        altText: product.name
                    },
                    {
                        productId: product._id,
                        imageUrl: `https://via.placeholder.com/600x400/cccccc/666666?text=Detail+1`,
                        imageType: 'detail',
                        sortOrder: 2,
                        altText: `${product.name} 상세 이미지 1`
                    },
                    {
                        productId: product._id,
                        imageUrl: `https://via.placeholder.com/600x400/eeeeee/999999?text=Detail+2`,
                        imageType: 'detail',
                        sortOrder: 3,
                        altText: `${product.name} 상세 이미지 2`
                    }
                ];
                
                await ProductDetailImage.insertMany(images);
            }
        }

        console.log('Seed data created successfully!');
        process.exit(0);

    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
}

seedData();