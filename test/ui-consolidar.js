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
    const msg = () => js(`document.querySelector('#msg').textContent`);
    const pos = (i, v) => js(`(()=>{const x=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input')[${i}]; x.value='${v}'; x.dispatchEvent(new Event('change'));})()`);
    const objs = () => js(`window.__anvil.estado.doc.objetos.map(o=>o.nome+'@'+o.transformacao.posicao.join(',')).join(' ; ')`);
    for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
    await w.webContents.executeJavaScript("localStorage.setItem('teste:origem','1')");
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Cilindro')).click()`); await espera(300);
      await pos(0, 10); await espera(200);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Esfera')).click()`); await espera(300);
      await pos(2, 15); await espera(200);
      console.log('antes:', await objs());
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await espera(200);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'K', modifiers: ['control'] }); await espera(800);
      console.log(await msg());
      console.log('consolidado:', await objs());
      await pos(0, 50); await espera(300);
      await bt('Salvar na biblioteca'); await espera(300);
      await js(`(()=>{const i=document.querySelector('#modal input'); i.value='Suporte teste'; })()`);
      await js(`document.querySelector('#modal .primario').click()`); await espera(800);
      console.log(await msg());
      await js(`[...document.querySelectorAll('.cat-titulo.fechada')].forEach(b=>b.click())`); await espera(300);
      console.log('biblioteca:', await js(`[...document.querySelectorAll('.forma.peca')].map(b=>b.textContent).join(', ')`));
      await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Voltar à receita')).click()`); await espera(600);
      console.log('receita de volta (movida +50 em X):', await objs());
      await js(`[...document.querySelectorAll('.forma.peca')][0].click()`); await espera(600);
      console.log(await msg());
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      fs.writeFileSync('/tmp/shots/19-consolidar.png', (await w.webContents.capturePage()).toPNG());
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
