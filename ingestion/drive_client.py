import os
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/presentations.readonly'
]

def get_credentials():
    """Build Google credentials from environment variables."""
    creds = Credentials(
        token=None,
        refresh_token=os.environ['GOOGLE_REFRESH_TOKEN'],
        client_id=os.environ['GOOGLE_CLIENT_ID'],
        client_secret=os.environ['GOOGLE_CLIENT_SECRET'],
        token_uri='https://oauth2.googleapis.com/token',
        scopes=SCOPES
    )
    creds.refresh(Request())
    return creds

def get_drive_service():
    return build('drive', 'v3', credentials=get_credentials())

def get_docs_service():
    return build('docs', 'v1', credentials=get_credentials())

def get_slides_service():
    return build('slides', 'v1', credentials=get_credentials())

def list_folder_files(folder_id: str) -> list[dict]:
    """
    Recursively list all files in the specified Drive folder and subfolders.
    Returns file metadata including id, name, mimeType, modifiedTime, webViewLink.
    """
    service = get_drive_service()

    supported_mime_types = [
        'application/vnd.google-apps.document',
        'application/vnd.google-apps.presentation',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]

    def get_files_in_folder(fid, folder_path=''):
        files = []
        page_token = None

        # Get subfolders first and recurse into them
        folder_query = f"'{fid}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        while True:
            folder_response = service.files().list(
                q=folder_query,
                spaces='drive',
                fields='nextPageToken, files(id, name)',
                pageToken=page_token
            ).execute()

            for subfolder in folder_response.get('files', []):
                subfolder_path = folder_path + '/' + subfolder['name'] if folder_path else subfolder['name']
                print(f"Found subfolder: {subfolder_path}")
                files.extend(get_files_in_folder(subfolder['id'], subfolder_path))

            page_token = folder_response.get('nextPageToken')
            if not page_token:
                break

        # Get supported files in this folder
        mime_query = ' or '.join([f"mimeType='{m}'" for m in supported_mime_types])
        file_query = f"'{fid}' in parents and ({mime_query}) and trashed=false"
        page_token = None

        while True:
            response = service.files().list(
                q=file_query,
                spaces='drive',
                fields='nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)',
                pageToken=page_token
            ).execute()

            for f in response.get('files', []):
                f['folder_path'] = folder_path

            files.extend(response.get('files', []))
            page_token = response.get('nextPageToken')

            if not page_token:
                break

        return files

    all_files = get_files_in_folder(folder_id)
    print(f"Found {len(all_files)} files total across all subfolders")
    return all_files