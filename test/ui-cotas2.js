const { app } = require('electron');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`localStorage.setItem('teste:origem','1')`);
  await js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent==='Caixa').click()`); await espera(300);
  await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
  await js(`window.__anvil.mostrarCotas()`); await espera(200);
  const centro = sel => js(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect(); return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()`);
  const clicar = async p => { for (const t of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type: t, x: p[0], y: p[1], button: 'left', clickCount: 1 }); await espera(300); };
  const tam = () => js(`(()=>{const F=window.__anvil,o=F.estado.doc.objetos[0]; return o.transformacao.escala.map(v=>v*20).join(' x ');})()`);
  await clicar(await centro('#cotas [data-eixo="0"]'));
  console.log('editando X?', await js(`!!document.querySelector('#cotas input')`));
  for (const ch of ['3', '5']) { w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' }); }
  await js(`document.querySelector('#cotas input').value='35'`);
  await clicar(await centro('#cotas [data-eixo="1"]'));
  await espera(300);
  console.log('depois de clicar na cota Y: tamanho', await tam(), '| editando agora?', await js(`document.querySelector('#cotas input') ? 'sim, eixo ' + (document.querySelector('#cotas input').previousSibling, 'Y') : 'não'`), '| cotas na tela:', await js(`document.querySelectorAll('#cotas .cota').length`));
  await js(`(()=>{const i=document.querySelector('#cotas input'); i.value='0'; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));})()`); await espera(400);
  console.log('Y = 0 (inválido): tamanho', await tam(), '| cotas na tela:', await js(`[...document.querySelectorAll('#cotas .cota')].map(c=>c.textContent).join(' / ')`));
  app.exit(0);
}); });
require('../main.js');
