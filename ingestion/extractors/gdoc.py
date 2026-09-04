from googleapiclient.discovery import build
from ingestion.drive_client import get_credentials

def extract_gdoc(file_id: str) -> str:
    """
    Export a Google Doc as plain text.
    Returns the full document text.
    """
    service = build('drive', 'v3', credentials=get_credentials())

    response = service.files().export(
        fileId=file_id,
        mimeType='text/plain'
    ).execute()

    text = response.decode('utf-8')

    lines = [line.strip() for line in text.splitlines()]
    cleaned = '\n'.join(line for line in lines if line)

    return cleaned