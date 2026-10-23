/**
 * Seed de demonstracao: 30 empresas + 50 cidadaos funcionais.
 * 30 contas business (empresa.seed01@guigui.test ... seed30) com a sua
 * company (seed-co-01 ... seed-co-30); 50 cidadaos (cidadao.seed01 ... seed50).
 * Password unica: Guigui2026! (ver DADOS-SEED-DEMO.md).
 * Idempotente: verifica email antes de criar; companies com ON CONFLICT.
 * seed-co-01..20 ficam active; seed-co-21..30 ficam pending (fila do admin).
 * Correr em C:\guigui:  npx tsx scripts/seed-demo-dataset.ts [--clean]
 * --clean remove APENAS registos seed (@guigui.test / seed-co-*).
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { hashPassword } from '../server/modules/identity-access';

const SEED_PASSWORD = 'Guigui2026!';
const SEED_DOMAIN = 'guigui.test';
const APPROVE_COUNT = 20;

const NEIGHBORHOODS = [
  'Bissau Velho', 'Bandim', 'Santa Luzia', 'Caracol', 'Cuntum',
  'Praca dos Herois', 'Bairro Militar', 'Pefine', 'Antula', 'Bor',
];

const CITIZEN_FIRST = [
  'Malam', 'Fatou', 'Ibraima', 'Aissatu', 'Bacar', 'Mariama', 'Adulai',
  'Fatumata', 'Braima', 'Nabintu', 'Cherno', 'Aminata', 'Mamadu', 'Kadiatu',
  'Ussumane', 'Binta', 'Seku', 'Djenabu', 'Aliu', 'Hawa', 'Suleimane',
  'Ramatulai', 'Augusto', 'Luisa', 'Domingos', 'Josefa',
];
const CITIZEN_LAST = [
  'Balde', 'Djalo', 'Sow', 'Barry', 'Cisse', 'Diallo', 'Ndiaye', 'Sanha',
  'Mendy', 'Gomes', 'Fernandes', 'Vieira', 'Correia', 'Mendes', 'Lopes',
  'Cabral', 'Mane', 'Cassama', 'Embalo', 'Nanque', 'Ca', 'Teixeira', 'Pereira',
];

export type CompanySeed = {
  name: string;
  categoryId: string;
  subcategoryId: string;
  neighborhood: string;
  description: string;
};

// 30 empresas distribuidas pelas categorias reais (cat-1 ... cat-16).
export const COMPANIES: CompanySeed[] = [
  { name: 'Cantina Sabores de Bandim', categoryId: 'cat-1', subcategoryId: 'Restaurantes', neighborhood: 'Bandim', description: 'Cozinha guineense caseira: caldo de mancarra, cafriela e peixe grelhado.' },
  { name: 'Cafe Kriol e Pastelaria', categoryId: 'cat-1', subcategoryId: 'Cafes & Pastelarias', neighborhood: 'Bissau Velho', description: 'Cafe, pao quente e pasteis artesanais no coracao de Bissau Velho.' },
  { name: 'Hotel Bijagos Palace', categoryId: 'cat-2', subcategoryId: 'Hoteis', neighborhood: 'Praca dos Herois', description: 'Hotel central com piscina, restaurante e salas de reuniao.' },
  { name: 'Pousada Orango Acolhimento', categoryId: 'cat-2', subcategoryId: 'Pousadas', neighborhood: 'Antula', description: 'Pousada familiar tranquila com pequeno-almoco incluido.' },
  { name: 'Bubaque Tours e Travessias', categoryId: 'cat-3', subcategoryId: 'Ecoturismo Bijagos', neighborhood: 'Bissau Velho', description: 'Travessias e excursoes ecologicas para as ilhas Bijagos.' },
  { name: 'Guia Bissau Walks', categoryId: 'cat-3', subcategoryId: 'Guias Turisticos', neighborhood: 'Bissau Velho', description: 'Visitas guiadas a pe pelo centro historico de Bissau.' },
  { name: 'Clinica Saude Santa Luzia', categoryId: 'cat-4', subcategoryId: 'Hospitais & Clinicas', neighborhood: 'Santa Luzia', description: 'Medicina geral, pediatria e analises clinicas.' },
  { name: 'Farmacia Bandim Central', categoryId: 'cat-4', subcategoryId: 'Farmacias', neighborhood: 'Bandim', description: 'Medicamentos certificados e atendimento permanente.' },
  { name: 'Barbearia Estilo Bissau', categoryId: 'cat-4', subcategoryId: 'Saloes de Cabeleireiro & Barber', neighborhood: 'Caracol', description: 'Cortes modernos, barba e estetica masculina.' },
  { name: 'Colegio Luz do Saber', categoryId: 'cat-5', subcategoryId: 'Escolas & Colegios', neighborhood: 'Cuntum', description: 'Ensino primario e secundario com turmas pequenas.' },
  { name: 'Centro de Linguas Kriol-Frances', categoryId: 'cat-5', subcategoryId: 'Centros de Linguas', neighborhood: 'Praca dos Herois', description: 'Cursos de frances, ingles e portugues para jovens.' },
  { name: 'Advocacia Balde e Associados', categoryId: 'cat-6', subcategoryId: 'Advogados & Solicitadores', neighborhood: 'Praca dos Herois', description: 'Direito civil, comercial e apoio a empresas.' },
  { name: 'Contabilidade Certa GW', categoryId: 'cat-6', subcategoryId: 'Contabilidade & Auditing', neighborhood: 'Bairro Militar', description: 'Contabilidade, fiscalidade e constituicao de empresas.' },
  { name: 'Mercearia Preco Bom', categoryId: 'cat-7', subcategoryId: 'Supermercados & Lojas', neighborhood: 'Bandim', description: 'Mercearia de bairro com frescos diarios e entrega.' },
  { name: 'Boutique Nha Terra Moda', categoryId: 'cat-7', subcategoryId: 'Moda & Boutiques', neighborhood: 'Praca dos Herois', description: 'Roupa africana contemporanea e tecidos tradicionais.' },
  { name: 'Electronica Djitu Ten', categoryId: 'cat-7', subcategoryId: 'Electronica e Informatica', neighborhood: 'Caracol', description: 'Telemoveis, acessorios e reparacoes com garantia.' },
  { name: 'Oficina Auto Rapida Bor', categoryId: 'cat-8', subcategoryId: 'Oficinas Mecanicas', neighborhood: 'Bor', description: 'Mecanica geral, pneus e revisao rapida.' },
  { name: 'Taxis Unidos de Bissau', categoryId: 'cat-8', subcategoryId: 'Servicos de Taxi & Transporte', neighborhood: 'Pefine', description: 'Central de taxis com atendimento por telefone e WhatsApp.' },
  { name: 'Construtora Tchon Firme', categoryId: 'cat-9', subcategoryId: 'Empreiteiros', neighborhood: 'Antula', description: 'Construcao e remodelacao de moradias e lojas.' },
  { name: 'Imobiliaria Casa Nha', categoryId: 'cat-9', subcategoryId: 'Agencias Imobiliarias', neighborhood: 'Praca dos Herois', description: 'Arrendamento e venda de casas e apartamentos em Bissau.' },
  { name: 'Microcredito Kumpu Tera', categoryId: 'cat-10', subcategoryId: 'Microfinancas', neighborhood: 'Bandim', description: 'Microcredito para pequenos negocios e comerciantes.' },
  { name: 'Cambio Rapido Aeroporto', categoryId: 'cat-10', subcategoryId: 'Casas de Cambio & Remessas', neighborhood: 'Bairro Militar', description: 'Cambio e recepcao de remessas com taxas transparentes.' },
  { name: 'NetBlau Internet e Informatica', categoryId: 'cat-11', subcategoryId: 'Provedores de Internet', neighborhood: 'Praca dos Herois', description: 'Internet, recargas e assistencia informatica.' },
  { name: 'Telemoveis Bissau Center', categoryId: 'cat-11', subcategoryId: 'Lojas de Telemoveis', neighborhood: 'Bandim', description: 'Venda e reparacao de telemoveis e acessorios.' },
  { name: 'Cooperativa Caju de Quinhamel', categoryId: 'cat-13', subcategoryId: 'Cooperativas de Caju', neighborhood: 'Antula', description: 'Caju processado e derivados de produtores locais.' },
  { name: 'Pesca Fresca do Cais', categoryId: 'cat-13', subcategoryId: 'Pesca Artesanal', neighborhood: 'Bissau Velho', description: 'Peixe fresco diario direto dos pescadores do cais.' },
  { name: 'Festival Gumbe Nights', categoryId: 'cat-14', subcategoryId: 'Concertos & Festivais', neighborhood: 'Praca dos Herois', description: 'Organizacao de concertos e noites de gumbe.' },
  { name: 'Galeria Arte Bijagos', categoryId: 'cat-14', subcategoryId: 'Exposicoes de Arte', neighborhood: 'Bissau Velho', description: 'Arte guineense: mascaras, tecidos e pintura.' },
  { name: 'Associacao Djuntos Mon', categoryId: 'cat-15', subcategoryId: 'Associacoes Comunitarias', neighborhood: 'Cuntum', description: 'Apoio comunitario, formacao e atividades juvenis.' },
  { name: 'Radio Voz do Povo FM', categoryId: 'cat-16', subcategoryId: 'Radios Comunitarias & Nacionais', neighborhood: 'Pefine', description: 'Radio comunitaria com noticias locais e musica guineense.' },
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function citizenName(index: number): string {
  const first = CITIZEN_FIRST[index % CITIZEN_FIRST.length];
  const last = CITIZEN_LAST[(index * 7 + 3) % CITIZEN_LAST.length];
  return `${first} ${last}`;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL obrigatoria para a seed.');
  const clean = process.argv.includes('--clean');
  const pool = new Pool({ connectionString });
  try {
    if (clean) {
      const delM = await pool.query(
        "DELETE FROM company_members WHERE company_id LIKE 'seed-co-%' OR user_id IN (SELECT id FROM users WHERE email LIKE '%@guigui.test')",
      );
      const delC = await pool.query("DELETE FROM companies WHERE id LIKE 'seed-co-%'");
      const delU = await pool.query("DELETE FROM users WHERE email LIKE '%@guigui.test'");
      console.log(`seed-clean: ${delM.rowCount} vinculos, ${delC.rowCount} empresas, ${delU.rowCount} users removidos.`);
      return;
    }
    const passwordHash = hashPassword(SEED_PASSWORD);
    const now = new Date().toISOString();
    let citCreated = 0;
    let citExist = 0;
    for (let i = 1; i <= 50; i += 1) {
      const email = `cidadao.seed${pad2(i)}@${SEED_DOMAIN}`;
      const found = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
      if (found.rowCount) { citExist += 1; continue; }
      await pool.query(
        'INSERT INTO users (id,name,email,phone,neighborhood,role,account_status,password_hash,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,\'user\',\'active\',$6,$7,NOW())',
        [`usr-seed-cid-${pad2(i)}`, citizenName(i), email, `+245 955 10 ${pad2(i)} 0${i % 10}`, NEIGHBORHOODS[i % NEIGHBORHOODS.length], passwordHash, now],
      );
      citCreated += 1;
    }
    console.log(`seed-demo: cidadaos criados=${citCreated} existentes=${citExist}`);
    let bizCreated = 0;
    let bizExist = 0;
    const approved: string[] = [];
    const pending: string[] = [];
    for (let i = 0; i < COMPANIES.length; i += 1) {
      const n = i + 1;
      const num = pad2(n);
      const co = COMPANIES[i];
      const email = `empresa.seed${num}@${SEED_DOMAIN}`;
      const companyId = `seed-co-${num}`;
      const found = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
      let userId: string;
      if (found.rowCount) { userId = String(found.rows[0].id); bizExist += 1; }
      else {
        userId = `usr-seed-biz-${num}`;
        await pool.query(
          'INSERT INTO users (id,name,email,phone,neighborhood,role,account_status,password_hash,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,\'business\',\'active\',$6,$7,NOW())',
          [userId, `Gestao ${co.name}`, email, `+245 955 20 ${num} 00`, co.neighborhood, passwordHash, now],
        );
        bizCreated += 1;
      }
      const active = n <= APPROVE_COUNT;
      const status = active ? 'active' : 'pending';
      const data = {
        slug: co.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-'),
        description: co.description, subcategoryId: co.subcategoryId,
        neighborhood: co.neighborhood, address: `Avenida Principal, ${co.neighborhood}, Bissau`,
        phone: `+245 955 20 ${num} 00`, whatsapp: `+24595520${num}00`, email,
        openingHours: 'Segunda a Sabado: 08:00 - 20:00', isOpenNow: true,
        priceRange: '$$', verified: active, featured: false,
        ratingLabel: 'Muito Bom', reviewsCount: 0, postsQuotaRemaining: 10,
        subscriptionRenewDate: '2027-01-01', tier: 'professional', ownerEmail: email,
      };
      await pool.query(
        'INSERT INTO companies (id,owner_user_id,name,status,category_id,data,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,NOW()) ON CONFLICT (id) DO UPDATE SET owner_user_id=COALESCE(EXCLUDED.owner_user_id,companies.owner_user_id),name=EXCLUDED.name,status=EXCLUDED.status,category_id=EXCLUDED.category_id,data=EXCLUDED.data,updated_at=NOW()',
        [companyId, userId, co.name, status, co.categoryId, JSON.stringify(data), now],
      );
      await pool.query(
        "INSERT INTO company_members (company_id,user_id,member_role,accepted_at) VALUES ($1,$2,'manager',NOW()) ON CONFLICT (company_id,user_id) DO NOTHING",
        [companyId, userId],
      );
      if (active) approved.push(companyId); else pending.push(companyId);
    }
    console.log(`seed-demo: empresas criadas=${bizCreated} existentes=${bizExist}`);
    const tC = await pool.query("SELECT COUNT(*)::int AS n FROM companies WHERE id LIKE 'seed-co-%'");
    const tU = await pool.query("SELECT COUNT(*)::int AS n FROM users WHERE email LIKE '%@guigui.test'");
    const tA = await pool.query("SELECT COUNT(*)::int AS n FROM companies WHERE id LIKE 'seed-co-%' AND status='active'");
    const tP = await pool.query("SELECT COUNT(*)::int AS n FROM companies WHERE id LIKE 'seed-co-%' AND status='pending'");
    console.log(`seed-demo: companies total=${tC.rows[0].n} active=${tA.rows[0].n} pending=${tP.rows[0].n}`);
    console.log(`seed-demo: seed users total=${tU.rows[0].n}`);
    console.log(`seed-demo: aprovadas: ${approved.join(', ')}`);
    console.log(`seed-demo: pendentes: ${pending.join(', ')}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('seed-demo FALHOU:', error instanceof Error ? error.message : error);
  process.exit(1);
});
