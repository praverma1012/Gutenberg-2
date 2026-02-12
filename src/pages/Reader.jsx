import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useBookText } from '../hooks/useGutenberg.js';
import './Reader.css';

const THEMES = {
  light: { bg: '#ffffff', text: '#2c1810', name: 'Light', accent: '#e0d5c8' },
  sepia: { bg: '#f5e6c8', text: '#3d2b1f', name: 'Sepia', accent: '#d4b896' },
  dark: { bg: '#1a1a1a', text: '#e0d5c8', name: 'Dark', accent: '#3a3a3a' },
};

const FONTS = [
  { key: 'cormorant', label: 'Cormorant Garamond', family: "'Cormorant Garamond', serif" },
  { key: 'libre', label: 'Libre Baskerville', family: "'Libre Baskerville', serif" },
  { key: 'lora', label: 'Lora', family: "'Lora', serif" },
  { key: 'merriweather', label: 'Merriweather', family: "'Merriweather', serif" },
  { key: 'playfair', label: 'Playfair Display', family: "'Playfair Display', serif" },
  { key: 'inter', label: 'Inter', family: "'Inter', sans-serif" },
  { key: 'opensans', label: 'Open Sans', family: "'Open Sans', sans-serif" },
];

const FONT_SIZES = [14, 16, 18, 20, 22, 24, 28];
const CHARS_PER_PAGE_BASE = 2800;

export default function Reader() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { title, author } = location.state || {};
  const { text, loading, error } = useBookText(bookId);

  const [currentPage, setCurrentPage] = useState(0);
  const [theme, setTheme] = useState('sepia');
  const [fontKey, setFontKey] = useState('cormorant');
  const [fontSize, setFontSize] = useState(20);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const contentRef = useRef(null);

  const font = FONTS.find(f => f.key === fontKey) || FONTS[0];
  const currentTheme = THEMES[theme];

  // Calculate pages based on text content and font size
  const charsPerPage = Math.round(CHARS_PER_PAGE_BASE * (18 / fontSize));

  const pages = useMemo(() => {
    if (!text) return [];
    const result = [];
    const paragraphs = text.split(/\n\n+/);
    let currentPageContent = '';
    let currentLen = 0;

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if (currentLen + trimmed.length > charsPerPage && currentPageContent) {
        result.push(currentPageContent);
        currentPageContent = '';
        currentLen = 0;
      }

      // If a single paragraph is too long, split it
      if (trimmed.length > charsPerPage) {
        if (currentPageContent) {
          result.push(currentPageContent);
          currentPageContent = '';
          currentLen = 0;
        }
        const words = trimmed.split(/\s+/);
        let chunk = '';
        for (const word of words) {
          if ((chunk + ' ' + word).length > charsPerPage) {
            result.push(chunk.trim());
            chunk = word;
          } else {
            chunk += ' ' + word;
          }
        }
        if (chunk.trim()) {
          currentPageContent = chunk.trim();
          currentLen = currentPageContent.length;
        }
      } else {
        currentPageContent += (currentPageContent ? '\n\n' : '') + trimmed;
        currentLen += trimmed.length;
      }
    }

    if (currentPageContent) result.push(currentPageContent);
    return result;
  }, [text, charsPerPage]);

  const totalPages = pages.length;
  const progress = totalPages > 0 ? ((currentPage + 1) / totalPages * 100).toFixed(1) : 0;

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentPage(p => Math.min(p + 1, totalPages - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentPage(p => Math.max(p - 1, 0));
      } else if (e.key === 'Home') {
        setCurrentPage(0);
      } else if (e.key === 'End') {
        setCurrentPage(totalPages - 1);
      } else if (e.key === 'Escape') {
        setShowSettings(false);
        setShowToc(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [totalPages]);

  // Extract table of contents from chapter headings
  const toc = useMemo(() => {
    if (!pages.length) return [];
    const entries = [];
    const chapterRegex = /^(CHAPTER|Chapter|BOOK|Book|PART|Part|ACT|Act|SECTION|Section|CANTO|Canto)\s+[IVXLCDM\d]+/m;
    pages.forEach((page, idx) => {
      const match = page.match(chapterRegex);
      if (match) {
        const line = page.split('\n').find(l => chapterRegex.test(l));
        entries.push({ page: idx, title: line?.trim().substring(0, 60) || match[0] });
      }
    });
    return entries;
  }, [pages]);

  const goToPage = useCallback((pageNum) => {
    setCurrentPage(Math.max(0, Math.min(pageNum, totalPages - 1)));
    setShowToc(false);
  }, [totalPages]);

  // Scroll to top when page changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  const renderContent = (pageText) => {
    if (!pageText) return null;
    return pageText.split('\n\n').map((para, i) => {
      const trimmed = para.trim();
      if (!trimmed) return null;

      // Detect chapter headings
      const isHeading = /^(CHAPTER|Chapter|BOOK|Book|PART|Part|ACT|Act|SECTION|Section|CANTO|Canto)\s+[IVXLCDM\d]+/.test(trimmed);
      const isAllCaps = trimmed === trimmed.toUpperCase() && trimmed.length < 100 && trimmed.length > 2;

      if (isHeading || isAllCaps) {
        return (
          <h2 key={i} className="reader__heading">
            {trimmed}
          </h2>
        );
      }

      return (
        <p key={i} className="reader__paragraph">
          {trimmed}
        </p>
      );
    });
  };

  if (loading) {
    return (
      <div className="reader reader--loading" style={{ background: currentTheme.bg, color: currentTheme.text }}>
        <div className="reader__loader">
          <div className="reader__loader-book">
            <div className="reader__loader-page" />
            <div className="reader__loader-page" />
            <div className="reader__loader-page" />
          </div>
          <p>Loading book...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reader reader--error">
        <h2>Unable to load book</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')}>Back to Library</button>
      </div>
    );
  }

  return (
    <div className="reader" style={{ background: currentTheme.bg, color: currentTheme.text }}>
      {/* Top toolbar */}
      <header className="reader__toolbar" style={{ background: currentTheme.bg, borderColor: currentTheme.accent }}>
        <button className="reader__toolbar-btn" onClick={() => navigate('/')} title="Back to Library">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="reader__toolbar-label">Library</span>
        </button>

        <div className="reader__toolbar-title">
          <span className="reader__book-title">{title || `Book #${bookId}`}</span>
          {author && <span className="reader__book-author">by {author}</span>}
        </div>

        <div className="reader__toolbar-actions">
          {toc.length > 0 && (
            <button
              className={`reader__toolbar-btn ${showToc ? 'reader__toolbar-btn--active' : ''}`}
              onClick={() => { setShowToc(!showToc); setShowSettings(false); }}
              title="Table of Contents"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="3" cy="5" r="1" fill="currentColor"/>
                <circle cx="3" cy="10" r="1" fill="currentColor"/>
                <circle cx="3" cy="15" r="1" fill="currentColor"/>
              </svg>
            </button>
          )}
          <button
            className={`reader__toolbar-btn ${showSettings ? 'reader__toolbar-btn--active' : ''}`}
            onClick={() => { setShowSettings(!showSettings); setShowToc(false); }}
            title="Reading Settings"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <text x="3" y="15" fontSize="15" fill="currentColor" fontFamily="serif">A</text>
            </svg>
          </button>
        </div>
      </header>

      {/* Settings panel */}
      {showSettings && (
        <div className="reader__settings" style={{ background: currentTheme.bg, borderColor: currentTheme.accent }}>
          <div className="reader__settings-section">
            <label className="reader__settings-label">Theme</label>
            <div className="reader__theme-options">
              {Object.entries(THEMES).map(([key, t]) => (
                <button
                  key={key}
                  className={`reader__theme-btn ${theme === key ? 'reader__theme-btn--active' : ''}`}
                  style={{ background: t.bg, color: t.text, border: `2px solid ${theme === key ? t.text : t.accent}` }}
                  onClick={() => setTheme(key)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="reader__settings-section">
            <label className="reader__settings-label">Font</label>
            <select
              className="reader__font-select"
              value={fontKey}
              onChange={(e) => setFontKey(e.target.value)}
              style={{ background: currentTheme.bg, color: currentTheme.text, borderColor: currentTheme.accent }}
            >
              {FONTS.map((f) => (
                <option key={f.key} value={f.key} style={{ fontFamily: f.family }}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="reader__settings-section">
            <label className="reader__settings-label">Size</label>
            <div className="reader__size-options">
              <button
                className="reader__size-btn"
                onClick={() => setFontSize(s => Math.max(14, s - 2))}
                style={{ color: currentTheme.text, borderColor: currentTheme.accent }}
              >
                A-
              </button>
              <span className="reader__size-value">{fontSize}px</span>
              <button
                className="reader__size-btn"
                onClick={() => setFontSize(s => Math.min(28, s + 2))}
                style={{ color: currentTheme.text, borderColor: currentTheme.accent }}
              >
                A+
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table of Contents panel */}
      {showToc && (
        <div className="reader__toc" style={{ background: currentTheme.bg, borderColor: currentTheme.accent }}>
          <h3 className="reader__toc-title">Table of Contents</h3>
          <div className="reader__toc-list">
            {toc.map((entry, i) => (
              <button
                key={i}
                className={`reader__toc-item ${currentPage === entry.page ? 'reader__toc-item--active' : ''}`}
                onClick={() => goToPage(entry.page)}
                style={{ color: currentTheme.text }}
              >
                <span className="reader__toc-chapter">{entry.title}</span>
                <span className="reader__toc-page">p. {entry.page + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reading area */}
      <main className="reader__content" ref={contentRef} onClick={() => { setShowSettings(false); setShowToc(false); }}>
        <div
          className="reader__page"
          style={{
            fontFamily: font.family,
            fontSize: `${fontSize}px`,
            lineHeight: fontSize <= 18 ? 1.9 : fontSize <= 22 ? 1.8 : 1.7,
          }}
        >
          {renderContent(pages[currentPage])}
        </div>
      </main>

      {/* Bottom navigation */}
      <footer className="reader__nav" style={{ background: currentTheme.bg, borderColor: currentTheme.accent }}>
        <button
          className="reader__nav-btn"
          onClick={() => setCurrentPage(p => Math.max(p - 1, 0))}
          disabled={currentPage === 0}
          style={{ color: currentTheme.text }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Prev
        </button>

        <div className="reader__nav-info">
          <div className="reader__progress-bar" style={{ background: currentTheme.accent }}>
            <div
              className="reader__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="reader__page-info">
            Page {currentPage + 1} of {totalPages} &middot; {progress}%
          </span>
        </div>

        <button
          className="reader__nav-btn"
          onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages - 1))}
          disabled={currentPage >= totalPages - 1}
          style={{ color: currentTheme.text }}
        >
          Next
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </footer>
    </div>
  );
}
