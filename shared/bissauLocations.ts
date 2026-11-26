/**
 * Catálogo único de localidades do Sector Autónomo de Bissau.
 *
 * Fonte de verdade partilhada pelo servidor (seed da tabela `locations`) e pelo
 * frontend (filtros e formulários). A divisão por sectores segue a numeração
 * usada pelo recenseamento do INE para o Sector Autónomo de Bissau; os bairros
 * fora dessa numeração oficial aparecem no grupo "Zonas e áreas de expansão".
 *
 * `aliases` guarda as grafias alternativas já usadas nos registos existentes
 * (por exemplo "Praça (Centro)" ou "Baciaque"), para que o filtro continue a
 * encontrar empresas e eventos antigos sem duplicar localidades.
 */

export type BissauLocationKind = 'bairro' | 'zona';

export interface BissauLocationSeed {
  /** Identificador único e estável. */
  id: string;
  /** Nome canónico apresentado na interface. */
  name: string;
  /** Sector ou zona administrativa a que pertence. */
  sector: string;
  /** Ordem do sector na lista. */
  sectorOrder: number;
  kind: BissauLocationKind;
  /** Grafias alternativas usadas em registos antigos. */
  aliases: string[];
  /** Ordem dentro do sector. */
  sortOrder: number;
}

export interface BissauLocationDto {
  id: string;
  name: string;
  sector: string;
  sectorOrder: number;
  kind: BissauLocationKind;
  aliases: string[];
  sortOrder: number;
  isActive: boolean;
}

export interface BissauLocationGroup {
  sector: string;
  sectorOrder: number;
  locations: BissauLocationDto[];
}

export interface BissauLocationCatalogResponse {
  locations: BissauLocationDto[];
  groups: BissauLocationGroup[];
  updatedAt: string;
}

const sector = (order: number, name: string) => `Sector ${order} · ${name}`;

export const BISSAU_SECTORS: readonly { order: number; name: string }[] = [
  { order: 1, name: sector(1, 'Centro Histórico') },
  { order: 2, name: sector(2, 'Calequir e Cupelom') },
  { order: 3, name: sector(3, 'Bandim, Belém e Praça dos Heróis') },
  { order: 4, name: sector(4, 'Antula e Lala Quema') },
  { order: 5, name: sector(5, 'Ajuda e Missira') },
  { order: 6, name: sector(6, 'Cuntum e Quelelé') },
  { order: 7, name: sector(7, 'Bairro Militar e Plak 1') },
  { order: 8, name: sector(8, 'Hafia e Plak 2') },
  { order: 9, name: 'Zonas e áreas de expansão' },
];

const location = (
  id: string,
  name: string,
  sectorOrder: number,
  kind: BissauLocationKind,
  aliases: string[],
  sortOrder: number,
): BissauLocationSeed => ({
  id,
  name,
  sector: BISSAU_SECTORS.find((entry) => entry.order === sectorOrder)?.name || BISSAU_SECTORS[BISSAU_SECTORS.length - 1].name,
  sectorOrder,
  kind,
  aliases,
  sortOrder,
});

export const BISSAU_LOCATIONS: readonly BissauLocationSeed[] = [
  // Sector 1 — Centro Histórico
  location('loc-s1-bissau-velho', 'Bissau Velho', 1, 'bairro', ['Bissau-Velho', 'Bissau Velho (Centro)'], 10),
  location('loc-s1-praca', 'Praça', 1, 'bairro', ['Praça (Centro)', 'Centro', 'Centro de Cidade', 'Centro Administrativo'], 20),
  location('loc-s1-chao-de-papel', 'Chão de Papel', 1, 'bairro', [], 30),
  location('loc-s1-mindara', 'Mindará', 1, 'bairro', ['Mindara'], 40),
  location('loc-s1-reino-ga-beafada', 'Reino Gã-Beafada', 1, 'bairro', ['Reino Gambeafada', 'Reino Gã Beafada'], 50),
  location('loc-s1-setembro', 'Setembro', 1, 'bairro', [], 60),
  location('loc-s1-tchada', 'Tchada', 1, 'bairro', ['Tcada'], 70),
  location('loc-s1-varela', 'Varela', 1, 'bairro', ['Bairro Varela'], 80),
  location('loc-s1-ilheu-de-rei', 'Ilhéu de Rei', 1, 'bairro', ['Ilheu de Rei'], 90),
  location('loc-s1-achada', 'Achada', 1, 'bairro', ['Bairro Achada'], 100),
  location('loc-s1-alto-crim', 'Alto Crim', 1, 'bairro', ['Alto-Crim'], 110),
  location('loc-s1-bissau-velho-praca', 'Praça dos Heróis', 3, 'bairro', ['Praca dos Herois'], 30),

  // Sector 2 — Calequir e Cupelom
  location('loc-s2-amedalai', 'Amedalai', 2, 'bairro', ['Bairro de Amedalai'], 10),
  location('loc-s2-calequir', 'Calequir', 2, 'bairro', ['Calequale', 'Calequire'], 20),
  location('loc-s2-cupelom', 'Cupelom de Cima e Baixo', 2, 'bairro', ['Cupelum', 'Cupelom', 'Cupelão', 'Cupelom Cima e Baixo'], 30),
  location('loc-s2-pefine', 'Pefine', 2, 'bairro', ['Bairro de Pefine'], 40),
  location('loc-s2-rossiu', 'Rossiu', 2, 'bairro', ['Rossio'], 50),
  location('loc-s2-sintra-nema', 'Sintra Nema', 2, 'bairro', ['Sintra'], 60),

  // Sector 3 — Bandim, Belém e Praça dos Heróis
  location('loc-s3-bandim', 'Bandim', 3, 'bairro', ['Bandim 1', 'Bandim 2', 'Bandim I', 'Bandim II', 'Bandim Zona 1 a 8', 'Bandim Zona 1 á 8'], 10),
  location('loc-s3-belem', 'Belém', 3, 'bairro', ['Belem'], 20),

  // Sector 4 — Antula e Lala Quema
  location('loc-s4-antula', 'Antula', 4, 'bairro', ['Antula Bono', 'Bono', 'Cuio', "N'Dam Lero", "N'Dam Téte", 'Comité'], 10),
  location('loc-s4-djogoro', 'Djogoro', 4, 'bairro', [], 20),
  location('loc-s4-empantcha', 'Empantcha', 4, 'bairro', ["N'Pantcha", 'Mpantcha', 'Empantchá'], 30),
  location('loc-s4-flefe', 'Flefe', 4, 'bairro', [], 40),
  location('loc-s4-lala-quema', 'Lala Quema', 4, 'bairro', ['Lala Quema 1ª, 2ª e 3ª Fase'], 50),
  location('loc-s4-lero', 'Lero', 4, 'bairro', [], 60),
  location('loc-s4-ndame', "N'Dame", 4, 'bairro', ["N'Dame", 'Ndame'], 70),
  location('loc-s4-pluba', 'Pluba', 4, 'bairro', ['Pluba de Cima e Baixo', 'Coco-Plubá'], 80),
  location('loc-s4-santa-luzia', 'Santa Luzia', 4, 'bairro', ['Bairro de Santa Luzia', 'Santa Luiza'], 90),
  location('loc-s4-sao-vicente-paulo', 'São Vicente Paulo', 4, 'bairro', ['Sao Vicente Paulo'], 100),
  location('loc-s4-tete', 'Tete', 4, 'bairro', ['Téte', 'Bairro de Tete'], 110),
  location('loc-s4-massa-cobra', 'Massa Cobra', 4, 'bairro', ['Massa-Cobra'], 120),

  // Sector 5 — Ajuda e Missira
  location('loc-s5-ajuda', 'Ajuda', 5, 'bairro', ["Bairro de Ajuda", "D'Ajuda", 'Ajuda 1ª Fase', 'Ajuda 1ª e 2ª Fase', 'Ajuda 1 e 2 Fase'], 10),
  location('loc-s5-internacional', 'Internacional', 5, 'bairro', ['Bairro Internacional'], 20),
  location('loc-s5-luanda', 'Luanda', 5, 'bairro', ['Bairro de Luanda'], 30),
  location('loc-s5-missira', 'Missira', 5, 'bairro', ['Bairro de Missira'], 40),
  location('loc-s5-madina', 'Madina', 5, 'bairro', ['Madina (Mãe de Água)', 'Bairro de Madina'], 50),
  location('loc-s5-melhoramento', 'Melhoramento', 5, 'bairro', [], 60),

  // Sector 6 — Cuntum e Quelelé
  location('loc-s6-cuntum', 'Cuntum', 6, 'bairro', ['Bairro de Cuntum', 'Contum'], 10),
  location('loc-s6-cuntum-madina', 'Cuntum Madina', 6, 'bairro', ['Contum Madina'], 20),
  location('loc-s6-quelele', 'Quelelé', 6, 'bairro', ['Quelele', 'Quelele (Ponta Neto, Sul e Bono)', 'Ponta Neto'], 30),

  // Sector 7 — Bairro Militar e Plak 1
  location('loc-s7-bairro-militar', 'Bairro Militar', 7, 'bairro', [], 10),
  location('loc-s7-bissaque', 'Bissaque', 7, 'bairro', ['Bissauque', 'Bissaquel'], 20),
  location('loc-s7-djolo', 'Djolo', 7, 'bairro', [], 30),
  location('loc-s7-penha', 'Penha', 7, 'bairro', ['Penha 1ª, 2ª e 3ª Fase', 'Penha-Bor', 'Bôr', 'Bor'], 40),
  location('loc-s7-plak-1', 'Plak 1', 7, 'bairro', ['Plack 1', 'Plack I', 'Plak I'], 50),
  location('loc-s7-sao-paulo', 'São Paulo', 7, 'bairro', ['Sao Paulo'], 60),
  location('loc-s7-bra', 'Brá', 7, 'bairro', ['Bairro Brá', 'Brá (BCEAO)', 'Zona Industrial de Brá'], 70),

  // Sector 8 — Hafia e Plak 2
  location('loc-s8-hafia', 'Hafia', 8, 'bairro', ['Áfia', 'Afia', 'Bairro Hafia'], 10),
  location('loc-s8-plak-2', 'Plak 2', 8, 'bairro', ['Plack 2', 'Plack II', 'Plak II'], 20),

  // Zonas e áreas de expansão
  location('loc-z-caracol', 'Caracol', 9, 'zona', [], 10),
  location('loc-z-reno', 'Reno', 9, 'zona', ['Bairro Reno'], 20),
  location('loc-z-cupul', 'Cupul', 9, 'zona', ['Bairro Cupul'], 30),
  location('loc-z-granja-pessube', 'Granja Pessubé', 9, 'zona', ['Granja Pessube'], 40),
  location('loc-z-chapa', 'Chapa de Bissau', 9, 'zona', ['Chapa', 'Chapa de Bissau'], 50),
  location('loc-z-porto', 'Porto de Bissau', 9, 'zona', ['Porto'], 60),
  location('loc-z-co', 'Bairro de Có', 9, 'zona', ['Bairro de Co'], 70),
  location('loc-z-encarnacao', 'Bairro de Encarnação', 9, 'zona', ['Bairro de Encarnacao'], 80),
  location('loc-z-cumura', 'Bairro de Cumura', 9, 'zona', [], 90),
  location('loc-z-varzea', 'Bairro da Várzea', 9, 'zona', ['Bairro da Varzea'], 100),
  location('loc-z-farim', 'Bairro do Farim', 9, 'zona', [], 110),
  location('loc-z-minadouro', 'Bairro do Minadouro', 9, 'zona', [], 120),
  location('loc-z-ladeira', 'Bairro da Ladeira', 9, 'zona', [], 130),
  location('loc-z-galpao', 'Bairro do Galpão', 9, 'zona', ['Bairro do Galpao'], 140),
  location('loc-z-sol', 'Bairro de Sol', 9, 'zona', ['Bairro do Sol'], 150),
  location('loc-z-lagoa', 'Bairro da Lagoa', 9, 'zona', [], 160),
  location('loc-z-inacio', 'Bairro do Inácio', 9, 'zona', ['Bairro do Inacio'], 170),
  location('loc-z-mota', 'Bairro da Mota', 9, 'zona', [], 180),
  location('loc-z-coracao-jesus', 'Bairro da Coração de Jesus', 9, 'zona', ['Bairro da Coracao de Jesus'], 190),
  location('loc-z-estados', 'Bairro dos Estados', 9, 'zona', [], 200),
  location('loc-z-embaixadas', 'Zona das Embaixadas', 9, 'zona', [], 210),
  location('loc-z-industrial-bolola', 'Zona Industrial de Bolola', 9, 'zona', ['Bolola'], 220),
  location('loc-z-quinel', 'Quinel', 9, 'zona', ['Quinele'], 230),
  location('loc-z-cupilom', 'Cupilom', 9, 'zona', ['Cupilom', 'Cupilão'], 240),
  location('loc-z-ensino', 'Ensino', 9, 'zona', [], 250),
  location('loc-z-morrinho', 'Morrinho', 9, 'zona', [], 260),
  location('loc-z-largo-aparelho', 'Largo do Aparelho', 9, 'zona', [], 270),
];

const normalise = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Compara um valor de `neighborhood` com a localidade selecionada (nome ou alias). */
export function locationMatches(neighborhood: string | null | undefined, selected: string | null | undefined): boolean {
  if (!selected) return true;
  const candidate = normalise(neighborhood || '');
  if (!candidate) return false;
  const record = BISSAU_LOCATIONS.find((entry) => normalise(entry.name) === normalise(selected) || entry.aliases.some((alias) => normalise(alias) === normalise(selected)));
  if (!record) return candidate === normalise(selected);
  return normalise(record.name) === candidate || record.aliases.some((alias) => normalise(alias) === candidate);
}

export function groupLocations(locations: BissauLocationDto[]): BissauLocationGroup[] {
  const groups = new Map<string, BissauLocationGroup>();
  for (const entry of locations) {
    const existing = groups.get(entry.sector);
    if (existing) existing.locations.push(entry);
    else groups.set(entry.sector, { sector: entry.sector, sectorOrder: entry.sectorOrder, locations: [entry] });
  }
  return Array.from(groups.values())
    .sort((left, right) => left.sectorOrder - right.sectorOrder || left.sector.localeCompare(right.sector, 'pt'))
    .map((group) => ({ ...group, locations: [...group.locations].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt')) }));
}
