CHUNK_SIZE_CHARS = 2000
CHUNK_OVERLAP_CHARS = 200

def count_tokens(text: str) -> int:
    return len(text) // 4

def chunk_text(
    text: str,
    source_type: str,
    file_id: str,
    file_name: str,
    source_url: str,
    page_number: int = None,
    slide_number: int = None,
    section_header: str = None
) -> list[dict]:
    """
    Split text into overlapping chunks using character count.
    Prepends section_header to every chunk so heading context
    is always present regardless of where the chunk falls.
    """
    text = text.strip()
    if not text:
        return []

    # Prepend section header to the text so it's always in context
    if section_header:
        prefixed_text = f"{section_header}\n\n{text}"
    else:
        prefixed_text = text

    chunks = []
    text_length = len(prefixed_text)
    start = 0
    iteration = 0
    max_iterations = (text_length // CHUNK_SIZE_CHARS) + 10

    while start < text_length:
        iteration += 1
        if iteration > max_iterations:
            print(f"  WARNING — chunker hit safety limit at iteration {iteration}, breaking")
            break

        end = min(start + CHUNK_SIZE_CHARS, text_length)
        chunk_text_str = prefixed_text[start:end].strip()

        if chunk_text_str:
            chunks.append({
                'content': chunk_text_str,
                'source_type': source_type,
                'source_file_id': file_id,
                'source_file_name': file_name,
                'source_url': source_url,
                'page_number': page_number,
                'slide_number': slide_number,
                'section_header': section_header,
                'token_count': count_tokens(chunk_text_str)
            })

        next_start = start + CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS
        if next_start <= start:
            next_start = start + CHUNK_SIZE_CHARS
        start = next_start

    return chunks