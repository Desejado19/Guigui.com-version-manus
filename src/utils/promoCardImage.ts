import type { Language, Promotion } from '../types';

const WIDTH = 760;
const HEIGHT = 880;
const PAD = 52;

const SANS = '"Segoe UI", system-ui, -apple-system, sans-serif';
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:]$/, '')}…`;
  return kept;
}

function formatValidity(value: string, lang: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(lang === 'pt' ? 'pt-PT' : lang, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Descarrega apenas o cartão de desconto como imagem PNG.
 * Nada de página, lista ou resto do ecrã entra no ficheiro.
 */
export function downloadPromotionCardImage(promo: Promotion, lang: Language = 'pt'): void {
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = WIDTH * scale;
  canvas.height = HEIGHT * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(scale, scale);

  ctx.save();
  roundRectPath(ctx, 0, 0, WIDTH, HEIGHT, 44);
  ctx.clip();
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, '#0e5142');
  gradient.addColorStop(0.55, '#07362b');
  gradient.addColorStop(1, '#04241d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#74e3b0';
  ctx.font = `800 15px ${SANS}`;
  ctx.fillText('CUPÃO DE DESCONTO · GUIGUI.COM', PAD, 74);

  const badge = (promo.discountBadge || 'OFERTA').toUpperCase();
  ctx.font = `800 24px ${SANS}`;
  const badgeWidth = Math.min(WIDTH - PAD * 2, ctx.measureText(badge).width + 48);
  roundRectPath(ctx, PAD, 104, badgeWidth, 52, 26);
  ctx.fillStyle = '#f2b53d';
  ctx.fill();
  ctx.fillStyle = '#04201a';
  ctx.textAlign = 'center';
  ctx.fillText(badge, PAD + badgeWidth / 2, 139);
  ctx.textAlign = 'left';

  ctx.fillStyle = 'rgba(255, 255, 255, .78)';
  ctx.font = `700 16px ${SANS}`;
  ctx.fillText((promo.businessName || '').toUpperCase(), PAD, 200);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 34px ${SANS}`;
  const titleLines = wrapText(ctx, promo.title, WIDTH - PAD * 2, 2);
  titleLines.forEach((line, index) => ctx.fillText(line, PAD, 246 + index * 44));

  const descTop = 246 + titleLines.length * 44 + 8;
  ctx.fillStyle = 'rgba(255, 255, 255, .8)';
  ctx.font = `400 18px ${SANS}`;
  wrapText(ctx, promo.description, WIDTH - PAD * 2, 3)
    .forEach((line, index) => ctx.fillText(line, PAD, descTop + index * 28));

  const dividerY = descTop + 3 * 28 + 26;
  ctx.strokeStyle = 'rgba(126, 205, 176, .4)';
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(PAD, dividerY);
  ctx.lineTo(WIDTH - PAD, dividerY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255, 255, 255, .75)';
  ctx.font = `700 13px ${SANS}`;
  ctx.fillText('CÓDIGO', PAD, dividerY + 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 44px ${MONO}`;
  ctx.fillText(promo.code || '—', PAD, dividerY + 92);

  const infoTop = dividerY + 132;
  ctx.fillStyle = 'rgba(255, 255, 255, .75)';
  ctx.font = `700 13px ${SANS}`;
  ctx.fillText('VÁLIDO ATÉ', PAD, infoTop);
  ctx.fillText('BAIRRO', WIDTH / 2 + 10, infoTop);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 17px ${SANS}`;
  ctx.fillText(formatValidity(promo.validUntil, lang), PAD, infoTop + 28);
  ctx.fillText(promo.neighborhood || 'Bissau', WIDTH / 2 + 10, infoTop + 28);

  const noteTop = infoTop + 78;
  ctx.fillStyle = 'rgba(255, 255, 255, .8)';
  ctx.font = `400 16px ${SANS}`;
  wrapText(
    ctx,
    `Apresente este cupão na ${promo.businessName} para aplicar o desconto.`,
    WIDTH - PAD * 2,
    2,
  ).forEach((line, index) => ctx.fillText(line, PAD, noteTop + index * 24));

  ctx.fillStyle = '#74e3b0';
  ctx.font = `800 15px ${SANS}`;
  ctx.fillText('guigui.com', PAD, HEIGHT - 46);

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `${promo.code || promo.id}-cupao.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
