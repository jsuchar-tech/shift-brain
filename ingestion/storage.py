import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.environ['SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY']
)


def get_ingested_files() -> dict[str, str]:
    """Return {source_file_id: file_modified_time} for ingested sources."""
    response = supabase.table('document_chunks') \
        .select('source_file_id, file_modified_time') \
        .execute()

    ingested = {}
    for row in response.data:
        file_id = row['source_file_id']
        if file_id not in ingested:
            ingested[file_id] = row['file_modified_time']
    return ingested


def delete_file_chunks(file_id: str):
    """Delete all chunks for a file before re-ingesting."""
    supabase.table('document_chunks').delete() \
        .eq('source_file_id', file_id).execute()
    print(f'Deleted existing chunks for: {file_id}')


def upsert_chunks(chunks: list[dict], file_modified_time: str):
    """Insert embedded chunks in bounded batches."""
    ingested_at = datetime.now(timezone.utc).isoformat()
    rows = [{
        'content': chunk['content'],
        'embedding': chunk['embedding'],
        'source_type': chunk['source_type'],
        'source_file_id': chunk['source_file_id'],
        'source_file_name': chunk['source_file_name'],
        'source_url': chunk.get('source_url'),
        'page_number': chunk.get('page_number'),
        'slide_number': chunk.get('slide_number'),
        'section_header': chunk.get('section_header'),
        'chunk_index': chunk.get('chunk_index'),
        'file_modified_time': file_modified_time,
        'last_ingested_at': ingested_at
    } for chunk in chunks]

    for start in range(0, len(rows), 50):
        supabase.table('document_chunks').insert(rows[start:start + 50]).execute()
    print(f'Inserted {len(rows)} chunks')
