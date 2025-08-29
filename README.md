# Admin Panel Backend

이 백엔드 서버는 파일 업로드를 처리하고 n8n으로 전달하는 API를 제공합니다.

## 설정 방법

1. 필요한 패키지 설치:
   ```bash
   pip install -r requirements.txt
   ```

2. 환경 변수 설정 (`.env` 파일 생성):
   ```env
   # 서버 설정
   PORT=8000
   
   # n8n 웹훅 URL
   N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/upload-data
   
   # 파일 업로드 설정
   UPLOAD_DIR=uploads
   MAX_FILE_SIZE=52428800  # 50MB (바이트 단위)
   ```

## 실행 방법

개발 모드로 실행 (자동 리로드 활성화):
```bash
uvicorn main:app --reload
```

프로덕션 모드로 실행:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## API 엔드포인트

### 상태 확인
- `GET /api/health`
  - 서버 상태 확인

### 파일 업로드
- `POST /api/upload`
  - 파일을 업로드하고 n8n으로 전송
  - Content-Type: multipart/form-data
  - 파라미터: `file` (업로드할 파일)

## 개발 가이드

### 로컬 개발
1. 가상 환경 생성 및 활성화:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # 또는
   .\venv\Scripts\activate  # Windows
   ```

2. 의존성 설치:
   ```bash
   pip install -r requirements.txt
   ```

3. 개발 서버 실행:
   ```bash
   uvicorn main:app --reload
   ```

### 테스트
```bash
# 테스트 파일 업로드 예시
curl -X 'POST' \
  'http://localhost:8000/api/upload' \
  -H 'accept: application/json' \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@test.jpg;type=image/jpeg'
```

## 배포

### Docker를 사용한 배포
1. Docker 이미지 빌드:
   ```bash
   docker build -t admin-backend .
   ```

2. 컨테이너 실행:
   ```bash
   docker run -d --name admin-backend -p 8000:8000 --env-file .env admin-backend
   ```

### 시스템 서비스로 실행 (systemd)
`/etc/systemd/system/admin-backend.service` 파일 생성:
```ini
[Unit]
Description=Admin Panel Backend
After=network.target

[Service]
User=your_username
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

서비스 활성화 및 시작:
```bash
sudo systemctl enable admin-backend
sudo systemctl start admin-backend
```
