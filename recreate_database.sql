-- 기존 app_settings 테이블 삭제
DROP TABLE IF EXISTS app_settings CASCADE;

-- 새로운 app_settings 테이블 생성 (컬럼 기반 구조)
CREATE TABLE app_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ai_greeting TEXT,
    training_data TEXT,
    instruction_data TEXT,
    gpt_model VARCHAR(100) DEFAULT 'gpt-3.5-turbo',
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,
    references_enabled BOOLEAN DEFAULT FALSE,
    download_button_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기본 데이터 삽입
INSERT INTO app_settings (
    ai_greeting,
    training_data,
    instruction_data,
    gpt_model,
    temperature,
    max_tokens,
    references_enabled,
    download_button_enabled
) VALUES (
    '안녕하세요! 무엇을 도와드릴까요?',
    '',
    '',
    'gpt-3.5-turbo',
    0.7,
    1000,
    FALSE,
    FALSE
);

-- RLS 활성화
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 기본 정책 생성
CREATE POLICY "Allow all for authenticated users" ON app_settings FOR ALL USING (auth.role() = 'authenticated');

-- 인덱스 생성
CREATE INDEX idx_app_settings_id ON app_settings(id);

-- 채팅 세션 테이블 생성
CREATE TABLE chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_uuid VARCHAR(255) UNIQUE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    message_count INTEGER DEFAULT 0
);

-- 채팅 로그 테이블 생성
CREATE TABLE chat_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_uuid VARCHAR(255) NOT NULL REFERENCES chat_sessions(session_uuid) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 문서 메타데이터 테이블 생성
CREATE TABLE document_metadata (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT,
    total_pages INTEGER,
    total_chunks INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    storage_path VARCHAR(500),
    pinecone_vectors_count INTEGER DEFAULT 0
);

-- 인덱스 생성
CREATE INDEX idx_chat_logs_session_uuid ON chat_logs(session_uuid);
CREATE INDEX idx_document_metadata_name ON document_metadata(document_name);

-- RLS 활성화
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_metadata ENABLE ROW LEVEL SECURITY;

-- 기본 정책 생성
CREATE POLICY "Allow all for authenticated users" ON chat_sessions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON chat_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON document_metadata FOR ALL USING (auth.role() = 'authenticated');

-- 테이블 구조 확인
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'app_settings' 
ORDER BY ordinal_position;
