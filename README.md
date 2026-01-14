# ROI Draw - VSCode Extension

이미지에 폴리곤을 그려서 정규화된 ROI(Region of Interest) 좌표를 추출하는 VSCode Extension입니다.

## 기능

- **폴리곤 그리기**: 마우스 클릭으로 이미지에 폴리곤을 그립니다
- **정규화된 좌표**: 0-1 범위로 정규화된 좌표 (이미지 크기에 독립적)
- **여러 폴리곤**: 한 이미지에 여러 개의 ROI 정의 가능
- **편집 기능**: 폴리곤의 점을 드래그하여 수정
- **Undo/Redo**: 모든 작업을 취소하거나 재실행
- **저장/불러오기**: JSON 형식으로 ROI 데이터 저장
- **실시간 좌표 표시**: 현재 마우스 위치의 정규화된 좌표 표시

## 설치 및 실행

### 개발 모드로 실행

1. 프로젝트 디렉토리에서:
   ```bash
   npm install
   npm run compile
   ```

2. VSCode에서 `F5`를 눌러 Extension Development Host 실행

3. 새 창에서 이미지 파일 우클릭 → "Open ROI Editor" 선택

## 사용 방법

### 1. 이미지 열기

- 탐색기에서 이미지 파일(.jpg, .png, .gif, .webp, .bmp) 우클릭
- "Open ROI Editor" 선택
- 또는 Command Palette (`Ctrl+Shift+P`) → "ROI Draw: Open ROI Editor"

### 2. 폴리곤 그리기

1. **Draw 모드** (기본): Canvas를 클릭하여 폴리곤의 점 추가
2. **더블클릭** 또는 **Escape**로 폴리곤 닫기
3. 새로운 폴리곤을 그리려면 계속 클릭

### 3. 폴리곤 편집

1. **Edit 모드** 버튼 클릭
2. 폴리곤의 점을 클릭하고 드래그하여 이동

### 4. 폴리곤 선택 및 삭제

1. **Select 모드** 버튼 클릭 또는 사이드바에서 폴리곤 클릭
2. **Delete** 키 또는 사이드바의 × 버튼으로 삭제

### 5. 저장 및 내보내기

- **Save 버튼** 또는 `Ctrl+S`: 이미지와 같은 폴더에 `.roi.json` 파일로 저장
- **Export 버튼**: 클립보드에 JSON 복사

## 키보드 단축키

- `Ctrl+Z` / `Cmd+Z`: Undo (실행 취소)
- `Ctrl+Shift+Z` / `Cmd+Shift+Z`: Redo (다시 실행)
- `Ctrl+S` / `Cmd+S`: Save (저장)
- `Delete` / `Backspace`: 선택된 폴리곤 삭제
- `Escape`: 현재 작업 취소

## 데이터 형식

### ROI JSON 파일 예시

```json
{
  "version": "1.0.0",
  "imageUri": "file:///path/to/image.jpg",
  "imageDimensions": {
    "width": 1920,
    "height": 1080
  },
  "polygons": [
    {
      "id": "uuid-string",
      "label": "Region 1",
      "color": "#FF5733",
      "closed": true,
      "points": [
        { "x": 0.1, "y": 0.2 },
        { "x": 0.3, "y": 0.2 },
        { "x": 0.3, "y": 0.4 },
        { "x": 0.1, "y": 0.4 }
      ]
    }
  ],
  "metadata": {
    "createdAt": "2026-01-14T12:00:00Z",
    "modifiedAt": "2026-01-14T12:30:00Z"
  }
}
```

### 좌표 정규화

모든 좌표는 이미지의 원본 크기에 대한 상대값(0-1)으로 저장됩니다:

- `x`: 0 (왼쪽) ~ 1 (오른쪽)
- `y`: 0 (위) ~ 1 (아래)

예: `(0.5, 0.5)` = 이미지 중앙

## 설정

VSCode Settings에서 다음 항목을 설정할 수 있습니다:

- `roiDraw.defaultPolygonColor`: 새 폴리곤의 기본 색상 (기본값: `#FF5733`)
- `roiDraw.vertexSize`: 폴리곤 꼭지점 크기 (기본값: `6`)
- `roiDraw.lineWidth`: 폴리곤 선 두께 (기본값: `2`)
- `roiDraw.autoSave`: 자동 저장 활성화 (기본값: `true`)
- `roiDraw.autoSaveDelay`: 자동 저장 지연 시간(ms) (기본값: `2000`)
- `roiDraw.maxUndoHistory`: 최대 Undo 히스토리 (기본값: `50`)

## 프로젝트 구조

```
roi-draw/
├── src/
│   ├── extension.ts              # Extension 진입점
│   ├── webview/
│   │   ├── WebviewProvider.ts    # Webview 관리
│   │   └── messages.ts           # 메시지 타입 정의
│   ├── core/
│   │   ├── ROIManager.ts         # ROI 비즈니스 로직
│   │   └── StateManager.ts       # Undo/Redo 관리
│   └── storage/
│       ├── ROIStorage.ts         # JSON 저장/로드
│       └── types.ts              # 데이터 타입
├── media/
│   └── webview/
│       ├── main.js               # UI 로직
│       ├── canvas.js             # Canvas 그리기
│       └── styles.css            # 스타일
└── dist/                         # 빌드 결과물
```

## 개발

### 빌드

```bash
npm run compile        # 일회성 빌드
npm run watch         # 파일 변경 감지 및 자동 빌드
npm run package       # 프로덕션 빌드
```

### 디버깅

1. VSCode에서 프로젝트 열기
2. `F5` 눌러 Extension Development Host 실행
3. 새 창에서 Extension 테스트

### 패키지 생성

```bash
npm install -g vsce
vsce package
```

`.vsix` 파일이 생성되며, 이를 다른 사람과 공유하거나 설치할 수 있습니다.

## 라이선스

MIT

## 버전 히스토리

### 0.1.0 (2026-01-14)

- 초기 릴리스
- 기본 폴리곤 그리기 기능
- JSON 저장/불러오기
- Undo/Redo 기능
- 여러 폴리곤 지원
- 폴리곤 편집 기능
