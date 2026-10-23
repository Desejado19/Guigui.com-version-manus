import { ModerationResult, ModerationSettings } from '../types';

export const DEFAULT_MODERATION_SETTINGS: ModerationSettings = {
  languageCautionEnabled: true,
  sensitivityLevel: 'standard',
  autoApproveGreenThreshold: 85,
  autoRejectRedThreshold: 90,
};

const CRIOULO_KEYWORDS = [
  'kuri',
  'mancebo',
  'fasi',
  'pabu',
  'djintis',
  'frikundam',
  'kumpu',
  'kriol',
  'sabi',
  'djudu',
  'dianti',
  'mininu',
  'bardadi',
  'naisi',
  'djunto',
  'tchoma',
  'nobi',
  'kombosa',
];

const RED_SEVERE_KEYWORDS = [
  'matar',
  'assassinar',
  'violencia',
  'porno',
  'sexo explicito',
  'cocaina',
  'droga ilegal',
  'arma de fogo',
  'cura definitiva',
  'remedio milagroso',
];

const YELLOW_CAUTION_KEYWORDS = [
  'garantido 100%',
  'dinheiro facil',
  'ladrao',
  'fraude',
  'engana',
  'falso',
  'banco central oficial',
  'orange money matriz',
  'telecel oficial',
];

/**
 * AI Real-Time Content Moderation Pipeline (Section 9)
 * Evaluates text and image against 9.2 criteria and applies 9.3 Crioulo caution rule.
 */
export function analyzeContentWithAI(
  text: string,
  imageUrl?: string,
  settings: ModerationSettings = DEFAULT_MODERATION_SETTINGS
): ModerationResult {
  const lowerText = text.toLowerCase();
  const detectedCategories: string[] = [];

  // 1. Severe Violation Check (Red)
  for (const kw of RED_SEVERE_KEYWORDS) {
    if (lowerText.includes(kw)) {
      detectedCategories.push('Linguagem Abusiva / Atividade Ilegal / Alegação Falsa');
      return {
        status: 'vermelho',
        reason: `Conteúdo contém violações graves da política de segurança (termo detetado: "${kw}").`,
        confidence: 96,
        detectedCategories,
        suggestedAction: 'reject',
        isCriouloLanguage: false,
      };
    }
  }

  // Check image URL mock tags
  if (imageUrl && (imageUrl.includes('explicit') || imageUrl.includes('violence'))) {
    detectedCategories.push('Imagem Imprópria');
    return {
      status: 'vermelho',
      reason: 'Imagem flagged com conteúdo gráfico ou explícito.',
      confidence: 98,
      detectedCategories,
      suggestedAction: 'reject',
      isCriouloLanguage: false,
    };
  }

  // 2. Caution Check (Yellow)
  let isYellow = false;
  let yellowReason = '';

  for (const kw of YELLOW_CAUTION_KEYWORDS) {
    if (lowerText.includes(kw)) {
      isYellow = true;
      detectedCategories.push('Alegação Publicitária Sensível / Imitação de Marca');
      yellowReason = `Contém termos publicitários que requerem verificação documental humana ("${kw}").`;
      break;
    }
  }

  // 3. Guinean Creole (Crioulo Guineense) Caution Check (Section 9.3)
  let isCrioulo = false;
  for (const cKw of CRIOULO_KEYWORDS) {
    if (lowerText.includes(cKw)) {
      isCrioulo = true;
      break;
    }
  }

  if (isCrioulo && settings.languageCautionEnabled) {
    isYellow = true;
    detectedCategories.push('Crioulo Guineense (Precaução AI Secção 9.3)');
    if (!yellowReason) {
      yellowReason =
        'Conteúdo redigido em Crioulo Guineense. Classificado como Amarelo por precaução automática de modelo de linguagem conforme Secção 9.3.';
    }
  }

  if (isYellow) {
    return {
      status: 'amarelo',
      reason: yellowReason,
      confidence: 88,
      detectedCategories,
      suggestedAction: 'flag_for_human_review',
      isCriouloLanguage: isCrioulo,
    };
  }

  // 4. Clean Content (Green)
  detectedCategories.push('Conteúdo Conforme');
  return {
    status: 'verde',
    reason: 'Análise de IA concluída sem infrações detetadas.',
    confidence: 94,
    detectedCategories,
    suggestedAction: 'approve',
    isCriouloLanguage: isCrioulo,
  };
}
