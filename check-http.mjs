const res = await fetch('http://localhost:3000/');
const text = await res.text();
console.log('STATUS:', res.status);
console.log('LENGTH:', text.length);
console.log('HAS_ROOT_DIV:', text.includes('id="root"'));
console.log('HAS_VITE_CLIENT:', text.includes('@vite/client'));
console.log('CONTENT_TYPE:', res.headers.get('content-type'));
console.log('FIRST_200:', text.slice(0, 200));