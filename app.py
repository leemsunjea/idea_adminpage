import logging
import os
import re
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import time
import PyPDF2
import io
import tiktoken
import pdfplumber

import requests
from fastapi import FastAPI, HTTPException, Request, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from pinecone import Pinecone
from pydantic import BaseModel

# Supabase Integration
from supabase_db import db

# Pinecone 설정
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
pc = Pinecone(api_key=PINECONE_API_KEY) if PINECONE_API_KEY else None

def make_ascii_id(text: str) -> str:
    """텍스트를 ASCII ID로 변환"""
    # 한글과 특수문자를 제거하고 ASCII로 변환
    ascii_text = re.sub(r'[^\w\s-]', '', text)
    ascii_text = re.sub(r'[-\s]+', '_', ascii_text)
    return ascii_text.strip('_').lower()

def get_embedding(text: str):
    """OpenAI embeddings 생성"""
    if not client:
        raise ValueError("OpenAI 클라이언트가 초기화되지 않았습니다. OPENAI_API_KEY를 확인하세요.")
    
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

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


# ===== Document management APIs =====

@app.get("/api/documents")
async def list_documents(request: Request):
    """Pinecone에서 문서 목록을 조회"""
    try:
        # Pinecone에서 인덱스 목록 조회
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        index = pc.Index("ideadb")
        
        # 인덱스 통계 조회
        stats = index.describe_index_stats()
        total_vector_count = stats.get('total_vector_count', 0)
        
        # Pinecone에서 벡터들의 메타데이터 조회하여 고유한 문서 목록 생성
        documents = []
        if total_vector_count > 0:
            # 벡터 쿼리를 통해 메타데이터 조회 (최대 1000개)
            query_response = index.query(
                vector=[0.0] * 1536,  # 더미 벡터 (1536은 text-embedding-3-small의 차원)
                top_k=1000,
                include_metadata=True
            )
            
            # document_name 기준으로 중복 제거하고 최신 added_date 찾기
            unique_documents = {}
            for match in query_response.matches:
                metadata = match.metadata
                doc_name = metadata.get('document_name', '')
                if doc_name:
                    added_date = metadata.get('added_date', '')
                    uploaded_at = metadata.get('uploaded_at', '')
                    
                    # 기존 문서가 없거나 현재 문서의 added_date가 더 최신인 경우
                    if doc_name not in unique_documents or (added_date and added_date > unique_documents[doc_name].get('added_date', '')):
                        unique_documents[doc_name] = {
                            "name": doc_name,
                            "filename": metadata.get('text_preview', '')[:50] + '...' if metadata.get('text_preview') else doc_name,
                            "size": 0,  # Pinecone에서는 파일 크기 정보가 없음
                            "pages": metadata.get('pdf_total_pages', 0),
                            "chunks": 0,  # 개별 문서의 청크 수는 별도 계산 필요
                            "uploaded_at": added_date or uploaded_at,  # added_date 우선, 없으면 uploaded_at
                            "added_date": added_date,  # 원본 added_date 저장
                            "storage_path": f"pinecone/{doc_name}",
                            "vector_count": 0  # 개별 문서의 벡터 수는 별도 계산 필요
                        }
            
            # 각 문서별 벡터 수 계산
            for doc_name in unique_documents:
                # 해당 문서의 벡터 수 조회
                doc_query = index.query(
                    vector=[0.0] * 1536,
                    top_k=1000,
                    include_metadata=True,
                    filter={"document_name": {"$eq": doc_name}}
                )
                unique_documents[doc_name]["chunks"] = len(doc_query.matches)
                unique_documents[doc_name]["vector_count"] = len(doc_query.matches)
            
            documents = list(unique_documents.values())
        
        return {
            "documents": documents,
            "total_vectors": total_vector_count
        }
    except Exception as e:
        print(f"문서 목록 조회 중 오류: {str(e)}")
        return {"documents": [], "total_vectors": 0}


@app.delete("/api/documents/{doc_name}")
async def delete_document(doc_name: str, request: Request):
    """Supabase에서 문서를 삭제"""
    try:
        success = db.delete_document_metadata(doc_name)
        if success:
            return {"success": True, "message": "문서가 삭제되었습니다."}
        else:
            raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"문서 삭제 실패: {str(e)}")

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
                        reader = PyPDF2.PdfReader(str(temp_file))
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

                for paragraph in raw_paragraphs:
                    para_tokens = count_tokens(paragraph)
                    
                    if current_tokens + para_tokens <= target_tokens:
                        current_parts.append(paragraph)
                        current_tokens += para_tokens
                    else:
                        if current_parts:
                            chunks_for_page.append(" ".join(current_parts))
                        current_parts = [paragraph]
                        current_tokens = para_tokens

                if current_parts:
                    chunks_for_page.append(" ".join(current_parts))

                # 2차 청크 분할: 너무 긴 청크를 토큰 제한에 맞게 분할
                final_chunks: List[str] = []
                for chunk in chunks_for_page:
                    chunk_tokens = count_tokens(chunk)
                    if chunk_tokens <= target_max_tokens:
                        final_chunks.append(chunk)
                    else:
                        # 토큰 제한에 맞게 분할
                        sub_chunks = split_text_by_token_limit(chunk, target_tokens)
                        final_chunks.extend(sub_chunks)

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
            
            # Supabase에 메타데이터 저장
            db.save_document_metadata(
                document_name=base_name,
                original_filename=original_filename,
                file_size=len(file_content),
                total_pages=total_pages,
                total_chunks=len(vectors),
                storage_path=f"local/{base_name}"
            )
            
            return {
                "status": "success",
                "message": f"성공적으로 {len(vectors)}개의 청크를 업로드했습니다.",
                "document_name": base_name,
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

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    """문서 업로드 및 임베딩 처리"""
    try:
        # 파일 크기 제한 (50MB)
        max_size = 50 * 1024 * 1024
        if file.size and file.size > max_size:
            raise HTTPException(
                status_code=400,
                detail="파일 크기가 50MB를 초과합니다."
            )
        
        # PDF 파일만 허용
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=400,
                detail="PDF 파일만 업로드 가능합니다."
            )
        
        # 파일 내용 읽기
        file_content = await file.read()

        # 파일 처리 및 업로드
        result = await process_and_upload_file(file_content, file.filename)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"문서 업로드 중 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"문서 업로드 실패: {str(e)}"
        )