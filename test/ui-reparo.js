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
    const bt = t => js(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(t)} || b.querySelector(':scope > span')?.textContent.trim()===${JSON.stringify(t)}).click()`);
    const estado = () => js(`document.querySelector('.estado').textContent + ' | ' + [...document.querySelectorAll('.diag li')].map(l=>l.textContent).join(' / ')`);
    await espera(2500);
    await w.webContents.executeJavaScript("localStorage.setItem('teste:origem','1')");
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Cilindro')).click()`); await espera(300);
      await bt('Converter em malha editável'); await espera(400);
      console.log('antes:', await estado());
      await bt('Editar triângulos e vértices'); await espera(300);
      await js(`window.__anvil.modoMalha.selT = new Set([0,1,5]);`);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Delete' }); await espera(400);
      await bt('Concluir'); await espera(300);
      console.log('estragada:', await estado());
      await bt('Reparar para impressão'); await espera(600);
      console.log('msg:', await js(`document.querySelector('#msg').textContent`));
      console.log('depois:', await estado());
      await js(`document.querySelector('#propriedades [data-dica=impressao]').scrollIntoView()`);
      fs.writeFileSync('/tmp/shots/18-reparo.png', (await w.webContents.capturePage()).toPNG());
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
