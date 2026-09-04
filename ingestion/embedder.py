import os
import requests
from dotenv import load_dotenv

load_dotenv()

VOYAGE_API_KEY = os.environ['VOYAGE_API_KEY']
EMBEDDING_MODEL = 'voyage-4-large'
BATCH_SIZE = 128
API_URL = 'https://api.voyageai.com/v1/embeddings'

def embed_chunks(chunks: list[dict]) -> list[dict]:
    """
    Generate embeddings via Voyage AI REST API directly.
    Processes in batches to respect API limits.
    """
    texts = [chunk['content'] for chunk in chunks]
    all_embeddings = []

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]

        response = requests.post(
            API_URL,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {VOYAGE_API_KEY}'
            },
            json={
                'input': batch,
                'model': EMBEDDING_MODEL,
                'input_type': 'document'
            }
        )

        if not response.ok:
            raise Exception(f"Voyage API error: {response.status_code} {response.text}")

        data = response.json()
        embeddings = [item['embedding'] for item in data['data']]
        all_embeddings.extend(embeddings)
        print(f"Embedded batch {i // BATCH_SIZE + 1} / {max(1, (len(texts) - 1) // BATCH_SIZE + 1)}")

    for chunk, embedding in zip(chunks, all_embeddings):
        chunk['embedding'] = embedding

    return chunks