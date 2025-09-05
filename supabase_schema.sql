-- Supabase 데이터베이스 스키마
-- 이 파일을 Supabase SQL Editor에서 실행하여 테이블을 생성하세요

-- 1. PDF 바이너리 저장을 위한 Storage 버킷 생성
INSERT INTO storage.buckets (
    id, 
    name, 
    public, 
    file_size_limit, 
    allowed_mime_types
)
VALUES (
    'pdfs',
    'pdfs',
    true,
    52428800,  -- 50MB
    ARRAY[]::text[]  -- 빈 배열 = 모든 MIME 타입 허용
);

-- 2. 일반 텍스트 저장을 위한 테이블들 생성

-- 관리자 사용자 테이블
CREATE TABLE admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 권한 테이블
CREATE TABLE user_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(255) NOT NULL REFERENCES admin_users(username) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    can_view BOOLEAN DEFAULT FALSE,
    can_save BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(username, category)
);

-- 설정 데이터 테이블
CREATE TABLE app_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ai_greeting TEXT,
    training_data TEXT,
    instruction_data TEXT,
    gpt_model VARCHAR(100),
    temperature DECIMAL(3,2),
    max_tokens INTEGER,
    references_enabled BOOLEAN DEFAULT FALSE,
    download_button_enabled BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 채팅 세션 테이블
CREATE TABLE chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_uuid VARCHAR(255) UNIQUE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    message_count INTEGER DEFAULT 0
);

-- 채팅 로그 테이블
CREATE TABLE chat_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_uuid VARCHAR(255) NOT NULL REFERENCES chat_sessions(session_uuid) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 문서 메타데이터 테이블 (Pinecone 벡터와 연동)
CREATE TABLE document_metadata (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT,
    total_pages INTEGER,
    total_chunks INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    storage_path VARCHAR(500), -- Supabase Storage 경로
    pinecone_vectors_count INTEGER DEFAULT 0
);

-- 인덱스 생성
CREATE INDEX idx_admin_users_username ON admin_users(username);
CREATE INDEX idx_user_permissions_username ON user_permissions(username);
CREATE INDEX idx_chat_logs_session_uuid ON chat_logs(session_uuid);
CREATE INDEX idx_document_metadata_name ON document_metadata(document_name);

-- RLS (Row Level Security) 활성화
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_metadata ENABLE ROW LEVEL SECURITY;

-- 기본 정책 (필요에 따라 수정)
CREATE POLICY "Allow all for authenticated users" ON admin_users FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON user_permissions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON app_settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON chat_sessions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON chat_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON document_metadata FOR ALL USING (auth.role() = 'authenticated');
