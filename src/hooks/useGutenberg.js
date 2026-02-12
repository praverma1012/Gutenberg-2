import { useState, useEffect, useCallback, useRef } from 'react';
import { generateBookCover, getCachedCover } from '../lib/covers.js';
import { generateSummary, getCachedSummary } from '../lib/summary.js';

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

const GUTENDEX_URL = 'https://gutendex.com/books';

// Detect if running as a static site (GitHub Pages) vs with backend server
const isStaticDeploy = !window.location.hostname.includes('localhost') &&
  !window.location.hostname.includes('127.0.0.1');

// CORS proxy for fetching Gutenberg text files from static deployments
const CORS_PROXY = 'https://corsproxy.io/?url=';

function proxyUrl(url) {
  return isStaticDeploy ? `${CORS_PROXY}${encodeURIComponent(url)}` : url;
}

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

      const resp = await fetch(`${GUTENDEX_URL}?${params.toString()}`, {
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

const GUTENBERG_TEXT_URLS = (id) => [
  `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
  `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
  `https://www.gutenberg.org/files/${id}/${id}.txt`,
];

export function useBookText(bookId) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!bookId) return;
    setLoading(true);

    async function fetchText() {
      const urls = GUTENBERG_TEXT_URLS(bookId);
      for (const url of urls) {
        try {
          const res = await fetch(proxyUrl(url));
          if (res.ok) {
            const rawText = await res.text();
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
            return;
          }
        } catch (e) {
          // try next URL
        }
      }
      setError('Could not load book text. The book may not be available in plain text format.');
      setLoading(false);
    }

    fetchText();
  }, [bookId]);

  return { text, loading, error };
}

export function useBookCover(bookId, title, author) {
  const [cover, setCover] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookId) return;
    // Check cache first, then generate
    const cached = getCachedCover(bookId);
    if (cached) {
      setCover(cached);
      setLoading(false);
      return;
    }
    const image = generateBookCover(title || 'Untitled', author || 'Unknown', bookId);
    setCover(image);
    setLoading(false);
  }, [bookId, title, author]);

  return { cover, loading };
}

export function useBookSummary(bookId, title, author) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    if (!bookId) return;

    // Check cache
    const cached = getCachedSummary(bookId);
    if (cached) {
      setSummary(cached);
      return;
    }

    setLoading(true);

    try {
      const urls = GUTENBERG_TEXT_URLS(bookId);
      let text = '';

      for (const url of urls) {
        try {
          const res = await fetch(proxyUrl(url));
          if (res.ok) {
            text = await res.text();
            break;
          }
        } catch (e) {}
      }

      const result = generateSummary(text, title || 'Untitled', author || 'Unknown', bookId);
      setSummary(result);
    } catch (e) {
      setSummary(`"${title}" by ${author} is a classic work from Project Gutenberg.`);
    } finally {
      setLoading(false);
    }
  }, [bookId, title, author]);

  return { summary, loading, fetchSummary };
}
