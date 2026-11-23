// Lista de compradores de um evento (CSV gerado no servidor).
//
// A agregação — quantidade de bilhetes, tipos e total por comprador — é feita
// em `GET /api/tickets/sold/export`, que já está limitado aos eventos da
// empresa da sessão e não tem o limite de 500 linhas da vista paginada. Aqui
// só se descarrega o ficheiro devolvido.

export interface BuyerListDownloadResult {
  ok: boolean;
  filename?: string;
  message: string;
}

export async function downloadBuyerListCsv(eventId?: string): Promise<BuyerListDownloadResult> {
  try {
    // Sem eventId o servidor exporta todos os eventos da empresa e acrescenta
    // uma coluna com o nome do evento em cada linha.
    const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
    const response = await fetch(
      `/api/tickets/sold/export${query}`,
      { credentials: 'same-origin', cache: 'no-store' },
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      return {
        ok: false,
        message: payload?.error || 'Não foi possível gerar a lista de compradores.',
      };
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1]
      || (eventId ? `compradores-${eventId}.csv` : 'compradores-todos-os-eventos.csv');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    return { ok: true, filename, message: `Lista de compradores descarregada (${filename}).` };
  } catch {
    return { ok: false, message: 'Não foi possível gerar a lista de compradores. Tente novamente.' };
  }
}
