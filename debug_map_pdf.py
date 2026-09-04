import tempfile
import os
from dotenv import load_dotenv
load_dotenv()

from ingestion.drive_client import get_drive_service
from googleapiclient.http import MediaIoBaseDownload
import pdfplumber

service = get_drive_service()

results = service.files().list(
    q="name='SHIFT Member Offer 2025.pdf'",
    fields='files(id, name)'
).execute()

file = results.get('files', [])[0]
print(f"File: {file['name']} — {file['id']}")

with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
    tmp_path = tmp.name
    request = service.files().get_media(fileId=file['id'])
    downloader = MediaIoBaseDownload(tmp, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()

with pdfplumber.open(tmp_path) as pdf:
    for i, page in enumerate(pdf.pages, start=1):
        print(f"\n=== PAGE {i} ===")

        # Standard extraction
        standard = page.extract_text() or ''
        print(f"Standard extract ({len(standard)} chars):")
        print(standard[:500])

        # Word-level extraction — catches overlapping/positioned text
        words = page.extract_words(
            x_tolerance=3,
            y_tolerance=3,
            keep_blank_chars=False,
            use_text_flow=False,
            extra_attrs=['fontname', 'size']
        )
        print(f"\nWord-level extract ({len(words)} words):")
        word_text = ' '.join(w['text'] for w in words)
        print(word_text[:500])

        # Check if map page
        if any(w['text'] in ['Kosovo', 'Bhutan', 'Cambodia', 'Myanmar', 'Philippines'] for w in words):
            print(f"\n*** MAP PAGE FOUND — page {i} ***")
            print("All words on this page:")
            for w in words:
                print(f"  '{w['text']}' at x={w['x0']:.0f} y={w['top']:.0f} font={w.get('fontname','')} size={w.get('size',0):.1f}")

os.unlink(tmp_path)
print("\nDone")