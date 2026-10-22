import * as fs from 'fs';
const html = fs.readFileSync('C:/Users/PC/Downloads/Guigui.com-manus-version/Guigui.com-tema-escuro-testado/playwright-report/index.html', 'utf8');
const idx = html.indexOf('test-results');
if (idx >= 0) {
  const endScript = html.indexOf('</script>', idx);
  const snippet = html.slice(idx, endScript >= 0 ? endScript : idx + 2000);
  console.log(snippet.slice(0, 2000));
} else {
  console.log('No test-results found');
}