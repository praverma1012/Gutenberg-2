import { useState, useEffect, useCallback, useRef } from 'react';

const GENRES = [
  { key: 'all', label: 'All Genres' },
  { key: 'Fiction', label: 'Fiction' },
  { key: 'Adventure', label: 'Adventure' },
  { key: 'Romance', label: 'Romance' },
  { key: 'Mystery', label: 'Mystery' },
  { key: 'Science Fiction', label: 'Science Fiction' },
  { key: 'Horror', label: 'Horror' },
  { key: 'Poetry', label: 'Poetry' },
  { key: 'Drama', label: 'Drama' },
  { key: 'History', label: 'History' },
  { key: 'Philosophy', label: 'Philosophy' },
  { key: 'Children', label: 'Children' },
  { key: 'Humor', label: 'Humor' },
];

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export { GENRES, ALPHABET };

export function useGutenberg() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const abortRef = useRef(null);

  const fetchBooks = useCallback(async (pageNum = 1, reset = false) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ page: pageNum });

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      if (selectedGenre && selectedGenre !== 'all') {
        params.set('topic', selectedGenre);
      }

      params.set('mime_type', 'text/plain');

      const resp = await fetch(`/api/gutenberg/books?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await resp.json();

      let results = data.results || [];

      // Client-side filter by author last name letter
      if (selectedLetter) {
        results = results.filter(book => {
          const authors = book.authors || [];
          return authors.some(a => {
            const lastName = a.name.split(',')[0].trim();
            if (selectedLetter === '#') {
              return !/^[A-Za-z]/.test(lastName);
            }
            return lastName.toUpperCase().startsWith(selectedLetter);
          });
        });
      }

      setTotalCount(data.count || 0);
      setHasMore(!!data.next);

      if (reset) {
        setBooks(results);
      } else {
        setBooks(prev => [...prev, ...results]);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Failed to load books. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedGenre, selectedLetter, searchQuery]);

  useEffect(() => {
    setPage(1);
    fetchBooks(1, true);
  }, [selectedGenre, selectedLetter, searchQuery]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchBooks(nextPage, false);
    }
  }, [loading, hasMore, page, fetchBooks]);

  return {
    books,
    loading,
    error,
    hasMore,
    totalCount,
    loadMore,
    selectedGenre,
    setSelectedGenre,
    selectedLetter,
    setSelectedLetter,
    searchQuery,
    setSearchQuery,
  };
}

export function useBookText(bookId) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!bookId) return;
    setLoading(true);

    fetch(`/api/gutenberg/text/${bookId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load book');
        return res.text();
      })
      .then(rawText => {
        // Strip Gutenberg header/footer
        let cleaned = rawText;
        const startMarkers = ['*** START OF THE PROJECT GUTENBERG', '*** START OF THIS PROJECT GUTENBERG', '***START OF THE PROJECT GUTENBERG', '***START OF THIS PROJECT GUTENBERG'];
        const endMarkers = ['*** END OF THE PROJECT GUTENBERG', '*** END OF THIS PROJECT GUTENBERG', '***END OF THE PROJECT GUTENBERG', '***END OF THIS PROJECT GUTENBERG', 'End of the Project Gutenberg', 'End of Project Gutenberg'];

        for (const marker of startMarkers) {
          const idx = cleaned.indexOf(marker);
          if (idx !== -1) {
            const nextLine = cleaned.indexOf('\n', idx);
            cleaned = cleaned.substring(nextLine + 1);
            break;
          }
        }

        for (const marker of endMarkers) {
          const idx = cleaned.indexOf(marker);
          if (idx !== -1) {
            cleaned = cleaned.substring(0, idx);
            break;
          }
        }

        setText(cleaned.trim());
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [bookId]);

  return { text, loading, error };
}

export function useBookCover(bookId, title, author) {
  const [cover, setCover] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookId) return;
    const params = new URLSearchParams({ title: title || '', author: author || '' });
    fetch(`/api/cover/${bookId}?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setCover(data.image);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [bookId, title, author]);

  return { cover, loading };
}

export function useBookSummary(bookId, title, author) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(() => {
    if (!bookId) return;
    setLoading(true);
    const params = new URLSearchParams({ title: title || '', author: author || '' });
    fetch(`/api/summary/${bookId}?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setSummary(data.summary);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [bookId, title, author]);

  return { summary, loading, fetchSummary };
}
