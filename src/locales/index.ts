import type { Language, LocaleCode } from '../types';
import ptBR from './pt-BR';
import en from './en';
import fr from './fr';
import es from './es';
export const LOCALE_TO_LANGUAGE: Record<LocaleCode, Language> = {
  'pt-BR': 'pt',
  en: 'en',
  fr: 'fr',
  es: 'es',
};
export const LANGUAGE_TO_LOCALE: Record<Language, LocaleCode> = {
  pt: 'pt-BR',
  en: 'en',
  fr: 'fr',
  es: 'es',
};
export const LOCALES = { 'pt-BR': ptBR, en, fr, es } as const;
export type LocaleKey = keyof typeof ptBR;
