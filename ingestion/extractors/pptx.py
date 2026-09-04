import os
import gc
import tempfile
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from ingestion.drive_client import get_credentials
from pptx import Presentation
from pptx.util import Pt

def extract_pptx(file_id: str) -> list[dict]:
    """
    Download a .pptx from Drive to a temp file and extract text slide by slide.
    Combines slide title with body content for better chunk context.
    Skips slides with insufficient content.
    """
    service = build('drive', 'v3', credentials=get_credentials())

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.pptx', delete=False) as tmp:
            tmp_path = tmp.name
            request = service.files().get_media(fileId=file_id)
            downloader = MediaIoBaseDownload(tmp, request)

            done = False
            while not done:
                _, done = downloader.next_chunk()

        prs = Presentation(tmp_path)
        slides = []

        for i, slide in enumerate(prs.slides, start=1):
            try:
                title_texts = []
                body_texts = []

                for shape in slide.shapes:
                    try:
                        if not hasattr(shape, 'text') or not shape.text.strip():
                            continue

                        text = shape.text.strip()

                        # Detect title shapes
                        is_title = False
                        if shape.shape_type == 13:  # Title shape type
                            is_title = True
                        elif hasattr(shape, 'text_frame'):
                            for para in shape.text_frame.paragraphs:
                                if para.runs:
                                    for run in para.runs:
                                        try:
                                            if run.font.size and run.font.size >= Pt(24):
                                                is_title = True
                                        except Exception:
                                            pass

                        if is_title:
                            title_texts.append(text)
                        else:
                            body_texts.append(text)

                    except Exception:
                        continue

                # Speaker notes
                try:
                    if slide.has_notes_slide:
                        notes = slide.notes_slide.notes_text_frame.text.strip()
                        if notes:
                            body_texts.append(f"[Notes: {notes}]")
                except Exception:
                    pass

                # Combine title + body into one coherent chunk
                all_parts = []
                if title_texts:
                    all_parts.append(' | '.join(title_texts))
                if body_texts:
                    all_parts.extend(body_texts)

                combined = '\n'.join(all_parts).strip()

                # Skip slides with insufficient content
                if len(combined) < 80:
                    continue

                slides.append({
                    'slide_number': i,
                    'text': combined
                })

                gc.collect()

            except Exception as e:
                print(f"  WARNING — skipping slide {i}: {e}")
                continue

        return slides

    except Exception as e:
        print(f"  ERROR extracting pptx: {type(e).__name__}: {e}")
        return []

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        gc.collect()