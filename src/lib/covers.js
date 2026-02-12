// Client-side procedural book cover generation with localStorage caching

const CACHE_PREFIX = 'gutenberg_cover_';

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

function hashColor(str, seed = 0) {
  const h = simpleHash(str + seed + 'hue') % 360;
  const s = 25 + (simpleHash(str + seed + 'sat') % 30);
  const l = 25 + (simpleHash(str + seed + 'lit') % 25);
  return { h, s, l };
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateBookCover(title, author, bookId) {
  const { h, s, l } = hashColor(title + author);
  const { h: h2, s: s2, l: l2 } = hashColor(author + title, 1);
  const { h: h3 } = hashColor(title, 2);

  const bgColor = `hsl(${h}, ${s}%, ${l}%)`;
  const accentColor = `hsl(${h2}, ${Math.min(s2 + 15, 60)}%, ${Math.min(l2 + 20, 55)}%)`;
  const patternColor = `hsl(${h3}, ${Math.min(s + 10, 60)}%, ${Math.min(l + 10, 55)}%)`;

  const patternType = simpleHash(title) % 6;

  let patternSvg = '';
  switch (patternType) {
    case 0:
      for (let i = 0; i < 5; i++) {
        const cx = 60 + (i * 45) % 180;
        const cy = 120 + Math.sin(i * 1.5) * 40;
        patternSvg += `<circle cx="${cx}" cy="${cy}" r="${15 + i * 3}" fill="none" stroke="${patternColor}" stroke-width="1" opacity="0.3"/>`;
      }
      break;
    case 1:
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          const x = 50 + i * 55;
          const y = 90 + j * 55;
          patternSvg += `<rect x="${x}" y="${y}" width="30" height="30" transform="rotate(45 ${x + 15} ${y + 15})" fill="none" stroke="${patternColor}" stroke-width="0.8" opacity="0.25"/>`;
        }
      }
      break;
    case 2:
      for (let i = 0; i < 8; i++) {
        const y = 80 + i * 20;
        patternSvg += `<path d="M 30 ${y} Q 150 ${y + (i % 2 === 0 ? -10 : 10)} 270 ${y}" fill="none" stroke="${patternColor}" stroke-width="0.7" opacity="0.2"/>`;
      }
      break;
    case 3:
      for (let i = 0; i < 12; i++) {
        const angle = (i * 30) * Math.PI / 180;
        const x2 = 150 + Math.cos(angle) * 120;
        const y2 = 140 + Math.sin(angle) * 120;
        patternSvg += `<line x1="150" y1="140" x2="${x2}" y2="${y2}" stroke="${patternColor}" stroke-width="0.5" opacity="0.15"/>`;
      }
      break;
    case 4:
      for (let i = 0; i < 6; i++) {
        const y = 80 + i * 25;
        patternSvg += `<path d="M 20 ${y} C 80 ${y - 15}, 120 ${y + 15}, 180 ${y} C 220 ${y - 15}, 260 ${y + 15}, 280 ${y}" fill="none" stroke="${patternColor}" stroke-width="0.8" opacity="0.2"/>`;
      }
      break;
    case 5:
      for (let i = 0; i < 10; i++) {
        patternSvg += `<line x1="${20 + i * 28}" y1="70" x2="${20 + i * 28}" y2="240" stroke="${patternColor}" stroke-width="0.4" opacity="0.15"/>`;
        patternSvg += `<line x1="20" y1="${70 + i * 19}" x2="280" y2="${70 + i * 19}" stroke="${patternColor}" stroke-width="0.4" opacity="0.15"/>`;
      }
      break;
  }

  // Word-wrap title
  const words = title.split(' ');
  const titleLines = [];
  let currentLine = '';
  const maxChars = 18;
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxChars) {
      if (currentLine) titleLines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += ' ' + word;
    }
  }
  if (currentLine.trim()) titleLines.push(currentLine.trim());

  if (titleLines.length > 4) {
    titleLines.length = 4;
    titleLines[3] = titleLines[3].substring(0, maxChars - 3) + '...';
  }

  const titleFontSize = titleLines.some(l => l.length > 14) ? 20 : 24;
  const titleStartY = 310 - (titleLines.length * (titleFontSize + 4)) / 2;

  const titleSvg = titleLines.map((line, i) =>
    `<text x="150" y="${titleStartY + i * (titleFontSize + 6)}" font-family="Georgia, 'Times New Roman', serif" font-size="${titleFontSize}" font-weight="bold" fill="white" text-anchor="middle" opacity="0.95">${escapeXml(line)}</text>`
  ).join('');

  const authorWords = author.split(' ');
  const authorLines = [];
  let curAuthorLine = '';
  for (const word of authorWords) {
    if ((curAuthorLine + ' ' + word).trim().length > 24) {
      if (curAuthorLine) authorLines.push(curAuthorLine.trim());
      curAuthorLine = word;
    } else {
      curAuthorLine += ' ' + word;
    }
  }
  if (curAuthorLine.trim()) authorLines.push(curAuthorLine.trim());

  const authorSvg = authorLines.map((line, i) =>
    `<text x="150" y="${400 + i * 18}" font-family="Georgia, 'Times New Roman', serif" font-size="13" fill="white" text-anchor="middle" opacity="0.75">${escapeXml(line)}</text>`
  ).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
    <defs>
      <linearGradient id="bg${bookId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${bgColor}"/>
        <stop offset="100%" style="stop-color:${accentColor}"/>
      </linearGradient>
      <linearGradient id="spine${bookId}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:rgba(0,0,0,0.3)"/>
        <stop offset="100%" style="stop-color:rgba(0,0,0,0)"/>
      </linearGradient>
    </defs>
    <rect width="300" height="450" fill="url(#bg${bookId})" rx="3"/>
    <rect x="0" y="0" width="20" height="450" fill="url(#spine${bookId})" rx="3"/>
    <rect x="25" y="20" width="255" height="410" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1" rx="2"/>
    <rect x="30" y="25" width="245" height="400" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5" rx="2"/>
    ${patternSvg}
    <line x1="60" y1="270" x2="240" y2="270" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
    ${titleSvg}
    <line x1="80" y1="385" x2="220" y2="385" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
    ${authorSvg}
  </svg>`;

  const dataUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));

  // Cache to localStorage
  try {
    localStorage.setItem(CACHE_PREFIX + bookId, dataUri);
  } catch (e) {
    // localStorage full — evict oldest entries
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(CACHE_PREFIX)) keys.push(key);
      }
      // Remove first 20 entries to make space
      keys.slice(0, 20).forEach(k => localStorage.removeItem(k));
      localStorage.setItem(CACHE_PREFIX + bookId, dataUri);
    } catch (e2) {
      // give up caching silently
    }
  }

  return dataUri;
}

export function getCachedCover(bookId) {
  try {
    return localStorage.getItem(CACHE_PREFIX + bookId);
  } catch (e) {
    return null;
  }
}
