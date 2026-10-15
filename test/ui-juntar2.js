const { app } = require('electron');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => {
  w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.level, e.message); });
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    const clicar = async p => { for (const t of ['mouseMove', 'mouseDown', 'mouseUp']) { w.webContents.sendInputEvent({ type: t, x: Math.round(p[0]), y: Math.round(p[1]), button: 'left', clickCount: 1 }); await espera(80); } await espera(300); };
    const ponto = (i, x, y, z) => js(`(()=>{const F=window.__anvil; const m=F.malhas.get(F.estado.doc.objetos[${i}].id); m.updateMatrixWorld(true); const p=new F.THREE.Vector3(${x},${y},${z}).applyMatrix4(m.matrixWorld).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
    await espera(2500);
    await js(`localStorage.setItem('teste:origem','1')`);
    try {
      // alvo: grupo multicolorido (caixa + cilindro) com fillet por cima
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(200);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Cilindro')).click()`); await espera(200);
      await js(`(()=>{const F=window.__anvil; F.estado.doc.objetos[1].transformacao.posicao=[10,0,0]; F.selecionar(F.estado.doc.objetos.map(o=>o.id));})()`);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'G', modifiers: ['control'] }); await espera(600);
      // peça que vai encostar
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Cunha')).click()`); await espera(200);
      await js(`(()=>{const F=window.__anvil, c=F.estado.doc.objetos[1]; c.transformacao.posicao=[-40,0,0]; F.selecionar([c.id]);})()`); await espera(300);
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(400);
      console.log('grupo multicolorido?', await js(`!!window.__anvil.malhas.get(window.__anvil.estado.doc.objetos[0].id).geometry.attributes.color`));
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'J' }); await espera(200);
      await clicar(await ponto(1, -9, 0, 3));          // base da cunha? (face de trás x=-10)
      console.log('1º clique:', await js(`document.querySelector('#msg').textContent`));
      await clicar(await ponto(0, 2, -4, 20));          // topo do grupo
      console.log('2º clique:', await js(`document.querySelector('#msg').textContent`), '| presa?', await js(`!!window.__anvil.estado.doc.objetos[1].juncao`));
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await espera(200);
      // ciclo: tenta prender o grupo na cunha
      await js(`window.__anvil.selecionar([window.__anvil.estado.doc.objetos[0].id])`); await espera(200);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'J' }); await espera(200);
      await clicar(await ponto(0, -9, 0, 10));
      await clicar(await ponto(1, 0, 0, 2));
      console.log('ciclo:', await js(`document.querySelector('#msg').textContent`), '| grupo preso?', await js(`!!window.__anvil.estado.doc.objetos[0].juncao`));
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
