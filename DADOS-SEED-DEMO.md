# Dados de demonstracao — 30 empresas + 50 cidadaos

Criados com `npm run db:seed-demo` (script `scripts/seed-demo-dataset.ts`).
Correr em `C:\guigui` (caminho sem `#`) com o servidor parado ou a correr —
usa a mesma `DATABASE_URL` do `.env`.

## Credenciais (password unica)

**Password de TODAS as contas seed: `Guigui2026!`**

### Admin demo

| Email | Papel | Password |
|---|---|---|
| `admin.teste@guigui.com` | admin | `Guigui2026!` (reposta em 13/10/2026 via `scripts/reset-admin-password.ts` — a password antiga nao era conhecida) |

### Cidadaos (50) — role `user`

| Email | Nome (exemplo) |
|---|---|
| `cidadao.seed01@guigui.test` … `cidadao.seed50@guigui.test` | Nomes guineenses variados |

Exemplos: `cidadao.seed01@guigui.test` (Fatou Fernandes),
`cidadao.seed25@guigui.test`, `cidadao.seed50@guigui.test`.

### Empresas (30) — role `business`

| Email | Empresa | Estado |
|---|---|---|
| `empresa.seed01@guigui.test` | Cantina Sabores de Bandim | active |
| `empresa.seed02@guigui.test` | Cafe Kriol e Pastelaria | active |
| `empresa.seed03@guigui.test` | Hotel Bijagos Palace | active |
| `empresa.seed04@guigui.test` | Pousada Orango Acolhimento | active |
| `empresa.seed05@guigui.test` | Bubaque Tours e Travessias | active |
| `empresa.seed06@guigui.test` | Guia Bissau Walks | active |
| `empresa.seed07@guigui.test` | Clinica Saude Santa Luzia | active |
| `empresa.seed08@guigui.test` | Farmacia Bandim Central | active |
| `empresa.seed09@guigui.test` | Barbearia Estilo Bissau | active |
| `empresa.seed10@guigui.test` | Colegio Luz do Saber | active |
| `empresa.seed11@guigui.test` | Centro de Linguas Kriol-Frances | active |
| `empresa.seed12@guigui.test` | Advocacia Balde e Associados | active |
| `empresa.seed13@guigui.test` | Contabilidade Certa GW | active |
| `empresa.seed14@guigui.test` | Mercearia Preco Bom | active |
| `empresa.seed15@guigui.test` | Boutique Nha Terra Moda | active |
| `empresa.seed16@guigui.test` | Electronica Djitu Ten | active |
| `empresa.seed17@guigui.test` | Oficina Auto Rapida Bor | active |
| `empresa.seed18@guigui.test` | Taxis Unidos de Bissau | active |
| `empresa.seed19@guigui.test` | Construtora Tchon Firme | active |
| `empresa.seed20@guigui.test` | Imobiliaria Casa Nha | active |
| `empresa.seed21@guigui.test` | Microcredito Kumpu Tera | **pending** |
| `empresa.seed22@guigui.test` | Cambio Rapido Aeroporto | **pending** |
| `empresa.seed23@guigui.test` | NetBlau Internet e Informatica | **pending** |
| `empresa.seed24@guigui.test` | Telemoveis Bissau Center | **pending** |
| `empresa.seed25@guigui.test` | Cooperativa Caju de Quinhamel | **pending** |
| `empresa.seed26@guigui.test` | Pesca Fresca do Cais | **pending** |
| `empresa.seed27@guigui.test` | Festival Gumbe Nights | **pending** |
| `empresa.seed28@guigui.test` | Galeria Arte Bijagos | **pending** |
| `empresa.seed29@guigui.test` | Associacao Djuntos Mon | **pending** |
| `empresa.seed30@guigui.test` | Radio Voz do Povo FM | **pending** |

## O que ver com estes dados

1. **Directorio** (`Business Directory`): as 20 activas juntam-se as
   existentes; filtrar por categoria mostra a distribuicao.
2. **Login cidadao**: `cidadao.seed01@guigui.test` abre a Area Pessoal.
3. **Login empresa activa**: `empresa.seed01@guigui.test` abre o Painel
   da Empresa com a ficha completa.
4. **Login empresa pendente**: `empresa.seed25@guigui.test` faz login
   mas a empresa aguarda validacao (nao aparece no directorio).
5. **Fila do admin**: login `admin.teste@guigui.com` / `Guigui2026!` →
   `GET /api/admin/businesses/pending` mostra `seed-co-21 … seed-co-30`;
   aprovar uma com `POST /api/admin/businesses/:id/decision`
   `{"decision":"approve"}` faz aparecer no directorio.

## Manutencao

- Re-correr a seed e idempotente (nao duplica).
- Remover tudo: `npm run db:seed-demo -- --clean`
  (apaga APENAS `@guigui.test` / `seed-co-*`; dados reais intactos).
- Validacao Playwright: `npx playwright test tests/seed-demo.spec.ts`.
