export default async function run(page) {
  const browser = page.context().browser();
  const businessContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const businessPage = await businessContext.newPage();
  const adminPage = await adminContext.newPage();
  await businessPage.goto('http://localhost:3000/');
  await adminPage.goto('http://localhost:3000/');
  const request = (targetPage) => async (url, options = {}) => targetPage.evaluate(async ({ url, options }) => {
    const response = await fetch(url, { credentials: 'include', ...options });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }, { url, options });
  const citizenRequest = request(page);
  const businessRequest = request(businessPage);
  const adminRequest = request(adminPage);
  const unique = `QA ${Date.now()}`;
  const citizenLogin = await citizenRequest('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' }) });
  const businessLogin = await businessRequest('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' }) });
  const adminLogin = await adminRequest('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin.teste@guigui.com', password: 'Guigui@2026!' }) });
  const createConversation = await citizenRequest('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: 'biz-1', subject: unique, text: 'Mensagem cidadão QA' }) });
  const businessInbox = await businessRequest('/api/conversations');
  const conversation = businessInbox.body.conversations?.find((item) => item.subject === unique);
  const businessReply = conversation ? await businessRequest(`/api/conversations/${encodeURIComponent(conversation.id)}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Resposta empresa QA' }) }) : { status: 0, body: {} };
  const citizenInbox = await citizenRequest('/api/conversations');
  const supportCreate = await citizenRequest('/api/support/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: unique, description: 'Pedido suporte QA', category: 'technical' }) });
  const adminTickets = await adminRequest('/api/support/tickets/mine');
  const ticket = adminTickets.body.tickets?.find((item) => item.subject === unique);
  const adminReply = ticket ? await adminRequest(`/api/support/tickets/${encodeURIComponent(ticket.id)}/replies`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Resposta administração QA' }) }) : { status: 0, body: {} };
  const citizenTickets = await citizenRequest('/api/support/tickets/mine');
  await businessContext.close();
  await adminContext.close();
  return {
    citizenLogin: citizenLogin.status,
    businessLogin: businessLogin.status,
    adminLogin: adminLogin.status,
    conversationCreate: createConversation.status,
    conversationVisibleToBusiness: Boolean(conversation),
    businessReply: businessReply.status,
    replyVisibleToCitizen: Boolean(citizenInbox.body.messages?.some((item) => item.text === 'Resposta empresa QA')),
    supportCreate: supportCreate.status,
    supportVisibleToAdmin: Boolean(ticket),
    adminReply: adminReply.status,
    supportReplyVisibleToCitizen: Boolean(citizenTickets.body.tickets?.some((item) => item.replies?.some((reply) => reply.text === 'Resposta administração QA'))),
  };
}
