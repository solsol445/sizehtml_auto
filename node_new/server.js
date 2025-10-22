import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import FileService from './services/FileService.js';
import imageRoutes from './routes/imageRoutes.js';
import presetRoutes from './routes/presetRoutes.js';
import { SERVER_CONFIG, PATHS } from './config/constants.js';

// ESM에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/**
 * 미들웨어 설정
 */
app.use(cors());
app.use(express.json());
app.use(express.static(PATHS.PUBLIC_DIR));

/**
 * 메인 페이지
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(PATHS.PUBLIC_DIR, 'index.html'));
});

/**
 * API 라우터 연결
 */
app.use('/api', imageRoutes);
app.use('/api/presets', presetRoutes);

/**
 * 404 에러 핸들러
 */
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

/**
 * 중앙 집중식 에러 처리 미들웨어
 */
app.use((error, req, res, next) => {
    console.error('='.repeat(50));
    console.error('❌ ERROR CAUGHT BY CENTRAL HANDLER:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request path:', req.path);
    console.error('Request method:', req.method);
    console.error('='.repeat(50));

    // 클라이언트에 에러 응답
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

/**
 * 서버 초기화 및 시작
 */
async function startServer() {
    try {
        // 필수 디렉토리 생성
        await FileService.ensureDirectory(PATHS.INPUT_DIR);
        await FileService.ensureDirectory(PATHS.OUTPUT_DIR);

        // 프리셋 파일 초기화
        await FileService.initPresetsFile();

        // 서버 시작
        app.listen(SERVER_CONFIG.PORT, () => {
            console.log('\n' + '='.repeat(60));
            console.log('🚀 Image Resizer Web Server Started! (ESM Refactored)');
            console.log('='.repeat(60));
            console.log(`📱 Open your browser: http://localhost:${SERVER_CONFIG.PORT}`);
            console.log(`📁 Input folder: ${PATHS.INPUT_DIR}`);
            console.log(`📁 Output folder: ${PATHS.OUTPUT_DIR}`);
            console.log(`📄 Presets file: ${PATHS.PRESETS_FILE}`);
            console.log(`\n✨ Features:`);
            console.log(`   - Image Upload & Resize`);
            console.log(`   - Preset Management`);
            console.log(`   - External Folder Browsing`);
            console.log(`   - 1px Copy & Delete`);
            console.log(`   - NAS Transfer`);
            console.log(`\nPress Ctrl+C to stop the server`);
            console.log('='.repeat(60) + '\n');
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// 서버 시작
startServer();

export default app;
