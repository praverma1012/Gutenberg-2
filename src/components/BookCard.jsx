import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookCover, useBookSummary } from '../hooks/useGutenberg.js';
import './BookCard.css';

export default function BookCard({ book }) {
  const navigate = useNavigate();
  const title = book.title || 'Untitled';
  const author = book.authors?.[0]?.name || 'Unknown Author';
  const authorDisplay = author.includes(',')
    ? author.split(',').reverse().map(s => s.trim()).join(' ')
    : author;
  const bookId = String(book.id);

  const { cover, loading: coverLoading } = useBookCover(bookId, title, authorDisplay);
  const { summary, loading: summaryLoading, fetchSummary } = useBookSummary(bookId, title, authorDisplay);
  const [expanded, setExpanded] = useState(false);

  const subjects = (book.subjects || []).slice(0, 3);

  const handleExpand = (e) => {
    e.stopPropagation();
    if (!expanded && !summary) {
      fetchSummary();
    }
    setExpanded(!expanded);
  };

  const handleRead = (e) => {
    e.stopPropagation();
    navigate(`/read/${bookId}`, { state: { title, author: authorDisplay } });
  };

  return (
    <div className={`book-card ${expanded ? 'book-card--expanded' : ''}`}>
      <div className="book-card__cover-wrap" onClick={handleExpand}>
        {coverLoading ? (
          <div className="book-card__cover-skeleton skeleton" />
        ) : (
          <img src={cover} alt={title} className="book-card__cover" loading="lazy" />
        )}
        <div className="book-card__hover-overlay">
          <span>{expanded ? 'Hide Details' : 'View Details'}</span>
        </div>
      </div>

      <div className="book-card__info">
        <h3 className="book-card__title" title={title}>{title}</h3>
        <p className="book-card__author">{authorDisplay}</p>
        {subjects.length > 0 && (
          <div className="book-card__subjects">
            {subjects.map((s, i) => (
              <span key={i} className="book-card__subject-tag">{s.split(' -- ')[0]}</span>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div className="book-card__details">
          <div className="book-card__summary">
            {summaryLoading ? (
              <>
                <div className="skeleton" style={{ height: 14, width: '100%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 14, width: '80%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 14, width: '60%' }} />
              </>
            ) : (
              <p>{summary}</p>
            )}
          </div>
          <button className="book-card__read-btn" onClick={handleRead}>
            Read Now
          </button>
        </div>
      )}
    </div>
  );
}
