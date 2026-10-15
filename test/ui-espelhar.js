const { app } = require('electron'); const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (e.level > 1 && !/Security/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`localStorage.setItem('teste:origem','1')`);
  try {
    // cunha: espelhar em X inverte a rampa
    await js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent==='Cunha').click()`); await espera(300);
    await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
    w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'M' }); await espera(500);
    console.log('painel:', await js(`document.querySelector('#propriedades h2').textContent`), '| setas na vista:', await js(`window.__anvil.cena.children.flatMap(g=>g.children||[]).filter(o=>o.userData?.espelho).map(o=>o.userData.espelho).join(',')`));
    const ponta = await js(`(()=>{const F=window.__anvil; const s=F.cena.children.flatMap(g=>g.children||[]).find(o=>o.userData?.espelho==='x'); const p=s.getWorldPosition(new F.THREE.Vector3()).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
    const antes = await js(`JSON.stringify(window.__anvil.estado.doc.objetos[0].transformacao)`);
    for (const t of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type: t, x: Math.round(ponta[0]), y: Math.round(ponta[1]), button: 'left', clickCount: 1 });
    await espera(500);
    console.log('clique na seta X:', await js(`document.querySelector('#msg').textContent`), '| escala:', await js(`window.__anvil.estado.doc.objetos[0].transformacao.escala.join(',')`), '| mudou?', antes !== await js(`JSON.stringify(window.__anvil.estado.doc.objetos[0].transformacao)`));
    fs.writeFileSync('/tmp/shots/64-espelhar.png', (await w.webContents.capturePage()).toPNG());
    await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Espelhar Z').click()`); await espera(400);
    console.log('botão Espelhar Z:', await js(`window.__anvil.estado.doc.objetos[0].transformacao.escala.join(',')`), '| base no chão?', await js(`(()=>{const F=window.__anvil; const m=F.malhas.get(F.estado.doc.objetos[0].id); m.updateMatrixWorld(true); return new F.THREE.Box3().setFromObject(m,true).min.z.toFixed(2);})()`));
    w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await espera(300);
    console.log('saiu:', await js(`document.querySelector('#propriedades h2').textContent`));
  } catch (e) { console.log('ERRO TESTE', e); }
  app.exit(0);
}); });
require('../main.js');
