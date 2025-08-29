import logging
import os
import pickle
import re
import mimetypes
import time
import json
from pathlib import Path
from typing import Optional, Dict

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials as SA_Credentials


LOGGER = logging.getLogger(__name__)

# OAuth scopes and file locations
SCOPES = ['https://www.googleapis.com/auth/drive']

# Resolve credentials/token path relative to this file (works locally and in Docker)
_BASE_DIR = Path(__file__).resolve().parent
_OAUTH_KEY_PATH = _BASE_DIR / 'Oauthkey.json'
_DEFAULT_CLIENT_SECRET_PATH = _BASE_DIR / 'client_secret_956514703917-9d24mhtkm0ooqncga0v765o579si9364.apps.googleusercontent.com.json'

# Prefer Oauthkey.json if present; otherwise fall back to the existing client_secret file
if _OAUTH_KEY_PATH.exists():
    CREDENTIALS_FILE = str(_OAUTH_KEY_PATH)
else:
    CREDENTIALS_FILE = str(_DEFAULT_CLIENT_SECRET_PATH)

# Persist token next to the module (default)
TOKEN_FILE = str(_BASE_DIR / 'token.pickle')
# Fallback writable temp location for environments where the app directory is read-only
_TMP_DIR = Path(os.getenv('TMPDIR') or '/tmp')
_FALLBACK_TOKEN_FILE = str(_TMP_DIR / 'token.pickle')

# Upload destination in Google Drive
PARENT_FOLDER_ID = os.getenv('GOOGLE_DRIVE_PARENT_FOLDER_ID', '1EI-8lUCEUGobF8AbxD7mwdmap-SgnI07')
######################################################################
# In-memory background upload status store
######################################################################
UPLOAD_STATUS: Dict[str, dict] = {}

def _set_status(job_id: Optional[str], status: str, detail: Optional[str] = None, drive_file: Optional[dict] = None) -> None:
    if not job_id:
        return
    UPLOAD_STATUS[job_id] = {
        'status': status,
        'detail': detail,
        'drive_file': drive_file,
        'updated_at': time.time()
    }

def get_upload_status(job_id: str) -> dict:
    data = UPLOAD_STATUS.get(job_id)
    if not data:
        return {'status': 'unknown'}
    return data



def authenticate():
    """Authenticate with Google Drive and return credentials.

    Priority:
    1) Service Account (if GOOGLE_DRIVE_USE_SERVICE_ACCOUNT=true)
    2) OAuth user flow with local token cache (token.pickle)
    """
    # 1) Service Account path (headless-friendly)
    use_sa = os.getenv('GOOGLE_DRIVE_USE_SERVICE_ACCOUNT', 'false').lower() == 'true'
    if use_sa:
        try:
            sa_json = os.getenv('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON')
            sa_file = os.getenv('GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE')
            creds: Optional[object] = None
            if sa_json:
                info = json.loads(sa_json)
                creds = SA_Credentials.from_service_account_info(info, scopes=SCOPES)
            elif sa_file and os.path.exists(sa_file):
                creds = SA_Credentials.from_service_account_file(sa_file, scopes=SCOPES)
            else:
                # Try to reuse the GOOGLE_SHEETS_CONFIG_JSON if provided
                sheets_json = os.getenv('GOOGLE_SHEETS_CONFIG_JSON')
                if sheets_json:
                    info = json.loads(sheets_json)
                    creds = SA_Credentials.from_service_account_info(info, scopes=SCOPES)

            if creds:
                try:
                    sa_email = getattr(creds, 'service_account_email', None)
                    if sa_email:
                        LOGGER.info("Using Google Drive service account: %s", sa_email)
                except Exception:
                    pass
                return creds
            else:
                LOGGER.warning("Service account requested but no credentials provided; falling back to OAuth user flow")
        except Exception as e:
            LOGGER.warning("Service account auth failed: %s; falling back to OAuth user flow", e)

    # 2) OAuth user flow with token cache
    creds = None
    # Try loading token from default path; if not present or fails, try fallback in /tmp
    token_candidates = [TOKEN_FILE]
    if _FALLBACK_TOKEN_FILE != TOKEN_FILE:
        token_candidates.append(_FALLBACK_TOKEN_FILE)
    for candidate in token_candidates:
        if os.path.exists(candidate):
            try:
                with open(candidate, 'rb') as token:
                    creds = pickle.load(token)
                    LOGGER.info(f"Loaded Google Drive token from {candidate}")
                    break
            except Exception as e:
                LOGGER.warning(f"Failed to load token file from {candidate}: {e}")
                creds = None

    if not creds or not getattr(creds, 'valid', False):
        if creds and getattr(creds, 'expired', False) and getattr(creds, 'refresh_token', None):
            try:
                creds.refresh(Request())
            except Exception as e:
                LOGGER.warning(f"Token refresh failed: {e}. Re-running OAuth flow.")
                creds = None
        if not creds or not getattr(creds, 'valid', False):
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            # open_browser=False prevents auto-launch; still requires visiting the URL once
            creds = flow.run_local_server(port=0, access_type='offline', open_browser=False)
        # Persist token (try default path first, then fallback to /tmp)
        try:
            with open(TOKEN_FILE, 'wb') as token:
                pickle.dump(creds, token)
        except Exception as e:
            LOGGER.warning(f"Failed to persist token file at {TOKEN_FILE}: {e}")
            # Attempt fallback write to /tmp
            try:
                _TMP_DIR.mkdir(parents=True, exist_ok=True)
                with open(_FALLBACK_TOKEN_FILE, 'wb') as token:
                    pickle.dump(creds, token)
                LOGGER.info(f"Persisted Google Drive token to fallback path: {_FALLBACK_TOKEN_FILE}")
            except Exception as e2:
                LOGGER.warning(f"Failed to persist token to fallback path {_FALLBACK_TOKEN_FILE}: {e2}")

    return creds


def _sanitize_filename(name: str) -> str:
    # Replace disallowed characters for Drive/OS file names
    sanitized = re.sub(r'[\\/:*?"<>|\n\r\t]+', '_', name).strip()
    return sanitized or 'uploaded_file'


def upload_file_to_drive(file_path: str, display_name: Optional[str] = None, job_id: Optional[str] = None) -> Optional[dict]:
    """Upload a local file to Google Drive under the configured parent folder.

    Args:
        file_path: Absolute or relative path to the local file to upload.
        display_name: Optional display name to use in Drive. Defaults to basename of file_path.

    Returns:
        The Drive file resource dict on success, or None on failure.
    """
    # Pre-check: local file must exist
    if not os.path.exists(file_path):
        msg = f"Drive upload aborted: file not found: {file_path}"
        LOGGER.error(msg)
        _set_status(job_id, 'error', detail=msg)
        return None

    name = _sanitize_filename(display_name or os.path.basename(file_path))
    # Prefer guessing from the actual file; fallback to name
    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type, _ = mimetypes.guess_type(name)

    # Authenticate once outside of retry loop
    try:
        creds = authenticate()
        service = build('drive', 'v3', credentials=creds)
    except Exception as e:
        LOGGER.error("Drive authentication/build failed: %s", e)
        _set_status(job_id, 'error', detail=f"auth/build failed: {e}")
        return None

    # Pre-flight: verify parent folder
    try:
        parent_meta = service.files().get(fileId=PARENT_FOLDER_ID, fields='id,name,mimeType,driveId,trashed', supportsAllDrives=True).execute()
        if parent_meta.get('trashed'):
            raise RuntimeError("parent folder is in trash")
        if parent_meta.get('mimeType') != 'application/vnd.google-apps.folder':
            LOGGER.warning("Provided parent is not a folder: %s (%s)", parent_meta.get('name'), parent_meta.get('mimeType'))
    except HttpError as e:
        LOGGER.error("Invalid or inaccessible parent folder '%s': %s", PARENT_FOLDER_ID, e)
        _set_status(job_id, 'error', detail=f"invalid parent folder: {PARENT_FOLDER_ID}")
        return None
    except Exception as e:
        LOGGER.error("Parent folder verification failed: %s", e)
        _set_status(job_id, 'error', detail=f"parent verification failed: {e}")
        return None

    # Prepare metadata and media uploader
    file_metadata = {
        'name': name,
        'parents': [PARENT_FOLDER_ID],
    }
    if mime_type:
        file_metadata['mimeType'] = mime_type

    media = MediaFileUpload(
        file_path,
        mimetype=mime_type or 'application/octet-stream',
        resumable=False
    )

    # Retry upload up to 3 times with backoff
    max_attempts = 3
    for attempt_index in range(1, max_attempts + 1):
        try:
            created = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id,name,parents,mimeType',
                supportsAllDrives=True
            ).execute()

            if not created or not created.get('id'):
                raise RuntimeError("Drive API returned empty response or missing file id")

            web_link = f"https://drive.google.com/file/d/{created.get('id')}/view"
            LOGGER.info(
                "Google Drive upload successful: id=%s name=%s link=%s",
                created.get('id'), created.get('name'), web_link
            )
            created_with_link = dict(created)
            created_with_link['webViewLink'] = web_link
            _set_status(job_id, 'success', drive_file=created_with_link)
            return created
        except HttpError as http_err:
            LOGGER.error(
                "Drive upload HTTP error (attempt %d/%d) for %s: %s",
                attempt_index, max_attempts, file_path, http_err
            )
            _set_status(job_id, 'error', detail=f"HTTP error: {http_err}")
        except Exception as e:
            LOGGER.error(
                "Drive upload failed (attempt %d/%d) for %s: %s",
                attempt_index, max_attempts, file_path, e
            )
            _set_status(job_id, 'error', detail=str(e))

        if attempt_index < max_attempts:
            # Exponential backoff: 0.5s, 1s
            time.sleep(0.5 * attempt_index)

    LOGGER.error("Drive upload ultimately failed after %d attempts for %s", max_attempts, file_path)
    return None


def background_upload(file_path: str, display_name: Optional[str] = None, job_id: Optional[str] = None) -> None:
    """Background task entrypoint for FastAPI to upload and then clean up local temp file."""
    try:
        _set_status(job_id, 'running')
        result = upload_file_to_drive(file_path, display_name, job_id)
        if not result:
            LOGGER.error("Background Drive upload returned no result for %s (name=%s)", file_path, display_name)
    finally:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                LOGGER.info(f"Cleaned up temporary file after Drive upload: {file_path}")
        except Exception as e:
            LOGGER.warning(f"Failed to remove temporary file {file_path}: {e}")


