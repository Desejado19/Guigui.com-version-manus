const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/PC/Downloads/Guigui.com-manus-version/Guigui.com-tema-escuro-testado/playwright-report/data';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
for (const f of files) {
  const full = path.join(dir, f);
  const content = fs.readFileSync(full, 'utf8');
  const nameMatch = content.match(/^- Name: (.*?)$/m);
  const errorMatch = content.match(/```\s*\n(.*?)\n```/s);
  if (nameMatch) {
    const name = nameMatch[1].replace(/\n/g, ' ').trim();
    const err = errorMatch ? errorMatch[1].replace(/\n/g, ' ').trim().slice(0, 140) : 'no error details';
    console.log('FAILED: ' + name + ' | ' + err);
  }
}