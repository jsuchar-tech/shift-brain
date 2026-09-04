import os
import sys
import gc
from dotenv import load_dotenv
from ingestion.drive_client import list_folder_files
from ingestion.notion_client import list_all_pages
from ingestion.storage import get_ingested_files, delete_file_chunks, upsert_chunks
from ingestion.chunker import chunk_text
from ingestion.embedder import embed_chunks
from ingestion.extractors.gdoc import extract_gdoc
from ingestion.extractors.gslides import extract_gslides
from ingestion.extractors.pdf import extract_pdf
from ingestion.extractors.docx import extract_docx
from ingestion.extractors.pptx import extract_pptx
from ingestion.extractors.notion import extract_notion_page

load_dotenv()

FOLDER_ID = os.environ['GOOGLE_DRIVE_FOLDER_ID']

MIME_TYPES = {
    'application/vnd.google-apps.document': 'gdoc',
    'application/vnd.google-apps.presentation': 'gslides',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
}

SKIP_FILES = []
NOTION_SOURCE_TYPE = 'notion'


def process_file(file: dict, source_type: str) -> list[dict]:
    file_id = file['id']
    file_name = file['name']
    source_url = file.get('webViewLink', '')
    chunks = []

    print(f"Processing: {file_name} ({source_type})")

    try:
        if source_type == 'gdoc':
            text = extract_gdoc(file_id)
            if not text or not text.strip():
                print(f"  SKIP — empty text extracted from: {file_name}")
                return []
            chunks = chunk_text(
                text=text,
                source_type=source_type,
                file_id=file_id,
                file_name=file_name,
                source_url=source_url
            )

        elif source_type == 'gslides':
            slides = extract_gslides(file_id)
            if not slides:
                print(f"  SKIP — no slides with text found in: {file_name}")
                return []
            for slide in slides:
                slide_chunks = chunk_text(
                    text=slide['text'],
                    source_type=source_type,
                    file_id=file_id,
                    file_name=file_name,
                    source_url=source_url,
                    slide_number=slide['slide_number']
                )
                chunks.extend(slide_chunks)

        elif source_type == 'pdf':
            pages = extract_pdf(file_id)
            if not pages:
                print(f"  SKIP — no text extracted from PDF (possibly scanned): {file_name}")
                return []
            for page in pages:
                page_chunks = chunk_text(
                    text=page['text'],
                    source_type=source_type,
                    file_id=file_id,
                    file_name=file_name,
                    source_url=source_url,
                    page_number=page['page_number']
                )
                chunks.extend(page_chunks)

        elif source_type == 'docx':
            sections = extract_docx(file_id)
            if not sections:
                print(f"  SKIP — no sections extracted from: {file_name}")
                return []
            for section in sections:
                section_chunks = chunk_text(
                    text=section['text'],
                    source_type=source_type,
                    file_id=file_id,
                    file_name=file_name,
                    source_url=source_url,
                    section_header=section.get('section_header')
                )
                chunks.extend(section_chunks)

        elif source_type == 'pptx':
            slides = extract_pptx(file_id)
            if not slides:
                print(f"  SKIP — no slides with text found in: {file_name}")
                return []
            for slide in slides:
                slide_chunks = chunk_text(
                    text=slide['text'],
                    source_type=source_type,
                    file_id=file_id,
                    file_name=file_name,
                    source_url=source_url,
                    slide_number=slide['slide_number']
                )
                chunks.extend(slide_chunks)

    except Exception as e:
        print(f"  ERROR — {type(e).__name__}: {e} — file: {file_name}")
        import traceback
        traceback.print_exc()
        return []

    chunks = [c for c in chunks if len(c.get('content', '')) >= 80]

    if not chunks:
        print(f"  SKIP — chunker produced 0 chunks from: {file_name}")
        return []

    print(f"  OK — {len(chunks)} chunks from {file_name}")
    return chunks


def run_notion_ingestion(force: bool = False):
    """
    Sync all Notion pages shared with the integration.
    Handles both database entries (Shifter groups) and standalone pages.
    """
    print("\n=== Notion ingestion started ===\n")

    from ingestion.notion_client import list_all_pages
    pages = list_all_pages()

    if not pages:
        print("No Notion pages found. Make sure pages are shared with the integration.")
        return

    ingested = {} if force else get_ingested_files()

    processed = 0
    skipped = 0
    errors = 0
    error_pages = []

    for page in pages:
        page_id = page['id'].replace('-', '')
        page_title = page['title'] or 'Untitled'
        page_url = page['url']
        last_edited = page['last_edited_time']
        is_db_entry = page.get('is_database_entry', False)
        properties = page.get('properties', {})

        if page_title == 'Untitled' and not is_db_entry:
            skipped += 1
            continue

        print(f"Processing: {page_title} ({'db entry' if is_db_entry else 'page'})")

        if not force and page_id in ingested:
            ingested_time = ingested[page_id]
            if ingested_time and ingested_time >= last_edited:
                print(f"  UNCHANGED — skipping: {page_title}")
                skipped += 1
                continue

        if page_id in ingested:
            delete_file_chunks(page_id)

        try:
            sections = extract_notion_page(
                page_id,
                page_title,
                properties=properties if is_db_entry else None
            )
        except Exception as e:
            print(f"  ERROR — {type(e).__name__}: {e}")
            errors += 1
            error_pages.append(page_title)
            continue

        if not sections:
            print(f"  SKIP — no content extracted from: {page_title}")
            skipped += 1
            continue

        chunks = []
        for section in sections:
            section_chunks = chunk_text(
                text=section['text'],
                source_type=NOTION_SOURCE_TYPE,
                file_id=page_id,
                file_name=page_title,
                source_url=page_url,
                section_header=section.get('section_header')
            )
            chunks.extend(section_chunks)

        chunks = [c for c in chunks if len(c.get('content', '')) >= 80]

        if not chunks:
            print(f"  SKIP — chunker produced 0 chunks from: {page_title}")
            skipped += 1
            continue

        print(f"  OK — {len(chunks)} chunks from {page_title}")
        print(f"  Embedding {len(chunks)} chunks...")
        chunks = embed_chunks(chunks)
        print(f"  Embedding complete, upserting...")
        upsert_chunks(chunks, last_edited)
        processed += 1
        gc.collect()

    print(f"\n=== Notion ingestion complete ===")
    print(f"Processed:  {processed} pages")
    print(f"Skipped:    {skipped} pages")
    print(f"Errors:     {errors} pages")

    if error_pages:
        print(f"\nPages that errored:")
        for p in error_pages:
            print(f"  - {p}")

    print(f"================================\n")


def run_ingestion(force: bool = False, file_filter: str = None, type_filter: str = None):
    print("\n=== SHIFT Brain ingestion started ===\n")

    files = list_folder_files(FOLDER_ID)
    if not files:
        print("No files found in Drive folder. Exiting.")
        return

    ingested = {} if force else get_ingested_files()
    print(f"Already ingested: {len(ingested)} files\n")

    processed = 0
    skipped = 0
    errors = 0
    error_files = []

    for file in files:
        file_id = file['id']
        file_name = file['name']
        mime_type = file['mimeType']
        modified_time = file['modifiedTime']
        source_type = MIME_TYPES.get(mime_type)

        if not source_type:
            print(f"  UNSUPPORTED — {mime_type}: {file_name}")
            errors += 1
            error_files.append(f"{file_name} ({mime_type})")
            continue

        if any(skip.lower() in file_name.lower() for skip in SKIP_FILES):
            print(f"  SKIP LIST — manually excluded: {file_name}")
            skipped += 1
            continue

        if type_filter and source_type != type_filter:
            continue

        if file_filter and file_filter not in file_name.lower():
            continue

        if not force and file_id in ingested:
            ingested_time = ingested[file_id]
            if ingested_time and ingested_time >= modified_time:
                print(f"  UNCHANGED — skipping: {file_name}")
                skipped += 1
                continue

        if file_id in ingested:
            delete_file_chunks(file_id)

        chunks = process_file(file, source_type)
        if not chunks:
            errors += 1
            error_files.append(file_name)
            gc.collect()
            continue

        print(f"  Embedding {len(chunks)} chunks...")
        chunks = embed_chunks(chunks)
        print(f"  Embedding complete, upserting...")
        upsert_chunks(chunks, modified_time)
        processed += 1

        del chunks
        gc.collect()

    print(f"\n=== Drive ingestion complete ===")
    print(f"Processed:            {processed} files")
    print(f"Skipped (unchanged):  {skipped} files")
    print(f"Errors/skipped:       {errors} files")

    if error_files:
        print(f"\nFiles that produced no chunks:")
        for f in error_files:
            print(f"  - {f}")

    print(f"================================\n")


if __name__ == '__main__':
    force = '--force' in sys.argv
    notion_only = '--notion' in sys.argv
    drive_only = '--drive' in sys.argv
    file_filter = None
    type_filter = None

    for arg in sys.argv:
        if arg.startswith('--file='):
            file_filter = arg.split('=', 1)[1].lower()
        if arg.startswith('--type='):
            type_filter = arg.split('=', 1)[1].lower()

    if force:
        print("Force mode — re-ingesting all files")
    if file_filter:
        print(f"File filter: only processing files matching '{file_filter}'")
    if type_filter:
        print(f"Type filter: only processing {type_filter} files")

    if notion_only:
        run_notion_ingestion(force=force)
    elif drive_only:
        run_ingestion(force=force, file_filter=file_filter, type_filter=type_filter)
    else:
        run_ingestion(force=force, file_filter=file_filter, type_filter=type_filter)
        run_notion_ingestion(force=force)