# Validação do fluxo de compras e pagamentos — 28 de Agosto de 2026

O preview abriu correctamente em `https://3000-iku7lz1w9ir0xw5zfd6o1-b3e65758.us3.manus.computer/` e mostrou a interface Guigui.com sem erro visual de carregamento. A sessão persistida observada no browser era Super Admin, com cabeçalho, navegação, agenda cultural, cartões de eventos e sino de notificações visíveis.

## Evidência da API

A compra de teste Orange Money devolveu HTTP 200, criou um código alfanumérico aleatório (`GUI-...`), token QR opaco (`QR-GUI-...`) e transacção sandbox. A repetição com a mesma chave `Idempotency-Key` devolveu HTTP 200 e exactamente a mesma resposta, sem criar um segundo bilhete.

O código alfanumérico validou no endpoint de scanner com HTTP 200. O payload QR versionado `GUI-TICKET:v1:<qrToken>:<ticketCode>` também foi reconhecido pelo servidor; a segunda tentativa devolveu HTTP 409 com estado `already_used`.

Uma transferência manual criou HTTP 202 com `paymentPending=true`. Um webhook assinado com HMAC válido alterou o estado para confirmado e emitiu um bilhete único. Um webhook com assinatura inválida devolveu HTTP 401 e `INVALID_WEBHOOK_SIGNATURE`.

## Regressões

`npm run check`, `npm run test:follow`, `npx tsx scripts/audit-ticket-validation.ts` e `npm run build` concluíram sem falhas. O build mantém apenas o aviso não bloqueante de chunk Vite superior a 500 kB. `/api/health` respondeu HTTP 200.

## Regra de segurança confirmada

O scanner deixou de aceitar a lista local de pedidos como autorização. A validação do preview passa pelo servidor e exige empresa, evento, código de porta, estado, validade, assinatura e utilização única. A integração real com Orange Money ou Telecel continua dependente de contrato, credenciais e especificação oficial da operadora; o código preparado usa adaptadores sandbox/manual e webhook assinado.
