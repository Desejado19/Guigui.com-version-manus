export default async function run(page) {
  const request = async (url, options = {}) => page.evaluate(async ({ url, options }) => {
    const response = await fetch(url, { credentials: 'include', ...options });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }, { url, options });
  const citizenLogin = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' }) });
  const create = await request('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: 'biz-1', subject: 'Teste de comunicação', text: 'Mensagem de teste cidadão para empresa' }) });
  const businessLogin = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' }) });
  const businessInbox = await request('/api/conversations');
  const conversation = businessInbox.body.conversations?.find((item) => item.subject === 'Teste de comunicação');
  const reply = conversation
    ? await request(`/api/conversations/${encodeURIComponent(conversation.id)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Resposta da empresa em formato de conversa' }),
      })
    : { status: 0, body: {} };
  const businessInboxAfterReply = await request('/api/conversations');
  const supportCreate = await request('/api/support/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'Teste de suporte', description: 'Pedido de ajuda', category: 'technical' }),
  });
  const supportId = supportCreate.body.ticket?.id;
  const supportReply = supportId
    ? await request(`/api/support/tickets/${encodeURIComponent(supportId)}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Resposta de suporte em sequência' }),
      })
    : { status: 0, body: {} };
  return { citizenLogin: citizenLogin.status, create: create.status, businessLogin: businessLogin.status, businessInbox: businessInbox.status, visibleToBusiness: Boolean(conversation), messageVisibleToBusiness: Boolean(businessInbox.body.messages?.some((item) => item.conversation_id === conversation?.id)), reply: reply.status, replyVisible: Boolean(businessInboxAfterReply.body.messages?.some((item) => item.text === 'Resposta da empresa em formato de conversa')), supportCreate: supportCreate.status, supportReply: supportReply.status };
}
