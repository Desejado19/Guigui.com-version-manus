import { chromium } from 'playwright';

const BASE = process.env.RESP_BASE_URL || 'http://127.0.0.1:3000';
const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 360, height: 640 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const MAX_FINDINGS = 25;

async function auditLayout(page, context) {
  return page.evaluate(
    ({ max, context: ctx }) => {
      const findings = [];
      const win = window.innerWidth;
      const root = document.documentElement;
      const textOf = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
      const hasContent = (el) =>
        textOf(el).length > 0 ||
        !!el.querySelector('input,select,textarea,button,img,svg,canvas,video');
      const describe = (el) => {
        const klass = typeof el.className === 'string' ? el.className : '';
        const short = klass.split(/\s+/).filter(Boolean).slice(0, 5).join('.');
        const kids = Array.from(el.children).map((c) => c.tagName.toLowerCase()).join(',');
        const st = getComputedStyle(el);
        return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${short ? `.${short}` : ''}[${kids}] ch=${el.clientHeight} sh=${el.scrollHeight} ox=${st.overflowX}/${st.overflowY}`;
      };
      const isVisible = (el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (rect.width < 1 || rect.height < 1) return false;
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        if (Number(style.opacity) < 0.05) return false;
        // Elementos "sr-only" existem para leitores de ecrã, não para ver.
        if (el.closest('.sr-only')) return false;
        return rect.bottom > 0 && rect.top < window.innerHeight;
      };
      // Contentor de tamanho fixo com overflow intencional (avatar/thumbnail
      // com object-cover, ou imagem externa ainda sem dimensões) não é bug:
      // só envolve img/video/canvas (sem botões, inputs nem texto).
      const isMediaCrop = (el) => {
        if (el.querySelector('input,select,textarea,button')) return false;
        if (textOf(el).length > 0) return false;
        const media = el.querySelectorAll('img,video,canvas');
        if (media.length === 0) return false;
        const hasOtherElements = Array.from(el.querySelectorAll('*')).some((child) => {
          const tag = child.tagName.toLowerCase();
          return tag !== 'img' && tag !== 'video' && tag !== 'canvas';
        });
        return !hasOtherElements;
      };
      const scrollAncestorX = (el) => {
        let node = el.parentElement;
        while (node && node !== root) {
          const style = getComputedStyle(node);
          if (/(auto|scroll)/.test(style.overflowX)) return node;
          node = node.parentElement;
        }
        return null;
      };
      const clippingAncestor = (el) => {
        let node = el.parentElement;
        while (node && node !== root) {
          const style = getComputedStyle(node);
          const clippedX = /(hidden|clip)/.test(style.overflowX);
          const clippedY = /(hidden|clip)/.test(style.overflowY);
          if (clippedX || clippedY) return { node, clippedX, clippedY };
          node = node.parentElement;
        }
        return null;
      };
      // Cortes de media intencionais (capa de card/hero com object-cover e
      // overlays absolutos) e truncagens de texto (line-clamp) nao sao bugs.
      const isCoverCrop = (el) => {
        const kids = Array.from(el.children);
        if (!kids.length) return false;
        const hasMedia = !!el.querySelector('img,video,canvas');
        const allMediaOrAbsolute = kids.every((k) => {
          const st = getComputedStyle(k);
          return st.position === 'absolute' || /^(img|video|canvas)$/i.test(k.tagName);
        });
        return hasMedia && allMediaOrAbsolute;
      };
      const isLineClamp = (el) => /line-clamp/.test(String(el.className));
      if (root.scrollWidth > win + 2) {
        findings.push({
          kind: 'page-x',
          detail: `${ctx} → documento com ${root.scrollWidth}px de largura numa janela de ${win}px`,
        });
      }
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        if (findings.length >= max) break;
        if (!isVisible(el) || !hasContent(el)) continue;
        const style = getComputedStyle(el);
        // Elementos absolutos (badges, tooltips, overlays) são posicionados
        // deliberadamente fora da caixa do pai.
        if (style.position === 'fixed' || style.position === 'absolute') continue;
        const tag = el.tagName.toLowerCase();
        if (tag === 'img' || tag === 'video' || tag === 'svg' || tag === 'canvas') continue;
        // Conteúdo dentro de faixa com rolagem própria é alcançável.
        if (scrollAncestorX(el)) continue;
        const intentionalCrop = isMediaCrop(el) || isCoverCrop(el) || isLineClamp(el);
        if (/(hidden|clip)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 4 && !intentionalCrop) {
          findings.push({ kind: 'self-clip-x', detail: `${ctx} → ${describe(el)} corta ${el.scrollWidth - el.clientWidth}px de largura` });
        }
        if (/(hidden|clip)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 4 && !intentionalCrop) {
          findings.push({ kind: 'self-clip-y', detail: `${ctx} → ${describe(el)} corta ${el.scrollHeight - el.clientHeight}px de altura` });
        }
        if (intentionalCrop) continue;
        const clip = clippingAncestor(el);
        if (!clip) continue;
        // Faixa com rolagem horizontal propria (carousel/tabela) nao e bug.
        if (/overflow-x-auto|no-scrollbar/.test(String(clip.node.className))) continue;
        const rect = el.getBoundingClientRect();
        const box = clip.node.getBoundingClientRect();
        const overflowRight = Math.round(rect.right - box.right);
        const overflowLeft = Math.round(box.left - rect.left);
        const overflowBottom = Math.round(rect.bottom - box.bottom);
        if (clip.clippedX && overflowRight > 4) {
          findings.push({ kind: 'clip-x', detail: `${ctx} → ${describe(el)} excede ${describe(clip.node)} em ${overflowRight}px à direita` });
        }
        if (clip.clippedX && overflowLeft > 4) {
          findings.push({ kind: 'clip-x-left', detail: `${ctx} → ${describe(el)} excede ${describe(clip.node)} em ${overflowLeft}px à esquerda` });
        }
        if (clip.clippedY && overflowBottom > 4) {
          findings.push({ kind: 'clip-y', detail: `${ctx} → ${describe(el)} excede ${describe(clip.node)} em ${overflowBottom}px em altura` });
        }
      }
      const seen = new Set();
      return findings.filter((f) => {
        const key = `${f.kind}|${f.detail}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    { max: MAX_FINDINGS, context },
  );
}

const TABS = [
  { label: 'feed', pattern: /Feed Bissau/i },
  { label: 'diretorio', pattern: /Diretório de/i },
  { label: 'ofertas', pattern: /Ofertas &|Ofertas \\u0026/ },
  { label: 'eventos', pattern: /^Eventos/ },
];

async function openTab(page, pattern) {
  const btn = page.getByRole('button', { name: pattern }).filter({ visible: true }).first();
  await btn.click({ timeout: 8000 });
  await page.waitForTimeout(1500);
}

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: vp });
    await page.addInitScript(() => {
      window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
    });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    for (const tab of TABS) {
      await openTab(page, tab.pattern).catch(() => {});
      const findings = await auditLayout(page, `${tab.label} ${vp.width}x${vp.height}`);
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          viewport: `${vp.width}x${vp.height}`,
          tab: tab.label,
          scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
          findings,
        }),
      );
    }
    await page.close();
  }
} finally {
  await browser.close();
}
