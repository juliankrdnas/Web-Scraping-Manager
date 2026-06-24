const { join } = require('path');

module.exports = {
  cacheDirectory: join(
    process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer'
  ),
};
