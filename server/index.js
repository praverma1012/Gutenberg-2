import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { createCanvas } from './canvas.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite database for caching
const dbPath = path.join(__dirname, 'cache.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS cover_cache (
    book_id TEXT PRIMARY KEY,
    image_data TEXT NOT NULL,
    title TEXT,
    author TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS summary_cache (
    book_id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const getCover = db.prepare('SELECT image_data FROM cover_cache WHERE book_id = ?');
const insertCover = db.prepare('INSERT OR REPLACE INTO cover_cache (book_id, image_data, title, author) VALUES (?, ?, ?, ?)');
const getSummary = db.prepare('SELECT summary FROM summary_cache WHERE book_id = ?');
const insertSummary = db.prepare('INSERT OR REPLACE INTO summary_cache (book_id, summary) VALUES (?, ?)');

// Deterministic color generation from string
function hashColor(str, seed = 0) {
  const hash = crypto.createHash('md5').update(str + seed).digest('hex');
  const h = parseInt(hash.substring(0, 3), 16) % 360;
  const s = 25 + (parseInt(hash.substring(3, 5), 16) % 30);
  const l = 25 + (parseInt(hash.substring(5, 7), 16) % 25);
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

// Generate a beautiful procedural book cover as SVG
function generateBookCover(title, author) {
  const { h, s, l } = hashColor(title + author);
  const { h: h2, s: s2, l: l2 } = hashColor(author + title, 1);
  const { h: h3 } = hashColor(title, 2);

  const bgColor = `hsl(${h}, ${s}%, ${l}%)`;
  const accentColor = `hsl(${h2}, ${s2 + 15}%, ${l2 + 20}%)`;
  const patternColor = `hsl(${h3}, ${s + 10}%, ${l + 10}%)`;

  // Choose a decorative pattern based on the hash
  const patternType = parseInt(crypto.createHash('md5').update(title).digest('hex').substring(0, 2), 16) % 6;

  let patternSvg = '';
  switch (patternType) {
    case 0: // Circles
      for (let i = 0; i < 5; i++) {
        const cx = 60 + (i * 45) % 180;
        const cy = 120 + Math.sin(i * 1.5) * 40;
        patternSvg += `<circle cx="${cx}" cy="${cy}" r="${15 + i * 3}" fill="none" stroke="${patternColor}" stroke-width="1" opacity="0.3"/>`;
      }
      break;
    case 1: // Diamond grid
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          const x = 50 + i * 55;
          const y = 90 + j * 55;
          patternSvg += `<rect x="${x}" y="${y}" width="30" height="30" transform="rotate(45 ${x + 15} ${y + 15})" fill="none" stroke="${patternColor}" stroke-width="0.8" opacity="0.25"/>`;
        }
      }
      break;
    case 2: // Horizontal lines with curves
      for (let i = 0; i < 8; i++) {
        const y = 80 + i * 20;
        patternSvg += `<path d="M 30 ${y} Q 150 ${y + (i % 2 === 0 ? -10 : 10)} 270 ${y}" fill="none" stroke="${patternColor}" stroke-width="0.7" opacity="0.2"/>`;
      }
      break;
    case 3: // Radiating lines
      for (let i = 0; i < 12; i++) {
        const angle = (i * 30) * Math.PI / 180;
        const x2 = 150 + Math.cos(angle) * 120;
        const y2 = 140 + Math.sin(angle) * 120;
        patternSvg += `<line x1="150" y1="140" x2="${x2}" y2="${y2}" stroke="${patternColor}" stroke-width="0.5" opacity="0.15"/>`;
      }
      break;
    case 4: // Waves
      for (let i = 0; i < 6; i++) {
        const y = 80 + i * 25;
        patternSvg += `<path d="M 20 ${y} C 80 ${y - 15}, 120 ${y + 15}, 180 ${y} C 220 ${y - 15}, 260 ${y + 15}, 280 ${y}" fill="none" stroke="${patternColor}" stroke-width="0.8" opacity="0.2"/>`;
      }
      break;
    case 5: // Cross-hatch
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

  // Limit to 4 lines
  if (titleLines.length > 4) {
    titleLines.length = 4;
    titleLines[3] = titleLines[3].substring(0, maxChars - 3) + '...';
  }

  const titleFontSize = titleLines.some(l => l.length > 14) ? 20 : 24;
  const titleStartY = 310 - (titleLines.length * (titleFontSize + 4)) / 2;

  const titleSvg = titleLines.map((line, i) =>
    `<text x="150" y="${titleStartY + i * (titleFontSize + 6)}" font-family="Georgia, 'Times New Roman', serif" font-size="${titleFontSize}" font-weight="bold" fill="white" text-anchor="middle" opacity="0.95">${escapeXml(line)}</text>`
  ).join('');

  // Word-wrap author
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
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${bgColor}"/>
        <stop offset="100%" style="stop-color:${accentColor}"/>
      </linearGradient>
      <linearGradient id="spine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:rgba(0,0,0,0.3)"/>
        <stop offset="100%" style="stop-color:rgba(0,0,0,0)"/>
      </linearGradient>
    </defs>
    <!-- Background -->
    <rect width="300" height="450" fill="url(#bg)" rx="3"/>
    <!-- Spine shadow -->
    <rect x="0" y="0" width="20" height="450" fill="url(#spine)" rx="3"/>
    <!-- Decorative border -->
    <rect x="25" y="20" width="255" height="410" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1" rx="2"/>
    <rect x="30" y="25" width="245" height="400" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5" rx="2"/>
    <!-- Pattern area -->
    ${patternSvg}
    <!-- Title divider -->
    <line x1="60" y1="270" x2="240" y2="270" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
    <!-- Title -->
    ${titleSvg}
    <!-- Author divider -->
    <line x1="80" y1="385" x2="220" y2="385" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
    <!-- Author -->
    ${authorSvg}
  </svg>`;

  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Generate a short book summary from first portion of text
function generateSummary(text, title, author) {
  // Take first ~2000 chars of actual content
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

  // Extract meaningful sentences for a summary
  const sentences = excerpt.split(/[.!?]+/).filter(s => s.trim().length > 20).slice(0, 3);

  if (sentences.length === 0) {
    return `"${title}" by ${author} is a classic work of literature available through Project Gutenberg. Open the book to begin reading this timeless text.`;
  }

  const opening = sentences.map(s => s.trim()).join('. ') + '.';

  return `"${title}" by ${author} — ${opening.substring(0, 500)}`;
}

// API: Get or generate cover image
app.get('/api/cover/:bookId', (req, res) => {
  const { bookId } = req.params;
  const { title, author } = req.query;

  // Check cache first
  const cached = getCover.get(bookId);
  if (cached) {
    return res.json({ image: cached.image_data, cached: true });
  }

  // Generate new cover
  const image = generateBookCover(title || 'Untitled', author || 'Unknown');
  insertCover.run(bookId, image, title, author);

  res.json({ image, cached: false });
});

// API: Get or generate summary
app.get('/api/summary/:bookId', async (req, res) => {
  const { bookId } = req.params;
  const { title, author } = req.query;

  // Check cache
  const cached = getSummary.get(bookId);
  if (cached) {
    return res.json({ summary: cached.summary, cached: true });
  }

  try {
    // Fetch beginning of book text from Gutenberg
    const textUrl = `https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`;
    const altUrl = `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`;

    let text = '';
    try {
      const resp = await fetch(textUrl);
      if (resp.ok) text = await resp.text();
    } catch (e) {}

    if (!text) {
      try {
        const resp = await fetch(altUrl);
        if (resp.ok) text = await resp.text();
      } catch (e) {}
    }

    const summary = generateSummary(text, title || 'Untitled', author || 'Unknown');
    insertSummary.run(bookId, summary);

    res.json({ summary, cached: false });
  } catch (err) {
    res.json({ summary: `"${title}" by ${author} is a classic work from Project Gutenberg.`, cached: false });
  }
});

// Proxy Gutenberg API to avoid CORS issues
app.get('/api/gutenberg/books', async (req, res) => {
  try {
    const params = new URLSearchParams(req.query);
    const url = `https://gutendex.com/books?${params.toString()}`;
    const resp = await fetch(url);
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch from Gutenberg API' });
  }
});

// Proxy book text
app.get('/api/gutenberg/text/:bookId', async (req, res) => {
  const { bookId } = req.params;
  const urls = [
    `https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`,
    `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`,
    `https://www.gutenberg.org/files/${bookId}/${bookId}.txt`,
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const text = await resp.text();
        res.type('text/plain').send(text);
        return;
      }
    } catch (e) {}
  }

  res.status(404).json({ error: 'Book text not found' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
