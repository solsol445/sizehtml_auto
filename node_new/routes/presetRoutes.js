import express from 'express';
import PresetController from '../controllers/presetController.js';

const router = express.Router();

// 프리셋 목록 조회
router.get('/', PresetController.getPresets);

// 프리셋 저장
router.post('/', PresetController.savePreset);

// 프리셋 삭제
router.delete('/:name', PresetController.deletePreset);

export default router;

