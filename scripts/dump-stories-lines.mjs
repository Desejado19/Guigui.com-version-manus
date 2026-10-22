import fs from 'node:fs';

const target = 'src/components/StoriesBar.tsx';
const src = fs.readFileSync(target, 'utf8');
const lines = src.split('\n');
console.log('TOTAL LINES', lines.length);
for (let i = 182; i < lines.length; i += 1) {
  console.log(`${i + 1}|${lines[i].length}:${lines[i]}`);
}