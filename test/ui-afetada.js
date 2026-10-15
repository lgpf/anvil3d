const { app } = require('electron');
const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => {
  w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.level, e.message); });
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    await espera(2500);
    await js(`localStorage.setItem('teste:origem','1')`);
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Cilindro')).click()`); await espera(200);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Esfera')).click()`); await espera(200);
      await js(`(()=>{const F=window.__anvil, e=F.estado.doc.objetos[1]; e.transformacao.posicao=[8,0,8]; e.furo=true; F.selecionar([e.id]);})()`);
      await js(`document.querySelector('[data-cmd=desfazer]')`); await js(`(()=>{const i=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input')[0]; i.value='8'; i.dispatchEvent(new Event('change'));})()`); await espera(500);
      console.log('furo invadindo sólido (sem junção): áreas escuras =', await js(`window.__anvil.grupoAfetado.children.length`));
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(500);
      fs.writeFileSync('/tmp/shots/48-afetada.png', (await w.webContents.capturePage()).toPNG());
      await js(`(()=>{const i=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input')[0]; i.value='60'; i.dispatchEvent(new Event('change'));})()`); await espera(500);
      console.log('furo afastado: áreas escuras =', await js(`window.__anvil.grupoAfetado.children.length`));
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
