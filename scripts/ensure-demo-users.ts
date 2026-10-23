import fs from 'node:fs';
import path from 'node:path';

type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'business' | 'admin';
  phone: string;
  neighborhood: string;
  avatarUrl: string;
  passwordHash: string;
  createdAt: string;
};

const filePath = path.resolve(process.env.GUIGUI_DATA_DIR || 'data', 'auth.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { users?: StoredUser[] };
const users = Array.isArray(data.users) ? data.users : [];
const template = users[0];

if (!template) {
  throw new Error('É necessário existir pelo menos um utilizador para gerar dados de demonstração.');
}

for (let index = 1; index <= 15; index += 1) {
  const id = `usr-seed-${index}`;
  if (users.some((user) => user.id === id)) continue;
  users.push({
    ...template,
    id,
    name: `Utilizador Demonstração ${index}`,
    email: `utilizador.demo${index}@guigui.com`,
    phone: `+245 955 40 ${String(index).padStart(2, '0')} ${String(index + 20).padStart(2, '0')}`,
    neighborhood: ['Bissau Velho', 'Bandim', 'Santa Luzia', 'Caracol', 'Cuntum'][index % 5],
    createdAt: new Date('2026-09-01T09:00:00.000Z').toISOString(),
  });
}

fs.writeFileSync(filePath, `${JSON.stringify({ users }, null, 2)}\n`);
console.log(`demo-users: ${users.length} utilizador(es) disponíveis`);
