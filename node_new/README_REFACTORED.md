# 📸 Image Resizer - ESM 리팩토링 버전

## 🎯 리팩토링 개요

기존의 모놀리식 구조를 **ES 모듈(ESM) 방식**과 **관심사 분리(SoC) 원칙**에 따라 재구성한 버전입니다.

---

## 📂 새로운 프로젝트 구조

```
node_copy/
├── config/
│   └── constants.js          # 상수 및 설정 관리
├── controllers/
│   ├── imageController.js    # 이미지 요청/응답 처리
│   └── presetController.js   # 프리셋 요청/응답 처리
├── routes/
│   ├── imageRoutes.js        # 이미지 API 라우터
│   └── presetRoutes.js       # 프리셋 API 라우터
├── services/
│   └── FileService.js        # 파일 시스템 로직 (fs 작업)
├── public/                   # 정적 파일 (HTML, CSS, JS)
├── img_in/                   # 입력 이미지 폴더
├── img_out/                  # 출력 이미지 폴더
├── presets.json              # 프리셋 저장 파일
├── server.js                 # Express 서버 메인 진입점
├── resize.js                 # 순수 이미지 리사이징 유틸리티
├── cli.js                    # 터미널 CLI 도구
├── package.json              # ESM 설정 포함
└── README_REFACTORED.md      # 이 파일
```

---

## ✨ 주요 개선 사항

### **1. ES 모듈(ESM) 도입**
- `require()` → `import`
- `module.exports` → `export`
- `package.json`에 `"type": "module"` 추가

### **2. 관심사 분리 (Separation of Concerns)**
- **config/**: 상수 및 설정 중앙 관리
- **services/**: 비즈니스 로직 (파일 시스템 작업)
- **controllers/**: 요청/응답 처리
- **routes/**: API 엔드포인트 정의

### **3. 비동기 처리 개선**
- `fs` → `fs/promises` 사용
- 모든 파일 작업을 `async/await`로 처리

### **4. 중앙 집중식 에러 처리**
- Express의 에러 미들웨어를 통한 통합 에러 관리
- 일관된 에러 응답 포맷

### **5. 코드 재사용성 향상**
- `FileService` 클래스를 통한 파일 시스템 로직 통합
- 순수 함수로 리팩토링된 `resize.js`

---

## 🚀 실행 방법

### **1. 웹 서버 실행**
```bash
npm run web
# 또는
node server.js
```
- 브라우저에서 `http://localhost:4005` 접속

### **2. CLI 도구 실행**
```bash
npm start
# 또는
node cli.js
```
- 터미널에서 이미지 리사이징 수행

### **3. 개발 모드 (nodemon)**
```bash
npm run dev
```
- 파일 변경 시 자동 재시작

---

## 📋 API 엔드포인트

### **이미지 관련**
- `POST /api/upload` - 이미지 업로드 및 리사이징
- `GET /api/folders` - 폴더별 이미지 목록 조회
- `GET /api/images/:folder/:filename` - 이미지 파일 서빙
- `POST /api/browse-external` - 외부 폴더 브라우징
- `GET /api/external-image` - 외부 이미지 서빙
- `POST /api/delete-folder` - 폴더 삭제
- `POST /api/delete-image` - 이미지 삭제
- `POST /api/copy-images` - 1px 이미지 복사
- `POST /api/delete-copied-images` - 1px 복사된 이미지 삭제
- `POST /api/nas-transfer` - NAS 전송

### **프리셋 관련**
- `GET /api/presets` - 프리셋 목록 조회
- `POST /api/presets` - 프리셋 저장
- `DELETE /api/presets/:name` - 프리셋 삭제

---

## 🔧 설정 (config/constants.js)

### **서버 설정**
```javascript
export const SERVER_CONFIG = {
    PORT: 4005,
    CORS_ENABLED: true,
    FILE_SIZE_LIMIT: 10 * 1024 * 1024, // 10MB
    MAX_FILES: 10
};
```

### **이미지 설정**
```javascript
export const IMAGE_CONFIG = {
    RESIZE_QUALITY: 95,
    USE_MOZJPEG: true,
    KERNEL: 'lanczos3'
};
```

### **1px Copy 패턴**
```javascript
export const COPY_PATTERNS = {
    GENERAL: ['promotion_00', 'promotion_01', 'promotion_02', 'fit_01', 'illust_01'],
    HTML: ['desc_info_02', 'title_info_01', 'size_info_04', 'spec_info_03']
};
```

---

## 🛠️ 주요 클래스 및 함수

### **FileService (services/FileService.js)**
```javascript
// 디렉토리 생성
await FileService.ensureDirectory(path);

// 프리셋 로드/저장
const presets = await FileService.loadPresets();
await FileService.savePresets(presets);

// 파일 복사/삭제
await FileService.copyFile(src, dest);
await FileService.deleteFile(path);

// 이미지 검색
const images = await FileService.findImagesByPattern(...);
```

### **resizeImageWithMinimalLoss (resize.js)**
```javascript
import { resizeImageWithMinimalLoss } from './resize.js';

await resizeImageWithMinimalLoss(
    'input.jpg',
    'output.jpg',
    1200,
    1440
);
```

---

## 📦 의존성

```json
{
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "readline-sync": "^1.4.10",
    "sharp": "^0.32.6"
  },
  "devDependencies": {
    "nodemon": "^3.1.10"
  }
}
```

---

## 🔄 리팩토링 전후 비교

| 항목 | 기존 (CommonJS) | 리팩토링 (ESM) |
|------|----------------|----------------|
| **모듈 시스템** | `require()` | `import/export` |
| **파일 구조** | 단일 파일 (server.js: 902줄) | 모듈화 (평균 100-300줄) |
| **파일 작업** | 동기/비동기 혼용 | `fs/promises` 통합 |
| **에러 처리** | 개별 `try-catch` | 중앙 에러 미들웨어 |
| **설정 관리** | 하드코딩 | `constants.js` 중앙 관리 |
| **재사용성** | 낮음 | 높음 (클래스/함수 분리) |

---

## 🧪 테스트 방법

### **1. 웹 서버 테스트**
```bash
node server.js
```
- `http://localhost:4005` 접속
- 이미지 업로드 및 리사이징 테스트

### **2. CLI 테스트**
```bash
node cli.js
```
- `img_in` 폴더에 이미지 추가
- 터미널에서 크기 입력 후 처리

### **3. API 테스트 (curl)**
```bash
# 프리셋 목록 조회
curl http://localhost:4005/api/presets

# 프리셋 저장
curl -X POST http://localhost:4005/api/presets \
  -H "Content-Type: application/json" \
  -d '{"name":"test","width":800,"height":1000}'
```

---

## 🎓 학습 포인트

이 리팩토링을 통해 배울 수 있는 개념:

1. **ES 모듈 시스템** - 최신 JavaScript 표준
2. **MVC 패턴** - Model(Service), View(Public), Controller
3. **비동기 프로그래밍** - `async/await`, `fs/promises`
4. **Express 미들웨어** - 라우터, 에러 핸들러
5. **관심사 분리** - 단일 책임 원칙
6. **설정 관리** - 중앙 집중식 상수 관리

---

## 📝 추가 개선 가능 사항

- [ ] TypeScript 도입
- [ ] 유닛 테스트 추가 (Jest, Mocha)
- [ ] 환경 변수 관리 (dotenv)
- [ ] 로깅 시스템 (Winston, Pino)
- [ ] Docker 컨테이너화
- [ ] API 문서화 (Swagger)
- [ ] 데이터베이스 연동 (MongoDB, PostgreSQL)

---

## 📧 문의

리팩토링 관련 질문이나 개선 제안은 언제든지 환영합니다!

---

**버전: 2.0.0 (ESM Refactored)**  
**마지막 업데이트: 2025-10-22**

