const puppeteer = require('puppeteer');

/**
 * Extrae texto de un elemento CSS en una URL dada usando Puppeteer.
 * @param {string} url  - URL de la página objetivo.
 * @param {string} selector - Selector CSS del elemento a extraer.
 * @returns {Promise<string|null>} Texto extraído o null si ocurrió un error.
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

    const data = await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      return element ? element.innerText.trim() : null;
    }, selector);

    return data;
  } catch (error) {
    console.error(`[ScraperEngine] Error al hacer scraping de ${url}:`, error.message);
    return null;
  } finally {
    await browser.close();
  }
}

module.exports = { extractData };
