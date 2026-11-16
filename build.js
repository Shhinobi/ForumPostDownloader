const fs = require('fs');
const path = require('path');

const getContents = filePath => fs.readFileSync(path.resolve(__dirname, filePath), 'utf8');

const header = getContents('./src/header.js');

// The inclusion order is important.
const includes = ['globals.js', 'logging.js', 'settings.js', 'helpers.js', 'prototypes.js', 'parsers.js', 'styles.js', 'ui.js', 'init.js']
  .map(fn => getContents(`./src/includes/${fn}`))
  .join('\n');
const main = getContents('./src/main.js');

const distDir = path.resolve(__dirname, './dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const data = `${header}\n${includes}\n${main}`;

fs.writeFileSync(path.join(distDir, 'build.user.js'), data);
