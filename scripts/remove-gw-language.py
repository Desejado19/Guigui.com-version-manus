from pathlib import Path
import re, json
root = Path(__file__).resolve().parents[1]

def replace(path, old, new):
    p=root/path; s=p.read_text();
    if old not in s: print('missing', path, old[:40])
    p.write_text(s.replace(old,new))

replace('src/types.ts', "export type Language = 'pt' | 'gw' | 'fr' | 'en' | 'es';\nexport type LocaleCode = 'pt-BR' | 'en' | 'fr' | 'es' | 'gw';", "export type Language = 'pt' | 'fr' | 'en' | 'es';\nexport type LocaleCode = 'pt-BR' | 'en' | 'fr' | 'es';")
replace('src/locales/index.ts', "import gw from './gw';\n", '')
replace('src/locales/index.ts', "  gw: 'gw',\n", '')
replace('src/locales/index.ts', "  gw: 'gw',\n", '')
replace('src/locales/index.ts', "export const LOCALES = { 'pt-BR': ptBR, en, fr, es, gw } as const;", "export const LOCALES = { 'pt-BR': ptBR, en, fr, es } as const;")

# Remove complete gw object blocks from TS catalog maps.
for rel in ['src/utils/i18n.ts','src/utils/workspaceTranslations.ts','src/utils/contentTranslation.ts','src/services/notificationService.ts','src/services/smsService.ts','server/i18n.ts']:
    p=root/rel; s=p.read_text()
    s=re.sub(r"\n  gw: \{.*?\n  \},(?=\n  (?:en|fr|es):|\n\};)", '', s, flags=re.S)
    s=re.sub(r"\n    gw: '[^\n]*',", '', s)
    s=re.sub(r"\n      gw: '[^\n]*',", '', s)
    s=s.replace(" || normalized === 'gw'", '')
    s=s.replace(" || value === 'gw'", '')
    s=s.replace(" || requested === 'gw'", '')
    s=s.replace("language === 'gw' ? 'pt-PT' : language", "language")
    p.write_text(s)

# Remove GW-specific ternaries and options in product UI.
replace('src/components/Navbar.tsx', "          : currentLang === 'gw'\n            ? 'Kriol'\n            : currentLang === 'fr'", "          : currentLang === 'fr'")
replace('src/components/Navbar.tsx', "    { code: 'gw', name: t('language.crioulo'), flag: 'GW' },\n", '')
replace('src/components/admin/AdminProfilePanel.tsx', "            <option value=\"gw\">{t('language.crioulo')}</option>\n", '')
replace('src/components/BusinessDetailModal.tsx', "lang === 'gw' ? 'crioulo' : lang", "lang")

# Remove map entries for gw in ticket labels.
for rel in ['src/components/MyTicketsPanel.tsx','src/components/SoldTicketsPanel.tsx']:
    p=root/rel; s=p.read_text(); s=re.sub(r", gw: '[^']*'", '', s); p.write_text(s)

# Remove gw keys from locale files, keeping the legacy key out of the selectable catalog.
for rel in ['src/locales/pt-BR.ts','src/locales/en.ts','src/locales/fr.ts','src/locales/es.ts']:
    p=root/rel; s=p.read_text(); s=re.sub(r"\n\s*'language\.crioulo': '[^']*',", '', s); p.write_text(s)

# Remove gw columns from i18n specs and update extractor/auditor language sets.
for rel in ['i18n-specs/citizen-dashboard.json','i18n-specs/business-dashboard.json']:
    p=root/rel; data=json.loads(p.read_text());
    for site in data.get('sites', []): site.pop('gw', None)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
for rel in ['scripts/i18n-extract.mjs','scripts/audit-i18n-coverage.mjs']:
    p=root/rel; s=p.read_text();
    s=s.replace("{ lang: 'gw', file: 'src/locales/gw.ts' },\n  ", '')
    s=s.replace("['gw', 'en', 'fr', 'es']", "['en', 'fr', 'es']")
    s=s.replace("{ pt: site.pt, gw: site.gw, en: site.en, fr: site.fr, es: site.es }", "{ pt: site.pt, en: site.en, fr: site.fr, es: site.es }")
    s=s.replace("{ pt: norm(hit.pt), gw: site.gw, en: site.en, fr: site.fr, es: site.es }", "{ pt: norm(hit.pt), en: site.en, fr: site.fr, es: site.es }")
    s=s.replace("const localeOf = { pt: 'pt-BR', gw: 'gw', en: 'en', fr: 'fr', es: 'es' };", "const localeOf = { pt: 'pt-BR', en: 'en', fr: 'fr', es: 'es' };")
    p.write_text(s)

# Remove gw-only test assertions and test language lists.
for rel in ['tests/i18n-dashboards.spec.ts','tests/unit/components/qrCodeDisplay.test.tsx','tests/unit/components/errorBoundary.test.tsx','tests/unit/reviews.test.ts','tests/home.spec.ts']:
    p=root/rel; s=p.read_text()
    s=re.sub(r"\n\s*it\('traduz os rótulos para crioulo'.*?\n\s*\}\);", '', s, flags=re.S)
    s=s.replace(", 'gw'", '')
    s=s.replace(" || lang === 'gw'", '')
    s=s.replace("['pt', 'gw', 'en', 'fr', 'es']", "['pt', 'en', 'fr', 'es']")
    s=s.replace("const LANGUAGES = ['pt', 'gw', 'en', 'fr', 'es'] as const;", "const LANGUAGES = ['pt', 'en', 'fr', 'es'] as const;")
    s=re.sub(r"\n\s*gw: \[[^\n]*\],", '', s)
    s=s.replace(" gw: string;", '')
    s=s.replace("'gw', 'Konsiga tudu ki nha ten'", "'en', 'You have no tickets yet'")
    s=s.replace("    // O Kriyol tem de estar traduzido, conforme Secção 11.5.\n    expect(getQualitativeScoreLabel('gw', 'muito_bom')).toBe('Muitu Bom');\n", '')
    s=s.replace("      <ErrorBoundary currentLang=\"gw\">", "      <ErrorBoundary currentLang=\"en\">")
    p.write_text(s)

# Remove the deleted source file after all imports are gone.
(root/'src/locales/gw.ts').unlink(missing_ok=True)
