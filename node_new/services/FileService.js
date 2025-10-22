import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { PATHS, IMAGE_CONFIG, COPY_PATTERNS, NAS_CONFIG, EXCLUDE_CONFIG } from '../config/constants.js';

/**
 * 파일 시스템 관련 모든 작업을 처리하는 서비스 클래스
 */
class FileService {
    /**
     * 디렉토리 존재 여부 확인 및 생성
     */
    static async ensureDirectory(dirPath) {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    /**
     * 디렉토리 존재 여부 확인 (동기)
     */
    static existsSync(filePath) {
        return fsSync.existsSync(filePath);
    }

    /**
     * 프리셋 파일 초기화
     */
    static async initPresetsFile() {
        if (!fsSync.existsSync(PATHS.PRESETS_FILE)) {
            await fs.writeFile(
                PATHS.PRESETS_FILE,
                JSON.stringify({ presets: [] }, null, 2),
                'utf8'
            );
        }
    }

    /**
     * 프리셋 데이터 로드
     */
    static async loadPresets() {
        try {
            const data = await fs.readFile(PATHS.PRESETS_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading presets:', error);
            return { presets: [] };
        }
    }

    /**
     * 프리셋 데이터 저장
     */
    static async savePresets(presets) {
        try {
            await fs.writeFile(
                PATHS.PRESETS_FILE,
                JSON.stringify({ presets }, null, 2),
                'utf8'
            );
            return true;
        } catch (error) {
            console.error('Error saving presets:', error);
            return false;
        }
    }

    /**
     * 임시 파일 쓰기
     */
    static async writeTempFile(filePath, buffer) {
        await fs.writeFile(filePath, buffer);
    }

    /**
     * 파일 삭제
     */
    static async deleteFile(filePath) {
        await fs.unlink(filePath);
    }

    /**
     * 파일 복사
     */
    static async copyFile(source, destination) {
        await fs.copyFile(source, destination);
    }

    /**
     * 폴더 삭제 (재귀적)
     */
    static async deleteFolder(folderPath) {
        await fs.rm(folderPath, { recursive: true, force: true });
    }

    /**
     * 폴더 내 이미지 파일 목록 가져오기
     */
    static async getImagesInFolder(folderPath) {
        const files = await fs.readdir(folderPath);
        const images = [];

        for (const file of files) {
            const fullPath = path.join(folderPath, file);
            const stat = await fs.stat(fullPath);

            if (stat.isFile() && this.isImageFile(file)) {
                images.push({
                    name: file,
                    url: `/api/images/${path.basename(folderPath)}/${file}`,
                    size: stat.size
                });
            }
        }

        return images;
    }

    /**
     * 출력 폴더별 이미지 목록 가져오기
     */
    static async getFolders() {
        const folders = [];

        if (!fsSync.existsSync(PATHS.OUTPUT_DIR)) {
            return folders;
        }

        const items = await fs.readdir(PATHS.OUTPUT_DIR, { withFileTypes: true });

        for (const item of items) {
            if (item.isDirectory()) {
                const folderPath = path.join(PATHS.OUTPUT_DIR, item.name);
                const images = await this.getImagesInFolder(folderPath);

                folders.push({
                    name: item.name,
                    path: item.name,
                    imageCount: images.length,
                    images
                });
            }
        }

        return folders;
    }

    /**
     * 외부 폴더 브라우징
     */
    static async browseExternalFolder(folderPath, includeImages = false) {
        // 특정 폴더의 이미지만 요청하는 경우
        if (includeImages) {
            const images = [];
            const files = await fs.readdir(folderPath);

            for (const file of files) {
                const fullPath = path.join(folderPath, file);
                const stat = await fs.stat(fullPath);

                if (stat.isFile() && this.isImageFile(file)) {
                    images.push({
                        name: file,
                        path: fullPath,
                        size: stat.size
                    });
                }
            }

            return { images };
        }

        // 최상위 폴더 목록 가져오기
        const items = await fs.readdir(folderPath, { withFileTypes: true });
        const folders = [];

        for (const item of items) {
            if (item.isDirectory()) {
                const folderFullPath = path.join(folderPath, item.name);
                const images = [];

                try {
                    const subFiles = await fs.readdir(folderFullPath);

                    for (const file of subFiles) {
                        const filePath = path.join(folderFullPath, file);
                        const stat = await fs.stat(filePath);

                        if (stat.isFile() && this.isImageFile(file)) {
                            images.push({
                                name: file,
                                path: filePath,
                                size: stat.size
                            });
                        }
                    }
                } catch (err) {
                    console.error('Error reading subfolder:', err);
                }

                if (images.length > 0) {
                    folders.push({
                        name: item.name,
                        path: folderFullPath,
                        imageCount: images.length,
                        images
                    });
                }
            }
        }

        return { folders };
    }

    /**
     * 재귀적으로 이미지 파일 찾기 (1px Copy용)
     */
    static async findImagesByPattern(seasonPath, season, presetNames, enabledPatterns, includeHtmlImages) {
        const imageFiles = [];
        const htmlPatterns = COPY_PATTERNS.HTML;

        const searchDirectory = async (currentPath) => {
            try {
                const items = await fs.readdir(currentPath);

                for (const item of items) {
                    const itemPath = path.join(currentPath, item);
                    const stat = await fs.stat(itemPath);

                    if (stat.isDirectory()) {
                        await searchDirectory(itemPath);
                    } else if (stat.isFile() && this.isImageFile(item)) {
                        // transparent 폴더 제외
                        if (this.isInTransparentFolder(itemPath)) continue;

                        const fileExt = path.extname(item);
                        const fileNameWithoutExt = path.basename(item, fileExt);

                        const underscoreIndex = fileNameWithoutExt.indexOf('_');
                        if (underscoreIndex === -1) continue;

                        const firstPart = fileNameWithoutExt.substring(0, underscoreIndex);
                        const afterFirstUnderscore = fileNameWithoutExt.substring(underscoreIndex + 1);

                        // 시즌 확인
                        const hasSeason = firstPart.startsWith(season);
                        if (!hasSeason) continue;

                        // 활성화된 패턴인지 확인
                        const isEnabledPattern = enabledPatterns.includes(afterFirstUnderscore);
                        if (!isEnabledPattern) continue;

                        // HTML 이미지인지 확인
                        const isHtmlImage = htmlPatterns.includes(afterFirstUnderscore);
                        if (isHtmlImage && !includeHtmlImages) continue;

                        // 저장된 프리셋이 포함된 파일인지 확인 (복사본 제외)
                        const hasAnyPreset = presetNames.some(presetName =>
                            item.includes(`_${presetName}.`)
                        );

                        if (!hasAnyPreset) {
                            imageFiles.push({
                                name: item,
                                path: itemPath,
                                relativePath: path.relative(seasonPath, itemPath)
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error reading directory ${currentPath}:`, error);
            }
        };

        await searchDirectory(seasonPath);
        return imageFiles;
    }

    /**
     * 프리셋이 포함된 이미지 파일 찾기 (1px 삭제용)
     */
    static async findImagesWithPreset(seasonPath, season, presetName) {
        const imageFiles = [];

        const searchDirectory = async (currentPath) => {
            try {
                const items = await fs.readdir(currentPath);

                for (const item of items) {
                    const itemPath = path.join(currentPath, item);
                    const stat = await fs.stat(itemPath);

                    if (stat.isDirectory()) {
                        await searchDirectory(itemPath);
                    } else if (stat.isFile()) {
                        // transparent 폴더 제외
                        if (this.isInTransparentFolder(itemPath)) continue;

                        const isImage = this.isImageFile(item);
                        const hasSeason = item.includes(season);
                        const hasPreset = item.includes(`_${presetName}.`);

                        if (isImage && hasSeason && hasPreset) {
                            imageFiles.push({
                                name: item,
                                path: itemPath,
                                relativePath: path.relative(seasonPath, itemPath)
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error reading directory ${currentPath}:`, error);
            }
        };

        await searchDirectory(seasonPath);
        return imageFiles;
    }

    /**
     * NAS 전송용 이미지 파일 찾기
     */
    static async findImagesForNas(sourcePath) {
        const imageFiles = [];
        const excludePrefixes = NAS_CONFIG.EXCLUDE_PREFIXES;

        const searchDirectory = async (currentPath) => {
            try {
                const items = await fs.readdir(currentPath);

                for (const item of items) {
                    const itemPath = path.join(currentPath, item);
                    const stat = await fs.stat(itemPath);

                    if (stat.isDirectory()) {
                        await searchDirectory(itemPath);
                        } else if (stat.isFile()) {
                            // transparent 폴더 제외
                            if (this.isInTransparentFolder(itemPath)) continue;

                            const isImage = this.isImageFile(item);
                            const isExcluded = excludePrefixes.some(prefix =>
                                item.toLowerCase().startsWith(prefix)
                            );

                            if (isImage && !isExcluded) {
                                imageFiles.push({
                                    name: item,
                                    path: itemPath,
                                    relativePath: path.relative(sourcePath, itemPath)
                                });
                            }
                        }
                }
            } catch (error) {
                console.error(`Error reading directory ${currentPath}:`, error);
            }
        };

        await searchDirectory(sourcePath);
        return imageFiles;
    }

    /**
     * 이미지 파일 여부 확인
     */
    static isImageFile(filename) {
        const ext = path.extname(filename).toLowerCase();
        return IMAGE_CONFIG.ALLOWED_EXTENSIONS.includes(ext);
    }

    /**
     * 파일 MIME 타입 확인
     */
    static isValidMimeType(mimetype) {
        return IMAGE_CONFIG.ALLOWED_MIMETYPES.includes(mimetype);
    }

    /**
     * transparent 폴더에 있는 파일인지 확인
     */
    static isInTransparentFolder(filePath) {
        const pathParts = filePath.split(path.sep);
        return EXCLUDE_CONFIG.FOLDERS.some(folder => 
            pathParts.includes(folder)
        );
    }

    /**
     * 코드로 시작하는 이미지 파일 찾기 (이미지 동기화용)
     * 시즌으로 시작하는 파일은 제외
     */
    static async findImagesByCode(sourcePath, code, presetNames, season = null) {
        const imageFiles = [];

        // 정규식 패턴: 코드로 시작 + _1-4자리 영숫자 + 확장자
        // 예: SF177E-55N_XFJ_1.jpg, SF177E-55N_XFJ_20.jpg, SF177E-55N_XFJ_L1.jpg, SF177E-55N_XFJ_ABCD.jpg
        const escapeRegex = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`^${escapeRegex}_[A-Z0-9]{1,4}\\.(jpg|jpeg|png|gif|webp)$`, 'i');

        const searchDirectory = async (currentPath) => {
            try {
                const items = await fs.readdir(currentPath);

                for (const item of items) {
                    const itemPath = path.join(currentPath, item);
                    const stat = await fs.stat(itemPath);

                    if (stat.isDirectory()) {
                        await searchDirectory(itemPath);
                    } else if (stat.isFile() && this.isImageFile(item)) {
                        // transparent 폴더 제외
                        if (this.isInTransparentFolder(itemPath)) continue;

                        // 시즌으로 시작하는 파일 제외
                        if (season && item.startsWith(season)) continue;

                        // 파일명이 정규식 패턴과 일치하는지 확인
                        if (pattern.test(item)) {
                            // 저장된 프리셋이 포함된 파일인지 확인 (복사본 제외)
                            const hasAnyPreset = presetNames.some(presetName =>
                                item.includes(`_${presetName}.`)
                            );

                            // 프리셋이 없는 원본 파일만 복사 대상
                            if (!hasAnyPreset) {
                                imageFiles.push({
                                    name: item,
                                    path: itemPath,
                                    relativePath: path.relative(sourcePath, itemPath)
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Error reading directory ${currentPath}:`, error);
            }
        };

        await searchDirectory(sourcePath);
        return imageFiles;
    }

    /**
     * 엑셀 코드 + 패턴 기반으로 이미지 파일 찾기 (1px Copy 엑셀 필터링용)
     */
    static async findImagesByExcelCodes(seasonPath, season, excelCodes, presetNames, enabledPatterns, includeHtmlImages) {
        const imageFiles = [];
        const htmlPatterns = COPY_PATTERNS.HTML;

        const searchDirectory = async (currentPath) => {
            try {
                const items = await fs.readdir(currentPath);

                for (const item of items) {
                    const itemPath = path.join(currentPath, item);
                    const stat = await fs.stat(itemPath);

                    if (stat.isDirectory()) {
                        await searchDirectory(itemPath);
                    } else if (stat.isFile() && this.isImageFile(item)) {
                        // transparent 폴더 제외
                        if (this.isInTransparentFolder(itemPath)) continue;

                        // 파일명 분석: 25FW-SF177E-55N_XFJ_promotion_01.jpg
                        const fileExt = path.extname(item);
                        const fileNameWithoutExt = path.basename(item, fileExt);

                        // "_"로 분할하여 패턴 추출
                        const parts = fileNameWithoutExt.split('_');
                        if (parts.length < 2) continue;

                        // 마지막 부분이 패턴
                        const pattern = parts[parts.length - 1];

                        // 활성화된 패턴인지 확인
                        const isEnabledPattern = enabledPatterns.includes(pattern);
                        if (!isEnabledPattern) continue;

                        // HTML 이미지인지 확인
                        const isHtmlImage = htmlPatterns.includes(pattern);
                        if (isHtmlImage && !includeHtmlImages) continue;

                        // 엑셀 코드 매칭 확인
                        // 25FW-SF177E-55N_XFJ_promotion_01.jpg 에서
                        // 시즌-코드 부분 추출 (마지막 _패턴 제외)
                        const codePartWithPattern = parts.slice(0, -1).join('_');
                        
                        // 엑셀 코드와 매칭 확인
                        const matchesExcelCode = excelCodes.some(excelCode => {
                            const expectedPattern = `${season}-${excelCode}`;
                            return codePartWithPattern === expectedPattern;
                        });

                        if (!matchesExcelCode) continue;

                        // 저장된 프리셋이 포함된 파일인지 확인 (복사본 제외)
                        const hasAnyPreset = presetNames.some(presetName =>
                            item.includes(`_${presetName}.`)
                        );

                        if (!hasAnyPreset) {
                            imageFiles.push({
                                name: item,
                                path: itemPath,
                                relativePath: path.relative(seasonPath, itemPath)
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error reading directory ${currentPath}:`, error);
            }
        };

        await searchDirectory(seasonPath);
        return imageFiles;
    }

    /**
     * 1px 패턴 제외 이미지 찾기 (전체 동기화용)
     */
    static async findImagesExcludingPatterns(seasonPath, season, presetNames) {
        const imageFiles = [];
        const allPatterns = COPY_PATTERNS.ALL; // 9개 패턴 전체

        const searchDirectory = async (currentPath) => {
            try {
                const items = await fs.readdir(currentPath);

                for (const item of items) {
                    const itemPath = path.join(currentPath, item);
                    const stat = await fs.stat(itemPath);

                    if (stat.isDirectory()) {
                        await searchDirectory(itemPath);
                    } else if (stat.isFile() && this.isImageFile(item)) {
                        // transparent 폴더 제외
                        if (this.isInTransparentFolder(itemPath)) continue;

                        const fileExt = path.extname(item);
                        const fileNameWithoutExt = path.basename(item, fileExt);

                        const underscoreIndex = fileNameWithoutExt.indexOf('_');
                        if (underscoreIndex === -1) continue;

                        const firstPart = fileNameWithoutExt.substring(0, underscoreIndex);
                        const afterFirstUnderscore = fileNameWithoutExt.substring(underscoreIndex + 1);

                        // 시즌 확인
                        const hasSeason = firstPart.startsWith(season);
                        if (!hasSeason) continue;

                        // 1px 패턴 (9개 패턴) 제외
                        const isPatternImage = allPatterns.includes(afterFirstUnderscore);
                        if (isPatternImage) continue;

                        // 저장된 프리셋이 포함된 파일인지 확인 (복사본 제외)
                        const hasAnyPreset = presetNames.some(presetName =>
                            item.includes(`_${presetName}.`)
                        );

                        if (!hasAnyPreset) {
                            imageFiles.push({
                                name: item,
                                path: itemPath,
                                relativePath: path.relative(seasonPath, itemPath)
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error reading directory ${currentPath}:`, error);
            }
        };

        await searchDirectory(seasonPath);
        return imageFiles;
    }

    /**
     * 1px Copy로 생성된 패턴 이미지 찾기 (패턴 이미지 삭제용)
     * 특징: 시즌으로 시작 (예: 25FW-ABC123_promotion_01_musinsa.jpg)
     */
    static async findPatternImagesWithPreset(seasonPath, season, presetName) {
        const imageFiles = [];

        const searchDirectory = async (currentPath) => {
            try {
                const items = await fs.readdir(currentPath);

                for (const item of items) {
                    const itemPath = path.join(currentPath, item);
                    const stat = await fs.stat(itemPath);

                    if (stat.isDirectory()) {
                        await searchDirectory(itemPath);
                    } else if (stat.isFile() && this.isImageFile(item)) {
                        // transparent 폴더 제외
                        if (this.isInTransparentFolder(itemPath)) continue;

                        // 프리셋이 포함된 파일인지 확인
                        if (!item.includes(`_${presetName}.`)) continue;

                        // 시즌으로 시작하는지 확인
                        const hasSeason = item.startsWith(season);
                        if (hasSeason) {
                            imageFiles.push({
                                name: item,
                                path: itemPath,
                                relativePath: path.relative(seasonPath, itemPath)
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error reading directory ${currentPath}:`, error);
            }
        };

        await searchDirectory(seasonPath);
        return imageFiles;
    }

    /**
     * 동기화로 생성된 이미지 찾기 (동기화 이미지 삭제용)
     * 특징: 시즌으로 시작하지 않음 (예: ABC123_musinsa.jpg)
     */
    static async findSyncImagesWithPreset(seasonPath, season, presetName) {
        const imageFiles = [];

        const searchDirectory = async (currentPath) => {
            try {
                const items = await fs.readdir(currentPath);

                for (const item of items) {
                    const itemPath = path.join(currentPath, item);
                    const stat = await fs.stat(itemPath);

                    if (stat.isDirectory()) {
                        await searchDirectory(itemPath);
                    } else if (stat.isFile() && this.isImageFile(item)) {
                        // transparent 폴더 제외
                        if (this.isInTransparentFolder(itemPath)) continue;

                        // 프리셋이 포함된 파일인지 확인
                        if (!item.includes(`_${presetName}.`)) continue;

                        // 시즌으로 시작하지 않는지 확인
                        const hasSeason = item.startsWith(season);
                        if (!hasSeason) {
                            imageFiles.push({
                                name: item,
                                path: itemPath,
                                relativePath: path.relative(seasonPath, itemPath)
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error reading directory ${currentPath}:`, error);
            }
        };

        await searchDirectory(seasonPath);
        return imageFiles;
    }

    /**
     * 프리셋이 포함된 이미지 파일 찾기 (삭제용)
     */
    static async findImagesWithPreset(seasonPath, season, presetName) {
        const imageFiles = [];

        const searchDirectory = async (currentPath) => {
            try {
                const items = await fs.readdir(currentPath);

                for (const item of items) {
                    const itemPath = path.join(currentPath, item);
                    const stat = await fs.stat(itemPath);

                    if (stat.isDirectory()) {
                        await searchDirectory(itemPath);
                    } else if (stat.isFile() && this.isImageFile(item)) {
                        // transparent 폴더 제외
                        if (this.isInTransparentFolder(itemPath)) continue;

                        // 프리셋이 포함된 파일인지 확인
                        if (item.includes(`_${presetName}.`)) {
                            imageFiles.push({
                                name: item,
                                path: itemPath,
                                relativePath: path.relative(seasonPath, itemPath)
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error reading directory ${currentPath}:`, error);
            }
        };

        await searchDirectory(seasonPath);
        return imageFiles;
    }

    /**
     * 파일 삭제
     */
    static async deleteFile(filePath) {
        try {
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            console.error(`Error deleting file ${filePath}:`, error);
            return false;
        }
    }
}

export default FileService;

