/**
 * Tokens de design unificados para o kit interno.
 *
 * Estes valores espelham a paleta canónica do projecto (`src/index.css`),
 * mas em formato TypeScript para que componentes, hooks e utilitários TypeScript
 * pudessem optar por referências tipadas em vez de strings mágicas CSS.
 *
 * Regra: se um token existir aqui, o componente deve usá-lo; se faltar um token
 * novo, adicioná-lo também em `src/index.css` e aqui.
 */

export const colors = {
  // Verde principal / sucesso / confirmação
  green: {
    50: '#EEF7F4',
    100: '#DCEAE6',
    200: '#C2DFD4',
    300: '#9BCDBB',
    400: '#66BE9C',
    500: '#3FAE80',
    600: '#2F9E68',
    700: '#176158',
    800: '#0F4A44',
    900: '#0B3B37',
    950: '#071f1d',
  },
  // Dourado: destaque, premium, ação recompensa
  gold: {
    50: '#FFF9ED',
    100: '#FFF1D5',
    200: '#FCE3B4',
    300: '#F8D18C',
    400: '#F0B65B',
    500: '#E8A23A',
    600: '#C9852A',
    700: '#A86516',
    800: '#8A5211',
    900: '#6B3F0D',
    950: '#452A08',
  },
  // Coral: ação secundária quente / promoções
  coral: {
    50: '#FFF1EC',
    100: '#FFE4DC',
    200: '#FFCDBE',
    300: '#FCAE98',
    400: '#F07A4F',
    500: '#EC6640',
    600: '#E5572B',
    700: '#C4451F',
    800: '#9E3718',
    900: '#7C2B13',
  },
  // Vermelho: erro, perigo, remoção
  red: {
    50: '#FEF3F2',
    100: '#FEE4E2',
    200: '#FECDCA',
    300: '#FDA29B',
    400: '#F97066',
    500: '#F04438',
    600: '#D92D20',
    700: '#B42318',
    800: '#912018',
    900: '#7A271A',
  },
  // Amarelo: aviso, atenção, pendente
  yellow: {
    50: '#FFFBEB',
    100: '#FFF3CD',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#A15C07',
    800: '#854D0E',
    900: '#713F12',
  },
  // Azul: informação, dados, neutros indicadores
  blue: {
    50: '#EFF8FF',
    100: '#DBEAFE',
    200: '#B2DDFF',
    300: '#84CAFF',
    400: '#53B1FD',
    500: '#2E90FA',
    600: '#1570EF',
    700: '#175CD3',
    800: '#1849A9',
    900: '#194185',
  },
  // Neutro quente: superfícies, texto, bordas
  neutral: {
    0: '#FFFFFF',
    25: '#FCFBF8',
    50: '#F7F5F1',
    100: '#EEEAE2',
    200: '#E4DFD4',
    300: '#DCD6C8',
    400: '#ABA79B',
    500: '#5B6B67',
    600: '#52615C',
    700: '#34423E',
    800: '#253230',
    900: '#16221F',
    950: '#091B1E',
  },
} as const;

export type ColorTokenFamily = keyof typeof colors;
export type ColorTokenLevel = typeof colors.green[number];

export const tokens = {
  colors,
} as const;

export type Tokens = typeof tokens;
