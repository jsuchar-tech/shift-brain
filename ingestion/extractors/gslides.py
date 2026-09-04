from ingestion.drive_client import get_slides_service

def extract_gslides(file_id: str) -> list[dict]:
    """
    Extract text from a Google Slides presentation.
    Returns a list of slides each with slide_number and text.
    """
    service = get_slides_service()
    presentation = service.presentations().get(
        presentationId=file_id
    ).execute()

    slides = []
    for i, slide in enumerate(presentation.get('slides', []), start=1):
        slide_texts = []

        for element in slide.get('pageElements', []):
            shape = element.get('shape', {})
            text_content = shape.get('text', {})

            for text_element in text_content.get('textElements', []):
                run = text_element.get('textRun', {})
                content = run.get('content', '').strip()
                if content:
                    slide_texts.append(content)

        notes_page = slide.get('slideProperties', {}).get('notesPage', {})
        for element in notes_page.get('pageElements', []):
            shape = element.get('shape', {})
            if shape.get('shapeType') == 'TEXT_BOX':
                for text_element in shape.get('text', {}).get('textElements', []):
                    run = text_element.get('textRun', {})
                    content = run.get('content', '').strip()
                    if content and content != 'Click to edit Master text styles':
                        slide_texts.append(f"[Speaker notes: {content}]")

        if slide_texts:
            slides.append({
                'slide_number': i,
                'text': '\n'.join(slide_texts)
            })

    return slides