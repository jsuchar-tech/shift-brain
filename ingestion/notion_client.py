import os
from collections import deque

from dotenv import load_dotenv
from notion_client import Client

load_dotenv()

NOTION_API_VERSION = os.getenv('NOTION_API_VERSION', '2025-09-03')
PAGE_SIZE = 100

notion = Client(
    auth=os.environ['NOTION_INTEGRATION_TOKEN'],
    notion_version=NOTION_API_VERSION
)


def _paginated(api_method, **params):
    """Yield every result from a cursor-paginated Notion endpoint."""
    cursor = None
    while True:
        request = {**params, 'page_size': PAGE_SIZE}
        if cursor:
            request['start_cursor'] = cursor

        response = api_method(**request)
        yield from response.get('results', [])

        request_status = response.get('request_status', {})
        if request_status.get('type') == 'incomplete':
            reason = request_status.get('incomplete_reason', 'unknown reason')
            print(f"  WARNING — Notion returned an incomplete result set: {reason}")

        if not response.get('has_more'):
            break

        cursor = response.get('next_cursor')
        if not cursor:
            print("  WARNING — Notion reported more results without a next cursor")
            break


def get_block_children(block_id: str) -> list[dict]:
    """Get every direct child of a block, including paginated children."""
    try:
        return list(_paginated(notion.blocks.children.list, block_id=block_id))
    except Exception as error:
        print(f"  WARNING — could not get children of {block_id}: {error}")
        return []


def get_plain_text(rich_text_list: list) -> str:
    """Extract plain text from a Notion rich-text array."""
    return ''.join(item.get('plain_text', '') for item in rich_text_list).strip()


def get_page_title(page: dict) -> str:
    """Extract a page title without assuming the title property's name."""
    for prop_data in page.get('properties', {}).values():
        if prop_data.get('type') == 'title':
            title = get_plain_text(prop_data.get('title', []))
            if title:
                return title
    return 'Untitled'


def get_data_source_title(data_source: dict) -> str:
    """Return the display title of a data source discovered by Search."""
    title = get_plain_text(data_source.get('title', []))
    if title:
        return title
    return data_source.get('name') or 'Untitled database'


def extract_property_value(prop: dict) -> str:
    """Extract readable text from a Notion page property."""
    prop_type = prop.get('type', '')

    if prop_type == 'title':
        return get_plain_text(prop.get('title', []))
    if prop_type == 'rich_text':
        return get_plain_text(prop.get('rich_text', []))
    if prop_type == 'select':
        selected = prop.get('select')
        return selected.get('name', '') if selected else ''
    if prop_type == 'multi_select':
        return ', '.join(item.get('name', '') for item in prop.get('multi_select', []))
    if prop_type == 'date':
        date = prop.get('date')
        if not date:
            return ''
        start = date.get('start', '')
        end = date.get('end', '')
        return f"{start} to {end}" if end else start
    if prop_type == 'number':
        number = prop.get('number')
        return str(number) if number is not None else ''
    if prop_type == 'checkbox':
        return 'Yes' if prop.get('checkbox') else 'No'
    if prop_type == 'url':
        return prop.get('url', '') or ''
    if prop_type == 'email':
        return prop.get('email', '') or ''
    if prop_type == 'phone_number':
        return prop.get('phone_number', '') or ''
    if prop_type == 'people':
        return ', '.join(
            person.get('name', '')
            for person in prop.get('people', [])
            if person.get('name')
        )
    if prop_type == 'relation':
        return ''
    if prop_type == 'formula':
        formula = prop.get('formula', {})
        formula_type = formula.get('type', '')
        if formula_type == 'string':
            return formula.get('string', '') or ''
        if formula_type == 'number':
            number = formula.get('number')
            return str(number) if number is not None else ''
        if formula_type == 'boolean':
            boolean = formula.get('boolean')
            return ('Yes' if boolean else 'No') if boolean is not None else ''
        if formula_type == 'date':
            date = formula.get('date')
            return date.get('start', '') if date else ''
        return ''
    if prop_type == 'status':
        status = prop.get('status')
        return status.get('name', '') if status else ''
    if prop_type == 'files':
        names = []
        for file_item in prop.get('files', []):
            if file_item.get('type') == 'external':
                names.append(
                    file_item.get('name')
                    or file_item.get('external', {}).get('url', '')
                )
            elif file_item.get('type') == 'file':
                names.append(file_item.get('name', 'file'))
        return ', '.join(name for name in names if name)
    if prop_type == 'unique_id':
        unique_id = prop.get('unique_id')
        if not unique_id:
            return ''
        prefix = unique_id.get('prefix') or ''
        number = unique_id.get('number')
        return f"{prefix}{number}" if number is not None else ''
    if prop_type == 'rollup':
        rollup = prop.get('rollup', {})
        rollup_type = rollup.get('type', '')
        if rollup_type == 'number':
            number = rollup.get('number')
            return str(number) if number is not None else ''
        if rollup_type == 'date':
            date = rollup.get('date')
            return date.get('start', '') if date else ''
        if rollup_type == 'array':
            values = [extract_property_value(item) for item in rollup.get('array', [])]
            return ', '.join(value for value in values if value)
        return ''
    if prop_type in {
        'created_time', 'created_by', 'last_edited_time', 'last_edited_by',
        'button', 'verification'
    }:
        return ''

    return ''


def _page_record(
    page: dict,
    data_source_id: str | None = None,
    database_id: str | None = None,
    database_title: str | None = None,
    database_url: str | None = None
) -> dict:
    parent = page.get('parent', {})
    parent_type = parent.get('type')
    resolved_data_source_id = parent.get('data_source_id') or data_source_id
    resolved_database_id = parent.get('database_id') or database_id
    is_database_entry = parent_type in ('database_id', 'data_source_id') or bool(
        resolved_data_source_id or resolved_database_id
    )

    return {
        'id': page['id'],
        'title': get_page_title(page),
        'url': page.get('url', ''),
        'public_url': page.get('public_url'),
        'last_edited_time': page.get('last_edited_time', ''),
        'is_database_entry': is_database_entry,
        'database_id': resolved_database_id,
        'data_source_id': resolved_data_source_id,
        'database_title': database_title,
        'database_url': database_url,
        'properties': page.get('properties', {}) if is_database_entry else {}
    }


def list_all_pages() -> list[dict]:
    """
    Discover all standalone pages and every row in every shared data source.

    Notion Search returns page and data-source objects, but it does not replace
    querying each data source for its rows. The previous implementation filtered
    Search to ``page`` objects only, which omitted full-page databases such as
    SHIFT Brand Colour Codes and could therefore omit all of their entries.
    """
    pages_by_id = {}
    data_sources = deque()
    queued_data_source_ids = set()
    queried_data_source_ids = set()

    try:
        search_results = _paginated(notion.search)
        for result in search_results:
            object_type = result.get('object')
            if object_type == 'page':
                if result.get('in_trash') or result.get('archived'):
                    continue
                pages_by_id[result['id']] = _page_record(result)
            elif object_type == 'data_source':
                data_source_id = result.get('id')
                if data_source_id and data_source_id not in queued_data_source_ids:
                    data_sources.append(result)
                    queued_data_source_ids.add(data_source_id)
    except Exception as error:
        print(f"ERROR — Notion search failed: {error}")
        return []

    while data_sources:
        data_source = data_sources.popleft()
        data_source_id = data_source.get('id')
        if not data_source_id or data_source_id in queried_data_source_ids:
            continue
        queried_data_source_ids.add(data_source_id)

        data_source_title = get_data_source_title(data_source)
        data_source_url = data_source.get('public_url') or data_source.get('url')
        parent = data_source.get('parent', {})
        database_id = parent.get('database_id')
        print(f"Querying Notion data source: {data_source_title}")

        try:
            for result in _paginated(
                notion.data_sources.query,
                data_source_id=data_source_id
            ):
                object_type = result.get('object')
                if object_type == 'page':
                    if result.get('in_trash') or result.get('archived'):
                        continue
                    pages_by_id[result['id']] = _page_record(
                        result,
                        data_source_id=data_source_id,
                        database_id=database_id,
                        database_title=data_source_title,
                        database_url=data_source_url
                    )
                elif object_type == 'data_source':
                    nested_id = result.get('id')
                    if nested_id and nested_id not in queued_data_source_ids:
                        data_sources.append(result)
                        queued_data_source_ids.add(nested_id)
        except Exception as error:
            print(
                f"  WARNING — could not query Notion data source "
                f"'{data_source_title}' ({data_source_id}): {error}. "
                "Confirm the SHIFT Brain integration is connected to this database."
            )

    pages = list(pages_by_id.values())
    database_entries = sum(1 for page in pages if page['is_database_entry'])
    standalone_pages = len(pages) - database_entries
    public_count = sum(1 for page in pages if page.get('public_url'))

    print(f"Found {len(pages)} Notion pages total")
    print(f"  {len(queried_data_source_ids)} data sources queried")
    print(f"  {database_entries} database entries")
    print(f"  {standalone_pages} standalone pages")
    print(f"  {public_count} pages have a public URL available")

    return pages
