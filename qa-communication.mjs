export default async function run(page, ui) {
  const result = { before: await ui.snapshot(), steps: [] };
  const login = page.getByRole('button', { name: 'Entrar', exact: true });
  await login.click();
  await page.waitForTimeout(300);
  result.steps.push({ modal: (await page.locator('body').innerText()).includes('Acesso à Plataforma'), text: (await page.locator('body').innerText()).slice(-500) });
  await page.getByRole('button', { name: 'Próximo Passo', exact: true }).click();
  await page.waitForTimeout(300);
  const citizen = page.getByRole('button', { name: 'Entrar como Cidadão', exact: true });
  await citizen.click();
  await page.waitForTimeout(1000);
  result.steps.push({ loggedIn: (await page.locator('body').innerText()).includes('Malam Bacar'), text: (await page.locator('body').innerText()).slice(0, 700) });
  const businessCard = page.getByRole('button', { name: 'Restaurante Coqueiros', exact: true }).first();
  await businessCard.click();
  await page.waitForTimeout(300);
  const messageButtons = page.getByRole('button', { name: /Mensagem/ });
  result.steps.push({ businessModal: await messageButtons.count() > 0 });
  if (await messageButtons.count()) await messageButtons.first().click();
  await page.waitForTimeout(500);
  const text = await page.locator('body').innerText();
  result.steps.push({ communicationOpen: text.includes('Nova conversa') || text.includes('Conversas') || text.includes('Mensagens') });
  result.steps.push({ closeButtons: await page.getByRole('button', { name: /Fechar/ }).count() });
  return result;
}
