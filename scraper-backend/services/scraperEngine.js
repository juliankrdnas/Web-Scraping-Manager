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
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

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
