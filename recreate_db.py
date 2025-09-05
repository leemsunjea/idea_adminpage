#!/usr/bin/env python3
"""
Supabase 데이터베이스 재구성 스크립트
"""

from supabase_db import supabase

def recreate_app_settings_table():
    """app_settings 테이블을 새로운 구조로 재생성"""
    
    sql_commands = [
        # 기존 테이블 삭제
        "DROP TABLE IF EXISTS app_settings CASCADE;",
        
        # 새로운 테이블 생성
        """
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
        """,
        
        # 기본 데이터 삽입
        """
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
        """,
        
        # RLS 활성화
        "ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;",
        
        # 정책 생성
        'CREATE POLICY "Allow all for authenticated users" ON app_settings FOR ALL USING (auth.role() = \'authenticated\');'
    ]
    
    try:
        for i, sql in enumerate(sql_commands, 1):
            print(f"실행 중... ({i}/{len(sql_commands)})")
            print(f"SQL: {sql[:100]}...")
            
            # Supabase에서 SQL 실행
            result = supabase.rpc('exec_sql', {'sql': sql}).execute()
            print(f"✅ 성공: {result}")
            
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        return False
    
    print("🎉 데이터베이스 재구성 완료!")
    return True

if __name__ == "__main__":
    print("Supabase 데이터베이스 재구성을 시작합니다...")
    recreate_app_settings_table()
