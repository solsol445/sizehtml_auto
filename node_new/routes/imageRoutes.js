import express from 'express';
import multer from 'multer';
import ImageController from '../controllers/imageController.js';
import FileService from '../services/FileService.js';
import { SERVER_CONFIG } from '../config/constants.js';

const router = express.Router();

// multer 설정 (메모리 저장) - 이미지 업로드용
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        console.log('File upload:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });

        // JPG/JPEG 파일만 허용
        if (FileService.isValidMimeType(file.mimetype)) {
            cb(null, true);
        } else {
            console.error('Invalid file type:', file.mimetype);
            cb(new Error(`Only JPG/JPEG files are allowed. Received: ${file.mimetype}`), false);
        }
    },
    limits: {
        fileSize: SERVER_CONFIG.FILE_SIZE_LIMIT
    }
});

// multer 설정 (메모리 저장) - 엑셀 파일 업로드용
const excelUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        console.log('Excel file upload:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });

        // Excel 파일만 허용
        const allowedMimeTypes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.oasis.opendocument.spreadsheet'
        ];

        if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|ods)$/i)) {
            cb(null, true);
        } else {
            console.error('Invalid file type:', file.mimetype);
            cb(new Error(`Only Excel files are allowed. Received: ${file.mimetype}`), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB 제한
    }
});

// 이미지 업로드 및 리사이징
router.post('/upload', upload.array('images', SERVER_CONFIG.MAX_FILES), ImageController.uploadAndResize);

// 폴더별 이미지 목록 조회
router.get('/folders', ImageController.getFolders);

// 이미지 파일 서빙
router.get('/images/:folder/:filename', ImageController.serveImage);

// 외부 폴더 브라우징
router.post('/browse-external', ImageController.browseExternal);

// 외부 이미지 서빙
router.get('/external-image', ImageController.serveExternalImage);

// 폴더 삭제
router.post('/delete-folder', ImageController.deleteFolder);

// 이미지 삭제
router.post('/delete-image', ImageController.deleteImage);

// 1px 이미지 복사
router.post('/copy-images', ImageController.copyImages);

// 1px 이미지 복사 (엑셀 필터링)
router.post('/copy-images-excel', excelUpload.single('excelFile'), ImageController.copyImagesWithExcel);

// 1px 복사된 이미지 삭제
router.post('/delete-copied-images', ImageController.deleteCopiedImages);

// 동기화 서버 이미지 삭제
router.post('/delete-sync-images', ImageController.deleteSyncImages);

// NAS 전송
router.post('/nas-transfer', ImageController.nasTransfer);

// 이미지 동기화 (엑셀 기반)
router.post('/sync-images', excelUpload.single('excelFile'), ImageController.syncImages);

// 샘플 엑셀 파일 다운로드
router.get('/download-sample-excel', ImageController.downloadSampleExcel);

export default router;

