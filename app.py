import logging
import os
import re
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import time
from io import BytesIO
import sys

import requests
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from pinecone import Pinecone
from pydantic import BaseModel
from PyPDF2 import PdfReader
import pdfplumber
import tiktoken
from jose import JWTError, jwt
from passlib.context import CryptContext
from docx import Document as DocxDocument
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Google Sheets Integration
import pandas as pd
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# ===== Google configuration (edit here) =====
# Google Drive (OAuth) settings
GOOGLE_DRIVE_CREDENTIALS_FILE = os.getenv("GOOGLE_DRIVE_CREDENTIALS_FILE", "client_secret_956514703917-9d24mhtkm0ooqncga0v765o579si9364.apps.googleusercontent.com.json")
GOOGLE_DRIVE_PARENT_FOLDER_ID = os.getenv("GOOGLE_DRIVE_PARENT_FOLDER_ID", "1EI-8lUCEUGobF8AbxD7mwdmap-SgnI07")

# Expose to environment so gdrive_uploader can read them at import-time
os.environ.setdefault("GOOGLE_DRIVE_CREDENTIALS_FILE", GOOGLE_DRIVE_CREDENTIALS_FILE)
os.environ.setdefault("GOOGLE_DRIVE_PARENT_FOLDER_ID", GOOGLE_DRIVE_PARENT_FOLDER_ID)

# Google Drive background uploader (import after env is set)
from gdrive_uploader import background_upload as drive_background_upload
from gdrive_uploader import get_upload_status as drive_get_upload_status
from gdrive_uploader import CREDENTIALS_FILE as DRIVE_CREDENTIALS_FILE, TOKEN_FILE as DRIVE_TOKEN_FILE
from gdrive_uploader import PARENT_FOLDER_ID as DRIVE_PARENT_FOLDER_ID

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

# ===== Authentication & Admin/Permission Models =====

ADMIN_SHEET = "Admins"
PERMISSIONS_SHEET = "Permissions"

SECRET_KEY = os.getenv("ADMIN_JWT_SECRET", "change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ADMIN_TOKEN_EXPIRE_MINUTES", "480"))
COOKIE_NAME = os.getenv("ADMIN_COOKIE_NAME", "admin_token")
COOKIE_SECURE = os.getenv("ADMIN_COOKIE_SECURE", "false").lower() == "true"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ===== In-memory caches (server-side) =====
ADMIN_CACHE_TTL = int(os.getenv("ADMIN_CACHE_TTL_SECONDS", "300"))  # 5 minutes
PERMS_CACHE_TTL = int(os.getenv("PERMS_CACHE_TTL_SECONDS", "300"))  # 5 minutes
_admin_cache: Dict[str, object] = {"data": None, "time": 0.0}
_perms_cache: Dict[str, Dict[str, object]] = {}

def _cache_now() -> float:
    return time.time()

def _is_fresh(ts: float, ttl: int) -> bool:
    return bool(ts and ((_cache_now() - ts) < ttl))


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminUserCreate(BaseModel):
    username: str
    password: str
    is_super_admin: bool = False


class PermissionItem(BaseModel):
    category: str
    can_view: bool
    can_save: bool


class PermissionsUpdate(BaseModel):
    username: str
    permissions: List[PermissionItem]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def _gs_client():
    scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
    credential = ServiceAccountCredentials.from_json_keyfile_dict(GOOGLE_SHEETS_CONFIG, scope)
    return gspread.authorize(credential)


def _admin_doc():
    gc = _gs_client()
    return gc.open_by_key(SPREADSHEET_KEY)


def _ensure_worksheet(doc, title: str, headers: List[str]):
    try:
        ws = doc.worksheet(title)
        current_headers = ws.row_values(1)
        if not current_headers:
            ws.append_row(headers)
        elif len(current_headers) < len(headers):
            # Ensure all headers exist by updating the first row
            ws.update('A1', [headers])
        return ws
    except gspread.exceptions.WorksheetNotFound:
        ws = doc.add_worksheet(title=title, rows="100", cols="26")
        ws.append_row(headers)
        return ws


def _get_admin_by_username(username: str) -> Optional[Dict[str, str]]:
    # Use admin list cache for faster lookups
    admins = _list_admins()
    for a in admins:
        if a.get('username') == username:
            return a
    return None


def _list_admins() -> List[Dict[str, str]]:
    # Return cached value if fresh
    if _is_fresh(_admin_cache.get("time", 0.0), ADMIN_CACHE_TTL) and isinstance(_admin_cache.get("data"), list):
        return _admin_cache["data"]  # type: ignore

    doc = _admin_doc()
    ws = _ensure_worksheet(doc, ADMIN_SHEET, ['username', 'password_hash', 'is_super_admin', 'created_at', 'updated_at'])
    rows = ws.get_all_values()
    if len(rows) < 2:
        _admin_cache.update({"data": [], "time": _cache_now()})
        return []
    headers = rows[0]
    data: List[Dict[str, str]] = []
    for r in rows[1:]:
        if not any(r):
            continue
        item: Dict[str, str] = {}
        for i, h in enumerate(headers):
            if i < len(r):
                item[h] = r[i]
        data.append(item)
    _admin_cache.update({"data": data, "time": _cache_now()})
    return data


def _list_admins_simple() -> List[Dict[str, str]]:
    """경량 조회: username(A열), is_super_admin(C열)만 읽어서 반환.
    서버 캐시(_admin_cache)가 신선하면 그대로 사용하고, 아니면 최소 컬럼만 조회.
    """
    # Prefer cache if fresh
    if _is_fresh(_admin_cache.get("time", 0.0), ADMIN_CACHE_TTL) and isinstance(_admin_cache.get("data"), list):
        # _admin_cache에는 password_hash가 포함될 수 있으므로 안전 필드만 추려서 반환
        safe: List[Dict[str, str]] = []
        for a in _admin_cache["data"]:  # type: ignore
            safe.append({
                "username": a.get("username", ""),
                "is_super_admin": a.get("is_super_admin", "FALSE")
            })
        return safe

    doc = _admin_doc()
    ws = _ensure_worksheet(doc, ADMIN_SHEET, ['username', 'password_hash', 'is_super_admin', 'created_at', 'updated_at'])
    usernames = ws.col_values(1)  # column A
    is_supers = ws.col_values(3)  # column C
    # Remove header
    if usernames:
        usernames = usernames[1:]
    if is_supers:
        is_supers = is_supers[1:]
    n = max(len(usernames), len(is_supers))
    result: List[Dict[str, str]] = []
    for i in range(n):
        u = usernames[i] if i < len(usernames) else ""
        s = is_supers[i] if i < len(is_supers) else "FALSE"
        if not u:
            continue
        result.append({"username": u, "is_super_admin": s})
    # 업데이트된 전체 데이터 캐시 보존을 위해, 간단히 전체 재구성은 생략하고 안전 목록만 반환
    return result


def _upsert_admin(username: str, password: Optional[str], is_super_admin: bool) -> Dict[str, str]:
    doc = _admin_doc()
    ws = _ensure_worksheet(doc, ADMIN_SHEET, ['username', 'password_hash', 'is_super_admin', 'created_at', 'updated_at'])
    rows = ws.get_all_values()
    now = datetime.utcnow().isoformat()
    password_hash = get_password_hash(password) if password else None

    if len(rows) < 2:
        # empty, append headers already present, now add first row
        ws.append_row([username, password_hash or '', 'TRUE' if is_super_admin else 'FALSE', now, now])
        # Invalidate caches
        _admin_cache.update({"data": None, "time": 0.0})
        _perms_cache.pop(username, None)
        return {"username": username, "is_super_admin": is_super_admin}

    # find row
    for idx in range(1, len(rows)):
        r = rows[idx]
        if r and len(r) > 0 and r[0] == username:
            # update
            new_hash = password_hash or (r[1] if len(r) > 1 else '')
            ws.update(f"A{idx+1}:E{idx+1}", [[username, new_hash, 'TRUE' if is_super_admin else 'FALSE', r[3] if len(r) > 3 and r[3] else now, now]])
            # Invalidate caches
            _admin_cache.update({"data": None, "time": 0.0})
            _perms_cache.pop(username, None)
            return {"username": username, "is_super_admin": is_super_admin}

    # not found → append
    ws.append_row([username, password_hash or '', 'TRUE' if is_super_admin else 'FALSE', now, now])
    # Invalidate caches
    _admin_cache.update({"data": None, "time": 0.0})
    _perms_cache.pop(username, None)
    return {"username": username, "is_super_admin": is_super_admin}


def _delete_admin(username: str):
    doc = _admin_doc()
    ws = _ensure_worksheet(doc, ADMIN_SHEET, ['username', 'password_hash', 'is_super_admin', 'created_at', 'updated_at'])
    rows = ws.get_all_values()
    if len(rows) < 2:
        return
    for idx in range(1, len(rows)):
        r = rows[idx]
        if r and len(r) > 0 and r[0] == username:
            ws.delete_rows(idx + 1)
            break
    # Invalidate caches
    _admin_cache.update({"data": None, "time": 0.0})
    _perms_cache.pop(username, None)


def _get_permissions(username: str) -> Dict[str, Dict[str, bool]]:
    # Cached per-username permissions
    cached = _perms_cache.get(username)
    if cached and _is_fresh(cached.get("time", 0.0), PERMS_CACHE_TTL):
        return cached.get("data", {})  # type: ignore

    doc = _admin_doc()
    ws = _ensure_worksheet(doc, PERMISSIONS_SHEET, ['username', 'category', 'can_view', 'can_save', 'updated_at'])
    rows = ws.get_all_values()
    perms: Dict[str, Dict[str, bool]] = {}
    if len(rows) < 2:
        _perms_cache[username] = {"data": perms, "time": _cache_now()}
        return perms
    headers = rows[0]
    for r in rows[1:]:
        if not any(r):
            continue
        if r[0] != username:
            continue
        category = r[1]
        can_view = (r[2].upper() == 'TRUE') if len(r) > 2 and r[2] else False
        can_save = (r[3].upper() == 'TRUE') if len(r) > 3 and r[3] else False
        perms[category] = {"can_view": can_view, "can_save": can_save}
    _perms_cache[username] = {"data": perms, "time": _cache_now()}
    return perms


def _set_permissions(username: str, permissions: Dict[str, Dict[str, bool]]):
    doc = _admin_doc()
    ws = _ensure_worksheet(doc, PERMISSIONS_SHEET, ['username', 'category', 'can_view', 'can_save', 'updated_at'])
    rows = ws.get_all_values()
    now = datetime.utcnow().isoformat()

    # Build a map of existing rows for this user
    row_indexes_by_category: Dict[str, int] = {}
    for idx in range(1, len(rows)):
        r = rows[idx]
        if not any(r):
            continue
        if r[0] == username:
            row_indexes_by_category[r[1]] = idx + 1  # 1-based

    # Prepare batch updates and appends
    update_data: List[Dict[str, object]] = []
    append_values: List[List[str]] = []

    for category, flags in permissions.items():
        can_view = 'TRUE' if flags.get('can_view', False) else 'FALSE'
        can_save = 'TRUE' if flags.get('can_save', False) else 'FALSE'
        row_values = [username, category, can_view, can_save, now]
        if category in row_indexes_by_category:
            row_num = row_indexes_by_category[category]
            update_data.append({
                'range': f"{PERMISSIONS_SHEET}!A{row_num}:E{row_num}",
                'values': [row_values]
            })
        else:
            append_values.append(row_values)

    # Execute batch value updates if any
    if update_data:
        try:
            doc.values_batch_update({
                'valueInputOption': 'USER_ENTERED',
                'data': update_data
            })
        except Exception as e:
            logging.getLogger(__name__).warning(f"values_batch_update failed, falling back to per-row updates: {e}")
            for item in update_data:
                rng = str(item['range']).split('!')[1]
                vals = item['values']  # type: ignore
                ws.update(rng, vals)

    # Append rows in batch if possible
    if append_values:
        try:
            ws.append_rows(append_values, value_input_option='USER_ENTERED')
        except Exception as e:
            logging.getLogger(__name__).warning(f"append_rows failed, falling back to per-row append: {e}")
            for row_values in append_values:
                ws.append_row(row_values)

    # Invalidate permission cache for this user
    _perms_cache.pop(username, None)


def _parse_bool(value: str) -> bool:
    return str(value).upper() == 'TRUE'


def get_current_user_from_request(request: Request) -> Dict[str, str]:
    # Prefer Authorization header, otherwise read from HttpOnly cookie
    token: Optional[str] = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.lower().startswith('bearer '):
        token = auth_header.split(' ', 1)[1]
    else:
        token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증이 필요합니다.")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="토큰이 유효하지 않습니다.")
        admin = _get_admin_by_username(username)
        if not admin:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없습니다.")
        return {
            "username": username,
            "is_super_admin": _parse_bool(admin.get('is_super_admin', 'FALSE'))
        }
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="토큰이 유효하지 않습니다.")


def require_permission(user: Dict[str, str], category: str, action: str):
    if user.get('is_super_admin'):
        return
    perms = _get_permissions(user['username'])
    flags = perms.get(category)
    allowed = False
    if action == 'view':
        allowed = bool(flags and flags.get('can_view'))
    elif action == 'save':
        allowed = bool(flags and flags.get('can_save'))
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="권한이 없습니다.")

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

# Log Google Drive OAuth file recognition at startup
@app.on_event("startup")
async def _log_drive_oauth_config():
    try:
        cred_path = DRIVE_CREDENTIALS_FILE
        token_path = DRIVE_TOKEN_FILE
        cred_exists = os.path.exists(cred_path)
        token_exists = os.path.exists(token_path)
        token_dir = os.path.dirname(token_path) or "."
        token_dir_writable = os.access(token_dir, os.W_OK)
        logger.info(f"[Drive OAuth] CREDENTIALS_FILE={cred_path} exists={cred_exists}")
        logger.info(f"[Drive OAuth] TOKEN_FILE={token_path} exists={token_exists} dir_writable={token_dir_writable}")
        logger.info(f"[Drive OAuth] PARENT_FOLDER_ID={DRIVE_PARENT_FOLDER_ID}")
        use_sa = os.getenv('GOOGLE_DRIVE_USE_SERVICE_ACCOUNT', 'false')
        logger.info(f"[Drive OAuth] GOOGLE_DRIVE_USE_SERVICE_ACCOUNT={use_sa}")
    except Exception as e:
        logger.warning(f"[Drive OAuth] Startup logging failed: {e}")

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

# 설정
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {
    'pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp',
    'mp4', 'mov', 'avi', 'wmv', 'flv', 'mkv',
    'mp3', 'wav', 'ogg', 'm4a', 'aac',
    'zip', 'rar', '7z', 'tar', 'gz'
}

# 클라이언트 초기화
try:
    client = OpenAI()
    # 간단한 테스트 호출로 API 키 유효성 검사
    client.models.list()
    logger.info("OpenAI 클라이언트가 성공적으로 초기화되었습니다.")
except Exception as e:
    logger.warning(f"OpenAI 클라이언트 초기화 실패: {str(e)}")
    client = None

def get_file_extension(filename: str) -> str:
    return filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

def is_allowed_file(filename: str) -> bool:
    return get_file_extension(filename) in ALLOWED_EXTENSIONS


# ===== DOCX → PDF conversion utilities =====
def _register_korean_font() -> str:
    """Try to register a Korean-capable font for ReportLab. Returns font name to use."""
    try:
        if sys.platform == 'darwin':
            candidates = [
                ("/System/Library/Fonts/AppleSDGothicNeo.ttc", 0),
                ("/System/Library/Fonts/AppleGothic.ttc", 0),
                ("/System/Library/Fonts/STHeiti Light.ttc", 0),
                ("/Library/Fonts/Arial Unicode.ttf", None),
            ]
            for path, sub_idx in candidates:
                if os.path.exists(path):
                    if path.endswith('.ttc'):
                        pdfmetrics.registerFont(TTFont('KoreanFont', path, subfontIndex=sub_idx or 0))
                    else:
                        pdfmetrics.registerFont(TTFont('KoreanFont', path))
                    return 'KoreanFont'
    except Exception:
        pass
    return 'Helvetica'


def convert_docx_bytes_to_pdf_bytes(docx_bytes: bytes, original_filename: str) -> bytes:
    """Convert DOCX bytes to a simple PDF (text only) and return PDF bytes."""
    font_name = _register_korean_font()
    styles = getSampleStyleSheet()

    # Read DOCX from memory
    doc = DocxDocument(BytesIO(docx_bytes))

    # Build PDF in memory
    buffer = BytesIO()
    pdf = SimpleDocTemplate(buffer, pagesize=A4)
    story = []

    title_style = ParagraphStyle(
        'CustomTitle', parent=styles['Heading1'], fontSize=18, spaceAfter=20, alignment=1, fontName=font_name
    )
    body_style = ParagraphStyle(
        'CustomBody', parent=styles['Normal'], fontSize=12, spaceAfter=12, leading=18, fontName=font_name
    )

    title = Path(original_filename).stem
    story.append(Paragraph(title, title_style))
    story.append(Spacer(1, 20))

    # Paragraphs
    for paragraph in doc.paragraphs:
        text = (paragraph.text or '').strip()
        if not text:
            continue
        style = body_style
        try:
            if getattr(paragraph, 'style', None) and getattr(paragraph.style, 'name', '').startswith('Heading'):
                style = styles['Heading2']
                style.fontName = font_name
        except Exception:
            style = body_style
        story.append(Paragraph(text, style))
        story.append(Spacer(1, 6))

    # Tables (simple text rendering)
    for table in getattr(doc, 'tables', []):
        story.append(Spacer(1, 12))
        for row in table.rows:
            row_text = " | ".join([(cell.text or '').strip() for cell in row.cells])
            if row_text:
                story.append(Paragraph(row_text, body_style))
        story.append(Spacer(1, 12))

    pdf.build(story)
    buffer.seek(0)
    return buffer.read()

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


async def process_and_upload_file(file_content: bytes, original_filename: str):
    """파일을 처리하고 Pinecone에 업로드하는 함수"""
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI 서비스를 사용할 수 없습니다. 관리자에게 문의해주세요."
        )
    
    try:
        # 임시 파일로 저장
        temp_dir = Path("/tmp")
        temp_dir.mkdir(exist_ok=True)
        temp_file = temp_dir / original_filename
        
        with open(temp_file, "wb") as f:
            f.write(file_content)
        
        # PDF에서 텍스트 추출 및 동적 토큰 기반 청킹 처리
        vectors = []
        base_name = Path(original_filename).stem

        # tiktoken 인코더 준비 (모델에 맞춤)
        try:
            encoder = tiktoken.encoding_for_model("text-embedding-3-small")
        except Exception:
            encoder = tiktoken.get_encoding("cl100k_base")

        def count_tokens(text: str) -> int:
            return len(encoder.encode(text))

        def split_text_by_token_limit(text: str, max_tokens: int) -> List[str]:
            token_ids = encoder.encode(text)
            segments: List[str] = []
            for start in range(0, len(token_ids), max_tokens):
                segment = encoder.decode(token_ids[start:start + max_tokens])
                if segment.strip():
                    segments.append(segment)
            return segments

        target_min_tokens = 1000
        target_tokens = 1200
        target_max_tokens = 1500
        overlap_tokens = 200

        with pdfplumber.open(str(temp_file)) as pdf:
            total_pages = len(pdf.pages)

            for i, page in enumerate(pdf.pages, start=1):
                # 페이지 텍스트 추출
                page_text = page.extract_text() or ""
                if not page_text.strip():
                    # pdfplumber로 텍스트가 없으면 PyPDF2로 재시도 (fallback)
                    try:
                        reader = PdfReader(str(temp_file))
                        if i - 1 < len(reader.pages):
                            page_text = (reader.pages[i - 1].extract_text() or "").strip()
                    except Exception:
                        page_text = ""

                if not page_text:
                    logger.warning(f"페이지 {i}에 텍스트가 없습니다. 건너뜁니다.")
                    continue

                # 문단 단위 분리 (빈 줄 기준)
                raw_paragraphs = [p.strip() for p in re.split(r"\n{2,}", page_text) if p and p.strip()]
                if not raw_paragraphs:
                    # 문단 분리가 어려우면 줄 단위로 최소 분리
                    raw_paragraphs = [ln.strip() for ln in page_text.splitlines() if ln.strip()]

                # 1차 청크 조립: 문단을 합쳐 목표 토큰 수(약 1200)에 맞게 그룹화
                chunks_for_page: List[str] = []
                current_parts: List[str] = []
                current_tokens = 0

                for para in raw_paragraphs:
                    para_tokens = count_tokens(para)

                    # 아주 긴 문단은 토큰 기준으로 분할 후 개별 청크로 처리
                    if para_tokens > target_max_tokens:
                        if current_parts:
                            chunks_for_page.append(" ".join(current_parts))
                            current_parts = []
                            current_tokens = 0
                        long_segments = split_text_by_token_limit(para, target_tokens)
                        chunks_for_page.extend(long_segments)
                        continue

                    # 현재 청크에 추가 시 목표 토큰 초과 → 현재 청크 확정 후 새로 시작
                    if current_tokens + para_tokens > target_tokens:
                        if current_parts:
                            chunks_for_page.append(" ".join(current_parts))
                        current_parts = [para]
                        current_tokens = para_tokens
                    else:
                        current_parts.append(para)
                        current_tokens += para_tokens

                if current_parts:
                    chunks_for_page.append(" ".join(current_parts))

                if not chunks_for_page:
                    continue

                # 2차 오버랩 적용: 이전 청크의 마지막 200토큰을 겹쳐 다음 청크 앞에 붙임
                final_chunks: List[str] = []
                for idx, ch in enumerate(chunks_for_page):
                    if idx == 0:
                        final_chunks.append(ch)
                    else:
                        prev_tokens = encoder.encode(chunks_for_page[idx - 1])
                        overlap_slice = prev_tokens[-overlap_tokens:] if len(prev_tokens) > overlap_tokens else prev_tokens
                        overlap_text = encoder.decode(overlap_slice)
                        final_chunks.append((overlap_text + " " + ch).strip())

                # 벡터 생성 및 적재
                for k, chunk_text in enumerate(final_chunks, start=1):
                    try:
                        logger.info(f"페이지 {i}, 청크 {k} 처리 중... (토큰: {count_tokens(chunk_text)})")
                        embedding = get_embedding(chunk_text)
                        vector_id = make_ascii_id(f"{base_name}_page{i}_chunk{k}")

                        vectors.append({
                            "id": vector_id,
                            "values": embedding,
                            "metadata": {
                                "document_name": base_name,
                                "page": i,
                                "pdf_total_pages": total_pages,
                                "chunk": k,
                                "text": chunk_text,
                                "text_preview": chunk_text[:200],
                                "uploaded_at": datetime.utcnow().isoformat()
                            }
                        })
                        logger.info(f"페이지 {i}, 청크 {k} 처리 완료, 벡터 ID: {vector_id}")
                    except Exception as e:
                        logger.error(f"청크 처리 중 오류 (페이지 {i}, 청크 {k}): {str(e)}")
                        continue

        # Pinecone에 업로드
        if vectors:
            index = pc.Index("ideadb")
            index.upsert(vectors=vectors)
            logger.info(f"총 {len(vectors)}개의 벡터를 Pinecone에 업로드했습니다.")
            
            return {
                "status": "success",
                "message": f"성공적으로 {len(vectors)}개의 청크를 업로드했습니다.",
                "document_name": Path(original_filename).stem,
                "total_pages": total_pages,
                "total_chunks": len(vectors)
            }
        else:
            error_msg = "처리할 텍스트가 없습니다."
            logger.warning(error_msg)
            return {"status": "error", "message": error_msg}

    except Exception as e:
        error_msg = f"파일 처리 중 오류가 발생했습니다: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )
    finally:
        # 임시 파일 정리
        if 'temp_file' in locals() and temp_file.exists():
            try:
                temp_file.unlink()
                logger.info(f"임시 파일 삭제: {temp_file}")
            except Exception as e:
                logger.warning(f"임시 파일 삭제 실패: {str(e)}")

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "서버가 정상적으로 실행 중입니다."}


# ===== Admin Authentication & Management APIs =====

CATEGORIES = [
    'chatbot-connect',
    'chat-history',
    'gpt-setting',
    'prompt-setting',
    'data-setting',
    'reference-data'
]


@app.post("/api/admin/login")
async def admin_login(body: LoginRequest):
    # Bootstrap super admin if no admins exist
    try:
        existing = _list_admins()
        if not existing:
            bootstrap_username = os.getenv("ADMIN_BOOTSTRAP_USERNAME", "admin")
            bootstrap_password = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "admin123")
            _upsert_admin(bootstrap_username, bootstrap_password, True)
            logger.info("Super admin bootstrapped")
    except Exception as e:
        logger.warning(f"Bootstrap check failed: {e}")
    admin = _get_admin_by_username(body.username)
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    hashed = admin.get('password_hash') or ''
    if not verify_password(body.password, hashed):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    token = create_access_token({"sub": body.username})
    # set HttpOnly cookie for token
    max_age = ACCESS_TOKEN_EXPIRE_MINUTES * 60
    resp = JSONResponse(content={"success": True})
    resp.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=max_age,
        path="/"
    )
    return resp


@app.get("/api/admin/me")
async def admin_me(request: Request):
    user = get_current_user_from_request(request)
    perms = _get_permissions(user['username']) if not user.get('is_super_admin') else {c: {"can_view": True, "can_save": True} for c in CATEGORIES}
    return {
        "success": True,
        "data": {
            "username": user['username'],
            "is_super_admin": user['is_super_admin'],
            "permissions": perms,
            "categories": CATEGORIES
        }
    }


@app.post("/api/admin/logout")
async def admin_logout():
    # clear cookie
    resp = JSONResponse(content={"success": True})
    resp.set_cookie(
        key=COOKIE_NAME,
        value="",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=0,
        path="/"
    )
    return resp


@app.get("/api/admin/users")
async def list_admin_users(request: Request):
    user = get_current_user_from_request(request)
    if not user.get('is_super_admin'):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="접근 권한이 없습니다.")
    # Lightweight list: username + is_super_admin only, backed by server cache
    admins = _list_admins_simple()
    safe_admins = [{"username": a.get('username', ''), "is_super_admin": _parse_bool(a.get('is_super_admin', 'FALSE'))} for a in admins]
    return {"success": True, "data": safe_admins}


@app.post("/api/admin/users")
async def upsert_admin_user(request: Request, body: AdminUserCreate):
    user = get_current_user_from_request(request)
    if not user.get('is_super_admin'):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="접근 권한이 없습니다.")
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail="username과 password는 필수입니다.")
    res = _upsert_admin(body.username, body.password, body.is_super_admin)
    return {"success": True, "data": res}


@app.delete("/api/admin/users/{username}")
async def delete_admin_user(username: str, request: Request):
    user = get_current_user_from_request(request)
    if not user.get('is_super_admin'):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="접근 권한이 없습니다.")
    # prevent self-delete without another super admin existing (simple check omitted for brevity)
    _delete_admin(username)
    return {"success": True}


@app.get("/api/admin/permissions/{username}")
async def get_user_permissions(username: str, request: Request):
    user = get_current_user_from_request(request)
    if (not user.get('is_super_admin')) and (user['username'] != username):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="접근 권한이 없습니다.")
    perms = _get_permissions(username)
    return {"success": True, "data": perms}


@app.post("/api/admin/permissions")
async def set_user_permissions(request: Request, body: PermissionsUpdate):
    user = get_current_user_from_request(request)
    if not user.get('is_super_admin'):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="접근 권한이 없습니다.")
    # sanitize categories to known list
    sanitized = {}
    for p in body.permissions:
        if p.category in CATEGORIES:
            sanitized[p.category] = {"can_view": p.can_view, "can_save": p.can_save}
    _set_permissions(body.username, sanitized)
    return {"success": True}

@app.post("/api/upload")
async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    metadata: str = Form(None)
):
    # auth + permission
    user = get_current_user_from_request(request)
    require_permission(user, 'data-setting', 'save')
    print(f"Received upload request for file: {file.filename if file else 'No file'}")

    try:
        if not file or not file.filename:
            error_msg = "파일이 제공되지 않았습니다."
            print(error_msg)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )

        print(f"Processing file: {file.filename}, Content-Type: {file.content_type}")

        if not is_allowed_file(file.filename):
            error_msg = f"지원하지 않는 파일 형식입니다. 허용되는 형식: {', '.join(ALLOWED_EXTENSIONS)}"
            print(error_msg)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )
            
        if client is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenAI 서비스를 사용할 수 없습니다. 관리자에게 문의해주세요."
            )

        file_size = 0
        CHUNK_SIZE = 1024 * 1024
        file_content = b""

        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break
            file_content += chunk
            file_size += len(chunk)

            if file_size > MAX_FILE_SIZE:
                error_msg = f"파일 크기가 제한을 초과했습니다. 최대 {MAX_FILE_SIZE // (1024 * 1024)}MB까지 업로드 가능합니다."
                print(error_msg)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=error_msg
                )

        print(f"File read successfully. Size: {file_size} bytes")

        # DOCX 파일은 즉시 PDF로 변환만 수행하고, Drive 업로드/벡터링은 나중에 수행
        ext = get_file_extension(file.filename)
        if ext == 'docx':
            try:
                pdf_bytes = convert_docx_bytes_to_pdf_bytes(file_content, file.filename)
                # 변환된 PDF를 /tmp에 저장
                temp_dir = Path("/tmp")
                temp_dir.mkdir(exist_ok=True)
                safe_name = os.path.basename(file.filename)
                base_stem = Path(safe_name).stem or "converted"
                output_path = temp_dir / f"{base_stem}.pdf"
                with open(output_path, 'wb') as pf:
                    pf.write(pdf_bytes)
                logger.info(f"DOCX → PDF 변환 완료: {output_path}")
                return {
                    "success": True,
                    "message": "DOCX 파일을 PDF로 변환했습니다. 이후 처리는 나중에 수행됩니다.",
                    "filename": file.filename,
                    "size": file_size,
                    "converted_pdf_path": str(output_path),
                    "uploaded_at": datetime.utcnow().isoformat()
                }
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"DOCX → PDF 변환 실패: {e}")

        # 그 외 파일은 기존 로직 수행 (Drive 백그라운드 업로드 + 벡터링)
        drive_upload_scheduled = False
        drive_upload_schedule_error: Optional[str] = None
        try:
            temp_copy_dir = Path("/tmp")
            temp_copy_dir.mkdir(exist_ok=True)
            upload_job_id = uuid.uuid4().hex
            temp_copy_path = temp_copy_dir / f"drive_{upload_job_id}_{file.filename}"
            with open(temp_copy_path, "wb") as fcopy:
                fcopy.write(file_content)
            background_tasks.add_task(
                drive_background_upload,
                str(temp_copy_path),
                file.filename,
                upload_job_id
            )
            drive_upload_scheduled = True
            logger.info(f"Scheduled Google Drive background upload: {temp_copy_path}")
        except Exception as e:
            drive_upload_schedule_error = str(e)
            logger.warning(f"Failed to schedule Drive upload: {e}")

        result = await process_and_upload_file(file_content, file.filename)
        logger.info("파일 처리 및 업로드 완료")

        response_data = {
            "success": True,
            "message": "파일이 성공적으로 처리되었습니다.",
            "filename": file.filename,
            "size": file_size,
            "uploaded_at": datetime.utcnow().isoformat(),
            "result": result,
            "drive_upload_scheduled": drive_upload_scheduled,
            "drive_upload_schedule_error": drive_upload_schedule_error,
            "drive_upload_job_id": upload_job_id if drive_upload_scheduled else None
        }
        print(f"Upload successful: {response_data}")
        return response_data

    except HTTPException as he:
        print(f"HTTP Exception: {he.detail}")
        raise

    except Exception as e:
        error_msg = f"파일 처리 중 오류가 발생했습니다: {str(e)}"
        print(error_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )

@app.get("/api/upload/status/{job_id}")
async def get_drive_upload_status(job_id: str, request: Request):
    # 인증만 수행 (권한은 업로드 권한 보유자이면 충분)
    user = get_current_user_from_request(request)
    # 허용: view 또는 save 권한 보유자
    try:
        require_permission(user, 'data-setting', 'view')
    except HTTPException:
        require_permission(user, 'data-setting', 'save')
    try:
        data = drive_get_upload_status(job_id)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"상태 조회 실패: {e}")

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
        user = get_current_user_from_request(request)
        require_permission(user, 'prompt-setting', 'save')
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
        user = get_current_user_from_request(request)
        require_permission(user, 'gpt-setting', 'save')
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
        user = get_current_user_from_request(request)
        require_permission(user, 'prompt-setting', 'view')
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
        user = get_current_user_from_request(request)
        # Allow if user can save any of related categories
        try:
            require_permission(user, 'prompt-setting', 'save')
        except HTTPException:
            try:
                require_permission(user, 'gpt-setting', 'save')
            except HTTPException:
                require_permission(user, 'reference-data', 'save')
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

@app.get("/api/documents", response_model=List[Dict[str, str]])
async def get_documents(request: Request):
    try:
        user = get_current_user_from_request(request)
        require_permission(user, 'data-setting', 'view')
        # Pinecone 인덱스 접근
        index = pc.Index("ideadb")

        # 쿼리할 필터 조건: document_name이 존재하는 벡터
        filter_condition = {"document_name": {"$exists": True}}

        # 벡터 조회 (임의로 topK=1000 설정)
        result = index.query(
            vector=[0.0] * 1536,  # 임시 벡터 (필수값, 내용 무관)
            filter=filter_condition,
            top_k=1000,
            include_metadata=True
        )

        # 문서 이름 수집 (중복 제거)
        doc_names = set()
        for match in result.get('matches', []):
            metadata = match.get('metadata', {})
            name = metadata.get("document_name")
            if name:
                doc_names.add(name)

        # 정렬된 문서 목록 반환
        return [{"name": name} for name in sorted(doc_names)]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"문서 목록을 불러오는 중 오류가 발생했습니다: {str(e)}"
        )

# 문서 삭제 엔드포인트
@app.delete("/api/documents/{doc_name}")
async def delete_document(doc_name: str, request: Request):
    try:
        user = get_current_user_from_request(request)
        require_permission(user, 'data-setting', 'save')
        index = pc.Index("ideadb")
        # Pinecone에서 해당 문서명 벡터 삭제
        index.delete(filter={"document_name": doc_name})
        return JSONResponse(content={"message": f"'{doc_name}' 문서 벡터 삭제 완료"})
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"문서 삭제 중 오류: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn


# ===== Chat history APIs =====


@app.get("/api/chat/sessions")
async def list_chat_sessions(request: Request):
    """Sessions 시트에서 대화 세션 목록을 조회
    예상 컬럼: [uuid, started_at, ended_at, message_count]
    """
    try:
        user = get_current_user_from_request(request)
        require_permission(user, 'chat-history', 'view')
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
        user = get_current_user_from_request(request)
        require_permission(user, 'chat-history', 'view')
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