const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// ─────────────────────────────────────────────────────────────
// Tipos de error específicos para diagnóstico
// ─────────────────────────────────────────────────────────────

class ScraperError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ScraperError';
    this.code = code; // 'SELECTOR_NOT_FOUND' | 'NETWORK_ERROR' | 'BLOCKED' | 'TIMEOUT' | 'UNKNOWN'
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function isJsonApi(url) {
  try {
    return new URL(url).hostname.startsWith('api.');
  } catch {
    return false;
  }
}

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
// Clasificación de errores de Puppeteer
// ─────────────────────────────────────────────────────────────

/**
 * Convierte un error genérico de Puppeteer en un ScraperError con código específico.
 * Permite diferenciar qué tipo de fallo ocurrió para logging y diagnóstico.
 */
function classifyError(error, selector) {
  const msg = error.message || '';

  // Timeout esperando el selector CSS
  if (
    msg.includes('Waiting for selector') ||
    (msg.includes('Waiting failed') && selector && msg.includes(selector))
  ) {
    return new ScraperError(
      `Selector no encontrado: "${selector}" (timeout 10s). El sitio puede haber cambiado su diseño.`,
      'SELECTOR_NOT_FOUND'
    );
  }

  // Timeout de navegación (goto)
  if (msg.includes('Navigation timeout') || msg.includes('TimeoutError')) {
    return new ScraperError(
      `Timeout de navegación. El sitio tardó demasiado en responder.`,
      'TIMEOUT'
    );
  }

  // Bloqueo detectado (redirección a login/captcha)
  if (
    msg.includes('net::ERR_ABORTED') ||
    msg.includes('net::ERR_CONNECTION_REFUSED') ||
    msg.includes('ERR_NAME_NOT_RESOLVED')
  ) {
    return new ScraperError(
      `Error de red: ${msg}`,
      'NETWORK_ERROR'
    );
  }

  // Detectar redirección a login/captcha basada en URL final
  return new ScraperError(msg, 'UNKNOWN');
}

// ─────────────────────────────────────────────────────────────
// Modo JSON API
// ─────────────────────────────────────────────────────────────

async function extractFromApi(url, jsonPath) {
  console.log(`[ScraperEngine] Modo API → GET ${url}`);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; ScraperOrchestrator/1.0)',
      },
    });
  } catch (err) {
    throw new ScraperError(`Error de red al contactar la API: ${err.message}`, 'NETWORK_ERROR');
  }

  if (!response.ok) {
    const code = response.status === 403 || response.status === 401 ? 'BLOCKED' : 'NETWORK_ERROR';
    throw new ScraperError(`HTTP ${response.status} ${response.statusText}`, code);
  }

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

  // Validación de configuración antes de lanzar el browser
  if (task.isPaginated && !task.targetUrl.includes('{{PAGE_PARAM}}')) {
    await browser.close();
    throw new ScraperError(
      `Paginación activa pero la URL no contiene el comodín {{PAGE_PARAM}}. ` +
      `Añadilo a la URL o desactivá la paginación. URL actual: "${task.targetUrl}"`,
      'CONFIG_ERROR'
    );
  }

  try {
    for (let i = 0; i < pagesToScrape; i++) {
      let currentUrl = task.targetUrl;
      if (task.isPaginated) {
        const paramValue = task.paginationStart + i * task.paginationStep;
        currentUrl = task.targetUrl.replace('{{PAGE_PARAM}}', String(paramValue));
      }

      console.log(`[ScraperEngine] Página ${i + 1}/${pagesToScrape} → ${currentUrl}`);

      // Detectar que el comodín {{PAGE_PARAM}} sigue sin reemplazar ANTES de navegar
      if (currentUrl.includes('{{PAGE_PARAM}}')) {
        throw new ScraperError(
          `La URL contiene el comodín sin reemplazar: "${currentUrl}". Activá la paginación o corregí la URL.`,
          'CONFIG_ERROR'
        );
      }

      // Navegación con manejo explícito de errores de red
      try {
        await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 25000 });
      } catch (navErr) {
        console.warn(`[ScraperEngine] networkidle2 falló, reintentando con domcontentloaded...`);
        try {
          await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        } catch (navErr2) {
          throw new ScraperError(`No se pudo navegar a ${currentUrl}: ${navErr2.message}`, 'NETWORK_ERROR');
        }
      }

      const finalUrl = page.url();
      console.log(`[ScraperEngine] URL final: ${finalUrl}`);

      // Detectar respuesta HTTP 404 / 500 via response status
      const response = await page.evaluate(() => {
        // Algunos sitios inyectan el status en el meta o título
        const title = document.title?.toLowerCase() || '';
        if (title.includes('404') || title.includes('not found') || title.includes('page not found')) return 404;
        if (title.includes('500') || title.includes('server error')) return 500;
        return 200;
      });
      if (response === 404) {
        throw new ScraperError(
          `La página devolvió un error 404 (Not Found). Verificá que la URL sea correcta: ${currentUrl}`,
          'NETWORK_ERROR'
        );
      }

      // Detectar redirección a login/captcha
      if (
        finalUrl.includes('login') ||
        finalUrl.includes('captcha') ||
        finalUrl.includes('account-verification') ||
        finalUrl.includes('signin')
      ) {
        throw new ScraperError(
          `El sitio redirigió a una página de autenticación: ${finalUrl}`,
          'BLOCKED'
        );
      }

      await autoScroll(page);

      // waitForSelector con error específico
      try {
        await page.waitForSelector(task.cssSelector, { timeout: 10000 });
      } catch (selectorErr) {
        throw classifyError(selectorErr, task.cssSelector);
      }

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

      if (task.isPaginated && i < pagesToScrape - 1) {
        const delay = Math.random() * 2500 + 1500;
        console.log(`[ScraperEngine] Esperando ${Math.round(delay)}ms antes de siguiente página...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    console.log(`[ScraperEngine] Total extraído: ${allData.length} elemento(s)`);
    return allData;

  } catch (error) {
    // Re-lanzar ScraperErrors clasificados directamente
    if (error.name === 'ScraperError') throw error;

    // Clasificar errores no capturados internamente
    const classified = classifyError(error, task.cssSelector);
    console.error(`[ScraperEngine] ${classified.code}: ${classified.message}`);

    try {
      const bodyText = await page.evaluate(
        () => document.body?.innerText?.substring(0, 300) || 'sin contenido'
      );
      console.error(`[ScraperEngine] Contenido al fallar: ${bodyText}`);
    } catch (_) {}

    throw classified;
  } finally {
    await browser.close();
    console.log(`[ScraperEngine] Browser cerrado`);
  }
}

// ─────────────────────────────────────────────────────────────
// Punto de entrada unificado
// ─────────────────────────────────────────────────────────────

/**
 * @param {Object} task - Documento completo de MongoDB.
 * @returns {{ values: string[], errorCode: string|null, errorMessage: string|null }}
 */
async function extractData(task) {
  try {
    let values;
    if (isJsonApi(task.targetUrl)) {
      values = await extractFromApi(task.targetUrl, task.cssSelector);
    } else {
      values = await extractFromHtml(task);
    }
    return { values, errorCode: null, errorMessage: null };
  } catch (error) {
    const code = error.code || 'UNKNOWN';
    const message = error.message || 'Error desconocido';
    console.error(`[ScraperEngine] Fallo clasificado — ${code}: ${message}`);
    return { values: [], errorCode: code, errorMessage: message };
  }
}

module.exports = { extractData, ScraperError };
