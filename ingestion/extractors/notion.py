from ingestion.notion_client import (
    get_block_children,
    get_plain_text,
    extract_property_value,
    notion
)

# Property TYPES that are always administrative metadata, regardless
# of which database they're in or what they're named. This is what
# makes extraction work across differently-shaped databases without
# a hand-curated list per database.
METADATA_PROPERTY_TYPES = {
    'created_time', 'created_by', 'last_edited_time', 'last_edited_by',
    'button', 'verification'
}

# Small, optional denylist for fields that ARE content-typed but you
# still don't want in the RAG corpus (internal workflow flags, review
# statuses, etc). Keep this short — type-based filtering above does
# most of the work now. Tune based on diagnose_notion_properties.py output.
SKIP_PROPERTY_NAMES = {
    'Custom tags', 'Temp: Quality check', '✅ Database Status',
    '🟡 Evolution Type', '🟡 Evolution Scorecard Link',
}

# Optional nicer display labels — falls back to the raw property name
# if not listed, so this no longer needs to be exhaustive or kept in
# sync with every database's schema.
PROPERTY_LABELS = {
    'Youth Group Name': 'Youth Group',
    '➊ Country': 'Country',
    '➊ Region': 'Region',
    '➊ Year': 'Year',
    '➊ Shifters Year': 'Shifters Year',
    '➊ Shift Journey (Status)': 'Journey Status',
    '➋ Campaign Title': 'Campaign Title',
    '➌ Campaign Title': 'Campaign Title',
    '➋ Campaign Dates': 'Campaign Dates',
    '➋ Campaign Duration (In days)': 'Campaign Duration',
    '➋ Campaign location': 'Campaign Location',
    '➋ Official Category': 'Campaign Category',
    '➋ Sub-categories': 'Sub-categories',
    '➐ About the youth group': 'About the Group',
    '➒ Fun Adults': 'Fun Adults',
    "➒ Fun Adults' email address": 'Fun Adults Email',
    '➌ Right-Sized Problem': 'Problem Statement',
    '➌ Our Brighter Future': 'Vision',
    '➏ Campaign Reach': 'Campaign Reach',
    '➏ Offline engagement': 'Offline Engagement',
    '➏ Online reach': 'Online Reach',
    '➏ Partnerships': 'Partnerships',
    '➏ Partnership(s) formed': 'Partnerships Formed',
    '➏ Decision makers engaged': 'Decision Makers Engaged',
    "➏ Campaign's success story": 'Success Story',
    '➑ # Members in PLAN': 'Members in PLAN',
    '➑ # Members in ACTIVATE': 'Members in ACTIVATE',
    '➑ Age Range': 'Age Range',
    '⭐ Milestones': 'Milestones',
    '➒ Budget': 'Budget',
    "➓ Creative Buddies' Name": 'Creative Buddies',
    '➐ Online links': 'Online Links',
    "What's unique?": 'What Makes This Group Unique',
    '➏ In the news': 'In the News',
}


def extract_database_entry(page_id: str, page_title: str, properties: dict) -> list[dict]:
    """
    Extract a database entry as structured text.
    Skips properties by TYPE (metadata) first, then by a short
    optional name list, then includes everything else with a
    non-empty extracted value — regardless of which database it
    came from or what its properties are called.
    """
    lines = [f"{page_title}"]
    relations_dropped = []

    for prop_name, prop_data in properties.items():
        prop_type = prop_data.get('type', '')

        if prop_type in METADATA_PROPERTY_TYPES:
            continue
        if prop_name in SKIP_PROPERTY_NAMES:
            continue
        if prop_type == 'relation':
            rel_count = len(prop_data.get('relation', []))
            if rel_count:
                relations_dropped.append(f"{prop_name} ({rel_count} linked)")
            continue

        value = extract_property_value(prop_data)
        if not value or not value.strip():
            continue

        label = PROPERTY_LABELS.get(prop_name, prop_name)
        lines.append(f"{label}: {value}")

    if relations_dropped:
        print(f"  NOTE — {page_title}: relation properties not extracted "
              f"(would need follow-up API calls to resolve): {', '.join(relations_dropped)}")

    if len(lines) <= 1:
        print(f"  SKIP — no content extracted from: {page_title} "
              f"(had {len(properties)} properties, all metadata/empty/skipped)")
        return []

    text = '\n'.join(lines)
    return [{
        'section_header': page_title,
        'text': text
    }]


def extract_notion_page(page_id: str, page_title: str, properties: dict = None) -> list[dict]:
    """
    Extract content from a Notion page.

    Database entries can have BOTH structured properties (Select,
    Multi-select, etc) AND a full document body underneath them —
    Notion doesn't treat these as mutually exclusive, so neither
    should we. A database row that's really a document (title +
    properties + a full report written in the page body, as seen in
    this workspace) needs both extracted and combined, or the body
    — usually the actual substantive content — gets silently dropped
    and only the metadata survives.
    """
    sections = []

    if properties:
        sections.extend(extract_database_entry(page_id, page_title, properties))

    body_sections = extract_page_blocks(page_id, page_title)
    sections.extend(body_sections)

    return sections


def extract_page_blocks(page_id: str, page_title: str) -> list[dict]:
    """
    Extract text content from a standalone Notion page by reading blocks.
    """
    sections = []
    current_heading = page_title
    current_texts = []

    def flush_section():
        if current_texts:
            sections.append({
                'section_header': current_heading,
                'text': '\n'.join(current_texts)
            })

    def process_block(block: dict, depth: int = 0):
        nonlocal current_heading, current_texts
        block_type = block.get('type', '')
        block_data = block.get(block_type, {})

        if block_type in ('heading_1', 'heading_2', 'heading_3'):
            flush_section()
            current_heading = get_plain_text(block_data.get('rich_text', []))
            current_texts = []

        elif block_type == 'paragraph':
            text = get_plain_text(block_data.get('rich_text', []))
            if text:
                current_texts.append(text)

        elif block_type in ('bulleted_list_item', 'numbered_list_item'):
            text = get_plain_text(block_data.get('rich_text', []))
            if text:
                prefix = '• ' if block_type == 'bulleted_list_item' else '- '
                current_texts.append(f"{prefix}{text}")

        elif block_type == 'toggle':
            text = get_plain_text(block_data.get('rich_text', []))
            if text:
                current_texts.append(text)

        elif block_type == 'callout':
            text = get_plain_text(block_data.get('rich_text', []))
            if text:
                current_texts.append(f"[Note: {text}]")

        elif block_type == 'quote':
            text = get_plain_text(block_data.get('rich_text', []))
            if text:
                current_texts.append(f'"{text}"')

        elif block_type == 'table':
            table_rows = []
            children = get_block_children(block['id'])
            for row_block in children:
                if row_block.get('type') == 'table_row':
                    cells = row_block.get('table_row', {}).get('cells', [])
                    row_texts = [get_plain_text(cell) for cell in cells]
                    cleaned = [t for t in row_texts if t]
                    if cleaned:
                        table_rows.append(' | '.join(cleaned))
            if table_rows:
                current_texts.append('\n'.join(table_rows))

        elif block_type in ('column_list', 'column'):
            children = get_block_children(block['id'])
            for child in children:
                process_block(child, depth + 1)

        elif block_type == 'divider':
            flush_section()
            current_texts = []

        elif block_type in ('image', 'video', 'file', 'pdf', 'embed',
                             'bookmark', 'link_preview', 'unsupported',
                             'child_page', 'child_database'):
            pass

        if block_type in ('toggle', 'bulleted_list_item', 'numbered_list_item',
                           'callout', 'quote') and block.get('has_children'):
            try:
                children = get_block_children(block['id'])
                for child in children:
                    process_block(child, depth + 1)
            except Exception as e:
                print(f"  WARNING — child block error: {e}")

    try:
        blocks = get_block_children(page_id)
        for block in blocks:
            process_block(block)
        flush_section()
    except Exception as e:
        print(f"  ERROR extracting page blocks {page_id}: {e}")

    return sections