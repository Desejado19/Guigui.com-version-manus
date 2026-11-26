/**
 * Catálogo de demonstração "showcase" do Guigui.com.
 *
 * Cria 10 empresas completas — capa, logótipo, galeria, contactos, horário,
 * produtos, avaliações, uma publicação e um desconto activos — e 6 eventos
 * publicados com bilhetes. As imagens vivem em public/uploads/showcase/<slug>/
 * (o servidor serve /uploads a partir de public/uploads).
 *
 * Uso:
 *   npx tsx scripts/seed-showcase-businesses.ts          # cria/actualiza
 *   npx tsx scripts/seed-showcase-businesses.ts --clean  # remove só o showcase
 *
 * Idempotente: ids `showcase-co-*`, `showcase-ev-*`, `showcase-post-*`,
 * `showcase-promo-*` e upserts. Não toca em empresas existentes.
 * Contas criadas: empresa.showcaseNN@guigui.test / Guigui2026!
 */
import 'dotenv/config?override=true';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { hashPassword } from '../server/modules/identity-access';

const SEED_PASSWORD = 'Guigui2026!';
const SEED_DOMAIN = 'guigui.test';
const ASSET_ROOT = path.resolve(process.cwd(), 'public', 'uploads', 'showcase');

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isoDaysAgo(days: number, hour = 10): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function isoDaysFromNow(days: number, hour = 19, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

type ShowcaseReview = { author: string; score: 'gostei' | 'gostei_muito' | 'muito_bom'; comment: string; daysAgo: number };

type ShowcaseEvent = {
  id: string;
  title: string;
  description: string;
  category: string;
  daysFromNow: number;
  hour: number;
  minute: number;
  durationHours: number;
  capacity: number;
  ticketTypes: Array<{ name: string; priceXOF: number; quantity: number }>;
};

type ShowcaseBusiness = {
  n: number;
  slug: string;
  name: string;
  categoryId: string;
  subcategoryId: string;
  subcategoryName: string;
  groupGroupId: 'restauracao' | 'hotelaria_saude_educacao' | 'corporativo_financeiro' | 'ongs_artesãos' | 'servicos_profissionais';
  neighborhood: string;
  address: string;
  description: string;
  tagline: string;
  openingHours: string;
  phone: string;
  whatsapp: string;
  publicEmail: string;
  website: string;
  priceRange: '$' | '$$' | '$$$';
  tier: 'professional' | 'premium' | 'enterprise';
  features: string[];
  products: Array<{ name: string; priceXOF: number }>;
  languages: Array<'pt' | 'fr' | 'en'>;
  social: { facebook?: string; instagram?: string };
  ratingLabel: string;
  reviewsCount: number;
  reviews: ShowcaseReview[];
  posts: Array<{ title: string; content: string; image: 'cover' | 'gallery'; daysAgo: number; likes: number }>;
  promotion: { title: string; description: string; badge: string; code: string; validDays: number; clicks: number };
  event?: ShowcaseEvent;
  brand: { from: string; to: string; initials: string };
};

const BUSINESSES: ShowcaseBusiness[] = [
  {
    n: 1,
    slug: 'mare-alta',
    name: 'Restaurante Maré Alta',
    categoryId: 'cat-1',
    subcategoryId: 'Restaurantes',
    subcategoryName: 'Restaurantes',
    groupGroupId: 'restauracao',
    neighborhood: 'Bissau Velho',
    address: 'Avenida Amílcar Cabral, junto ao porto, Bissau Velho',
    description:
      'Cozinha atlântica com peixe grelhado do dia, caldo de mancarra e marisco fresco da costa guineense. Esplanada coberta sobre o porto, menu executivo ao almoço e uma carta de vinhos pensada para acompanhar peixe e marisco.',
    tagline: 'Peixe fresco do dia com vista para o porto',
    openingHours: 'Terça a domingo: 12:00 - 23:00 · Segunda encerrado',
    phone: '+245 955 41 01 20',
    whatsapp: '+245955410120',
    publicEmail: 'reservas@marealta.gw',
    website: 'https://marealta.gw',
    priceRange: '$$$',
    tier: 'premium',
    features: ['Esplanada coberta', 'Peixe fresco do dia', 'Menu executivo ao almoço', 'Reservas por WhatsApp', 'Wi-Fi gratuito', 'Pagamento multicaixa'],
    products: [
      { name: 'Peixe grelhado do dia', priceXOF: 6500 },
      { name: 'Caldo de mancarra com arroz', priceXOF: 4500 },
      { name: 'Arroz de marisco', priceXOF: 8500 },
      { name: 'Menu executivo (entrada, prato e bebida)', priceXOF: 5500 },
      { name: 'Sumo natural de mangue', priceXOF: 1500 },
    ],
    languages: ['pt', 'fr', 'en'],
    social: { facebook: 'https://facebook.com/marealtabissau', instagram: 'https://instagram.com/marealtabissau' },
    ratingLabel: 'Muito Bom',
    reviewsCount: 128,
    reviews: [
      { author: 'Aissatu Baldé', score: 'muito_bom', comment: 'O peixe grelhado estava no ponto e o atendimento foi impecável. A vista ao pôr do sol vale a visita.', daysAgo: 6 },
      { author: 'Domingos Vieira', score: 'gostei_muito', comment: 'Menu executivo com boa relação qualidade-preço. Voltarei com a equipa do escritório.', daysAgo: 21 },
      { author: 'Fatumata Cissé', score: 'gostei_muito', comment: 'Esplanada agradável e caldo de mancarra muito bem temperado.', daysAgo: 44 },
    ],
    posts: [
      { title: 'Novo menu de marisco a partir desta semana', content: 'Chegou o novo menu de marisco: ostras da costa, camarão grelhado e arroz de marisco para partilhar. Disponível todos os dias ao jantar, com peixe escolhido na lota de Bissau pela manhã.', image: 'gallery', daysAgo: 3, likes: 46 },
      { title: 'Sextas de música ao vivo na esplanada', content: 'Todas as sextas-feiras, a partir das 20h00, temos música ao vivo na esplanada. Entrada livre, reservas recomendadas pelo WhatsApp.', image: 'cover', daysAgo: 12, likes: 31 },
    ],
    promotion: {
      title: 'Menu executivo com 15% de desconto',
      description: 'Entrada, prato principal e bebida entre as 12h00 e as 15h00, de terça a sexta.',
      badge: '-15%',
      code: 'MARÉ15',
      validDays: 45,
      clicks: 87,
    },
    event: {
      id: 'showcase-ev-01',
      title: 'Jantar de Degustação Sabores do Atlântico',
      description: 'Cinco momentos de degustação com peixe e marisco da costa guineense, acompanhados por vinhos seleccionados. Lugares limitados, serviço sentado às 19h30.',
      category: 'Gastronomia',
      daysFromNow: 51,
      hour: 19,
      minute: 30,
      durationHours: 3,
      capacity: 40,
      ticketTypes: [
        { name: 'Degustação completa', priceXOF: 25000, quantity: 32 },
        { name: 'Degustação + harmonização de vinhos', priceXOF: 38000, quantity: 8 },
      ],
    },
    brand: { from: '#0f766e', to: '#134e4a', initials: 'MA' },
  },
  {
    n: 2,
    slug: 'le-baobab',
    name: 'Boulangerie Le Baobab',
    categoryId: 'cat-1',
    subcategoryId: 'Cafés & Pastelarias',
    subcategoryName: 'Cafés & Pastelarias',
    groupGroupId: 'restauracao',
    neighborhood: 'Bandim',
    address: 'Rua 12, nº 8, Bandim, Bissau',
    description:
      'Padaria artesanal franco-guineense com fermentação lenta, pão quente de duas em duas horas, croissants de manteiga e pastéis de nata feitos no dia. Café de origem servido em balcão e esplanada à sombra.',
    tagline: 'Pão artesanal e pastelaria fresca todos os dias',
    openingHours: 'Segunda a sábado: 06:30 - 19:00 · Domingo: 07:00 - 13:00',
    phone: '+245 955 41 02 30',
    whatsapp: '+245955410230',
    publicEmail: 'ola@lebaobab.gw',
    website: 'https://lebaobab.gw',
    priceRange: '$$',
    tier: 'professional',
    features: ['Pão de fermentação lenta', 'Pastelaria fresca', 'Café de origem', 'Esplanada', 'Encomendas para eventos'],
    products: [
      { name: 'Baguete artesanal', priceXOF: 750 },
      { name: 'Croissant de manteiga', priceXOF: 500 },
      { name: 'Pastel de nata', priceXOF: 350 },
      { name: 'Café expresso', priceXOF: 600 },
      { name: 'Cesta de pequeno-almoço', priceXOF: 3500 },
    ],
    languages: ['pt', 'fr'],
    social: { facebook: 'https://facebook.com/lebaobabbissau', instagram: 'https://instagram.com/lebaobabbissau' },
    ratingLabel: 'Muito Bom',
    reviewsCount: 96,
    reviews: [
      { author: 'Mariama Djalo', score: 'muito_bom', comment: 'O melhor pão de Bissau. Os croissants desaparecem antes das nove da manhã.', daysAgo: 4 },
      { author: 'Seku Sanhá', score: 'gostei_muito', comment: 'Pastéis de nata muito bons e café bem servido. Espaço pequeno mas acolhedor.', daysAgo: 17 },
    ],
    posts: [
      { title: 'Pão de fermentação lenta: nova fornada às 17h00', content: 'A partir desta semana há uma fornada extra às 17h00, com pão de fermentação lenta de farinha integral e sementes. Reserve o seu pelo WhatsApp.', image: 'cover', daysAgo: 2, likes: 37 },
      { title: 'Workshop de pão artesanal em Fevereiro', content: 'Vamos abrir um workshop prático de pão artesanal para 20 pessoas. Inscrições no balcão ou por WhatsApp; inclui farinha, avental e o pão que levar para casa.', image: 'gallery', daysAgo: 15, likes: 52 },
    ],
    promotion: {
      title: 'Dois croissants pelo preço de um',
      description: 'Válido de segunda a sexta, entre as 15h00 e as 19h00, no balcão da Boulangerie Le Baobab.',
      badge: '2 por 1',
      code: 'BAOBAB2X1',
      validDays: 30,
      clicks: 64,
    },
    event: {
      id: 'showcase-ev-02',
      title: 'Workshop de Pão Artesanal',
      description: 'Três horas de prática com o mestre padeiro: amassadura, fermentação lenta e cozedura. Cada participante leva para casa duas peças e o caderno de receitas.',
      category: 'Formação',
      daysFromNow: 72,
      hour: 9,
      minute: 0,
      durationHours: 3,
      capacity: 20,
      ticketTypes: [{ name: 'Participação individual', priceXOF: 12000, quantity: 20 }],
    },
    brand: { from: '#b45309', to: '#7c2d12', initials: 'LB' },
  },
  {
    n: 3,
    slug: 'tchon-de-bissau',
    name: 'Hotel Tchon de Bissau',
    categoryId: 'cat-2',
    subcategoryId: 'Hotéis',
    subcategoryName: 'Hotéis',
    groupGroupId: 'hotelaria_saude_educacao',
    neighborhood: 'Bissau Velho',
    address: 'Rua Guerra Mendes, nº 24, Bissau Velho',
    description:
      'Hotel boutique de 18 quartos num edifício restaurado do centro histórico, com pátio, piscina e pequeno-almoço incluído. Receção 24 horas, sala de reuniões e transfer para o aeroporto Osvaldo Vieira.',
    tagline: 'Boutique hotel no centro histórico de Bissau',
    openingHours: 'Receção aberta 24 horas',
    phone: '+245 955 41 03 40',
    whatsapp: '+245955410340',
    publicEmail: 'reservas@tchon.gw',
    website: 'https://tchon.gw',
    priceRange: '$$$',
    tier: 'enterprise',
    features: ['Piscina', 'Pequeno-almoço incluído', 'Wi-Fi em todo o hotel', 'Estacionamento privativo', 'Sala de reuniões', 'Transfer aeroporto', 'Receção 24 horas'],
    products: [
      { name: 'Quarto standard (noite)', priceXOF: 45000 },
      { name: 'Quarto superior (noite)', priceXOF: 62000 },
      { name: 'Suite (noite)', priceXOF: 85000 },
      { name: 'Sala de reuniões (meio dia)', priceXOF: 120000 },
    ],
    languages: ['pt', 'fr', 'en'],
    social: { facebook: 'https://facebook.com/tchondebissau', instagram: 'https://instagram.com/tchondebissau' },
    ratingLabel: 'Muito Bom',
    reviewsCount: 214,
    reviews: [
      { author: 'Luísa Mendes', score: 'muito_bom', comment: 'Quarto amplo, pequeno-almoço variado e piscina muito bem cuidada. Equipa atenciosa.', daysAgo: 9 },
      { author: 'Bacar Embaló', score: 'gostei_muito', comment: 'Óptimo para reuniões: sala bem equipada e Wi-Fi estável.', daysAgo: 26 },
      { author: 'Nabintu Barry', score: 'muito_bom', comment: 'Localização perfeita para conhecer o centro histórico a pé.', daysAgo: 58 },
    ],
    posts: [
      { title: 'Piscina aberta a não hóspedes aos fins de semana', content: 'Aos sábados e domingos, a piscina do pátio está aberta a visitantes, com serviço de bar e espreguiçadeiras. Reservas pelo telefone da receção.', image: 'cover', daysAgo: 5, likes: 71 },
      { title: 'Novo pacote de reuniões com almoço incluído', content: 'O pacote de meio dia inclui sala equipada, coffee break e almoço no restaurante. Ideal para equipas até 30 pessoas. Peça a proposta por e-mail.', image: 'gallery', daysAgo: 19, likes: 24 },
    ],
    promotion: {
      title: 'Terceira noite oferecida',
      description: 'Reserve duas noites em quarto standard ou superior e a terceira é por nossa conta. Válido para estadias até 31 de Março.',
      badge: '3.ª noite grátis',
      code: 'TCHON3',
      validDays: 90,
      clicks: 132,
    },
    event: {
      id: 'showcase-ev-03',
      title: 'Noite de Jazz na Piscina',
      description: 'Concerto intimista do quarteto Bissau Jazz Project à beira da piscina, com bar de cocktails e petiscos. Lugares sentados limitados.',
      category: 'Música',
      daysFromNow: 58,
      hour: 20,
      minute: 0,
      durationHours: 3,
      capacity: 80,
      ticketTypes: [
        { name: 'Entrada geral', priceXOF: 7500, quantity: 60 },
        { name: 'Mesa reservada (2 pessoas)', priceXOF: 20000, quantity: 10 },
      ],
    },
    brand: { from: '#1e3a8a', to: '#0f172a', initials: 'TB' },
  },
  {
    n: 4,
    slug: 'xitole-viagens',
    name: 'Xitole Viagens & Bijagós',
    categoryId: 'cat-3',
    subcategoryId: 'Agências de Viagens',
    subcategoryName: 'Agências de Viagens',
    groupGroupId: 'hotelaria_saude_educacao',
    neighborhood: 'Praça dos Heróis',
    address: 'Avenida dos Combatentes da Liberdade, Praça dos Heróis, Bissau',
    description:
      'Agência de viagens e operador local especializado no arquipélago dos Bijagós: travessias, circuitos de vários dias, aluguer de pirogas e apoio a vistos. Equipa de guias locais com mais de dez anos de experiência.',
    tagline: 'Viagens e circuitos no arquipélago dos Bijagós',
    openingHours: 'Segunda a sexta: 08:30 - 18:00 · Sábado: 09:00 - 13:00',
    phone: '+245 955 41 04 50',
    whatsapp: '+245955410450',
    publicEmail: 'viagens@xitole.gw',
    website: 'https://xitole.gw',
    priceRange: '$$',
    tier: 'premium',
    features: ['Guias locais certificados', 'Circuitos de 1 a 7 dias', 'Aluguer de pirogas', 'Apoio a vistos', 'Seguro de viagem', 'Reservas online'],
    products: [
      { name: 'Travessia Bissau – Bubaque', priceXOF: 25000 },
      { name: 'Circuito Bijagós (3 dias, pensão completa)', priceXOF: 180000 },
      { name: 'Aluguer de piroga com marinheiro (dia)', priceXOF: 45000 },
      { name: 'Transfer aeroporto – hotel', priceXOF: 10000 },
    ],
    languages: ['pt', 'fr', 'en'],
    social: { facebook: 'https://facebook.com/xitoleviagens', instagram: 'https://instagram.com/xitoleviagens' },
    ratingLabel: 'Muito Bom',
    reviewsCount: 74,
    reviews: [
      { author: 'Hawa Nanque', score: 'muito_bom', comment: 'Circuito de três dias muito bem organizado. Guias conhecedores e atentos.', daysAgo: 11 },
      { author: 'Augusto Correia', score: 'gostei_muito', comment: 'Trataram de tudo, incluindo o transfer do aeroporto. Recomendo.', daysAgo: 33 },
    ],
    posts: [
      { title: 'Circuito Orango 2027 já com datas abertas', content: 'Abrimos as datas do circuito de quatro dias à ilha de Orango, com visita à aldeia, observação de hipopótamos e noite em tabanca. Grupos de 6 a 12 pessoas.', image: 'cover', daysAgo: 7, likes: 88 },
      { title: 'Dicas para viajar nos Bijagós na época seca', content: 'Levante cedo para aproveitar o mar calmo, leve protector solar e reserve a travessia com antecedência. Partilhamos as nossas recomendações actualizadas no balcão e por WhatsApp.', image: 'gallery', daysAgo: 22, likes: 43 },
    ],
    promotion: {
      title: '10% em circuitos reservados com 30 dias de antecedência',
      description: 'Desconto aplicável a circuitos de três ou mais dias reservados com pelo menos 30 dias de antecedência.',
      badge: '-10%',
      code: 'XITOLE10',
      validDays: 60,
      clicks: 59,
    },
    event: {
      id: 'showcase-ev-04',
      title: 'Apresentação do Circuito Orango 2027',
      description: 'Sessão aberta com o guia principal: itinerário, época recomendada, o que levar e condições de reserva. No fim há espaço para perguntas e inscrições.',
      category: 'Turismo',
      daysFromNow: 66,
      hour: 18,
      minute: 30,
      durationHours: 2,
      capacity: 60,
      ticketTypes: [{ name: 'Inscrição na sessão', priceXOF: 2000, quantity: 60 }],
    },
    brand: { from: '#0369a1', to: '#0c4a6e', initials: 'XV' },
  },
  {
    n: 5,
    slug: 'clinica-bem-estar',
    name: 'Clínica Bem-Estar Bissau',
    categoryId: 'cat-4',
    subcategoryId: 'Hospitais & Clínicas',
    subcategoryName: 'Hospitais & Clínicas',
    groupGroupId: 'hotelaria_saude_educacao',
    neighborhood: 'Santa Luzia',
    address: 'Rua de Santa Luzia, nº 41, Bissau',
    description:
      'Clínica privada com medicina geral, pediatria, análises clínicas e ecografia no mesmo espaço. Marcações por telefone ou WhatsApp, atendimento em português, francês e crioulo e resultados entregues em 24 horas.',
    tagline: 'Cuidados de saúde com marcação no mesmo dia',
    openingHours: 'Segunda a sexta: 08:00 - 19:00 · Sábado: 08:00 - 13:00',
    phone: '+245 955 41 05 60',
    whatsapp: '+245955410560',
    publicEmail: 'marcacoes@bemestarbissau.gw',
    website: 'https://bemestarbissau.gw',
    priceRange: '$$',
    tier: 'professional',
    features: ['Marcação por WhatsApp', 'Análises no local', 'Pediatria', 'Ecografia', 'Atendimento em português, francês e crioulo', 'Resultados em 24 horas'],
    products: [
      { name: 'Consulta de medicina geral', priceXOF: 15000 },
      { name: 'Consulta de pediatria', priceXOF: 18000 },
      { name: 'Análises clínicas (perfil básico)', priceXOF: 22000 },
      { name: 'Ecografia', priceXOF: 25000 },
    ],
    languages: ['pt', 'fr'],
    social: { facebook: 'https://facebook.com/clinicabemestarbissau' },
    ratingLabel: 'Muito Bom',
    reviewsCount: 63,
    reviews: [
      { author: 'Kadiatu Sow', score: 'muito_bom', comment: 'Atendimento rápido e explicações claras. Consegui marcação no mesmo dia.', daysAgo: 8 },
      { author: 'Mamadu Cassamá', score: 'gostei_muito', comment: 'Levámos o nosso filho à pediatria e fomos muito bem tratados.', daysAgo: 29 },
    ],
    posts: [
      { title: 'Check-up anual: o que inclui e para quem é recomendado', content: 'O nosso check-up anual inclui consulta, análises básicas e medição de tensão arterial. Recomendado a adultos a partir dos 35 anos, uma vez por ano.', image: 'cover', daysAgo: 6, likes: 28 },
      { title: 'Marcações de pediatria também ao sábado', content: 'Reforçámos a equipa de pediatria aos sábados de manhã. Marque pelo WhatsApp e evite filas.', image: 'gallery', daysAgo: 20, likes: 19 },
    ],
    promotion: {
      title: 'Check-up anual com 20% de desconto',
      description: 'Consulta de medicina geral, análises básicas e medição de tensão arterial. Válido para marcações até 31 de Janeiro.',
      badge: '-20%',
      code: 'BEMESTAR20',
      validDays: 55,
      clicks: 41,
    },
    brand: { from: '#15803d', to: '#14532d', initials: 'CB' },
  },
  {
    n: 6,
    slug: 'studio-fit-bissau',
    name: 'Studio Fit Bissau',
    categoryId: 'cat-4',
    subcategoryId: 'Ginásios',
    subcategoryName: 'Ginásios',
    groupGroupId: 'hotelaria_saude_educacao',
    neighborhood: 'Antula',
    address: 'Estrada de Antula, ao lado do mercado, Bissau',
    description:
      'Ginásio de bairro com musculação, treino funcional e aulas de grupo de segunda a sábado. Planos mensais acessíveis, acompanhamento de treinador e avaliação física inicial gratuita.',
    tagline: 'Musculação e treino funcional em Antula',
    openingHours: 'Segunda a sexta: 06:00 - 22:00 · Sábado: 08:00 - 14:00',
    phone: '+245 955 41 06 70',
    whatsapp: '+245955410670',
    publicEmail: 'ola@studiofit.gw',
    website: 'https://studiofit.gw',
    priceRange: '$$',
    tier: 'professional',
    features: ['Musculação', 'Treino funcional', 'Aulas de grupo', 'Avaliação física inicial', 'Vestiários com duche', 'Planos mensais'],
    products: [
      { name: 'Mensalidade', priceXOF: 25000 },
      { name: 'Aula avulsa', priceXOF: 3000 },
      { name: 'Pack de 10 aulas', priceXOF: 25000 },
      { name: 'Personal training (sessão)', priceXOF: 12000 },
    ],
    languages: ['pt', 'en'],
    social: { instagram: 'https://instagram.com/studiofitbissau' },
    ratingLabel: 'Muito Bom',
    reviewsCount: 87,
    reviews: [
      { author: 'Suleimane Mané', score: 'muito_bom', comment: 'Equipamento cuidado e treinadores disponíveis. As aulas de funcional são exigentes mas divertidas.', daysAgo: 5 },
      { author: 'Djenabu Camará', score: 'gostei_muito', comment: 'Bom ambiente e horários flexíveis. A avaliação inicial ajudou-me a definir objectivos.', daysAgo: 24 },
    ],
    posts: [
      { title: 'Nova grelha de aulas de grupo', content: 'A partir de segunda-feira há aulas de funcional às 07h00 e às 18h30, e spinning às 19h30. Consulte a grelha completa na recepção.', image: 'cover', daysAgo: 4, likes: 33 },
      { title: 'Avaliação física gratuita para novos membros', content: 'Todos os novos membros têm direito a avaliação física inicial e plano de treino personalizado, sem custo adicional.', image: 'gallery', daysAgo: 18, likes: 25 },
    ],
    promotion: {
      title: 'Primeira semana gratuita',
      description: 'Experimente todas as aulas e a sala de musculação durante sete dias, sem compromisso.',
      badge: '1.ª semana grátis',
      code: 'FIT7',
      validDays: 40,
      clicks: 76,
    },
    event: {
      id: 'showcase-ev-05',
      title: 'Aula Aberta de Treino Funcional',
      description: 'Sessão de uma hora orientada por dois treinadores, aberta a todos os níveis. Traga roupa confortável e água; o material é fornecido.',
      category: 'Desporto',
      daysFromNow: 44,
      hour: 8,
      minute: 0,
      durationHours: 1,
      capacity: 40,
      ticketTypes: [{ name: 'Participação', priceXOF: 2000, quantity: 40 }],
    },
    brand: { from: '#ea580c', to: '#9a3412', initials: 'SF' },
  },
  {
    n: 7,
    slug: 'instituto-saber-mais',
    name: 'Instituto Saber+',
    categoryId: 'cat-5',
    subcategoryId: 'Formação Profissional',
    subcategoryName: 'Formação Profissional',
    groupGroupId: 'hotelaria_saude_educacao',
    neighborhood: 'Cuntum',
    address: 'Rua de Cuntum, nº 15, Bissau',
    description:
      'Instituto de formação profissional com cursos de informática, Excel avançado, contabilidade prática e línguas. Turmas reduzidas de manhã e ao anoitecer, formadores certificados e certificado no final do curso.',
    tagline: 'Formação prática para o mercado de trabalho',
    openingHours: 'Segunda a sexta: 08:00 - 21:00 · Sábado: 09:00 - 14:00',
    phone: '+245 955 41 07 80',
    whatsapp: '+245955410780',
    publicEmail: 'inscricoes@sabermais.gw',
    website: 'https://sabermais.gw',
    priceRange: '$$',
    tier: 'professional',
    features: ['Turmas reduzidas', 'Formadores certificados', 'Horários de manhã e anoitecer', 'Certificado no final', 'Computadores disponíveis', 'Pagamento em prestações'],
    products: [
      { name: 'Curso de informática básica (3 meses)', priceXOF: 45000 },
      { name: 'Excel avançado (2 meses)', priceXOF: 55000 },
      { name: 'Curso de inglês (trimestre)', priceXOF: 60000 },
      { name: 'Contabilidade prática (3 meses)', priceXOF: 75000 },
    ],
    languages: ['pt', 'en'],
    social: { facebook: 'https://facebook.com/institutosabermais' },
    ratingLabel: 'Muito Bom',
    reviewsCount: 52,
    reviews: [
      { author: 'Binta Ndiaye', score: 'muito_bom', comment: 'Fiz o curso de Excel avançado e apliquei logo no trabalho. Formadora muito clara.', daysAgo: 13 },
      { author: 'Aliu Gomes', score: 'gostei_muito', comment: 'Boa organização e turmas pequenas. Recomendo o curso de contabilidade.', daysAgo: 37 },
    ],
    posts: [
      { title: 'Inscrições abertas para o trimestre de Janeiro', content: 'Estão abertas as inscrições para informática básica, Excel avançado, inglês e contabilidade prática. Turmas de manhã e ao anoitecer, com vagas limitadas.', image: 'cover', daysAgo: 3, likes: 41 },
      { title: 'Novo módulo de contabilidade para pequenos negócios', content: 'Criámos um módulo prático de contabilidade para comerciantes e gestores de pequenos negócios, com estudos de caso reais e apoio na organização documental.', image: 'gallery', daysAgo: 16, likes: 27 },
    ],
    promotion: {
      title: 'Matrícula gratuita até 15 de Dezembro',
      description: 'Isenção do valor de matrícula em qualquer curso do trimestre de Janeiro, para inscrições até 15 de Dezembro.',
      badge: 'Matrícula grátis',
      code: 'SABERMAIS',
      validDays: 20,
      clicks: 48,
    },
    brand: { from: '#7c3aed', to: '#4c1d95', initials: 'S+' },
  },
  {
    n: 8,
    slug: 'atelier-no-balur',
    name: 'Atelier Nô Balur',
    categoryId: 'cat-7',
    subcategoryId: 'Moda & Boutiques',
    subcategoryName: 'Moda & Boutiques',
    groupGroupId: 'restauracao',
    neighborhood: 'Caracol',
    address: 'Rua do Caracol, nº 33, Bissau',
    description:
      'Atelier de moda guineense contemporânea: peças em wax e algodão, alfaiataria à medida e colecções limitadas produzidas em Bissau. Trabalhamos com costureiras locais e aceitamos encomendas personalizadas.',
    tagline: 'Moda guineense contemporânea feita em Bissau',
    openingHours: 'Segunda a sábado: 09:30 - 19:00',
    phone: '+245 955 41 08 90',
    whatsapp: '+245955410890',
    publicEmail: 'atelier@nobalur.gw',
    website: 'https://nobalur.gw',
    priceRange: '$$$',
    tier: 'premium',
    features: ['Peças em edição limitada', 'Alfaiataria à medida', 'Tecidos de produção local', 'Encomendas personalizadas', 'Provas por marcação'],
    products: [
      { name: 'Vestido Nô Balur', priceXOF: 38000 },
      { name: 'Camisa em wax', priceXOF: 18000 },
      { name: 'Bolsa artesanal', priceXOF: 12000 },
      { name: 'Alfaiataria à medida (desde)', priceXOF: 45000 },
    ],
    languages: ['pt', 'fr', 'en'],
    social: { facebook: 'https://facebook.com/ateliernobalur', instagram: 'https://instagram.com/ateliernobalur' },
    ratingLabel: 'Muito Bom',
    reviewsCount: 69,
    reviews: [
      { author: 'Ramatulai Baldé', score: 'muito_bom', comment: 'Mandaram fazer um vestido para um casamento e ficou perfeito. Acabamentos de grande qualidade.', daysAgo: 10 },
      { author: 'Josefa Lopes', score: 'gostei_muito', comment: 'Tecidos bonitos e atendimento paciente nas provas.', daysAgo: 31 },
    ],
    posts: [
      { title: 'Colecção Tabanca chega à loja do Caracol', content: 'A nova colecção Tabanca inspira-se nos tecidos e nas cores das tabancas do Sul. Peças em edição limitada, disponíveis na loja e por encomenda.', image: 'cover', daysAgo: 2, likes: 94 },
      { title: 'Como encomendar uma peça à medida', content: 'Escolha o tecido, marque uma prova e nós tratamos do resto. O prazo médio é de duas semanas; encomendas urgentes por WhatsApp.', image: 'gallery', daysAgo: 14, likes: 38 },
    ],
    promotion: {
      title: '25% na colecção Tabanca',
      description: 'Desconto em todas as peças da colecção Tabanca, na loja do Caracol. Stock limitado.',
      badge: '-25%',
      code: 'BALUR25',
      validDays: 35,
      clicks: 118,
    },
    event: {
      id: 'showcase-ev-06',
      title: 'Desfile Colecção Tabanca 2027',
      description: 'Apresentação da colecção Tabanca com 24 looks, música ao vivo e espaço de exposição de tecelagem local. Cocktail de boas-vindas incluído.',
      category: 'Moda',
      daysFromNow: 93,
      hour: 19,
      minute: 0,
      durationHours: 3,
      capacity: 120,
      ticketTypes: [
        { name: 'Entrada geral', priceXOF: 10000, quantity: 100 },
        { name: 'Frente de palco', priceXOF: 20000, quantity: 20 },
      ],
    },
    brand: { from: '#be123c', to: '#701a24', initials: 'NB' },
  },
  {
    n: 9,
    slug: 'auto-center-bor',
    name: 'Auto Center Bor',
    categoryId: 'cat-8',
    subcategoryId: 'Oficinas Mecânicas',
    subcategoryName: 'Oficinas Mecânicas',
    groupGroupId: 'servicos_profissionais',
    neighborhood: 'Bor',
    address: 'Estrada de Bor, km 4, Bissau',
    description:
      'Oficina com diagnóstico electrónico, mecânica geral, travões, suspensão e revisões periódicas. Orçamento por escrito antes de qualquer intervenção e garantia de 30 dias na mão de obra.',
    tagline: 'Mecânica com diagnóstico electrónico e orçamento prévio',
    openingHours: 'Segunda a sexta: 08:00 - 18:00 · Sábado: 08:00 - 13:00',
    phone: '+245 955 41 09 10',
    whatsapp: '+245955410910',
    publicEmail: 'oficina@autocenterbor.gw',
    website: 'https://autocenterbor.gw',
    priceRange: '$$',
    tier: 'professional',
    features: ['Diagnóstico electrónico', 'Orçamento por escrito', 'Garantia de 30 dias', 'Peças originais e alternativas', 'Recepção de veículos por marcação'],
    products: [
      { name: 'Revisão completa', priceXOF: 35000 },
      { name: 'Mudança de óleo e filtros', priceXOF: 22000 },
      { name: 'Diagnóstico electrónico', priceXOF: 10000 },
      { name: 'Alinhamento e balanceamento', priceXOF: 18000 },
    ],
    languages: ['pt', 'fr'],
    social: { facebook: 'https://facebook.com/autocenterbor' },
    ratingLabel: 'Muito Bom',
    reviewsCount: 58,
    reviews: [
      { author: 'Ibraima Djalo', score: 'muito_bom', comment: 'Explicaram tudo antes de mexer no carro e o orçamento foi cumprido. Serviço sério.', daysAgo: 7 },
      { author: 'Cherno Embaló', score: 'gostei_muito', comment: 'Resolveram um problema electrónico que outras oficinas não encontraram.', daysAgo: 27 },
    ],
    posts: [
      { title: 'Check-list antes da época das chuvas', content: 'Pneus, escovas, travões e nível dos líquidos: partilhamos a check-list que usamos nas revisões de Maio a Julho. Passe pela oficina para uma verificação rápida.', image: 'cover', daysAgo: 8, likes: 22 },
      { title: 'Diagnóstico electrónico disponível sem marcação', content: 'Reforçámos a equipa de diagnóstico: pode passar de manhã sem marcação e sair com o relatório impresso.', image: 'gallery', daysAgo: 23, likes: 16 },
    ],
    promotion: {
      title: 'Revisão com lavagem oferecida',
      description: 'Em qualquer revisão completa, a lavagem exterior do veículo é oferecida.',
      badge: 'Lavagem grátis',
      code: 'BORLAVA',
      validDays: 50,
      clicks: 34,
    },
    brand: { from: '#334155', to: '#0f172a', initials: 'AC' },
  },
  {
    n: 10,
    slug: 'tera-nova-imobiliaria',
    name: 'Tera Nova Imobiliária',
    categoryId: 'cat-9',
    subcategoryId: 'Agências Imobiliárias',
    subcategoryName: 'Agências Imobiliárias',
    groupGroupId: 'corporativo_financeiro',
    neighborhood: 'Bairro Militar',
    address: 'Avenida dos Combatentes, Bairro Militar, Bissau',
    description:
      'Mediação de arrendamento e venda de casas, apartamentos e espaços comerciais em Bissau. Visitas acompanhadas, verificação documental e apoio jurídico na assinatura do contrato.',
    tagline: 'Arrendamento e venda com apoio documental',
    openingHours: 'Segunda a sexta: 09:00 - 18:00 · Sábado: 09:00 - 13:00',
    phone: '+245 955 41 10 20',
    whatsapp: '+245955410200',
    publicEmail: 'geral@teranova.gw',
    website: 'https://teranova.gw',
    priceRange: '$$$',
    tier: 'premium',
    features: ['Visitas acompanhadas', 'Verificação documental', 'Apoio jurídico no contrato', 'Fotografia e tour virtual', 'Gestão de arrendamento'],
    products: [
      { name: 'Arrendamento T3 no Bairro Militar (mês)', priceXOF: 350000 },
      { name: 'Venda de apartamento T2', priceXOF: 32000000 },
      { name: 'Escritório de 120 m² (mês)', priceXOF: 450000 },
      { name: 'Avaliação de imóvel', priceXOF: 25000 },
    ],
    languages: ['pt', 'fr', 'en'],
    social: { facebook: 'https://facebook.com/teranovaimobiliaria', instagram: 'https://instagram.com/teranovaimobiliaria' },
    ratingLabel: 'Muito Bom',
    reviewsCount: 46,
    reviews: [
      { author: 'Mariama Sanhá', score: 'muito_bom', comment: 'Ajudaram-nos a encontrar casa e a rever o contrato. Processo transparente do início ao fim.', daysAgo: 12 },
      { author: 'Domingos Pereira', score: 'gostei_muito', comment: 'Visitas bem organizadas e sem pressão para decidir.', daysAgo: 35 },
    ],
    posts: [
      { title: 'Apartamentos T2 disponíveis para visita esta semana', content: 'Temos três apartamentos T2 mobilados no Bairro Militar e em Santa Luzia, com visita acompanhada esta semana. Envie mensagem para marcar horário.', image: 'cover', daysAgo: 4, likes: 26 },
      { title: 'O que verificar antes de assinar um contrato de arrendamento', content: 'Título de propriedade, estado do imóvel, condições de rescisão e responsabilidades de manutenção: resumimos os pontos essenciais que verificamos em cada contrato.', image: 'gallery', daysAgo: 17, likes: 47 },
    ],
    promotion: {
      title: 'Avaliação gratuita do seu imóvel',
      description: 'Avaliação de mercado sem custo para proprietários que pretendam arrendar ou vender este mês.',
      badge: 'Avaliação grátis',
      code: 'TERANOVA',
      validDays: 28,
      clicks: 39,
    },
    brand: { from: '#0d9488', to: '#115e59', initials: 'TN' },
  },
];

function logoSvg(initials: string, from: string, to: string): string {
  const fontSize = initials.length > 2 ? 92 : 118;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320" role="img">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="320" height="320" rx="72" fill="url(#brand)"/>
  <circle cx="160" cy="160" r="108" fill="none" stroke="#ffffff" stroke-opacity="0.24" stroke-width="2"/>
  <text x="160" y="168" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="#ffffff" letter-spacing="4">${initials}</text>
</svg>
`;
}

function writeAssets(business: ShowcaseBusiness): void {
  const dir = path.join(ASSET_ROOT, business.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'logo.svg'),
    logoSvg(business.brand.initials, business.brand.from, business.brand.to),
    'utf8',
  );
}

function buildBusinessData(business: ShowcaseBusiness, ownerEmail: string): Record<string, unknown> {
  const id = `showcase-co-${pad2(business.n)}`;
  const assetBase = `/uploads/showcase/${business.slug}`;
  const logo = `${assetBase}/logo.svg`;
  const coverImage = `${assetBase}/cover.jpg`;
  const gallery = [coverImage, `${assetBase}/gallery-1.jpg`];

  const posts = business.posts.map((post, index) => {
    const createdAt = isoDaysAgo(post.daysAgo, 9 + index);
    return {
      id: `showcase-post-${pad2(business.n)}-${index + 1}`,
      businessId: id,
      businessName: business.name,
      businessLogo: logo,
      title: post.title,
      content: post.content,
      imageUrl: post.image === 'cover' ? coverImage : gallery[1],
      mediaType: 'image',
      status: 'approved',
      createdAt,
      publishedAt: createdAt,
      likesCount: post.likes,
      sharesCount: Math.round(post.likes / 4),
      comments: [],
      reactions: { like: post.likes, love: Math.round(post.likes / 3), wow: 2, haha: 0, sad: 0, angry: 0 },
      isPlanSubscriberPost: business.tier === 'premium' || business.tier === 'enterprise',
      planBadge: business.tier === 'enterprise' ? 'Plano Empresa' : business.tier === 'premium' ? 'Plano Premium' : 'Plano Profissional',
    };
  });

  const promotion = {
    id: `showcase-promo-${pad2(business.n)}`,
    businessId: id,
    businessName: business.name,
    title: business.promotion.title,
    description: business.promotion.description,
    discountBadge: business.promotion.badge,
    code: business.promotion.code,
    validUntil: isoDaysFromNow(business.promotion.validDays, 23, 59),
    startsAt: isoDaysAgo(7, 9),
    activatedAt: isoDaysAgo(7, 9),
    imageUrl: coverImage,
    mediaType: 'image',
    categoryName: business.subcategoryName,
    neighborhood: business.neighborhood,
    isActive: true,
    status: 'active',
    clicksCount: business.promotion.clicks,
  };

  const reviews = business.reviews.map((review, index) => ({
    id: `showcase-review-${pad2(business.n)}-${index + 1}`,
    businessId: id,
    authorName: review.author,
    authorPhone: `+245 95• •• •${pad2(11 + index)}`,
    qualitativeScore: review.score,
    comment: review.comment,
    createdAt: isoDaysAgo(review.daysAgo, 15),
    verifiedSms: true,
    status: 'approved',
  }));

  return {
    id,
    name: business.name,
    slug: business.slug,
    logo,
    coverImage,
    gallery,
    description: business.description,
    tagline: business.tagline,
    categoryId: business.categoryId,
    subcategoryId: business.subcategoryId,
    groupGroupId: business.groupGroupId,
    tier: business.tier,
    neighborhood: business.neighborhood,
    address: business.address,
    phone: business.phone,
    whatsapp: business.whatsapp,
    email: ownerEmail,
    publicEmail: business.publicEmail,
    website: business.website,
    openingHours: business.openingHours,
    isOpenNow: true,
    priceRange: business.priceRange,
    status: 'active',
    verified: true,
    featured: false,
    homepageFeaturedOrder: null,
    ratingLabel: business.ratingLabel,
    reviewsCount: business.reviewsCount,
    reviews,
    posts,
    promotions: [promotion],
    features: business.features,
    products: business.products.map((product, index) => ({
      id: `showcase-product-${pad2(business.n)}-${index + 1}`,
      name: product.name,
      category: business.subcategoryName,
      priceXOF: product.priceXOF,
      isAvailable: true,
    })),
    socialLinks: business.social,
    serviceLanguages: business.languages,
    ownerName: `Gestão ${business.name}`,
    ownerEmail,
    createdAt: isoDaysAgo(180 - business.n, 9),
    metrics: {
      views: 900 + business.n * 137,
      whatsappClicks: 60 + business.n * 11,
      phoneClicks: 30 + business.n * 6,
      directionsClicks: 18 + business.n * 4,
      websiteClicks: 12 + business.n * 3,
    },
    subscriptionRenewDate: isoDaysFromNow(28, 0, 0).slice(0, 10),
    subscriptionPeriod: 'monthly',
    subscriptionStatus: 'active',
    subscriptionStartedAt: isoDaysAgo(150 - business.n, 9),
    postsQuotaRemaining: business.tier === 'professional' ? 6 : 10,
  };
}

async function upsertBusiness(client: PoolClient, business: ShowcaseBusiness, passwordHash: string): Promise<void> {
  const id = `showcase-co-${pad2(business.n)}`;
  const userId = `showcase-usr-${pad2(business.n)}`;
  const email = `empresa.showcase${pad2(business.n)}@${SEED_DOMAIN}`;
  const data = buildBusinessData(business, email);

  const existingUser = await client.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
  if (existingUser.rowCount === 0) {
    await client.query(
      `INSERT INTO users (id, name, email, phone, neighborhood, role, account_status, password_hash, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'business','active',$6,NOW(),NOW())`,
      [userId, `Gestão ${business.name}`, email, business.phone, business.neighborhood, passwordHash],
    );
  }

  await client.query(
    `INSERT INTO companies (id, owner_user_id, name, status, category_id, data, created_at, updated_at)
     VALUES ($1,$2,$3,'active',$4,$5::jsonb,NOW(),NOW())
     ON CONFLICT (id) DO UPDATE
       SET owner_user_id=EXCLUDED.owner_user_id,
           name=EXCLUDED.name,
           status=EXCLUDED.status,
           category_id=EXCLUDED.category_id,
           data=EXCLUDED.data,
           updated_at=NOW()`,
    [id, userId, business.name, business.categoryId, JSON.stringify(data)],
  );

  await client.query(
    `INSERT INTO company_members (company_id, user_id, member_role, accepted_at)
     VALUES ($1,$2,'manager',NOW()) ON CONFLICT (company_id, user_id) DO NOTHING`,
    [id, userId],
  );
}

async function upsertEvent(client: PoolClient, business: ShowcaseBusiness, event: ShowcaseEvent): Promise<void> {
  const companyId = `showcase-co-${pad2(business.n)}`;
  const startsAt = isoDaysFromNow(event.daysFromNow, event.hour, event.minute);
  const endsAt = isoDaysFromNow(event.daysFromNow, event.hour + event.durationHours, event.minute);
  const ticketTypes = event.ticketTypes.map((type, index) => ({
    id: `${event.id}-tt-${index + 1}`,
    name: type.name,
    priceXOF: type.priceXOF,
    quantity: type.quantity,
  }));

  const data = {
    id: event.id,
    businessId: companyId,
    title: event.title,
    status: 'published',
    organizerName: business.name,
    organizerLogo: `/uploads/showcase/${business.slug}/logo.svg`,
    category: event.category,
    date: startsAt.slice(0, 10),
    time: `${pad2(event.hour)}:${pad2(event.minute)}`,
    location: business.address,
    neighborhood: business.neighborhood,
    address: business.address,
    coverImage: `/uploads/showcase/${business.slug}/cover.jpg`,
    gallery: [`/uploads/showcase/${business.slug}/cover.jpg`, `/uploads/showcase/${business.slug}/gallery-1.jpg`],
    description: event.description,
    capacity: event.capacity,
    rules: 'Bilhete válido para uma entrada. Apresentar o código QR à entrada do recinto.',
    scannerDoorCode: `SHOW${pad2(business.n)}26`,
    ticketTypes: ticketTypes.map((type) => ({
      id: type.id,
      name: type.name,
      priceXOF: type.priceXOF,
      availableQuantity: type.quantity,
      soldQuantity: 0,
      salesOpen: true,
    })),
  };

  await client.query(
    `INSERT INTO events (id, company_id, title, status, starts_at, ends_at, data, created_at, updated_at)
     VALUES ($1,$2,$3,'published',$4,$5,$6::jsonb,NOW(),NOW())
     ON CONFLICT (id) DO UPDATE
       SET company_id=EXCLUDED.company_id,
           title=EXCLUDED.title,
           status=EXCLUDED.status,
           starts_at=EXCLUDED.starts_at,
           ends_at=EXCLUDED.ends_at,
           data=EXCLUDED.data,
           updated_at=NOW()`,
    [event.id, companyId, event.title, startsAt, endsAt, JSON.stringify(data)],
  );

  for (const type of ticketTypes) {
    await client.query(
      `INSERT INTO ticket_types (id, event_id, name, price_xof, quantity)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (event_id, name) DO UPDATE
         SET price_xof=EXCLUDED.price_xof, quantity=EXCLUDED.quantity`,
      [type.id, event.id, type.name, type.priceXOF, type.quantity],
    );
  }
}

async function clean(client: PoolClient): Promise<void> {
  await client.query("DELETE FROM ticket_types WHERE event_id LIKE 'showcase-ev-%'");
  const events = await client.query("DELETE FROM events WHERE id LIKE 'showcase-ev-%'");
  const members = await client.query("DELETE FROM company_members WHERE company_id LIKE 'showcase-co-%'");
  const companies = await client.query("DELETE FROM companies WHERE id LIKE 'showcase-co-%'");
  const users = await client.query("DELETE FROM users WHERE email LIKE 'empresa.showcase%@guigui.test'");
  console.log(
    `showcase-clean: ${events.rowCount} eventos, ${members.rowCount} vínculos, ${companies.rowCount} empresas, ${users.rowCount} utilizadores removidos.`,
  );
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL obrigatória.');

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    const meta = await client.query('SELECT current_database() AS db');
    const db = String(meta.rows[0].db);
    if (!['guigui', 'guigui_test', 'guigui_demo'].includes(db)) {
      throw new Error(`Base "${db}" não parece ser de desenvolvimento; abortar sem alterações.`);
    }
    console.log(`[showcase] base=${db}`);

    if (process.argv.includes('--clean')) {
      await clean(client);
      return;
    }

    const categories = await client.query('SELECT id FROM categories WHERE id = ANY($1)', [
      [...new Set(BUSINESSES.map((business) => business.categoryId))],
    ]);
    const knownCategories = new Set(categories.rows.map((row) => String(row.id)));
    const missing = BUSINESSES.filter((business) => !knownCategories.has(business.categoryId));
    if (missing.length > 0) {
      throw new Error(`Categorias em falta: ${missing.map((business) => business.categoryId).join(', ')}.`);
    }

    const passwordHash = hashPassword(SEED_PASSWORD);
    await client.query('BEGIN');
    for (const business of BUSINESSES) {
      writeAssets(business);
      await upsertBusiness(client, business, passwordHash);
    }
    let events = 0;
    for (const business of BUSINESSES) {
      if (!business.event) continue;
      await upsertEvent(client, business, business.event);
      events += 1;
    }
    await client.query('COMMIT');

    const summary = await client.query(
      `SELECT id, name, data->>'logo' AS logo, data->>'coverImage' AS cover,
              jsonb_array_length(COALESCE(data->'posts','[]'::jsonb)) AS posts,
              jsonb_array_length(COALESCE(data->'promotions','[]'::jsonb)) AS promotions
         FROM companies WHERE id LIKE 'showcase-co-%' ORDER BY id`,
    );
    console.log(`[showcase] empresas=${summary.rowCount} eventos=${events}`);
    for (const row of summary.rows) {
      console.log(`  ${row.id} · ${row.name} · posts=${row.posts} promoções=${row.promotions} · cover=${row.cover}`);
    }
    const linked = await client.query(
      `SELECT COUNT(*)::int AS n FROM events WHERE id LIKE 'showcase-ev-%' AND status='published'`,
    );
    console.log(`[showcase] eventos publicados na base=${linked.rows[0].n}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[showcase] FALHOU:', error instanceof Error ? error.message : error);
  process.exit(1);
});
