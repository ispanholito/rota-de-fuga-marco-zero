/**
 * Gera uma versão de ARQUIVO ÚNICO do jogo.
 *
 * Motivação: o projeto usa módulos ES, que os navegadores bloqueiam sob o
 * protocolo file://. Isso obriga a subir um servidor local para jogar. Este
 * script concatena todos os módulos (removendo import/export, já que tudo passa
 * a viver no mesmo escopo) e embute CSS e HTML num único arquivo .html, que
 * funciona com duplo clique, sem servidor e sem internet.
 *
 * A ordem dos módulos importa: cada arquivo só pode depender dos anteriores.
 *
 * Uso:
 *   node tools/build-standalone.mjs                  -> dist/rota-de-fuga-standalone.html
 *   node tools/build-standalone.mjs --fragment saida.html  -> sem <!doctype>/<html>/<body>
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const ORDEM = [
  'src/engine/utils.js',
  'src/engine/input.js',
  'src/engine/audio.js',
  'src/game/sprites.js',
  'src/game/level.js',
  'src/game/terminal.js',
  'src/game/threat.js',
  'src/game/player.js',
  'src/game/renderer.js',
  'src/data/levels.js',
  'src/game/game.js',
  'src/main.js',
];

/** Remove as linhas de import e a palavra-chave export. */
function desmodularizar(codigo, arquivo) {
  return codigo
    .split('\n')
    .filter((linha) => !/^\s*import\s.+from\s+['"].+['"];?\s*$/.test(linha))
    .join('\n')
    .replace(/^export\s+/gm, '')
    .replace(/^/, `// ===== ${arquivo} =====\n`);
}

const modulos = [];
for (const arquivo of ORDEM) {
  const codigo = await readFile(path.join(ROOT, arquivo), 'utf8');
  modulos.push(desmodularizar(codigo, arquivo));
}

const css = await readFile(path.join(ROOT, 'src/style.css'), 'utf8');
const indexHtml = await readFile(path.join(ROOT, 'index.html'), 'utf8');

// Extrai apenas o conteúdo de <body>, sem a tag <script type="module">.
const corpo = indexHtml
  .replace(/[\s\S]*<body>/, '')
  .replace(/<\/body>[\s\S]*/, '')
  .replace(/\s*<script type="module"[\s\S]*?<\/script>/, '')
  .trim();

const bundle = modulos.join('\n\n');
const fragment = process.argv.includes('--fragment');
const destino = process.argv[process.argv.indexOf('--fragment') + 1];

const conteudo = `<title>Rota de Fuga: Marco Zero</title>
<style>
${css}
/* Ajustes exclusivos da versão de arquivo único */
html, body { height: 100%; }
#aviso-foco {
  position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,.72); color: #39ff14; font: 16px "Courier New", monospace;
  letter-spacing: 2px; cursor: pointer; z-index: 50; text-align: center; padding: 20px;
}
</style>

${corpo}

<div id="aviso-foco">CLIQUE AQUI PARA ATIVAR O TECLADO E O ÁUDIO</div>

<script>
(function () {
'use strict';
${bundle}

// A página precisa receber o foco para capturar o teclado (e liberar o áudio).
var aviso = document.getElementById('aviso-foco');
function ativar() {
  aviso.remove();
  window.focus();
  document.body.focus();
}
aviso.addEventListener('click', ativar);
document.addEventListener('keydown', function once() {
  if (aviso.isConnected) ativar();
  document.removeEventListener('keydown', once);
});
})();
</script>`;

const documentoCompleto = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${conteudo.replace(/^<title>/, '<title>')}
</head>
</html>`;

const saida = fragment
  ? path.resolve(ROOT, destino || 'dist/artifact.html')
  : path.join(ROOT, 'dist', 'rota-de-fuga-standalone.html');

await mkdir(path.dirname(saida), { recursive: true });
await writeFile(saida, fragment ? conteudo : documentoCompleto, 'utf8');

const kb = (Buffer.byteLength(fragment ? conteudo : documentoCompleto) / 1024).toFixed(0);
console.log(`gerado: ${path.relative(ROOT, saida)} (${kb} KB, ${ORDEM.length} módulos embutidos)`);
