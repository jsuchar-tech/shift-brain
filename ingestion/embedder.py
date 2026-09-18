import os
import requests
from dotenv import load_dotenv

load_dotenv()

VOYAGE_API_KEY = os.environ['VOYAGE_API_KEY']
EMBEDDING_MODEL = 'voyage-4-large'
BATCH_SIZE = 128
API_URL = 'https://api.voyageai.com/v1/embeddings'
CONNECT_TIMEOUT_SECONDS = 10
READ_TIMEOUT_SECONDS = 60


def embed_chunks(chunks: list[dict]) -> list[dict]:
    """Generate Voyage embeddings in bounded, timeout-protected batches."""
    texts = [chunk['content'] for chunk in chunks]
    all_embeddings = []

    with requests.Session() as session:
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i:i + BATCH_SIZE]
            response = session.post(
                API_URL,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {VOYAGE_API_KEY}'
                },
                json={
                    'input': batch,
                    'model': EMBEDDING_MODEL,
                    'input_type': 'document'
                },
                timeout=(CONNECT_TIMEOUT_SECONDS, READ_TIMEOUT_SECONDS)
            )

            if not response.ok:
                raise RuntimeError(
                    f"Voyage API error: {response.status_code} {response.text[:300]}"
                )

            data = response.json()
            embeddings = [item['embedding'] for item in data['data']]
            all_embeddings.extend(embeddings)
            total_batches = max(1, (len(texts) - 1) // BATCH_SIZE + 1)
            print(f"Embedded batch {i // BATCH_SIZE + 1} / {total_batches}")

    for chunk, embedding in zip(chunks, all_embeddings):
        chunk['embedding'] = embedding

    return chunks
