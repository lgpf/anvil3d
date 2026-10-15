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
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Esfera')).click()`); await espera(200);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Cilindro')).click()`); await espera(200);
      await js(`(()=>{const F=window.__anvil,[e,c]=F.estado.doc.objetos; e.parametros.diametro=40; c.parametros.diametro=30; c.parametros.altura=60; c.transformacao.posicao=[14,0,-10]; c.furo=true; F.selecionar([e.id,c.id]);})()`);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'G', modifiers: ['control'] }); await espera(1200);
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Fillet…').click()`); await espera(1200);
      await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Todas').click()`); await espera(2500);
      console.log('aviso:', await js(`document.querySelector('#propriedades .caixa-aviso')?.textContent ?? 'nenhum'`));
      await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Aplicar').click()`); await espera(5000);
      console.log(await js(`document.querySelector('#msg').textContent`), '| erros', await js(`window.__anvil.estado.erros.size`));
      fs.writeFileSync('/tmp/shots/54-agudo.png', (await w.webContents.capturePage()).toPNG());
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
