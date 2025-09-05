# Admin Panel Backend

이 백엔드 서버는 Supabase를 사용하여 데이터를 저장하고 관리하는 API를 제공합니다.

## 설정 방법

1. 필요한 패키지 설치:
   ```bash
   pip install -r requirements.txt
   ```

2. Supabase 데이터베이스 설정:
   - Supabase 프로젝트 생성: https://supabase.com
   - `supabase_schema.sql` 파일을 Supabase SQL Editor에서 실행하여 테이블 생성
   - 프로젝트 설정에서 URL과 Service Role Key 확인

3. 환경 변수 설정 (`.env` 파일 생성):
   ```env
   # Supabase 설정
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   
   # OpenAI 설정
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Pinecone 설정
   PINECONE_API_KEY=your_pinecone_api_key_here
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

### 설정 관리
- `GET /api/load-settings`
  - Supabase에서 앱 설정 조회
- `POST /api/save-settings`
  - Supabase에 앱 설정 저장

### 채팅 관리
- `GET /api/chat/sessions`
  - 채팅 세션 목록 조회
- `GET /api/chat/logs/{session_uuid}`
  - 특정 세션의 채팅 로그 조회

### 프롬프트 관리
- `POST /api/save-prompt`
  - 프롬프트 데이터 저장
- `POST /api/save-gpt-settings`
  - GPT 설정 저장

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
# 서버 상태 확인
curl -X 'GET' 'http://localhost:8000/api/health'

# 설정 조회
curl -X 'GET' 'http://localhost:8000/api/load-settings'

# 채팅 세션 목록 조회
curl -X 'GET' 'http://localhost:8000/api/chat/sessions'
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
