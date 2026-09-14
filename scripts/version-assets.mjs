import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = path.join(root, 'asset-version.json');
const { version: current } = JSON.parse(await readFile(manifestPath, 'utf8'));
const parts = current.split('.');
parts[parts.length - 1] = String(Number(parts.at(-1)) + 1);
const version = process.argv[2] || parts.join('.');
if (!/^\d+(?:\.\d+)*$/.test(version)) {
  console.error('Use a numeric version such as 20260914.2.');
  process.exit(1);
}

const pages = (await readdir(root)).filter(name => name.endsWith('.html'));
const modules = (await readdir(path.join(root, 'assets/js'))).filter(name => name.endsWith('.js')).map(name => `assets/js/${name}`);
const styles = (await readdir(path.join(root, 'assets/css'))).filter(name => name.endsWith('.css')).map(name => `assets/css/${name}`);
for (const file of [...pages, ...modules, ...styles]) {
  const filePath = path.join(root, file);
  let source = await readFile(filePath, 'utf8');
  // Existing versioned URLs, including photo URLs, share the release number.
  source = source.replace(/([?&]v=)\d+(?:\.\d+)*/g, `$1${version}`);
  // Version every relative module dependency independently from its entry point.
  source = source.replace(/(from\s+['"])(\.\/[^'"?]+\.js)(?:\?v=[\d.]+)?(['"])/g, `$1$2?v=${version}$3`);
  // This includes template URLs such as assets/images/${brandIcons[name]}.
  source = source.replace(/((?:src|href)=['"])(assets\/[^'"\s?]+)(?:\?v=[\d.]+)?(['"])/g, `$1$2?v=${version}$3`);
  // Version local CSS url() dependencies if any are added later.
  source = source.replace(/url\((['"]?)(\.\.?\/[^)'"\s?]+)(?:\?v=[\d.]+)?\1\)/g, `url($1$2?v=${version}$1)`);
  source = source.replace(/const ASSET_VERSION = '[\d.]+';/, `const ASSET_VERSION = '${version}';`);
  await writeFile(filePath, source);
}
await writeFile(manifestPath, `${JSON.stringify({ version }, null, 2)}\n`);
console.log(`Tabiro asset version: ${version}. Stamped ${pages.length} pages, ${modules.length} modules, and ${styles.length} stylesheets.`);
console.log(`Deploy the HTML files and assets/ together. First-visit URL: /?v=${version}`);
