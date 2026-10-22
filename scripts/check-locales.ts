import { LOCALES } from '../src/locales/index';

const localeEntries = Object.entries(LOCALES);
const referenceKeys = Object.keys(localeEntries[0][1]).sort();
const failures: string[] = [];

for (const [locale, messages] of localeEntries) {
  const keys = Object.keys(messages).sort();
  const missing = referenceKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !referenceKeys.includes(key));
  if (missing.length) failures.push(`${locale}: missing ${missing.join(', ')}`);
  if (extra.length) failures.push(`${locale}: extra ${extra.join(', ')}`);
  for (const [key, value] of Object.entries(messages)) {
    if (!value.trim()) failures.push(`${locale}: empty translation for ${key}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Locale check passed: ${localeEntries.length} locales, ${referenceKeys.length} keys.`);
