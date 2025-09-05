import os
from supabase import create_client, Client

# 환경 변수에서 설정 불러오기
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

# 환경 변수가 없을 때 기본값 설정
if not SUPABASE_URL:
    SUPABASE_URL = "https://gkhdplnpkizhatxvvttn.supabase.co"
if not SUPABASE_SERVICE_ROLE_KEY:
    SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdraGRwbG5wa2l6aGF0eHZ2dHRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQ0MjE1NiwiZXhwIjoyMDcxMDE4MTU2fQ.-sTLezqfVWEj5NYLOtVEunDF5wsWTJbyspfPZrVDir4"

# Supabase 클라이언트 초기화
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
