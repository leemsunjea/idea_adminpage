import logging
import os
import re
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import time

import requests
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from pinecone import Pinecone
from pydantic import BaseModel

# Supabase Integration
from supabase_db import db

# ===== Supabase configuration =====
# 환경 변수에서 Supabase 설정을 불러옵니다
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PromptData(BaseModel):
    category: str
    content: str
    metadata: Optional[dict] = None

class GPTSettings(BaseModel):
    model: str
    temperature: float
    max_tokens: int

# 저장 요청 바디 스키마 (프론트엔드 payload와 동일 구조)
class ReferenceSettings(BaseModel):
    references_enabled: bool
    download_button_enabled: bool


class GPTSettingsInput(BaseModel):
    model: str
    temperature: float
    max_tokens: int


class SaveSettingsRequest(BaseModel):
    ai_greeting: str
    training_data: str
    instruction_data: str
    gpt_settings: GPTSettingsInput
    reference_settings: ReferenceSettings








# Pinecone 초기화
pc = Pinecone(api_key="pcsk_7NQwb5_L6YHKhNQ5QY8DTtKv3rmYoTAJZJZZ9MPZ6yV5mUZtdgVXLnhr4ZRVjt5ahb91H4")

app = FastAPI(
    title="Admin Panel Backend",
    description="Backend service for handling file uploads and prompt management",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

# static 폴더 마운트
app.mount("/static", StaticFiles(directory="static"), name="static")


# 루트에서 index.html 반환
@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"Incoming request: {request.method} {request.url}")
    try:
        response = await call_next(request)
        print(f"Response status: {response.status_code}")
        return response
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        raise


print("3.1.1")


# 클라이언트 초기화
try:
    client = OpenAI()
    # 간단한 테스트 호출로 API 키 유효성 검사
    client.models.list()
    logger.info("OpenAI 클라이언트가 성공적으로 초기화되었습니다.")
except Exception as e:
    logger.warning(f"OpenAI 클라이언트 초기화 실패: {str(e)}")
    client = None


async def forward_to_n8n_webhook(data: dict, endpoint: str = "prompt") -> dict:
    """
    Forward data to n8n webhook
    
    Args:
        data: The data to forward
        endpoint: The webhook endpoint (will be appended to base URL)
        
    Returns:
        dict: Response from n8n
    """
    n8n_url = os.getenv("N8N_PROMPT_WEBHOOK_URL")
    if not n8n_url:
        logger.warning("N8N_PROMPT_WEBHOOK_URL is not set, skipping webhook call")
        return {"status": "warning", "message": "Webhook URL not configured"}
        
    webhook_url = f"{n8n_url.rstrip('/')}/{endpoint}"

    try:
        headers = {
            "Content-Type": "application/json",
            "X-Forwarded-From": "admin-panel"
        }

        response = requests.post(
            webhook_url,
            json=data,
            headers=headers,
            timeout=30  # 30 seconds timeout
        )

        response.raise_for_status()  # Raise exception for HTTP errors

        try:
            return response.json()
        except ValueError:
            return {"status": "success", "message": "Data forwarded to n8n", "data": response.text}

    except requests.exceptions.RequestException as e:
        error_msg = f"Error forwarding to n8n: {str(e)}"
        if hasattr(e, 'response') and e.response is not None and hasattr(e.response, 'text'):
            error_msg += f" - Response: {e.response.text}"
        raise HTTPException(
            status_code=502,  # Bad Gateway
            detail=error_msg
        )

def make_ascii_id(text: str) -> str:
    """벡터 ID를 ASCII로 변환"""
    if not text:
        return str(uuid.uuid4())
    
    # 한글과 특수문자 제거, 영문자와 숫자만 유지
    text = re.sub(r'[^a-zA-Z0-9]', '_', text)
    # 연속된 언더스코어를 하나로 변환
    text = re.sub(r'_+', '_', text)
    # 앞뒤 언더스코어 제거
    text = text.strip('_')
    if not text:
        text = str(uuid.uuid4())
    return text




def get_embedding(text: str):
    """OpenAI embeddings 생성"""
    if not client:
        raise ValueError("OpenAI 클라이언트가 초기화되지 않았습니다. OPENAI_API_KEY를 확인하세요.")
    
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding



@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "서버가 정상적으로 실행 중입니다."}





@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.detail}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "error": "내부 서버 오류가 발생했습니다."}
    )

@app.post("/api/save-prompt")
async def save_prompt(prompt_data: PromptData, request: Request):
    try:
        logger = logging.getLogger(__name__)
        logger.info(f"Received prompt data - Category: {prompt_data.category}")
        logger.info(f"Content length: {len(prompt_data.content)} characters")

        # Prepare data to send to n8n
        payload = {
            "event_type": "prompt_saved",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "category": prompt_data.category,
                "content": prompt_data.content,
                "metadata": prompt_data.metadata or {},
                "source": {
                    "ip": request.client.host if request.client else "unknown",
                    "user_agent": request.headers.get("user-agent", "unknown")
                }
            }
        }

        # Forward to n8n
        n8n_response = await forward_to_n8n_webhook(payload)

        return {
            "success": True,
            "message": "프롬프트가 성공적으로 저장되었습니다.",
            "data": {
                "category": prompt_data.category,
                "content_length": len(prompt_data.content),
                "forwarded_to_n8n": True,
                "n8n_response": n8n_response
            }
        }
    except Exception as e:
        error_msg = f"프롬프트 저장 중 오류: {str(e)}"
        print(error_msg)
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )

@app.post("/api/save-gpt-settings")
async def save_gpt_settings(settings: GPTSettings, request: Request):
    try:
        logger = logging.getLogger(__name__)
        logger.info(f"Saving GPT settings - Model: {settings.model}, Temperature: {settings.temperature}, Max Tokens: {settings.max_tokens}")

        # Prepare data to send to n8n
        payload = {
            "event_type": "gpt_settings_saved",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "model": settings.model,
                "temperature": settings.temperature,
                "max_tokens": settings.max_tokens,
                "source": {
                    "ip": request.client.host if request.client else "unknown",
                    "user_agent": request.headers.get("user-agent", "unknown")
                }
            }
        }

        # Forward to n8n
        n8n_response = await forward_to_n8n_webhook(payload, endpoint="gpt-settings")

        return {
            "success": True,
            "message": "GPT 설정이 성공적으로 저장되었습니다.",
            "data": {
                "model": settings.model,
                "temperature": settings.temperature,
                "max_tokens": settings.max_tokens,
                "forwarded_to_n8n": True,
                "n8n_response": n8n_response
            }
        }
    except Exception as e:
        error_msg = f"GPT 설정 저장 중 오류: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )


@app.get("/api/load-settings")
async def load_settings(request: Request):
    """Supabase에서 설정 데이터를 가져오는 API"""
    try:
        data = db.get_app_settings()
        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"설정 데이터 로드 실패: {str(e)}"
        )


@app.post("/api/save-settings")
async def save_settings(request: Request, body: SaveSettingsRequest):
    """프론트에서 전달한 설정 값을 Supabase에 저장"""
    try:
        logger.info("Saving settings to Supabase...")
        settings_data = {
            'ai_greeting': body.ai_greeting,
            'training_data': body.training_data,
            'instruction_data': body.instruction_data,
            'gpt_model': body.gpt_settings.model,
            'temperature': body.gpt_settings.temperature,
            'max_tokens': body.gpt_settings.max_tokens,
            'references_enabled': body.reference_settings.references_enabled,
            'download_button_enabled': body.reference_settings.download_button_enabled
        }
        result = db.save_app_settings(settings_data)
        return {
            "success": True,
            "message": "설정이 저장되었습니다.",
            "result": result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"설정 저장 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"설정 저장 실패: {str(e)}")


if __name__ == "__main__":
    import uvicorn


# ===== Chat history APIs =====


@app.get("/api/chat/sessions")
async def list_chat_sessions(request: Request):
    """Supabase에서 대화 세션 목록을 조회"""
    try:
        data = db.get_chat_sessions()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"세션 목록 조회 실패: {str(e)}")


@app.get("/api/chat/logs/{session_uuid}")
async def get_chat_logs(session_uuid: str, request: Request):
    """Supabase에서 특정 uuid의 전체 메시지 목록 조회"""
    try:
        data = db.get_chat_logs(session_uuid)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"채팅 로그 조회 실패: {str(e)}")