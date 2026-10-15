// mesa personalizada (retangular) e densidade da grade
const { app } = require('electron'); const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (/rror/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`document.querySelector('[data-cmd=mesaPersonalizada]').click()`); await espera(300);
  await js(`(()=>{const i=[...document.querySelectorAll('.conteudo-modal input')]; i[0].value='350'; i[1].value='250'; [...document.querySelectorAll('.conteudo-modal button')].find(b=>b.textContent==='Aplicar').click();})()`); await espera(500);
  console.log('mesa:', await js(`document.querySelector('#msg').textContent`), '| item:', await js(`document.querySelector('[data-cmd=mesaPersonalizada]').textContent.trim()`), '| ativo:', await js(`document.querySelector('[data-cmd=mesaPersonalizada]').classList.contains('ativo')`));
  await js(`document.querySelector('[data-cmd=grade5]').click()`); await espera(400);
  console.log('grade:', await js(`document.querySelector('#msg').textContent`), '| ativo 5:', await js(`document.querySelector('[data-cmd=grade5]').classList.contains('ativo')`));
  await js(`window.__anvil.selecionar([])`); await js(`document.querySelector('[data-cmd=vistaIso]').click()`); await espera(500);
  fs.writeFileSync('/tmp/shots/107.png', (await w.webContents.capturePage()).toPNG());
  await js(`document.querySelector('[data-cmd=mesaPersonalizada]').click()`); await espera(300);
  await js(`(()=>{const s=document.querySelector('.conteudo-modal select'); s.value='redonda'; s.dispatchEvent(new Event('change')); const i=[...document.querySelectorAll('.conteudo-modal input')]; i[0].value='280'; [...document.querySelectorAll('.conteudo-modal button')].find(b=>b.textContent==='Aplicar').click();})()`); await espera(500);
  console.log('redonda:', await js(`document.querySelector('#msg').textContent`), '| item:', await js(`document.querySelector('[data-cmd=mesaPersonalizada]').textContent.trim()`));
  fs.writeFileSync('/tmp/shots/108.png', (await w.webContents.capturePage()).toPNG());
  await js(`document.querySelector('[data-cmd=mesa200]').click(); document.querySelector('[data-cmd=grade1]').click()`); await espera(300);
  console.log('volta ao padrão:', await js(`document.querySelector('[data-cmd=mesaPersonalizada]').textContent.trim()`), '| ativo 200:', await js(`document.querySelector('[data-cmd=mesa200]').classList.contains('ativo')`));
  app.exit(0);
}); });
require('../main.js');
