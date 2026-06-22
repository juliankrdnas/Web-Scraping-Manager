const puppeteer = require('puppeteer');

/**
 * Determina si una URL apunta a una API que devuelve JSON.
 * Reconoce: api.mercadolibre.com, api.mercadopago.com, y cualquier URL
 * que contenga /api/ o que el usuario haya marcado explícitamente.
 */
function isJsonApi(url) {
  try {
    const { hostname } = new URL(url);
    return hostname.startsWith('api.');
  } catch {
    return false;
  }
}

/**
 * Navega un objeto JSON anidado usando una ruta con notación de punto y corchetes.
 * Soporta:
 *   - Propiedad simple:          "title"
 *   - Ruta anidada:              "results.title"
 *   - Array con índice:          "results[0].title"
 *   - Array completo (flatten):  "results[].title"
 *
 * @param {any}    obj   - Objeto JSON raíz.
 * @param {string} path  - Ruta a extraer, ej: "results[].title"
 * @returns {string[]}   - Array de strings con los valores encontrados.
 */
function extractByPath(obj, path) {
  const parts = path
    .replace(/\[(\d*)\]/g, '.$1')   // results[0] → results.0  |  results[] → results.
    .split('.')
    .filter(Boolean);

  function dig(current, remaining) {
    if (remaining.length === 0) {
      if (current === null || current === undefined) return [];
      return [String(current).trim()].filter(Boolean);
    }

    const [head, ...tail] = remaining;

    if (Array.isArray(current)) {
      // Si el segmento es un índice numérico accede directamente; si no, mapea todo el array
      const idx = parseInt(head, 10);
      if (!isNaN(idx)) return dig(current[idx], tail);
      return current.flatMap((item) => dig(item[head], tail));
    }

    if (current && typeof current === 'object') {
      return dig(current[head], tail);
    }

    return [];
  }

  return dig(obj, parts);
}

// ─────────────────────────────────────────────────────────────
// Modo JSON API — fetch simple, sin Puppeteer
// ─────────────────────────────────────────────────────────────

/**
 * Llama a una URL de API REST, parsea el JSON y extrae valores
 * usando la ruta indicada en jsonPath.
 *
 * @param {string} url      - URL de la API (ej: https://api.mercadolibre.com/sites/MCO/search?q=tvs+raider)
 * @param {string} jsonPath - Ruta JSON (ej: results[].title)
 * @returns {Promise<string[]>}
 */
async function extractFromApi(url, jsonPath) {
  console.log(`[ScraperEngine] Modo API → GET ${url}`);
  console.log(`[ScraperEngine] Ruta JSON: "${jsonPath}"`);

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; ScraperOrchestrator/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const values = extractByPath(json, jsonPath);

  console.log(`[ScraperEngine] API extrajo ${values.length} valor(es)`);
  return values;
}

// ─────────────────────────────────────────────────────────────
// Modo HTML — Puppeteer con selector CSS
// ─────────────────────────────────────────────────────────────

async function extractFromHtml(url, selector) {
  console.log(`[ScraperEngine] Modo HTML → ${url}`);
  console.log(`[ScraperEngine] Selector CSS: "${selector}"`);

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

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    if (['image', 'font', 'media'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
      console.log(`[ScraperEngine] Página cargada (networkidle2)`);
    } catch {
      console.warn(`[ScraperEngine] networkidle2 falló, reintentando con domcontentloaded...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      console.log(`[ScraperEngine] Página cargada (domcontentloaded fallback)`);
    }

    const finalUrl = page.url();
    console.log(`[ScraperEngine] URL final: ${finalUrl}`);

    await page.waitForSelector(selector, { timeout: 10000 });

    const data = await page.evaluate((sel) => {
      return Array.from(document.querySelectorAll(sel))
        .map((el) => el.innerText.trim())
        .filter(Boolean);
    }, selector);

    console.log(`[ScraperEngine] HTML extrajo ${data.length} elemento(s)`);
    return data;

  } catch (error) {
    console.error(`[ScraperEngine] ERROR en ${url}: ${error.message}`);
    try {
      const bodyText = await page.evaluate(
        () => document.body?.innerText?.substring(0, 300) || 'sin contenido'
      );
      console.error(`[ScraperEngine] Contenido al fallar: ${bodyText}`);
    } catch (_) {}
    return [];
  } finally {
    await browser.close();
    console.log(`[ScraperEngine] Browser cerrado`);
  }
}

// ─────────────────────────────────────────────────────────────
// Punto de entrada unificado
// ─────────────────────────────────────────────────────────────

/**
 * Extrae datos de una URL usando el modo adecuado según el tipo de URL.
 *
 * Modo API  → URL comienza con api.* → selectorOrPath es una ruta JSON
 *             Ej: url = "https://api.mercadolibre.com/sites/MCO/search?q=tvs+raider"
 *                 selectorOrPath = "results[].title"
 *
 * Modo HTML → cualquier otra URL     → selectorOrPath es un selector CSS
 *             Ej: url = "https://ejemplo.com/productos"
 *                 selectorOrPath = ".product-title"
 *
 * @param {string} url             - URL objetivo.
 * @param {string} selectorOrPath  - Selector CSS o ruta JSON según el modo.
 * @returns {Promise<string[]>}
 */
async function extractData(url, selectorOrPath) {
  try {
    if (isJsonApi(url)) {
      return await extractFromApi(url, selectorOrPath);
    } else {
      return await extractFromHtml(url, selectorOrPath);
    }
  } catch (error) {
    console.error(`[ScraperEngine] Error inesperado: ${error.message}`);
    return [];
  }
}

module.exports = { extractData };
