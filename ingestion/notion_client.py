import os
from notion_client import Client
from dotenv import load_dotenv

load_dotenv()

notion = Client(auth=os.environ['NOTION_INTEGRATION_TOKEN'])


def get_block_children(block_id: str) -> list[dict]:
    """Get all children of a block with pagination."""
    children = []
    try:
        response = notion.blocks.children.list(block_id=block_id)
        children.extend(response.get('results', []))
        while response.get('has_more'):
            response = notion.blocks.children.list(
                block_id=block_id,
                start_cursor=response['next_cursor']
            )
            children.extend(response.get('results', []))
    except Exception as e:
        print(f"  WARNING — could not get children of {block_id}: {e}")
    return children


def get_page_title(page: dict) -> str:
    """
    Extract title from a Notion page object by finding the property
    with type == 'title' (every page/database entry has exactly one,
    but its NAME varies per database — e.g. 'Name', 'What is it?',
    'Youth Group Name' — so detection is by type, not by name).
    """
    props = page.get('properties', {})
    for prop_data in props.values():
        if prop_data.get('type') == 'title':
            rich_text = prop_data.get('title', [])
            if rich_text:
                return ''.join(t.get('plain_text', '') for t in rich_text)
    return 'Untitled'


def get_plain_text(rich_text_list: list) -> str:
    """Extract plain text from Notion rich text array."""
    return ''.join(t.get('plain_text', '') for t in rich_text_list).strip()


def extract_property_value(prop: dict) -> str:
    """Extract readable text from any Notion property type."""
    prop_type = prop.get('type', '')

    if prop_type == 'title':
        return get_plain_text(prop.get('title', []))
    elif prop_type == 'rich_text':
        return get_plain_text(prop.get('rich_text', []))
    elif prop_type == 'select':
        sel = prop.get('select')
        return sel.get('name', '') if sel else ''
    elif prop_type == 'multi_select':
        return ', '.join(s.get('name', '') for s in prop.get('multi_select', []))
    elif prop_type == 'date':
        date = prop.get('date')
        if date:
            start = date.get('start', '')
            end = date.get('end', '')
            return f"{start} to {end}" if end else start
        return ''
    elif prop_type == 'number':
        num = prop.get('number')
        return str(num) if num is not None else ''
    elif prop_type == 'checkbox':
        return 'Yes' if prop.get('checkbox') else 'No'
    elif prop_type == 'url':
        return prop.get('url', '') or ''
    elif prop_type == 'email':
        return prop.get('email', '') or ''
    elif prop_type == 'phone_number':
        return prop.get('phone_number', '') or ''
    elif prop_type == 'people':
        people = prop.get('people', [])
        return ', '.join(p.get('name', '') for p in people if p.get('name'))
    elif prop_type == 'relation':
        # Related page IDs only — not resolvable to text without a
        # follow-up API call per related page. The caller (extract_
        # database_entry) logs when this drops non-trivial content.
        return ''
    elif prop_type == 'formula':
        formula = prop.get('formula', {})
        ftype = formula.get('type', '')
        if ftype == 'string':
            return formula.get('string', '') or ''
        elif ftype == 'number':
            n = formula.get('number')
            return str(n) if n is not None else ''
        elif ftype == 'boolean':
            b = formula.get('boolean')
            return ('Yes' if b else 'No') if b is not None else ''
        elif ftype == 'date':
            d = formula.get('date')
            return d.get('start', '') if d else ''
        return ''
    elif prop_type == 'status':
        status = prop.get('status')
        return status.get('name', '') if status else ''
    elif prop_type == 'files':
        files = prop.get('files', [])
        names = []
        for f in files:
            if f.get('type') == 'external':
                names.append(f.get('name') or f.get('external', {}).get('url', ''))
            elif f.get('type') == 'file':
                names.append(f.get('name', 'file'))
        return ', '.join(n for n in names if n)
    elif prop_type == 'unique_id':
        uid = prop.get('unique_id')
        if uid:
            prefix = uid.get('prefix') or ''
            number = uid.get('number')
            return f"{prefix}{number}" if number is not None else ''
        return ''
    elif prop_type == 'rollup':
        rollup = prop.get('rollup', {})
        rtype = rollup.get('type', '')
        if rtype == 'number':
            n = rollup.get('number')
            return str(n) if n is not None else ''
        elif rtype == 'date':
            d = rollup.get('date')
            return d.get('start', '') if d else ''
        elif rtype == 'array':
            items = rollup.get('array', [])
            values = [extract_property_value(item) for item in items]
            return ', '.join(v for v in values if v)
        return ''
    elif prop_type in ('created_time', 'created_by', 'last_edited_time',
                        'last_edited_by', 'button', 'verification'):
        return ''

    return ''


def list_all_pages() -> list[dict]:
    """
    List all pages shared with this integration.
    Returns list of page dicts with id, title, url, public_url,
    last_edited_time, is_database_entry.

    Notion's 2025+ API represents database rows with parent.type ==
    'data_source_id' (introduced for multi-source databases), not
    the older 'database_id'. Both are treated as database entries
    here. In either case parent['database_id'] is present directly,
    so no extra lookup is needed to find which database an entry
    belongs to.

    `public_url` is only populated when a page has been explicitly
    shared publicly via Notion's "Share to web" toggle — otherwise
    it's None and only the workspace `url` is available (which
    requires access to the Notion workspace to resolve). Callers
    should prefer `public_url` when present so citations shown to
    end users don't link to pages they can't actually open.
    """
    pages = []
    visited = set()

    has_more = True
    cursor = None

    while has_more:
        params = {'filter': {'property': 'object', 'value': 'page'}}
        if cursor:
            params['start_cursor'] = cursor

        response = notion.search(**params)
        results = response.get('results', [])

        for page in results:
            page_id = page['id']
            if page_id in visited:
                continue
            visited.add(page_id)

            title = get_page_title(page)
            parent = page.get('parent', {})
            ptype = parent.get('type')
            is_database_entry = ptype in ('database_id', 'data_source_id')

            pages.append({
                'id': page_id,
                'title': title,
                'url': page.get('url', ''),
                'public_url': page.get('public_url'),
                'last_edited_time': page.get('last_edited_time', ''),
                'is_database_entry': is_database_entry,
                'database_id': parent.get('database_id') if is_database_entry else None,
                'properties': page.get('properties', {}) if is_database_entry else {}
            })

        has_more = response.get('has_more', False)
        cursor = response.get('next_cursor')

    print(f"Found {len(pages)} Notion pages total")
    db_entries = sum(1 for p in pages if p['is_database_entry'])
    standalone = len(pages) - db_entries
    public_count = sum(1 for p in pages if p.get('public_url'))
    print(f"  {db_entries} database entries")
    print(f"  {standalone} standalone pages")
    print(f"  {public_count} pages have a public URL available")

    return pages