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
