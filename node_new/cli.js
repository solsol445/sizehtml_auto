import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import readlineSync from 'readline-sync';
import { resizeImageWithMinimalLoss } from './resize.js';
import { PATHS, IMAGE_CONFIG } from './config/constants.js';

/**
 * img_in 폴더의 모든 JPG 이미지를 처리
 */
async function processAllImages(targetWidth, targetHeight) {
    // 크기별 폴더 생성 (예: 750x1000)
    const sizeFolder = `${targetWidth}x${targetHeight}`;
    const outputPath = path.join(PATHS.OUTPUT_DIR, sizeFolder);

    // 크기별 폴더가 없으면 생성
    if (!fsSync.existsSync(outputPath)) {
        await fs.mkdir(outputPath, { recursive: true });
        console.log(`Created folder: ${sizeFolder}`);
    }

    // img_in 폴더의 모든 파일 읽기
    const files = await fs.readdir(PATHS.INPUT_DIR);

    // JPG 파일만 필터링
    const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.jpg' || ext === '.jpeg';
    });

    if (imageFiles.length === 0) {
        console.log('\n⚠ No JPG images found in img_in folder.');
        return;
    }

    console.log(`\nProcessing ${imageFiles.length} images...`);
    console.log('='.repeat(50));

    // 각 이미지 처리
    let successCount = 0;
    let failCount = 0;

    for (const file of imageFiles) {
        const inputPath = path.join(PATHS.INPUT_DIR, file);
        const finalOutputPath = path.join(outputPath, file);

        try {
            await resizeImageWithMinimalLoss(inputPath, finalOutputPath, targetWidth, targetHeight);
            successCount++;
        } catch (error) {
            failCount++;
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Processing complete: Success ${successCount}, Failed ${failCount}`);
    console.log(`Output location: ${outputPath}`);
}

/**
 * 메인 실행 함수
 */
async function main() {
    console.clear();
    console.log('='.repeat(50));
    console.log('  Image Resizing Program (Minimize Loss)');
    console.log('='.repeat(50));

    // 입력 폴더 확인
    if (!fsSync.existsSync(PATHS.INPUT_DIR)) {
        console.error(`\n✗ Error: img_in folder not found.`);
        console.error(`  Path: ${PATHS.INPUT_DIR}`);
        process.exit(1);
    }

    // 목표 크기 입력받기
    console.log('\nEnter target image size:');

    let targetWidth, targetHeight;

    while (true) {
        const widthInput = readlineSync.question('  Width (px): ');
        targetWidth = parseInt(widthInput);

        if (!isNaN(targetWidth) && targetWidth > 0) {
            break;
        }
        console.log('  ✗ Please enter a valid number.');
    }

    while (true) {
        const heightInput = readlineSync.question('  Height (px): ');
        targetHeight = parseInt(heightInput);

        if (!isNaN(targetHeight) && targetHeight > 0) {
            break;
        }
        console.log('  ✗ Please enter a valid number.');
    }

    // 이미지 처리 시작
    await processAllImages(targetWidth, targetHeight);

    console.log('\nProgram finished.');
}

// 프로그램 실행
main().catch(error => {
    console.error('\nUnexpected error occurred:', error);
    process.exit(1);
});

