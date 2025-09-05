import os
from datetime import datetime
from typing import Dict, List, Optional
from supabase import create_client, Client

# Supabase 클라이언트 초기화
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

class SupabaseDB:
    """Supabase 데이터베이스 관리 클래스"""
    
    # ===== 관리자 사용자 관리 =====
    def get_admin_by_username(self, username: str) -> Optional[Dict]:
        """사용자명으로 관리자 조회"""
        try:
            response = supabase.table('admin_users').select('*').eq('username', username).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"관리자 조회 중 오류: {str(e)}")
            return None
    
    def upsert_admin(self, username: str, password_hash: str, is_super_admin: bool) -> Dict:
        """관리자 생성/업데이트"""
        try:
            data = {
                'username': username,
                'password_hash': password_hash,
                'is_super_admin': is_super_admin,
                'updated_at': datetime.utcnow().isoformat()
            }
            response = supabase.table('admin_users').upsert(data).execute()
            return response.data[0] if response.data else data
        except Exception as e:
            print(f"관리자 저장 중 오류: {str(e)}")
            raise
    
    def delete_admin(self, username: str) -> bool:
        """관리자 삭제"""
        try:
            supabase.table('admin_users').delete().eq('username', username).execute()
            return True
        except Exception as e:
            print(f"관리자 삭제 중 오류: {str(e)}")
            return False
    
    def list_admins(self) -> List[Dict]:
        """관리자 목록 조회"""
        try:
            response = supabase.table('admin_users').select('username, is_super_admin, created_at, updated_at').execute()
            return response.data or []
        except Exception as e:
            print(f"관리자 목록 조회 중 오류: {str(e)}")
            return []
    
    # ===== 권한 관리 =====
    def get_permissions(self, username: str) -> Dict[str, Dict[str, bool]]:
        """사용자 권한 조회"""
        try:
            response = supabase.table('user_permissions').select('*').eq('username', username).execute()
            perms = {}
            for row in response.data or []:
                perms[row['category']] = {
                    'can_view': row['can_view'],
                    'can_save': row['can_save']
                }
            return perms
        except Exception as e:
            print(f"권한 조회 중 오류: {str(e)}")
            return {}
    
    def set_permissions(self, username: str, permissions: Dict[str, Dict[str, bool]]) -> bool:
        """사용자 권한 설정"""
        try:
            # 기존 권한 삭제
            supabase.table('user_permissions').delete().eq('username', username).execute()
            
            # 새 권한 추가
            for category, flags in permissions.items():
                data = {
                    'username': username,
                    'category': category,
                    'can_view': flags.get('can_view', False),
                    'can_save': flags.get('can_save', False),
                    'updated_at': datetime.utcnow().isoformat()
                }
                supabase.table('user_permissions').insert(data).execute()
            return True
        except Exception as e:
            print(f"권한 설정 중 오류: {str(e)}")
            return False
    
    # ===== 앱 설정 관리 =====
    def get_app_settings(self) -> Dict:
        """앱 설정 조회"""
        try:
            response = supabase.table('app_settings').select('*').limit(1).execute()
            if response.data:
                return response.data[0]
            else:
                # 기본값 반환
                return {
                    'ai_greeting': '',
                    'training_data': '',
                    'instruction_data': '',
                    'gpt_model': 'gpt-3.5-turbo',
                    'temperature': 0.7,
                    'max_tokens': 1000,
                    'references_enabled': False,
                    'download_button_enabled': False
                }
        except Exception as e:
            print(f"앱 설정 조회 중 오류: {str(e)}")
            return {}
    
    def save_app_settings(self, settings_data: Dict) -> Dict:
        """앱 설정 저장"""
        try:
            settings_data['updated_at'] = datetime.utcnow().isoformat()
            response = supabase.table('app_settings').upsert(settings_data).execute()
            return response.data[0] if response.data else settings_data
        except Exception as e:
            print(f"앱 설정 저장 중 오류: {str(e)}")
            raise
    
    # ===== 채팅 세션 관리 =====
    def create_chat_session(self, session_uuid: str) -> Dict:
        """채팅 세션 생성"""
        try:
            data = {
                'session_uuid': session_uuid,
                'started_at': datetime.utcnow().isoformat()
            }
            response = supabase.table('chat_sessions').insert(data).execute()
            return response.data[0] if response.data else data
        except Exception as e:
            print(f"채팅 세션 생성 중 오류: {str(e)}")
            raise
    
    def get_chat_sessions(self) -> List[Dict]:
        """채팅 세션 목록 조회"""
        try:
            response = supabase.table('chat_sessions').select('*').order('started_at', desc=True).execute()
            return response.data or []
        except Exception as e:
            print(f"채팅 세션 목록 조회 중 오류: {str(e)}")
            return []
    
    def add_chat_log(self, session_uuid: str, role: str, message: str) -> Dict:
        """채팅 로그 추가"""
        try:
            data = {
                'session_uuid': session_uuid,
                'role': role,
                'message': message,
                'timestamp': datetime.utcnow().isoformat()
            }
            response = supabase.table('chat_logs').insert(data).execute()
            
            # 세션의 메시지 수 업데이트
            supabase.table('chat_sessions').update({
                'message_count': supabase.table('chat_logs').select('id', count='exact').eq('session_uuid', session_uuid).execute().count
            }).eq('session_uuid', session_uuid).execute()
            
            return response.data[0] if response.data else data
        except Exception as e:
            print(f"채팅 로그 추가 중 오류: {str(e)}")
            raise
    
    def get_chat_logs(self, session_uuid: str) -> List[Dict]:
        """특정 세션의 채팅 로그 조회"""
        try:
            response = supabase.table('chat_logs').select('*').eq('session_uuid', session_uuid).order('timestamp').execute()
            return response.data or []
        except Exception as e:
            print(f"채팅 로그 조회 중 오류: {str(e)}")
            return []
    
    # ===== 문서 메타데이터 관리 =====
    def save_document_metadata(self, document_name: str, original_filename: str, 
                              file_size: int, total_pages: int = None, 
                              total_chunks: int = None, storage_path: str = None) -> Dict:
        """문서 메타데이터 저장"""
        try:
            data = {
                'document_name': document_name,
                'original_filename': original_filename,
                'file_size': file_size,
                'total_pages': total_pages,
                'total_chunks': total_chunks,
                'storage_path': storage_path,
                'uploaded_at': datetime.utcnow().isoformat()
            }
            response = supabase.table('document_metadata').insert(data).execute()
            return response.data[0] if response.data else data
        except Exception as e:
            print(f"문서 메타데이터 저장 중 오류: {str(e)}")
            raise
    
    def get_document_metadata(self, document_name: str = None) -> List[Dict]:
        """문서 메타데이터 조회"""
        try:
            if document_name:
                response = supabase.table('document_metadata').select('*').eq('document_name', document_name).execute()
            else:
                response = supabase.table('document_metadata').select('*').order('uploaded_at', desc=True).execute()
            return response.data or []
        except Exception as e:
            print(f"문서 메타데이터 조회 중 오류: {str(e)}")
            return []
    
    def delete_document_metadata(self, document_name: str) -> bool:
        """문서 메타데이터 삭제"""
        try:
            supabase.table('document_metadata').delete().eq('document_name', document_name).execute()
            return True
        except Exception as e:
            print(f"문서 메타데이터 삭제 중 오류: {str(e)}")
            return False

# 전역 인스턴스
db = SupabaseDB()
