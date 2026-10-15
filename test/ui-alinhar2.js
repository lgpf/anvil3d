const { app } = require('electron'); const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)); const js = c => w.webContents.executeJavaScript(c);
  const ev = (type, p) => w.webContents.sendInputEvent({ type, x: Math.round(p[0]), y: Math.round(p[1]), ...(type === 'mouseMove' ? {} : { button: 'left', clickCount: 1 }) });
  await espera(6000);
  await js(`localStorage.setItem('teste:origem','1')`);
  try {
    for (const [n, x, y] of [['Caixa', -30, 0], ['Cilindro', 0, 15], ['Cone', 35, -10]]) {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent===${JSON.stringify(n)}).click()`); await espera(200);
      for (const [i, v] of [[0, x], [1, y]]) await js(`(()=>{const c=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input')[${i}]; c.value='${v}'; c.dispatchEvent(new Event('change'));})()`);
      await espera(150);
    }
    await js(`(()=>{const F=window.__anvil; F.selecionar(F.estado.doc.objetos.map(o=>o.id));})()`); await espera(300);
    await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(400);
    w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'L' }); await espera(500);
    const pontos = await js(`(()=>{const F=window.__anvil; const r=document.querySelector('#vista canvas').getBoundingClientRect(); return F.cena.children.flatMap(g=>g.children||[]).filter(m=>m.userData?.alinhar).map(m=>{const p=m.getWorldPosition(new F.THREE.Vector3()).project(F.camera); return {a:m.userData.alinhar, x:r.left+(p.x+1)/2*r.width, y:r.top+(1-p.y)/2*r.height};});})()`);
    console.log('pontos de alinhar:', pontos.length);
    const yFrente = pontos.find(p => p.a[0] === 1 && p.a[1] === 0);
    ev('mouseMove', [yFrente.x + 30, yFrente.y + 30]); await espera(150); ev('mouseMove', [yFrente.x + 1, yFrente.y]); await espera(150); ev('mouseMove', [yFrente.x, yFrente.y]); await espera(400);
    console.log('debug dispatch:', await js(`(()=>{const c=document.querySelector('#vista canvas'); c.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:${yFrente.x},clientY:${yFrente.y}})); return document.querySelector('#msg').textContent;})()`));
    console.log('prévia (y das peças na tela, sem mudar o projeto):', await js(`window.__anvil.estado.doc.objetos.map(o=>window.__anvil.malhas.get(o.id).position.y.toFixed(1)).join(' | ')`), '| projeto:', await js(`window.__anvil.estado.doc.objetos.map(o=>o.transformacao.posicao[1]).join(' | ')`), '|', await js(`document.querySelector('#msg').textContent`));
    await espera(300); fs.writeFileSync('/tmp/shots/61-alinhar.png', (await w.webContents.capturePage()).toPNG());
    ev('mouseDown', [yFrente.x, yFrente.y]); await espera(60); ev('mouseUp', [yFrente.x, yFrente.y]); await espera(500);
    console.log('depois do clique (frente = mín. Y):', await js(`window.__anvil.estado.doc.objetos.map(o=>{const m=window.__anvil.malhas.get(o.id); m.updateMatrixWorld(true); return new window.__anvil.THREE.Box3().setFromObject(m,true).min.y.toFixed(2);}).join(' | ')`));
  } catch (e) { console.log('ERRO TESTE', e); }
  app.exit(0);
}); });
require('../main.js');
