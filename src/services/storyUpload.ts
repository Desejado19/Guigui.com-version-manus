export async function uploadLocalStoryImage(
  file: File,
  baseUrl = window.location.origin,
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/stories/assets`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!response.ok) {
    throw new Error('Não foi possível carregar a imagem da story.');
  }
  const json = (await response.json().catch(() => ({}))) as { url?: string };
  if (!json.url) {
    throw new Error('Erro ao carregar a imagem da story.');
  }
  return json.url;
}
