import path from 'path';
import { fileURLToPath } from 'url';

// ESM에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 프로젝트 루트 디렉토리
export const ROOT_DIR = path.resolve(__dirname, '..');

// 서버 설정
export const SERVER_CONFIG = {
    PORT: 4005,
    CORS_ENABLED: true,
    FILE_SIZE_LIMIT: 10 * 1024 * 1024, // 10MB
    MAX_FILES: 10
};

// 디렉토리 경로
export const PATHS = {
    INPUT_DIR: path.join(ROOT_DIR, 'img_in'),
    OUTPUT_DIR: path.join(ROOT_DIR, 'img_out'),
    PRESETS_FILE: path.join(ROOT_DIR, 'presets.json'),
    PUBLIC_DIR: path.join(ROOT_DIR, 'public')
};

// 이미지 설정
export const IMAGE_CONFIG = {
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    ALLOWED_MIMETYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    RESIZE_QUALITY: 95,
    USE_MOZJPEG: true,
    KERNEL: 'lanczos3'
};

// 1px Copy 패턴 설정
export const COPY_PATTERNS = {
    // 일반 패턴
    GENERAL: [
        'promotion_00',
        'promotion_01',
        'promotion_02',
        'fit_01',
        'illust_01'
    ],
    // HTML 관련 패턴
    HTML: [
        'desc_info_02',
        'title_info_01',
        'size_info_04',
        'spec_info_03'
    ],
    // 모든 패턴
    get ALL() {
        return [...this.GENERAL, ...this.HTML];
    }
};

// NAS 전송 설정
export const NAS_CONFIG = {
    EXCLUDE_PREFIXES: ['swatch']
};

// 공통 제외 설정
export const EXCLUDE_CONFIG = {
    FOLDERS: ['transparent'],  // 제외할 폴더명
    PREFIXES: ['swatch']       // 제외할 파일명 prefix
};

