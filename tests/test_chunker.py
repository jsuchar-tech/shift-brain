import unittest

from ingestion.chunker import MAX_CHUNK_CHARS, chunk_text


class ChunkerQualityTests(unittest.TestCase):
    def test_source_identity_is_repeated_on_every_chunk(self):
        text = '\n\n'.join(f'Paragraph {index}. ' + ('Evidence ' * 80) for index in range(8))
        chunks = chunk_text(text, 'notion', 'file-1', 'Myanmar Campaign', 'https://example.com')
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(chunk['content'].startswith('Myanmar Campaign\n\n') for chunk in chunks))

    def test_chunk_indexes_are_stable_and_sequential(self):
        text = '\n\n'.join(('A complete paragraph. ' * 60) for _ in range(5))
        chunks = chunk_text(text, 'gdoc', 'file-2', 'Guide', 'https://example.com')
        self.assertEqual([chunk['chunk_index'] for chunk in chunks], list(range(len(chunks))))

    def test_chunks_are_bounded_without_cutting_normal_paragraphs(self):
        paragraphs = [('Sentence one. Sentence two. ' * 30).strip() for _ in range(6)]
        chunks = chunk_text('\n\n'.join(paragraphs), 'gdoc', 'file-3', 'Guide', '')
        prefix_length = len('Guide\n\n')
        self.assertTrue(all(len(chunk['content']) <= MAX_CHUNK_CHARS + prefix_length for chunk in chunks))
        self.assertTrue(all('Sentence' in chunk['content'] for chunk in chunks))


if __name__ == '__main__':
    unittest.main()
