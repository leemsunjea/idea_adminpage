# Python 3.10 slim 이미지 사용
FROM python:3.10-slim

# 시스템 패키지 업데이트 및 필요한 패키지 설치
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리 설정
WORKDIR /app

# pip 업그레이드
RUN pip install --upgrade pip

# requirements.txt 복사 및 패키지 설치 (캐시 활용)
COPY requirements.txt ./
RUN pip install --no-cache-dir --timeout=1000 -r requirements.txt

# 소스 코드 복사
COPY . .

# 8000 포트 오픈
EXPOSE 8000

# FastAPI 앱 실행
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
