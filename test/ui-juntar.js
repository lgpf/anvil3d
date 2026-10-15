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
    const foto = async n => fs.writeFileSync(`/tmp/shots/${n}.png`, (await w.webContents.capturePage()).toPNG());
    const bt = t => js(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(t)} || b.querySelector(':scope > span')?.textContent.trim()===${JSON.stringify(t)}).click()`);
    const msg = () => js(`document.querySelector('#msg').textContent`);
    const mover = async (x, y) => { w.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y) }); await espera(200); };
    const clicar = async (x, y, mods = []) => { await mover(x, y); for (const type of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, modifiers: mods }); await espera(400); };
    const projetar = expr => js(`(()=>{const F=window.__anvil; const p=(${expr}).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
    const xyz = i => js(`[...document.querySelectorAll('#propriedades .xyz')][${i}] ? [...[...document.querySelectorAll('#propriedades .xyz')][${i}].querySelectorAll('input')].map(i=>i.value).join(' | ') : '-'`);
    await espera(2500);
    await w.webContents.executeJavaScript("localStorage.setItem('teste:origem','1')");
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Cilindro')).click()`); await espera(300);
      await js(`(()=>{const i=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input')[0]; i.value='40'; i.dispatchEvent(new Event('change'));})()`); await espera(300);
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      // segura J (keyDown sem soltar)
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'J' }); await espera(200);
      console.log(await msg());
      const topoCil = await projetar(`new F.THREE.Vector3(43,2,20)`);
      await mover(...topoCil); await foto('12-hover-origem');
      await clicar(...topoCil);
      console.log(await msg());
      const ladoCaixa = await projetar(`new F.THREE.Vector3(3,-10,8)`);
      await mover(...ladoCaixa); await foto('13-hover-alvo');
      await clicar(...ladoCaixa);
      w.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'J' });
      console.log(await msg());
      console.log('junção:', await js(`JSON.stringify(window.__anvil.estado.doc.objetos[1].transformacao)`));
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      await foto('14-juntado');
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
