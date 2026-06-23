const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Detecta si la URL apunta a una API JSON (hostname comienza con "api.") */
function isJsonApi(url) {
  try {
    return new URL(url).hostname.startsWith('api.');
  } catch {
    return false;
  }
}

/**
 * Navega un objeto JSON usando notación de punto y corchetes.
 * Soporta: "title", "results.title", "results[0].title", "results[].title"
 */
function extractByPath(obj, path) {
  const parts = path
    .replace(/\[(\d*)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  function dig(current, remaining) {
    if (remaining.length === 0) {
      if (current == null) return [];
      return [String(current).trim()].filter(Boolean);
    }
    const [head, ...tail] = remaining;
    if (Array.isArray(current)) {
      const idx = parseInt(head, 10);
      if (!isNaN(idx)) return dig(current[idx], tail);
      return current.flatMap((item) => dig(item?.[head], tail));
    }
    if (current && typeof current === 'object') return dig(current[head], tail);
    return [];
  }

  return dig(obj, parts);
}

/**
 * Simula scroll humano para forzar la carga de contenido lazy-loaded.
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Modo JSON API — fetch sin Puppeteer
// ─────────────────────────────────────────────────────────────

async function extractFromApi(url, jsonPath) {
  console.log(`[ScraperEngine] Modo API → GET ${url}`);

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; ScraperOrchestrator/1.0)',
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

  const json = await response.json();
  const values = extractByPath(json, jsonPath);
  console.log(`[ScraperEngine] API extrajo ${values.length} valor(es)`);
  return values;
}

// ─────────────────────────────────────────────────────────────
// Modo HTML — Puppeteer + Stealth + Paginación
// ─────────────────────────────────────────────────────────────

async function extractFromHtml(task) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['image', 'font', 'media'].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  const allData = [];
  const pagesToScrape = task.isPaginated ? Math.min(task.maxPages, 10) : 1;

  try {
    for (let i = 0; i < pagesToScrape; i++) {
      // Calcular URL de la página actual reemplazando el comodín
      let currentUrl = task.targetUrl;
      if (task.isPaginated) {
        const paramValue = task.paginationStart + i * task.paginationStep;
        currentUrl = task.targetUrl.replace('{{PAGE_PARAM}}', String(paramValue));
      }

      console.log(`[ScraperEngine] Página ${i + 1}/${pagesToScrape} → ${currentUrl}`);

      try {
        await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 25000 });
      } catch {
        console.warn(`[ScraperEngine] networkidle2 falló, reintentando con domcontentloaded...`);
        await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      }

      const finalUrl = page.url();
      console.log(`[ScraperEngine] URL final: ${finalUrl}`);

      // Scroll para forzar lazy loading
      await autoScroll(page);

      await page.waitForSelector(task.cssSelector, { timeout: 10000 });

      const pageData = await page.evaluate((sel) => {
        return Array.from(document.querySelectorAll(sel))
          .map((el) => el.innerText.trim())
          .filter(Boolean);
      }, task.cssSelector);

      console.log(`[ScraperEngine] Página ${i + 1}: ${pageData.length} elemento(s)`);

      if (pageData.length === 0) {
        console.log(`[ScraperEngine] Sin datos en página ${i + 1}, finalizando paginación.`);
        break;
      }

      allData.push(...pageData);

      // Delay aleatorio anti-ban entre páginas
      if (task.isPaginated && i < pagesToScrape - 1) {
        const delay = Math.random() * 2500 + 1500;
        console.log(`[ScraperEngine] Esperando ${Math.round(delay)}ms antes de siguiente página...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    console.log(`[ScraperEngine] Total extraído: ${allData.length} elemento(s)`);
    return allData;

  } catch (error) {
    console.error(`[ScraperEngine] ERROR: ${error.message}`);
    try {
      const bodyText = await page.evaluate(
        () => document.body?.innerText?.substring(0, 300) || 'sin contenido'
      );
      console.error(`[ScraperEngine] Contenido al fallar: ${bodyText}`);
    } catch (_) {}
    return allData;
  } finally {
    await browser.close();
    console.log(`[ScraperEngine] Browser cerrado`);
  }
}

// ─────────────────────────────────────────────────────────────
// Punto de entrada unificado — recibe el objeto task completo
// ─────────────────────────────────────────────────────────────

/**
 * @param {Object} task - Documento completo de MongoDB con todos sus campos.
 */
async function extractData(task) {
  try {
    if (isJsonApi(task.targetUrl)) {
      return await extractFromApi(task.targetUrl, task.cssSelector);
    } else {
      return await extractFromHtml(task);
    }
  } catch (error) {
    console.error(`[ScraperEngine] Error inesperado: ${error.message}`);
    return [];
  }
}

module.exports = { extractData };
