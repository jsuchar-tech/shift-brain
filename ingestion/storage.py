import os
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

supabase = create_client(
    os.environ['SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY']
)

def get_ingested_files() -> dict[str, str]:
    """
    Returns dict of {file_id: file_modified_time}
    for all files currently in the database.
    """
    response = supabase.table('document_chunks') \
        .select('source_file_id, file_modified_time') \
        .execute()

    ingested = {}
    for row in response.data:
        file_id = row['source_file_id']
        mod_time = row['file_modified_time']
        if file_id not in ingested:
            ingested[file_id] = mod_time

    return ingested

def delete_file_chunks(file_id: str):
    """Delete all chunks for a file before re-ingesting."""
    supabase.table('document_chunks') \
        .delete() \
        .eq('source_file_id', file_id) \
        .execute()
    print(f"Deleted existing chunks for: {file_id}")

def upsert_chunks(chunks: list[dict], file_modified_time: str):
    """
    Insert chunks into pgvector.
    """
    rows = []
    for chunk in chunks:
        rows.append({
            'content': chunk['content'],
            'embedding': chunk['embedding'],
            'source_type': chunk['source_type'],
            'source_file_id': chunk['source_file_id'],
            'source_file_name': chunk['source_file_name'],
            'source_url': chunk.get('source_url'),
            'page_number': chunk.get('page_number'),
            'slide_number': chunk.get('slide_number'),
            'section_header': chunk.get('section_header'),
            'file_modified_time': file_modified_time,
            'last_ingested_at': datetime.now(timezone.utc).isoformat()
        })

    for i in range(0, len(rows), 50):
        batch = rows[i:i + 50]
        supabase.table('document_chunks').insert(batch).execute()

    print(f"Inserted {len(rows)} chunks")