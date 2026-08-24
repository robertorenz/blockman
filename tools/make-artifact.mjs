/**
 * Flatten the Vite build into one self-contained HTML page suitable for
 * publishing as an Artifact: no external requests, everything inlined.
 *
 *   npm run build && node tools/make-artifact.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const OUT = path.join(DIST, 'blockman.artifact.html');

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const assets = fs.readdirSync(path.join(DIST, 'assets'));

const cssFile = assets.find((f) => f.endsWith('.css'));
const jsFile = assets.find((f) => f.endsWith('.js'));
if (!cssFile || !jsFile) throw new Error('Build output is missing its css/js assets.');

const css = fs.readFileSync(path.join(DIST, 'assets', cssFile), 'utf8');
const js = fs.readFileSync(path.join(DIST, 'assets', jsFile), 'utf8');

// The Artifact host supplies <!doctype>/<html>/<head>/<body>, so emit only the
// page content: title, inlined styles, the markup, then the inlined bundle.
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!bodyMatch) throw new Error('Could not find <body> in the built index.html.');

const body = bodyMatch[1]
  .replace(/<script\b[^>]*><\/script>/gi, '')
  .replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi, '')
  .trim();

const out = `<title>Block-Man</title>
<style>
${css}
</style>

${body}

<script type="module">
${js}
</script>
`;

fs.writeFileSync(OUT, out);

const kb = (n) => (n / 1024).toFixed(1) + ' kB';
console.log(`wrote ${OUT}  ${kb(Buffer.byteLength(out))}`);
console.log(`  inlined css ${kb(css.length)}, js ${kb(js.length)}`);

// A stray absolute asset reference would 404 inside the sandbox.
for (const bad of out.matchAll(/(?:src|href)=["'](\/[^"']+|https?:\/\/[^"']+)["']/g)) {
  console.warn(`  WARNING external reference remains: ${bad[1]}`);
}
