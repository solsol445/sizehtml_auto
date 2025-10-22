import path from 'path';
import xlsx from 'xlsx';
import FileService from '../services/FileService.js';
import { resizeImageWithMinimalLoss } from '../resize.js';
import { PATHS } from '../config/constants.js';

/**
 * 이미지 관련 컨트롤러
 */
class ImageController {
    /**
     * 이미지 업로드 및 리사이징
     */
    static async uploadAndResize(req, res, next) {
        try {
            const { width, height, folderName, basePath } = req.body;
            const targetWidth = parseInt(width);
            const targetHeight = parseInt(height);

            // 입력 검증
            if (!targetWidth || !targetHeight || targetWidth <= 0 || targetHeight <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid width or height values'
                });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No images uploaded'
                });
            }

            // 폴더명 생성
            let finalFolderName;
            if (folderName && folderName.trim()) {
                finalFolderName = `${folderName.trim()} (${targetWidth}x${targetHeight})`;
            } else {
                finalFolderName = `${targetWidth}x${targetHeight}`;
            }

            // 출력 경로 결정
            let outputBaseDir = PATHS.OUTPUT_DIR;
            if (basePath && basePath.trim() && !basePath.startsWith('Local:')) {
                outputBaseDir = basePath.trim();
            }

            console.log('Creating folder:', { folderName, targetWidth, targetHeight, finalFolderName, basePath, outputBaseDir });

            const outputPath = path.join(outputBaseDir, finalFolderName);
            await FileService.ensureDirectory(outputPath);

            const results = [];
            let successCount = 0;
            let failCount = 0;

            // 각 이미지 처리
            for (const file of req.files) {
                try {
                    const originalName = file.originalname;

                    // 프리셋 사용 시 파일명 변경
                    let outputFileName = originalName;
                    if (folderName && folderName.trim()) {
                        const nameParts = originalName.split('.');
                        const extension = nameParts.pop();
                        const baseName = nameParts.join('.');
                        outputFileName = `${baseName}_${folderName.trim()}.${extension}`;
                    }

                    const finalOutputPath = path.join(outputPath, outputFileName);

                    console.log('Processing file:', { originalName, outputFileName, finalOutputPath, targetWidth, targetHeight });

                    // 임시 파일로 저장
                    const tempPath = path.join(PATHS.INPUT_DIR, originalName);
                    await FileService.writeTempFile(tempPath, file.buffer);

                    // 리사이징 처리
                    await resizeImageWithMinimalLoss(tempPath, finalOutputPath, targetWidth, targetHeight);

                    // 임시 파일 삭제
                    if (FileService.existsSync(tempPath)) {
                        await FileService.deleteFile(tempPath);
                    }

                    results.push({
                        originalName,
                        outputFileName,
                        success: true,
                        outputPath: `/api/images/${finalFolderName}/${outputFileName}`
                    });
                    successCount++;
                    console.log('Successfully processed:', originalName, '→', outputFileName);

                } catch (error) {
                    console.error('Error processing file:', file.originalname, error);
                    results.push({
                        originalName: file.originalname,
                        success: false,
                        error: error.message
                    });
                    failCount++;
                }
            }

            res.json({
                success: true,
                message: `Processing complete: ${successCount} success, ${failCount} failed`,
                results,
                outputFolder: finalFolderName
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * 폴더별 이미지 목록 조회
     */
    static async getFolders(req, res, next) {
        try {
            const folders = await FileService.getFolders();
            res.json({ folders });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 이미지 파일 서빙
     */
    static async serveImage(req, res, next) {
        try {
            const { folder, filename } = req.params;
            const imagePath = path.join(PATHS.OUTPUT_DIR, folder, filename);

            if (FileService.existsSync(imagePath)) {
                res.sendFile(imagePath);
            } else {
                res.status(404).json({ message: 'Image not found' });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * 외부 폴더 브라우징
     */
    static async browseExternal(req, res, next) {
        try {
            const { path: folderPath, includeImages } = req.body;

            if (!folderPath || !FileService.existsSync(folderPath)) {
                return res.json({
                    success: false,
                    message: 'Path does not exist or is inaccessible'
                });
            }

            const result = await FileService.browseExternalFolder(folderPath, includeImages);
            res.json({ success: true, ...result });

        } catch (error) {
            next(error);
        }
    }

    /**
     * 외부 이미지 서빙
     */
    static async serveExternalImage(req, res, next) {
        try {
            const imagePath = req.query.path;

            if (!imagePath || !FileService.existsSync(imagePath)) {
                return res.status(404).send('Image not found');
            }

            res.sendFile(imagePath);
        } catch (error) {
            next(error);
        }
    }

    /**
     * 폴더 삭제
     */
    static async deleteFolder(req, res, next) {
        try {
            const { path: folderPath } = req.body;

            if (!folderPath || !FileService.existsSync(folderPath)) {
                return res.json({
                    success: false,
                    message: 'Folder not found'
                });
            }

            await FileService.deleteFolder(folderPath);

            console.log('Folder deleted:', folderPath);
            res.json({
                success: true,
                message: 'Folder deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 이미지 삭제
     */
    static async deleteImage(req, res, next) {
        try {
            const { path: imagePath } = req.body;

            if (!imagePath || !FileService.existsSync(imagePath)) {
                return res.json({
                    success: false,
                    message: 'Image not found'
                });
            }

            await FileService.deleteFile(imagePath);

            console.log('Image deleted:', imagePath);
            res.json({
                success: true,
                message: 'Image deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 1px 이미지 복사
     */
    static async copyImages(req, res, next) {
        try {
            const { sourcePath, season, presetName, includeHtmlImages, enabledPatterns, targetPath } = req.body;

            if (!sourcePath || !season || !presetName || !targetPath) {
                return res.json({
                    success: false,
                    message: 'All parameters are required'
                });
            }

            if (!enabledPatterns || enabledPatterns.length === 0) {
                return res.json({
                    success: false,
                    message: 'No patterns enabled'
                });
            }

            const seasonPath = path.join(sourcePath, season);

            if (!FileService.existsSync(seasonPath)) {
                return res.json({
                    success: false,
                    message: `Season path does not exist: ${seasonPath}`
                });
            }

            await FileService.ensureDirectory(targetPath);

            // 저장된 프리셋 목록 가져오기
            const presetsData = await FileService.loadPresets();
            const presetNames = presetsData.presets.map(p => p.name);

            // 이미지 파일 찾기
            const imageFiles = await FileService.findImagesByPattern(
                seasonPath,
                season,
                presetNames,
                enabledPatterns,
                includeHtmlImages
            );

            let copiedCount = 0;
            const errors = [];

            // 각 이미지 파일 복사
            for (const fileInfo of imageFiles) {
                try {
                    const fileExt = path.extname(fileInfo.name);
                    const fileName = path.basename(fileInfo.name, fileExt);
                    const newFileName = `${fileName}_${presetName}${fileExt}`;

                    // 원본 파일과 같은 폴더에 저장
                    const originalDir = path.dirname(fileInfo.path);
                    const targetFilePath = path.join(originalDir, newFileName);

                    await FileService.copyFile(fileInfo.path, targetFilePath);
                    copiedCount++;

                    console.log(`Copied: ${fileInfo.relativePath} → ${path.relative(seasonPath, targetFilePath)}`);
                } catch (error) {
                    console.error(`Error copying ${fileInfo.name}:`, error);
                    errors.push(`${fileInfo.name}: ${error.message}`);
                }
            }

            res.json({
                success: true,
                message: `Successfully copied ${copiedCount} images`,
                copiedCount,
                errors
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * 1px 복사된 이미지 삭제
     */
    static async deleteCopiedImages(req, res, next) {
        try {
            const { sourcePath, season, presetName } = req.body;

            if (!sourcePath || !season || !presetName) {
                return res.json({
                    success: false,
                    message: 'All parameters are required'
                });
            }

            const seasonPath = path.join(sourcePath, season);

            if (!FileService.existsSync(seasonPath)) {
                return res.json({
                    success: false,
                    message: `Season path does not exist: ${seasonPath}`
                });
            }

            const imageFiles = await FileService.findImagesWithPreset(seasonPath, season, presetName);

            let deletedCount = 0;
            const errors = [];

            for (const fileInfo of imageFiles) {
                try {
                    await FileService.deleteFile(fileInfo.path);
                    deletedCount++;
                    console.log(`Deleted: ${fileInfo.relativePath}`);
                } catch (error) {
                    console.error(`Error deleting ${fileInfo.name}:`, error);
                    errors.push(`${fileInfo.name}: ${error.message}`);
                }
            }

            res.json({
                success: true,
                message: `Successfully deleted ${deletedCount} images`,
                deletedCount,
                errors
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * NAS 전송
     */
    static async nasTransfer(req, res, next) {
        try {
            const { basePath, season, sourcePath } = req.body;

            if (!basePath || !season || !sourcePath) {
                return res.json({
                    success: false,
                    message: 'All parameters are required'
                });
            }

            const imageFiles = await FileService.findImagesForNas(sourcePath);

            let transferredCount = 0;
            const errors = [];

            for (const fileInfo of imageFiles) {
                try {
                    const fileName = fileInfo.name;
                    const parts = fileName.split('_');

                    if (parts.length >= 2) {
                        const firstPart = parts[0];
                        const secondPart = parts[1];

                        const nasDir = path.join(basePath, season, firstPart, secondPart);
                        const nasFilePath = path.join(nasDir, fileName);

                        await FileService.ensureDirectory(nasDir);
                        await FileService.copyFile(fileInfo.path, nasFilePath);
                        transferredCount++;

                        console.log(`Transferred: ${fileInfo.relativePath} → ${path.relative(basePath, nasFilePath)}`);
                    } else {
                        errors.push(`${fileName}: Invalid filename format`);
                    }
                } catch (error) {
                    console.error(`Error transferring ${fileInfo.name}:`, error);
                    errors.push(`${fileInfo.name}: ${error.message}`);
                }
            }

            res.json({
                success: true,
                message: `Successfully transferred ${transferredCount} images to NAS`,
                transferredCount,
                errors
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * 이미지 동기화 (엑셀 기반)
     */
    static async syncImages(req, res, next) {
        try {
            const { sourcePath, season, presetName, syncAll } = req.body;

            if (!sourcePath || !season || !presetName) {
                return res.json({
                    success: false,
                    message: 'Source path, season, and preset name are required'
                });
            }

            // 전체 동기화가 아닌 경우 엑셀 파일 필수
            if (syncAll !== 'true' && syncAll !== true && !req.file) {
                return res.json({
                    success: false,
                    message: 'Excel file is required'
                });
            }

            // 시즌이 포함된 경로 생성
            const seasonPath = path.join(sourcePath, season);

            if (!FileService.existsSync(seasonPath)) {
                return res.json({
                    success: false,
                    message: `Season path does not exist: ${seasonPath}`
                });
            }

            // 저장된 프리셋 목록 가져오기
            const presetsData = await FileService.loadPresets();
            const presetNames = presetsData.presets.map(p => p.name);

            // 선택한 프리셋 정보 가져오기
            const selectedPreset = presetsData.presets.find(p => p.name === presetName);
            if (!selectedPreset) {
                return res.json({
                    success: false,
                    message: `Preset not found: ${presetName}`
                });
            }

            let copiedCount = 0;
            let resizedCount = 0;
            let skippedCount = 0;
            const errors = [];
            const processedCodes = [];

            // 전체 동기화 모드
            if (syncAll === 'true' || syncAll === true) {
                console.log('🌐 Full sync mode: Excluding 1px pattern images');

                // 1px 패턴 제외 이미지 찾기
                const matchedImages = await FileService.findImagesExcludingPatterns(
                    seasonPath,
                    season,
                    presetNames
                );

                console.log(`✅ Found ${matchedImages.length} images (excluding patterns)`);

                // 각 이미지 리사이징 및 복사
                for (const fileInfo of matchedImages) {
                    try {
                        const fileExt = path.extname(fileInfo.name);
                        const fileName = path.basename(fileInfo.name, fileExt);
                        const newFileName = `${fileName}_${presetName}${fileExt}`;

                        // 원본 파일과 같은 폴더에 저장
                        const originalDir = path.dirname(fileInfo.path);
                        const targetFilePath = path.join(originalDir, newFileName);

                        // 리사이징 후 저장 (덮어쓰기)
                        await resizeImageWithMinimalLoss(
                            fileInfo.path,
                            targetFilePath,
                            selectedPreset.width,
                            selectedPreset.height
                        );
                        
                        copiedCount++;
                        resizedCount++;

                        console.log(`   📋 Resized: ${fileInfo.name} → ${newFileName} (${selectedPreset.width}x${selectedPreset.height})`);
                    } catch (error) {
                        console.error(`   ❌ Error processing ${fileInfo.name}:`, error);
                        errors.push(`${fileInfo.name}: ${error.message}`);
                    }
                }

                return res.json({
                    success: true,
                    message: `Full sync complete: ${resizedCount} images resized`,
                    copiedCount: resizedCount,
                    resizedCount: resizedCount,
                    skippedCount: 0,
                    totalCodes: resizedCount + errors.length,
                    totalImages: resizedCount + errors.length,
                    processedCodes: [],
                    errors
                });
            }

            // 엑셀 기반 동기화 모드
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            console.log(`📊 Excel data loaded: ${data.length} rows`);

            // 헤더 행에서 'imgs' 열 찾기
            let imgsColumnIndex = -1;
            if (data.length > 0) {
                const headerRow = data[0];
                imgsColumnIndex = headerRow.findIndex(col => 
                    String(col).toLowerCase().trim() === 'imgs'
                );
            }

            if (imgsColumnIndex === -1) {
                return res.json({
                    success: false,
                    message: 'Excel file must have an "imgs" column in the header row'
                });
            }

            console.log(`📍 Found "imgs" column at index: ${imgsColumnIndex}`);

            // 엑셀의 각 행 처리 (헤더 제외)
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue;

                // imgs 열의 데이터 가져오기
                let code = row[imgsColumnIndex] ? String(row[imgsColumnIndex]).trim() : '';
                if (!code) continue;

                // SF177E-55NXFJ → SF177E-55N_XFJ 변환
                // 마지막 3글자 앞에 _ 삽입
                const originalCode = code;
                if (code.length > 3) {
                    const prefix = code.slice(0, -3);
                    const suffix = code.slice(-3);
                    code = `${prefix}_${suffix}`;
                }

                console.log(`\n🔍 Processing row ${i + 1}: ${originalCode} → ${code}`);

                try {
                    // 해당 코드로 시작하는 이미지 파일 찾기 (시즌 경로에서 검색)
                    const matchedImages = await FileService.findImagesByCode(
                        seasonPath,
                        code,
                        presetNames,
                        season
                    );

                    if (matchedImages.length === 0) {
                        console.log(`⚠️  No images found for: ${code}`);
                        skippedCount++;
                        continue;
                    }

                    console.log(`✅ Found ${matchedImages.length} images for: ${code}`);

                    // 각 이미지 리사이징 및 복사
                    for (const fileInfo of matchedImages) {
                        try {
                            const fileExt = path.extname(fileInfo.name);
                            const fileName = path.basename(fileInfo.name, fileExt);
                            const newFileName = `${fileName}_${presetName}${fileExt}`;

                            // 원본 파일과 같은 폴더에 저장
                            const originalDir = path.dirname(fileInfo.path);
                            const targetFilePath = path.join(originalDir, newFileName);

                            // 리사이징 후 저장 (덮어쓰기)
                            await resizeImageWithMinimalLoss(
                                fileInfo.path,
                                targetFilePath,
                                selectedPreset.width,
                                selectedPreset.height
                            );
                            
                            copiedCount++;
                            resizedCount++;

                            console.log(`   📋 Resized & Copied: ${fileInfo.name} → ${newFileName} (${selectedPreset.width}x${selectedPreset.height})`);
                        } catch (error) {
                            console.error(`   ❌ Error processing ${fileInfo.name}:`, error);
                            errors.push(`${fileInfo.name}: ${error.message}`);
                        }
                    }

                    processedCodes.push({
                        original: originalCode,
                        converted: code,
                        imageCount: matchedImages.length
                    });

                } catch (error) {
                    console.error(`❌ Error processing ${code}:`, error);
                    errors.push(`${code}: ${error.message}`);
                }
            }

            res.json({
                success: true,
                message: `Synchronization complete: ${resizedCount} images resized, ${skippedCount} codes skipped`,
                copiedCount: resizedCount,
                resizedCount: resizedCount,
                skippedCount,
                totalCodes: resizedCount + errors.length,
                totalImages: resizedCount + errors.length,
                processedCodes,
                errors
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * 1px 이미지 복사 (엑셀 필터링)
     */
    static async copyImagesWithExcel(req, res, next) {
        try {
            const { sourcePath, season, presetName, includeHtmlImages, enabledPatterns } = req.body;

            if (!sourcePath || !season || !presetName) {
                return res.json({
                    success: false,
                    message: 'Source path, season, and preset name are required'
                });
            }

            if (!req.file) {
                return res.json({
                    success: false,
                    message: 'Excel file is required'
                });
            }

            const seasonPath = path.join(sourcePath, season);

            if (!FileService.existsSync(seasonPath)) {
                return res.json({
                    success: false,
                    message: `Season path does not exist: ${seasonPath}`
                });
            }

            // 엑셀 파일 읽기
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            // 헤더 행에서 'imgs' 열 찾기
            let imgsColumnIndex = -1;
            if (data.length > 0) {
                const headerRow = data[0];
                imgsColumnIndex = headerRow.findIndex(col =>
                    String(col).toLowerCase().trim() === 'imgs'
                );
            }

            if (imgsColumnIndex === -1) {
                return res.json({
                    success: false,
                    message: 'Excel file must have an "imgs" column in the header row'
                });
            }

            // 엑셀에서 코드 목록 추출 및 변환
            const excelCodes = [];
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue;

                let code = row[imgsColumnIndex] ? String(row[imgsColumnIndex]).trim() : '';
                if (!code) continue;

                // SF177E-55NXFJ → SF177E-55N-XFJ 변환
                if (code.length > 3) {
                    const prefix = code.slice(0, -3);
                    const suffix = code.slice(-3);
                    code = `${prefix}-${suffix}`;
                }

                excelCodes.push(code);
            }

            if (excelCodes.length === 0) {
                return res.json({
                    success: false,
                    message: 'No valid codes found in Excel file'
                });
            }

            console.log(`📊 Loaded ${excelCodes.length} codes from Excel`);

            // 저장된 프리셋 목록 가져오기
            const presetsData = await FileService.loadPresets();
            const presetNames = presetsData.presets.map(p => p.name);

            // enabledPatterns 파싱
            const patterns = typeof enabledPatterns === 'string' 
                ? JSON.parse(enabledPatterns) 
                : enabledPatterns;

            // 이미지 파일 찾기
            const imageFiles = await FileService.findImagesByExcelCodes(
                seasonPath,
                season,
                excelCodes,
                presetNames,
                patterns,
                includeHtmlImages === 'true' || includeHtmlImages === true
            );

            let copiedCount = 0;
            let skippedCount = excelCodes.length;
            const errors = [];

            // 각 이미지 파일 복사
            for (const fileInfo of imageFiles) {
                try {
                    const fileExt = path.extname(fileInfo.name);
                    const fileName = path.basename(fileInfo.name, fileExt);
                    const newFileName = `${fileName}_${presetName}${fileExt}`;

                    // 원본 파일과 같은 폴더에 저장
                    const originalDir = path.dirname(fileInfo.path);
                    const targetFilePath = path.join(originalDir, newFileName);

                    // 파일 복사 (덮어쓰기)
                    await FileService.copyFile(fileInfo.path, targetFilePath);
                    copiedCount++;

                    console.log(`📋 Copied: ${fileInfo.relativePath} → ${path.relative(seasonPath, targetFilePath)}`);
                } catch (error) {
                    console.error(`Error copying ${fileInfo.name}:`, error);
                    errors.push(`${fileInfo.name}: ${error.message}`);
                }
            }

            // 실제로 이미지를 찾은 코드 수 계산
            const foundCodes = new Set(imageFiles.map(f => {
                const parts = f.name.split('_');
                return parts.slice(0, -1).join('_');
            })).size;

            skippedCount = excelCodes.length - foundCodes;

            res.json({
                success: true,
                message: `Excel filtering complete: ${copiedCount} images copied`,
                copiedCount,
                skippedCount,
                totalCodes: excelCodes.length,
                errors
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * 1px 복사된 이미지 삭제
     */
    static async deleteCopiedImages(req, res, next) {
        try {
            const { sourcePath, season, presetName } = req.body;

            if (!sourcePath || !season || !presetName) {
                return res.json({
                    success: false,
                    message: 'Source path, season, and preset name are required'
                });
            }

            const seasonPath = path.join(sourcePath, season);

            if (!FileService.existsSync(seasonPath)) {
                return res.json({
                    success: false,
                    message: `Season path does not exist: ${seasonPath}`
                });
            }

            console.log(`🗑️ Deleting images with preset "${presetName}" in ${seasonPath}`);

            // 프리셋이 포함된 이미지 파일 찾기
            const imageFiles = await FileService.findImagesWithPreset(
                seasonPath,
                season,
                presetName
            );

            if (imageFiles.length === 0) {
                return res.json({
                    success: true,
                    message: `No images found with preset "${presetName}"`,
                    deletedCount: 0,
                    totalImages: 0,
                    errors: []
                });
            }

            console.log(`✅ Found ${imageFiles.length} images to delete`);

            let deletedCount = 0;
            const errors = [];

            // 각 이미지 파일 삭제
            for (const fileInfo of imageFiles) {
                try {
                    const success = await FileService.deleteFile(fileInfo.path);
                    if (success) {
                        deletedCount++;
                        console.log(`   🗑️ Deleted: ${fileInfo.relativePath}`);
                    } else {
                        errors.push(`${fileInfo.name}: Failed to delete`);
                    }
                } catch (error) {
                    console.error(`Error deleting ${fileInfo.name}:`, error);
                    errors.push(`${fileInfo.name}: ${error.message}`);
                }
            }

            res.json({
                success: true,
                message: `Deletion complete: ${deletedCount} images deleted`,
                deletedCount,
                totalImages: imageFiles.length,
                errors
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * 동기화 서버 이미지 삭제
     */
    static async deleteSyncImages(req, res, next) {
        try {
            const { 
                sourcePath, 
                season, 
                presetName, 
                deletePatternImages, 
                deleteSyncImages, 
                deleteOriginalImages 
            } = req.body;

            if (!sourcePath || !season || !presetName) {
                return res.json({
                    success: false,
                    message: 'Source path, season, and preset name are required'
                });
            }

            const seasonPath = path.join(sourcePath, season);

            if (!FileService.existsSync(seasonPath)) {
                return res.json({
                    success: false,
                    message: `Season path does not exist: ${seasonPath}`
                });
            }

            console.log(`🗑️ Deleting sync images with preset "${presetName}" in ${seasonPath}`);
            console.log(`   - Pattern images: ${deletePatternImages}`);
            console.log(`   - Sync images: ${deleteSyncImages}`);
            console.log(`   - Original images: ${deleteOriginalImages} (DISABLED)`);

            let allImageFiles = [];
            let deletedCount = 0;
            const errors = [];

        // 1. 1px Copy 패턴 이미지 삭제
        if (deletePatternImages) {
            const patternImages = await FileService.findPatternImagesWithPreset(
                seasonPath, 
                season, 
                presetName
            );
            allImageFiles = allImageFiles.concat(patternImages);
            console.log(`   📁 Found ${patternImages.length} pattern images`);
        }

        // 2. 동기화로 생성된 이미지 삭제 (프리셋이 포함된 일반 이미지)
        if (deleteSyncImages) {
            const syncImages = await FileService.findSyncImagesWithPreset(
                seasonPath, 
                season, 
                presetName
            );
            // 패턴 이미지와 중복 제거
            const uniqueSyncImages = syncImages.filter(img => 
                !allImageFiles.some(existing => existing.path === img.path)
            );
            allImageFiles = allImageFiles.concat(uniqueSyncImages);
            console.log(`   🔄 Found ${uniqueSyncImages.length} sync images`);
        }

            // 3. 원본 이미지 삭제는 절대 하지 않음 (보안상 이유)
            // deleteOriginalImages는 항상 false로 처리됨

            if (allImageFiles.length === 0) {
                return res.json({
                    success: true,
                    message: `No images found for deletion`,
                    deletedCount: 0,
                    totalImages: 0,
                    errors: []
                });
            }

            console.log(`✅ Total images to delete: ${allImageFiles.length}`);

            // 각 이미지 파일 삭제
            for (const fileInfo of allImageFiles) {
                try {
                    const success = await FileService.deleteFile(fileInfo.path);
                    if (success) {
                        deletedCount++;
                        console.log(`   🗑️ Deleted: ${fileInfo.relativePath}`);
                    } else {
                        errors.push(`${fileInfo.name}: Failed to delete`);
                    }
                } catch (error) {
                    console.error(`Error deleting ${fileInfo.name}:`, error);
                    errors.push(`${fileInfo.name}: ${error.message}`);
                }
            }

            res.json({
                success: true,
                message: `Sync deletion complete: ${deletedCount} images deleted`,
                deletedCount,
                totalImages: allImageFiles.length,
                errors
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * 샘플 엑셀 파일 다운로드
     */
    static async downloadSampleExcel(req, res, next) {
        try {
            // 샘플 데이터 생성
            const sampleData = [
                ['imgs'],
                ['SF177E-55NXFJ'],
                ['AF550E-55NCCA'],
                ['NF5105I55NR30']
            ];

            // 새 워크북 생성
            const workbook = xlsx.utils.book_new();
            const worksheet = xlsx.utils.aoa_to_sheet(sampleData);

            // 워크시트를 워크북에 추가
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Sample');

            // 버퍼로 변환
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            // 파일명 생성 (중복 시 (1), (2) 추가)
            const baseFileName = 'img_sample';
            const fileExt = '.xlsx';
            
            // 응답 헤더 설정
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${baseFileName}${fileExt}"`);
            res.setHeader('Content-Length', buffer.length);

            // 파일 전송
            res.send(buffer);

        } catch (error) {
            next(error);
        }
    }
}

export default ImageController;

