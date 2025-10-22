import sharp from 'sharp';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { IMAGE_CONFIG } from './config/constants.js';

/**
 * 이미지 손실 최소화 리사이징 함수 (순수 유틸리티)
 * 
 * @param {string} inputPath - 입력 이미지 경로
 * @param {string} outputPath - 출력 이미지 경로
 * @param {number} targetWidth - 목표 가로 크기
 * @param {number} targetHeight - 목표 세로 크기
 */
export async function resizeImageWithMinimalLoss(inputPath, outputPath, targetWidth, targetHeight) {
    try {
        console.log(`\nProcessing: ${path.basename(inputPath)}`);

        // 입력 파일 존재 확인
        if (!fsSync.existsSync(inputPath)) {
            throw new Error(`Input file not found: ${inputPath}`);
        }

        // [1단계] 원본 이미지 메타데이터 가져오기
        const metadata = await sharp(inputPath).metadata();
        const originalWidth = metadata.width;
        const originalHeight = metadata.height;

        if (!originalWidth || !originalHeight) {
            throw new Error('Invalid image dimensions');
        }

        console.log(`  Original size: ${originalWidth}x${originalHeight}px`);
        console.log(`  Target size: ${targetWidth}x${targetHeight}px`);

        // [2단계] 목표 비율 계산
        const targetRatio = targetWidth / targetHeight;
        const originalRatio = originalWidth / originalHeight;

        console.log(`  Original ratio: ${originalRatio.toFixed(3)}, Target ratio: ${targetRatio.toFixed(3)}`);

        // [3단계] 잘라낼 영역 계산
        let cropWidth, cropHeight;

        if (originalRatio > targetRatio) {
            // 원본이 더 넓음 -> 좌우를 잘라냄
            cropHeight = originalHeight;
            cropWidth = Math.round(originalHeight * targetRatio);
        } else {
            // 원본이 더 높음 -> 상하를 잘라냄
            cropWidth = originalWidth;
            cropHeight = Math.round(originalWidth / targetRatio);
        }

        console.log(`  Crop area: ${cropWidth}x${cropHeight}px (center-based)`);

        // 출력 디렉토리 생성
        const outputDir = path.dirname(outputPath);
        if (!fsSync.existsSync(outputDir)) {
            await fs.mkdir(outputDir, { recursive: true });
        }

        // 기존 파일이 있으면 삭제 (덮어쓰기를 위해)
        if (fsSync.existsSync(outputPath)) {
            await fs.unlink(outputPath);
            console.log(`  🔄 Overwriting existing file: ${path.basename(outputPath)}`);
        }

        // [4단계] 중앙 기준으로 Crop 후 Resize 실행
        await sharp(inputPath)
            .extract({
                left: Math.round((originalWidth - cropWidth) / 2),
                top: Math.round((originalHeight - cropHeight) / 2),
                width: cropWidth,
                height: cropHeight
            })
            .resize(targetWidth, targetHeight, {
                kernel: sharp.kernel[IMAGE_CONFIG.KERNEL],
                fit: 'fill'
            })
            .jpeg({
                quality: IMAGE_CONFIG.RESIZE_QUALITY,
                mozjpeg: IMAGE_CONFIG.USE_MOZJPEG
            })
            .toFile(outputPath);

        console.log(`  ✓ Complete: ${path.basename(outputPath)}`);

    } catch (error) {
        console.error(`  ✗ Error: ${error.message}`);
        console.error(`  Stack: ${error.stack}`);
        throw error;
    }
}
