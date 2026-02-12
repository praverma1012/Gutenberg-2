import React, { useRef, useCallback, useState } from 'react';
import { useGutenberg, GENRES, ALPHABET } from '../hooks/useGutenberg.js';
import BookCard from '../components/BookCard.jsx';
import './Storefront.css';

export default function Storefront() {
  const {
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
  } = useGutenberg();

  const [searchInput, setSearchInput] = useState('');
  const observerRef = useRef();

  // Infinite scroll observer
  const lastBookRef = useCallback(
    (node) => {
      if (loading) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [loading, hasMore, loadMore]
  );

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  const clearFilters = () => {
    setSelectedGenre('all');
    setSelectedLetter(null);
    setSearchQuery('');
    setSearchInput('');
  };

  const hasFilters = selectedGenre !== 'all' || selectedLetter || searchQuery;

  return (
    <div className="storefront">
      {/* Header */}
      <header className="storefront__header">
        <div className="storefront__header-bg" />
        <div className="storefront__header-content">
          <div className="storefront__logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="4" y="6" width="24" height="30" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
              <rect x="12" y="4" width="24" height="30" rx="2" stroke="currentColor" strokeWidth="2" fill="rgba(255,255,255,0.1)"/>
              <line x1="9" y1="14" x2="23" y2="14" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="9" y1="19" x2="23" y2="19" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="9" y1="24" x2="18" y2="24" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <h1 className="storefront__title">Gutenberg Library</h1>
          <p className="storefront__subtitle">
            Explore thousands of free literary classics from Project Gutenberg
          </p>

          {/* Search */}
          <form className="storefront__search" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search books by title or author..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="storefront__search-input"
            />
            <button type="submit" className="storefront__search-btn">
              Search
            </button>
          </form>
        </div>
      </header>

      <main className="storefront__main">
        {/* Filters sidebar */}
        <aside className="storefront__sidebar">
          {/* Genre filter */}
          <div className="storefront__filter-section">
            <h3 className="storefront__filter-title">Genre</h3>
            <div className="storefront__genre-list">
              {GENRES.map((g) => (
                <button
                  key={g.key}
                  className={`storefront__genre-btn ${selectedGenre === g.key ? 'storefront__genre-btn--active' : ''}`}
                  onClick={() => setSelectedGenre(g.key)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Author letter filter */}
          <div className="storefront__filter-section">
            <h3 className="storefront__filter-title">Author Last Name</h3>
            <div className="storefront__alpha-grid">
              {ALPHABET.map((letter) => (
                <button
                  key={letter}
                  className={`storefront__alpha-btn ${selectedLetter === letter ? 'storefront__alpha-btn--active' : ''}`}
                  onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>

          {hasFilters && (
            <button className="storefront__clear-btn" onClick={clearFilters}>
              Clear All Filters
            </button>
          )}
        </aside>

        {/* Book grid */}
        <div className="storefront__content">
          {/* Active filters display */}
          {hasFilters && (
            <div className="storefront__active-filters">
              {searchQuery && (
                <span className="storefront__filter-chip">
                  Search: "{searchQuery}"
                  <button onClick={() => { setSearchQuery(''); setSearchInput(''); }}>&times;</button>
                </span>
              )}
              {selectedGenre !== 'all' && (
                <span className="storefront__filter-chip">
                  {selectedGenre}
                  <button onClick={() => setSelectedGenre('all')}>&times;</button>
                </span>
              )}
              {selectedLetter && (
                <span className="storefront__filter-chip">
                  Author: {selectedLetter}
                  <button onClick={() => setSelectedLetter(null)}>&times;</button>
                </span>
              )}
            </div>
          )}

          {/* Results count */}
          {!loading && books.length > 0 && (
            <p className="storefront__results-count">
              Showing {books.length} of {totalCount.toLocaleString()} books
            </p>
          )}

          {error && (
            <div className="storefront__error">
              <p>{error}</p>
              <button onClick={() => window.location.reload()}>Try Again</button>
            </div>
          )}

          <div className="storefront__grid">
            {books.map((book, idx) => (
              <div
                key={book.id}
                ref={idx === books.length - 1 ? lastBookRef : null}
              >
                <BookCard book={book} />
              </div>
            ))}

            {/* Loading skeletons */}
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <div key={`skel-${i}`} className="book-card-skeleton">
                  <div className="skeleton" style={{ aspectRatio: '2/3' }} />
                  <div style={{ padding: 16 }}>
                    <div className="skeleton" style={{ height: 18, width: '80%', marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 14, width: '50%' }} />
                  </div>
                </div>
              ))}
          </div>

          {!loading && books.length === 0 && !error && (
            <div className="storefront__empty">
              <div className="storefront__empty-icon">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <rect x="8" y="12" width="36" height="44" rx="3" stroke="var(--color-accent)" strokeWidth="2" fill="none"/>
                  <line x1="16" y1="24" x2="36" y2="24" stroke="var(--color-accent)" strokeWidth="1.5"/>
                  <line x1="16" y1="32" x2="36" y2="32" stroke="var(--color-accent)" strokeWidth="1.5"/>
                  <line x1="16" y1="40" x2="28" y2="40" stroke="var(--color-accent)" strokeWidth="1.5"/>
                </svg>
              </div>
              <h3>No books found</h3>
              <p>Try adjusting your filters or search query</p>
              {hasFilters && (
                <button className="storefront__clear-btn" onClick={clearFilters}>
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="storefront__footer">
        <p>
          Books provided by{' '}
          <a href="https://www.gutenberg.org" target="_blank" rel="noopener noreferrer">
            Project Gutenberg
          </a>
          . All texts are in the public domain.
        </p>
      </footer>
    </div>
  );
}
