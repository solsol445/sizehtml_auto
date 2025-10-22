import FileService from '../services/FileService.js';

/**
 * 프리셋 관련 컨트롤러
 */
class PresetController {
    /**
     * 프리셋 목록 조회
     */
    static async getPresets(req, res, next) {
        try {
            const data = await FileService.loadPresets();
            res.json({
                success: true,
                presets: data.presets
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 프리셋 저장
     */
    static async savePreset(req, res, next) {
        try {
            const { name, width, height } = req.body;

            if (!name || !width || !height) {
                return res.json({
                    success: false,
                    message: 'Name, width, and height are required'
                });
            }

            const data = await FileService.loadPresets();

            // 중복 이름 체크
            if (data.presets.find(p => p.name === name)) {
                return res.json({
                    success: false,
                    message: 'Preset name already exists'
                });
            }

            // 새 프리셋 추가
            data.presets.push({
                name: name.trim(),
                width: parseInt(width),
                height: parseInt(height)
            });

            const saved = await FileService.savePresets(data.presets);

            if (saved) {
                res.json({
                    success: true,
                    message: 'Preset saved successfully',
                    presets: data.presets
                });
            } else {
                res.json({
                    success: false,
                    message: 'Error saving preset'
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * 프리셋 삭제
     */
    static async deletePreset(req, res, next) {
        try {
            const { name } = req.params;
            const data = await FileService.loadPresets();

            const initialLength = data.presets.length;
            data.presets = data.presets.filter(p => p.name !== name);

            if (data.presets.length === initialLength) {
                return res.json({
                    success: false,
                    message: 'Preset not found'
                });
            }

            const saved = await FileService.savePresets(data.presets);

            if (saved) {
                res.json({
                    success: true,
                    message: 'Preset deleted successfully',
                    presets: data.presets
                });
            } else {
                res.json({
                    success: false,
                    message: 'Error deleting preset'
                });
            }
        } catch (error) {
            next(error);
        }
    }
}

export default PresetController;

