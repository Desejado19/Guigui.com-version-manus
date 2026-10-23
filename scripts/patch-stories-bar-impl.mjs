import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve('src', 'components', 'StoriesBar.tsx');
let src = fs.readFileSync(target, 'utf8');

const idx = src.indexOf('<button');
console.log('BUTTON INDEX:', idx);
if (idx !== -1) {
  const start = Math.max(0, idx - 20);
  const end = Math.min(src.length, idx + 520);
  console.log('BUTTON NEAR:', JSON.stringify(src.slice(start, end)));
}
const buttonRegex = /<button\s+type="button"\s+onClick=\{.*?\n\s+className="group relative flex h-36 w-24[^"]*?">/s;
console.log('TEST:', buttonRegex.test(src));