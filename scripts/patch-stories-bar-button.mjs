import fs from 'node:fs';

const target = 'src/components/StoriesBar.tsx';
let src = fs.readFileSync(target, 'utf8');
const lines = src.split('\n');

const oldLine =
  "            onClick={() => (currentUser ? onAddStory?.({ id: `story-${Date.now()}`, businessId: currentUser.businessId || '', businessName: currentUser.businessName || currentUser.name, businessLogo: currentUser.avatarUrl || '', storyType: 'text', caption: '', createdAt: new Date().toISOString() }) : onRequireLogin?.())}";
const expectedLine =
  "            onClick={() => setCreativeMode('image')}";

if (lines[128] !== oldLine) {
  throw new Error(`Line 129 did not match. FOUND: ${JSON.stringify(lines[128])}`);
}

lines[128] = expectedLine;
fs.writeFileSync(target, lines.join('\n'), 'utf8');
console.log('StoriesBar onAddStory button replaced successfully');