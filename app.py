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

# ===== Google configuration (edit here) =====



# Google Sheets 설정
GOOGLE_SHEETS_CONFIG = {
  "type": "service_account",
  "project_id": "verdant-descent-468719-n4",
  "private_key_id": "d35880bed11f0ed221ad7bcdac04f749bca57cea",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCnm+TCPzF5z3jN\nSrIRIzuguu+rPa4bmj9kPQdQMQqWEoexgamEjMwePV1EoKmvgcgtne/jz2269zlp\nz/oKflqpko+7RFZm2Dfkjin8GRLsLnyH9eEnE/d1h2uMvMMoblqtch/fDHLyUHCb\n4ZzViRn1XNJ+D4LhNnruEN1Uagys+Uoyql92k61N+/FxkSfgUbTwwjSj5KApSBF/\noT+tSPz1CkI4MekvL3S3noelXs3kCdwoORyVR9gBsxy5fiy3rzP16CzHxMGCP0wA\niQEW6oJPLrgHV2KXCvj2k0awveWv8t/edZYcm+0nv/zY/KzsS1I330ZVkYNRW/7x\ncAYr8Az/AgMBAAECggEAMwsUXx2snRqUgPyi/voaYigb7iwCFnDipk25qO/OeAab\noXDJ5c6VKQ5qFYjSNFtTUaUcFeYpVjuNFg7a6JAzXxn9wLuejoKBfw7WdWpTa276\nyNMWJvb7MSU1GS6xRmJZJiIv15cseGQL70UFpLg0mhcTGYXyx1B2noKvTNJhGtnw\nIkBO4G+hHeJYH5Cq29Vw7k782AWUgXw2Bj0+zRqCEVihZX3lLX9eJUXycoU9d1DJ\nnfCKG/al8CYnUZe9rfA8+2vo0MYZIu6Ql+0ke7nI2DZuA6g3MnJw9ASOS0n62ELM\nplMwHko+AMW2+Gr82eVluH4nLZEjqujAUXs+0EqeZQKBgQDbQbCOeVRlGf87FhVB\ngU7EdUbdgDOaKuS53WOqrTpE0cKA1ZibTu/3DEkqY33oT+h6bEJ7FbwYSbaG1p6E\nHCfl88TxUEck9/urdT0QeHJNhUwyeY2/tKvFLbmIbu/KiauEnND8EdbRUmyUdsH3\nXv7Rg3V0j7bFXPDDQVbedR/JtQKBgQDDsnj1Y1cvCyKIETh3BfV30bWzFJoaFfRF\nJrd/nSDVreuuz4ZvH7nx23u+vxbqj6Gkcu7dHCFB10UEjrlQ/jeyhaZ6Q3Xqqqe7\nbCNEk8tcOV0ly6+ZoLXuQ8zKbNJyNqgOtkVj9yC2cFA8iMLSX/XBPkaDEOEye+Ni\nML3ynIhcYwKBgDmKOLp7LuHFe8zW08c4FyLJoEpa7a/k19fLOO++vE75OXE0HPON\nOL590+my6IUCC4GtTZkdsBozphom0rza4sGfQq0No04ZYkux3c+nvF+JvuB0M/X+\nhSGfCVS7wGRH0uJfgRzV1aljVylzLR4tKPR06msnmBCdfnXPfOuukyQNAoGAMPx6\n5MoSJ9d8tFzDKqAWOwEGn6Y3kPIP7ENtyYb2kiZwCZkvCKADdrQ/PJcu0FZV2wle\nG4EQHiAZybNEVi7cmFZ2PsKmQLCpPfQqu97XF+XQGEbtVOJyyAq2t7EX2LkvxkcA\nBa71xFVG8HA3fFvC87V4BxTxmiaC27Bhy9o9FAsCgYAvTeQz64nbZ0dIoJeUUOBN\nAxfYp0prbz8S4sNSl3+NNSghxhjjOkOcKWlEfxTVwtTvTTxch1coefImXYkFCaXZ\niYtg4sA3182jJ3TKrzIix95+Qk44zlbun2mSBI+EXsXxwbzSW5mnD23TmfROYvH8\n0XL5LxovbbHMHfaL4opcVA==\n-----END PRIVATE KEY-----\n",
  "client_email": "sunjae1149@verdant-descent-468719-n4.iam.gserviceaccount.com",
  "client_id": "107475891746652200685",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/sunjae1149%40verdant-descent-468719-n4.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}


# Optional: override via environment variable (JSON string)
_GOOGLE_SHEETS_CONFIG_JSON = os.getenv("GOOGLE_SHEETS_CONFIG_JSON")
if _GOOGLE_SHEETS_CONFIG_JSON:
    import json as _json
    GOOGLE_SHEETS_CONFIG = _json.loads(_GOOGLE_SHEETS_CONFIG_JSON)

SPREADSHEET_KEY = os.getenv("GOOGLE_SHEETS_SPREADSHEET_KEY", "1V5TJmN8aKXCAH9ZbyZyc-Wz5TsIT5rloXJvvmHOqEkc")
SHEET_NAME = os.getenv("GOOGLE_SHEETS_SHEET_NAME", "Setting")

# Chat history Google Sheets 설정
CHAT_SPREADSHEET_KEY = os.getenv("GOOGLE_CHAT_SPREADSHEET_KEY", "1V5TJmN8aKXCAH9ZbyZyc-Wz5TsIT5rloXJvvmHOqEkc")
CHAT_SHEET_SESSIONS = os.getenv("GOOGLE_CHAT_SHEET_SESSIONS", "Sessions")
CHAT_SHEET_LOGS = os.getenv("GOOGLE_CHAT_SHEET_LOGS", "ChatLogs")

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





def _gs_client():
    scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
    credential = ServiceAccountCredentials.from_json_keyfile_dict(GOOGLE_SHEETS_CONFIG, scope)
    return gspread.authorize(credential)


def _admin_doc():
    gc = _gs_client()
    return gc.open_by_key(SPREADSHEET_KEY)



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


def get_google_sheets_data() -> dict:
    """Google Sheets에서 설정 데이터를 가져오는 함수"""
    try:
        # Google API 인증
        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        credential = ServiceAccountCredentials.from_json_keyfile_dict(GOOGLE_SHEETS_CONFIG, scope)
        gc = gspread.authorize(credential)
        
        # 스프레드시트 열기
        doc = gc.open_by_key(SPREADSHEET_KEY)
        sheet = doc.worksheet(SHEET_NAME)
        
        # 모든 값 가져오기
        all_values = sheet.get_all_values()
        if len(all_values) < 2:  # 헤더와 데이터가 최소 2행 필요
            raise ValueError("스프레드시트에 데이터가 충분하지 않습니다.")
        
        # 첫 번째 행을 컬럼명으로 사용
        headers = all_values[0]
        data_row = all_values[1]  # 첫 번째 데이터 행
        
        # 데이터를 딕셔너리로 변환
        data = {}
        for i, header in enumerate(headers):
            if i < len(data_row):
                value = data_row[i]
                # TRUE/FALSE 문자열을 boolean으로 변환
                if value.upper() == 'TRUE':
                    value = True
                elif value.upper() == 'FALSE':
                    value = False
                # 숫자로 변환 가능한 경우 변환
                elif value.replace('.', '').isdigit():
                    if '.' in value:
                        value = float(value)
                    else:
                        value = int(value)
                
                data[header] = value
        
        logger.info("Google Sheets에서 데이터를 성공적으로 가져왔습니다.")
        return data
        
    except Exception as e:
        logger.error(f"Google Sheets에서 데이터를 가져오는 중 오류 발생: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Google Sheets 데이터 로드 실패: {str(e)}"
        )


def save_google_sheets_data(payload: SaveSettingsRequest) -> dict:
    """Google Sheets의 2번째 행(A2:H2)에 설정 값을 저장"""
    try:
        # Google API 인증
        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        credential = ServiceAccountCredentials.from_json_keyfile_dict(GOOGLE_SHEETS_CONFIG, scope)
        gc = gspread.authorize(credential)

        # 스프레드시트 열기
        doc = gc.open_by_key(SPREADSHEET_KEY)
        sheet = doc.worksheet(SHEET_NAME)

        # 시트 헤더 확인 (선택)
        headers = sheet.row_values(1)
        expected_headers = [
            'aiGreeting', 'trainingData', 'instructionData',
            'gpt-model', 'temperature', 'max-tokens',
            'references', 'download-button'
        ]
        if len(headers) < 8:
            raise ValueError('시트의 헤더가 올바르지 않습니다. 최소 8개 컬럼 필요')

        # 값 매핑 (시트가 기대하는 순서/형식)
        row_values = [
            payload.ai_greeting,
            payload.training_data,
            payload.instruction_data,
            payload.gpt_settings.model,
            payload.gpt_settings.temperature,
            payload.gpt_settings.max_tokens,
            'TRUE' if payload.reference_settings.references_enabled else 'FALSE',
            'TRUE' if payload.reference_settings.download_button_enabled else 'FALSE',
        ]

        # 2번째 행(A2:H2)에 값 저장 (사용자 입력 형식으로 저장)
        sheet.update('A2:H2', [row_values], value_input_option='USER_ENTERED')

        logger.info('Google Sheets에 설정이 저장되었습니다.')
        return {
            'updated_range': 'A2:H2',
            'values': row_values
        }
    except Exception as e:
        logger.error(f'Google Sheets 저장 중 오류: {str(e)}')
        raise HTTPException(
            status_code=500,
            detail=f'Google Sheets 저장 실패: {str(e)}'
        )


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
    """Google Sheets에서 설정 데이터를 가져오는 API"""
    try:
        data = get_google_sheets_data()
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
    """프론트에서 전달한 설정 값을 Google Sheets에 저장"""
    try:
        logger.info("Saving settings to Google Sheets...")
        result = save_google_sheets_data(body)
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
    """Sessions 시트에서 대화 세션 목록을 조회
    예상 컬럼: [uuid, started_at, ended_at, message_count]
    """
    try:
        gc = _gs_client()
        doc = gc.open_by_key(CHAT_SPREADSHEET_KEY)
        sheet = doc.worksheet(CHAT_SHEET_SESSIONS)
        # 경량 조회: 필요한 컬럼 범위만 가져오기 (A:D)
        rows = sheet.get("A:D")
        if not rows or len(rows) < 2:
            return []
        headers = rows[0]
        data = []
        for r in rows[1:]:
            if not any(r):
                continue
            item = {}
            for i, h in enumerate(headers):
                if i < len(r):
                    item[h] = r[i]
            data.append(item)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"세션 목록 조회 실패: {str(e)}")


@app.get("/api/chat/logs/{session_uuid}")
async def get_chat_logs(session_uuid: str, request: Request):
    """ChatLogs 시트에서 특정 uuid의 전체 메시지 목록 조회
    예상 컬럼: [uuid, role, message, timestamp]
    """
    try:
        gc = _gs_client()
        doc = gc.open_by_key(CHAT_SPREADSHEET_KEY)
        sheet = doc.worksheet(CHAT_SHEET_LOGS)
        # 경량 조회: 필요한 범위만 가져오기 (전체 열 대신 A:E 등 필요한 최대 열만)
        rows = sheet.get("A:E")
        if not rows or len(rows) < 2:
            return {"success": True, "data": []}
        headers = rows[0]
        uuid_idx = headers.index('uuid') if 'uuid' in headers else 0
        data = []
        for r in rows[1:]:
            if len(r) <= uuid_idx:
                continue
            if r[uuid_idx] != session_uuid:
                continue
            item = {}
            for i, h in enumerate(headers):
                if i < len(r):
                    item[h] = r[i]
            data.append(item)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"채팅 로그 조회 실패: {str(e)}")