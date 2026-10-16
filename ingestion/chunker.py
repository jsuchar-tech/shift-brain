import re

TARGET_CHUNK_CHARS = 1600
MAX_CHUNK_CHARS = 2200
CHUNK_OVERLAP_CHARS = 260


def count_tokens(text: str) -> int:
    return len(text) // 4


def _split_long_unit(text: str) -> list[str]:
    """Split oversized paragraphs without cutting ordinary sentences."""
    if len(text) <= MAX_CHUNK_CHARS:
        return [text]

    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9“"\'])', text)
    units = []
    current = ''
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if len(sentence) > MAX_CHUNK_CHARS:
            if current:
                units.append(current)
                current = ''
            start = 0
            while start < len(sentence):
                end = min(start + MAX_CHUNK_CHARS, len(sentence))
                if end < len(sentence):
                    boundary = sentence.rfind(' ', start, end)
                    if boundary > start + (MAX_CHUNK_CHARS // 2):
                        end = boundary
                units.append(sentence[start:end].strip())
                start = end
            continue

        candidate = f'{current} {sentence}'.strip()
        if current and len(candidate) > MAX_CHUNK_CHARS:
            units.append(current)
            current = sentence
        else:
            current = candidate
    if current:
        units.append(current)
    return units


def _semantic_units(text: str) -> list[str]:
    normalized = text.replace('\r\n', '\n').replace('\r', '\n').strip()
    paragraphs = [part.strip() for part in re.split(r'\n\s*\n', normalized) if part.strip()]
    units = []
    for paragraph in paragraphs:
        # Preserve line-oriented tables and lists as a unit whenever possible.
        cleaned = '\n'.join(line.rstrip() for line in paragraph.splitlines()).strip()
        units.extend(_split_long_unit(cleaned))
    return units


def _body_chunks(text: str) -> list[str]:
    units = _semantic_units(text)
    if not units:
        return []

    chunks = []
    current = []
    current_length = 0

    for unit in units:
        separator = 2 if current else 0
        if current and current_length + separator + len(unit) > TARGET_CHUNK_CHARS:
            chunks.append('\n\n'.join(current))

            overlap = []
            overlap_length = 0
            for previous in reversed(current):
                added = len(previous) + (2 if overlap else 0)
                if overlap and overlap_length + added > CHUNK_OVERLAP_CHARS:
                    break
                overlap.insert(0, previous)
                overlap_length += added
                if overlap_length >= CHUNK_OVERLAP_CHARS:
                    break
            current = overlap
            current_length = overlap_length

        separator = 2 if current else 0
        if current and current_length + separator + len(unit) > MAX_CHUNK_CHARS:
            chunks.append('\n\n'.join(current))
            current = []
            current_length = 0
            separator = 0

        current.append(unit)
        current_length += separator + len(unit)

    if current:
        final = '\n\n'.join(current)
        if not chunks or final != chunks[-1]:
            chunks.append(final)
    return chunks


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
    """Create boundary-aware chunks with source identity on every embedding."""
    text = str(text or '').strip()
    if not text:
        return []

    labels = []
    for label in (file_name, section_header):
        cleaned = str(label or '').strip()
        if cleaned and cleaned.casefold() not in {item.casefold() for item in labels}:
            labels.append(cleaned)
    context_prefix = '\n'.join(labels)

    chunks = []
    for chunk_index, body in enumerate(_body_chunks(text)):
        content = f'{context_prefix}\n\n{body}' if context_prefix else body
        chunks.append({
            'content': content.strip(),
            'source_type': source_type,
            'source_file_id': file_id,
            'source_file_name': file_name,
            'source_url': source_url,
            'page_number': page_number,
            'slide_number': slide_number,
            'section_header': section_header,
            'chunk_index': chunk_index,
            'token_count': count_tokens(content)
        })

    return chunks
