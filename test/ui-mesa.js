const { app } = require('electron');
const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
fs.mkdirSync('/tmp/shots', { recursive: true });
app.on('browser-window-created', (_, w) => {
  w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.level, e.message); });
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    await espera(2500);
    try {
      await js(`localStorage.removeItem('teste:origem')`);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      console.log('peça nova em:', await js(`window.__anvil.estado.doc.objetos[0].transformacao.posicao.join(',')`));
      await js(`document.querySelector('[data-cmd=mesa256]').click()`); await espera(400);
      console.log('mesa 256, item marcado:', await js(`document.querySelector('[data-cmd=mesa256]').classList.contains('ativo')`));
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Esfera')).click()`); await espera(300);
      console.log('peça nova na mesa 256:', await js(`window.__anvil.estado.doc.objetos[1].transformacao.posicao.join(',')`));
      await js(`document.querySelector('[data-cmd=vistaIso]').click()`); await espera(700);
      fs.writeFileSync('/tmp/shots/43-mesa.png', (await w.webContents.capturePage()).toPNG());
      await js(`document.querySelector('[data-cmd=mesa200]').click()`); await espera(200);
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
