import os
import gc
import tempfile
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from ingestion.drive_client import get_credentials
import pdfplumber

def extract_page_text(page):
    """
    Extract text from a page using word-level extraction
    which captures positioned text that standard extraction misses.
    Falls back to standard extraction if word extraction yields less content.
    """
    # Word-level extraction — captures all text regardless of position
    try:
        words = page.extract_words(
            x_tolerance=5,
            y_tolerance=5,
            keep_blank_chars=False,
            use_text_flow=False
        )
        # Sort by vertical position first, then horizontal
        words_sorted = sorted(words, key=lambda w: (round(w['top'] / 15) * 15, w['x0']))
        word_text = ' '.join(w['text'] for w in words_sorted).strip()
    except Exception:
        word_text = ''

    # Standard extraction
    try:
        standard_text = page.extract_text() or ''
    except Exception:
        standard_text = ''

    # Use whichever gives more content
    if len(word_text) > len(standard_text):
        full_text = word_text
    else:
        full_text = standard_text

    # Extract tables
    table_texts = []
    try:
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                cleaned_row = [cell or '' for cell in row]
                joined = ' | '.join(cleaned_row).strip()
                if joined:
                    table_texts.append(joined)
    except Exception:
        pass

    if table_texts:
        full_text += '\n' + '\n'.join(table_texts)

    return full_text.strip()

def extract_pdf(file_id: str) -> list[dict]:
    """
    Download a PDF from Drive to a temp file and extract text page by page.
    Uses word-level extraction to capture positioned text like map labels.
    """
    service = build('drive', 'v3', credentials=get_credentials())

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp_path = tmp.name
            request = service.files().get_media(fileId=file_id)
            downloader = MediaIoBaseDownload(tmp, request)

            done = False
            while not done:
                _, done = downloader.next_chunk()

        pages = []

        with pdfplumber.open(tmp_path) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                try:
                    full_text = extract_page_text(page)

                    if full_text:
                        pages.append({
                            'page_number': i,
                            'text': full_text
                        })

                    gc.collect()

                except Exception as e:
                    print(f"  WARNING — skipping page {i}: {e}")
                    continue

        return pages

    except Exception as e:
        print(f"  ERROR extracting PDF: {type(e).__name__}: {e}")
        return []

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        gc.collect()