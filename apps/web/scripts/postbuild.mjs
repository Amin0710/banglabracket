// Copy the legal pages to the dist root so they're reachable at
// banglabracket.com/privacy.html (what Meta/Google expect), in addition to
// the copies that live under /wc2026/app/.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const from = 'dist/wc2026/app';
const to = 'dist';
const files = ['privacy.html', 'terms.html', 'data-deletion.html'];
for (const f of files) {
  const src = join(from, f);
  if (existsSync(src)) {
    mkdirSync(dirname(join(to, f)), { recursive: true });
    copyFileSync(src, join(to, f));
    console.log('copied', f, '-> dist/' + f);
  }
}

// Landing page at the bare root (banglabracket.com).
if (existsSync('landing/index.html')) {
  copyFileSync('landing/index.html', 'dist/index.html');
  console.log('copied landing -> dist/index.html');
}

// Branded 404 at the dist root — Vercel serves dist/404.html for any unmatched path.
if (existsSync('landing/404.html')) {
  copyFileSync('landing/404.html', 'dist/404.html');
  console.log('copied 404 -> dist/404.html');
}

// Make favicon reachable at the root too (the landing references /favicon.png).
if (existsSync('dist/wc2026/app/favicon.png')) {
  copyFileSync('dist/wc2026/app/favicon.png', 'dist/favicon.png');
  console.log('copied favicon -> dist/favicon.png');
}
