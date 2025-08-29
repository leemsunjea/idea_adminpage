# Python 3.10 slim 이미지 사용
FROM python:3.10-slim

# 작업 디렉토리 설정
WORKDIR /app

# requirements.txt 복사 및 패키지 설치
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사
COPY . .

# 환경 변수 파일(.env)이 있다면, 필요에 따라 직접 COPY
# COPY .env .

# 8000 포트 오픈
EXPOSE 8000

# FastAPI 앱 실행 (main.py의 app 객체 사용)
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
