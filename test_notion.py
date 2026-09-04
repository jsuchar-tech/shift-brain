"""
Prints the raw 'parent' object for the first ~20 pages the integration
can see, plus the full raw object for one page, so we can see exactly
how Notion's data-sources API (2025+) represents parent relationships
now — instead of guessing.

Usage: python inspect_notion_parents.py
"""
import json
from dotenv import load_dotenv
load_dotenv()

from ingestion.notion_client import notion


def main():
    response = notion.search(filter={'property': 'object', 'value': 'page'})
    results = response.get('results', [])

    print(f"Got {len(results)} pages in first page of results\n")

    parent_type_counts = {}
    for page in results:
        parent = page.get('parent', {})
        ptype = parent.get('type', 'MISSING')
        parent_type_counts[ptype] = parent_type_counts.get(ptype, 0) + 1

    print("Parent type breakdown:")
    for ptype, count in parent_type_counts.items():
        print(f"  {ptype}: {count}")

    print("\nFirst 10 pages — id, parent, title-ish field:")
    for page in results[:10]:
        parent = page.get('parent', {})
        props = page.get('properties', {})
        title_prop = None
        for name, data in props.items():
            if data.get('type') == 'title':
                title_prop = name
                break
        print(f"\n  page id: {page.get('id')}")
        print(f"  parent: {parent}")
        print(f"  title property name: {title_prop}")
        print(f"  all property names: {list(props.keys())}")

    if results:
        print("\n\nFull raw JSON of first result (for reference):")
        print(json.dumps(results[0], indent=2, default=str)[:3000])


if __name__ == '__main__':
    main()