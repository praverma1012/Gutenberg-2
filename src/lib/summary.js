// Client-side book summary generation with localStorage caching

const CACHE_PREFIX = 'gutenberg_summary_';

export function generateSummary(text, title, author, bookId) {
  if (!text) {
    const fallback = `"${title}" by ${author} is a classic work of literature available through Project Gutenberg. Open the book to begin reading this timeless text.`;
    cacheSummary(bookId, fallback);
    return fallback;
  }

  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

  // Try to find where the actual text starts (skip Gutenberg header)
  const startMarkers = ['*** START OF', '***START OF', 'CHAPTER', 'BOOK ', 'PART '];
  let startIdx = 0;
  for (const marker of startMarkers) {
    const idx = cleaned.indexOf(marker);
    if (idx !== -1 && idx < 3000) {
      const nextNewline = cleaned.indexOf('\n', idx);
      startIdx = nextNewline !== -1 ? nextNewline + 1 : idx + marker.length;
      break;
    }
  }

  const excerpt = cleaned.substring(startIdx, startIdx + 2000).trim();
  const sentences = excerpt.split(/[.!?]+/).filter(s => s.trim().length > 20).slice(0, 3);

  let summary;
  if (sentences.length === 0) {
    summary = `"${title}" by ${author} is a classic work of literature available through Project Gutenberg. Open the book to begin reading this timeless text.`;
  } else {
    const opening = sentences.map(s => s.trim()).join('. ') + '.';
    summary = `"${title}" by ${author} — ${opening.substring(0, 500)}`;
  }

  cacheSummary(bookId, summary);
  return summary;
}

function cacheSummary(bookId, summary) {
  try {
    localStorage.setItem(CACHE_PREFIX + bookId, summary);
  } catch (e) {
    // localStorage full — silently skip
  }
}

export function getCachedSummary(bookId) {
  try {
    return localStorage.getItem(CACHE_PREFIX + bookId);
  } catch (e) {
    return null;
  }
}
