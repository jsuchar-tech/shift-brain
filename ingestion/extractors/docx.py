import os
import gc
import tempfile
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from ingestion.drive_client import get_credentials
from docx import Document

def extract_docx(file_id: str) -> list[dict]:
    """
    Download a .docx from Drive to a temp file and extract text by section.
    Uses disk instead of memory to handle large files.
    """
    service = build('drive', 'v3', credentials=get_credentials())

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as tmp:
            tmp_path = tmp.name
            request = service.files().get_media(fileId=file_id)
            downloader = MediaIoBaseDownload(tmp, request)

            done = False
            while not done:
                _, done = downloader.next_chunk()

        doc = Document(tmp_path)
        sections = []
        current_heading = None
        current_text = []

        def flush_section():
            if current_text:
                sections.append({
                    'section_header': current_heading,
                    'text': '\n'.join(current_text)
                })

        def extract_tables():
            table_texts = []
            for table in doc.tables:
                rows = []
                for row in table.rows:
                    try:
                        cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                        if cells:
                            rows.append(' | '.join(cells))
                    except Exception:
                        continue
                if rows:
                    table_texts.append('\n'.join(rows))
            return table_texts

        for para in doc.paragraphs:
            try:
                text = para.text.strip()
                if not text:
                    continue

                style_name = ''
                try:
                    if para.style and para.style.name:
                        style_name = para.style.name
                except Exception:
                    style_name = ''

                if style_name.startswith('Heading'):
                    flush_section()
                    current_heading = text
                    current_text = []
                else:
                    current_text.append(text)

            except Exception:
                continue

        flush_section()

        table_texts = extract_tables()
        if table_texts:
            sections.append({
                'section_header': 'Tables',
                'text': '\n\n'.join(table_texts)
            })

        if not sections:
            all_text = '\n'.join(
                p.text.strip() for p in doc.paragraphs if p.text.strip()
            )
            if all_text:
                sections.append({
                    'section_header': None,
                    'text': all_text
                })

        return sections

    except Exception as e:
        print(f"  ERROR extracting docx: {type(e).__name__}: {e}")
        return []

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        gc.collect()