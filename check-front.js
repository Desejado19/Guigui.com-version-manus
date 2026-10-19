const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch({headless: true});
  const p = await b.newPage();
  await p.goto('http://localhost:3000/', {waitUntil: 'networkidle', timeout: 15000});
  const title = await p.title();
  const text = await p.textContent('body');
  console.log('TITLE:', title);
  console.log('bodyText length:', text.length);
  const root = await p.$('#root');
  const rootText = root ? await root.innerText() : '(no root div)';
  console.log('rootText:', JSON.stringify(rootText.substring(0,200)));
  await b.close();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });