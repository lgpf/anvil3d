const { app } = require('electron'); const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200mm" height="100mm">
  <g transform="translate(10,10)">
    <path d="M0,0 h60 v60 h-60 Z m15,15 v30 h30 v-30 Z" />
    <circle cx="110" cy="30" r="30" />
    <rect x="150" y="0" width="30" height="80" transform="rotate(10 165 40)" />
    <path d="M70,70 C80,95 120,95 130,70 Z" />
  </g></svg>`;
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (e.level > 1 && !/Security/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`window.__anvil.criarDeSvg(${JSON.stringify(SVG)}, 'teste')`); await espera(800);
  console.log(await js(`document.querySelector('#msg').textContent`));
  console.log('peça:', await js(`(()=>{const F=window.__anvil,o=F.estado.doc.objetos.at(-1); const m=F.malhas.get(o.id); m.updateMatrixWorld(true); const b=new F.THREE.Box3().setFromObject(m,true).getSize(new F.THREE.Vector3()); return o.nome+' | erro: '+(F.estado.erros.get(o.id)||'nenhum')+' | tamanho '+b.toArray().map(v=>v.toFixed(1)).join(' x ')+' | triângulos '+m.geometry.attributes.position.count/3;})()`));
  console.log('painel:', await js(`[...document.querySelectorAll('#propriedades .campo')].slice(0,6).map(c=>c.textContent.trim()).join(' | ')`));
  await js(`document.querySelector('[data-cmd=vistaTopo]').click()`); await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(600);
  fs.writeFileSync('/tmp/shots/74-svg.png', (await w.webContents.capturePage()).toPNG());
  app.exit(0);
}); });
require('../main.js');
