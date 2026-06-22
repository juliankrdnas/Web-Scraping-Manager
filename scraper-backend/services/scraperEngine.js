const puppeteer = require('puppeteer');

/**
 * Extrae texto de todos los elementos que coincidan con el selector CSS.
 * @param {string} url      - URL de la página objetivo.
 * @param {string} selector - Selector CSS de los elementos a extraer.
 * @returns {Promise<string[]>} Array de textos extraídos (vacío si hubo error).
 */
async function extractData(url, selector) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();

  // Simular un browser real para evitar detección anti-bot
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  // Bloquear recursos innecesarios para mejorar rendimiento
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector(selector, { timeout: 8000 });

    // Extraer TODOS los elementos que coincidan con el selector
    const data = await page.evaluate((sel) => {
      const elements = document.querySelectorAll(sel);
      return Array.from(elements).map((el) => el.innerText.trim()).filter(Boolean);
    }, selector);

    return data;
  } catch (error) {
    console.error(`[ScraperEngine] Error al hacer scraping de ${url}:`, error.message);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = { extractData };
