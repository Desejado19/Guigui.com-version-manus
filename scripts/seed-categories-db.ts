import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CATEGORY_GROUPS = [
  { id: 'restauracao', name: 'Restauração, Cafés & Pequeno Comércio', description: 'Restaurantes, lanchonetes, bares e pequenos comércios de Bissau.' },
  { id: 'hotelaria_saude_educacao', name: 'Hotelaria, Clínicas, Escolas & Comércio Médio', description: 'Hotéis, alojamentos, clínicas médicas, colégios e supermercados.' },
  { id: 'corporativo_financeiro', name: 'Bancos, Seguradoras, Telecoms & Construção', description: 'Bancos comerciais, instituições financeiras, operadoras e empreiteiras.' },
  { id: 'ongs_artesãos', name: 'ONGs, Cooperativas, Associações & Artesãos', description: 'Organizações comunitárias, feiras de artesanato e ONGs locais.' },
  { id: 'servicos_profissionais', name: 'Serviços Profissionais & Consultoria', description: 'Gabinetes de advogados, contabilidade, TI, arquitetura e consultoria.' },
];

const MAIN_CATEGORIES = [
  { id: 'cat-1', name: 'Restauração e Bebidas', iconName: 'UtensilsCrossed', groupId: 'restauracao', subcategories: ['Restaurantes', 'Churrascarias', 'Cafés & Pastelarias', 'Bares & Lounges', 'Food Trucks', 'Catering'] },
  { id: 'cat-2', name: 'Hotelaria e Alojamento', iconName: 'Hotel', groupId: 'hotelaria_saude_educacao', subcategories: ['Hotéis', 'Pousadas', 'Alojamento Local', 'Resorts nos Arquipélagos'] },
  { id: 'cat-3', name: 'Turismo e Lazer', iconName: 'Compass', groupId: 'hotelaria_saude_educacao', subcategories: ['Agências de Viagens', 'Guias Turísticos', 'Aluguer de Barcos e Pirogas', 'Ecoturismo Bijagós', 'Museus & Galerias'] },
  { id: 'cat-4', name: 'Saúde e Bem-estar', iconName: 'HeartPulse', groupId: 'hotelaria_saude_educacao', subcategories: ['Hospitais & Clínicas', 'Farmácias', 'Salões de Cabeleireiro & Barber', 'Spas & Estética', 'Ginásios'] },
  { id: 'cat-5', name: 'Educação e Formação', iconName: 'GraduationCap', groupId: 'hotelaria_saude_educacao', subcategories: ['Escolas & Colégios', 'Universidades & Institutos', 'Formação Profissional', 'Centros de Línguas'] },
  { id: 'cat-6', name: 'Serviços Profissionais', iconName: 'Briefcase', groupId: 'servicos_profissionais', subcategories: ['Advogados & Solicitadores', 'Contabilidade & Auditing', 'Consultoria e TI', 'Arquitetura & Engenharia'] },
  { id: 'cat-7', name: 'Comércio e Retalho', iconName: 'ShoppingBag', groupId: 'restauracao', subcategories: ['Supermercados & Lojas', 'Moda & Boutiques', 'Electrónica e Informática', 'Papelarias', 'Ourivesarias'] },
  { id: 'cat-8', name: 'Automóvel e Transportes', iconName: 'Car', groupId: 'servicos_profissionais', subcategories: ['Stands de Automóveis', 'Oficinas Mecânicas', 'Rent-a-Car', 'Serviços de Táxi & Transporte', 'Logística'] },
  { id: 'cat-9', name: 'Construção e Imobiliário', iconName: 'Building2', groupId: 'corporativo_financeiro', subcategories: ['Empreiteiros', 'Materiais de Construção', 'Agências Imobiliárias', 'Decoração & Jardinagem'] },
  { id: 'cat-10', name: 'Bancos e Serviços Financeiros', iconName: 'Landmark', groupId: 'corporativo_financeiro', subcategories: ['Bancos Comerciais', 'Microfinanças', 'Companhias de Seguros', 'Casas de Câmbio & Remessas'] },
  { id: 'cat-11', name: 'Telecomunicações e Tecnologia', iconName: 'Wifi', groupId: 'corporativo_financeiro', subcategories: ['Operadoras de Telecomunicações', 'Provedores de Internet', 'Lojas de Telemóveis', 'Desenvolvimento Software'] },
  { id: 'cat-12', name: 'Indústria e Produção', iconName: 'Factory', groupId: 'corporativo_financeiro', subcategories: ['Agroindústria (Caju, Frutas)', 'Transformação do Pescado', 'Oficinas de Carpintaria', 'Artesanato'] },
  { id: 'cat-13', name: 'Agricultura e Pescas', iconName: 'Tractor', groupId: 'ongs_artesãos', subcategories: ['Produtores Agrícolas', 'Cooperativas de Caju', 'Pesca Artesanal', 'Avicultura & Pecuária'] },
];

async function main() {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Inserir ou atualizar grupos
    for (const group of CATEGORY_GROUPS) {
      await client.query(
        `INSERT INTO categories (id, parent_id, name, description, is_active)
         VALUES ($1, NULL, $2, $3, TRUE)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = EXCLUDED.is_active`,
        [group.id, group.name, group.description]
      );
      console.log(`  Grupo: ${group.id} (${group.name})`);
    }

    // Inserir ou atualizar categorias principais
    for (const cat of MAIN_CATEGORIES) {
      await client.query(
        `INSERT INTO categories (id, parent_id, name, description, is_active)
         VALUES ($1, $2, $3, '', TRUE)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active`,
        [cat.id, cat.groupId, cat.name]
      );
      console.log(`  Categoria: ${cat.id} (${cat.name}) -> ${cat.groupId}`);
    }

    await client.query('COMMIT');
    console.log('\nSeed de categorias OK. Total de categorias no banco:', MAIN_CATEGORIES.length + CATEGORY_GROUPS.length);
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error('Seed falhou:', err);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main();
