// peça presa: modo mover desliza; modo girar, arrastando o corpo, gira na face
const { app } = require('electron');
const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => {
  w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.level, e.message); });
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    const ev = (type, x, y, b) => w.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, ...(b ? { modifiers: ['leftButtonDown'] } : {}) });
    const tela = v => js(`(()=>{const F=window.__anvil; const p=new F.THREE.Vector3(${v}).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
    const est = () => js(`(()=>{const o=window.__anvil.estado.doc.objetos[1]; return 'pos '+o.transformacao.posicao.map(v=>v.toFixed(1)).join(',')+' giro '+o.juncao.giro;})()`);
    for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
    await js(`window.__anvil.moverPeca(false)`);
    await js(`localStorage.setItem('teste:origem','1'); localStorage.setItem('passoGiro','0')`);
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(200);
      await js(`(()=>{const o=window.__anvil.estado.doc.objetos[0]; o.parametros.largura=60; o.parametros.profundidade=60; o.parametros.altura=4;})()`);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(200);
      await js(`(()=>{const F=window.__anvil,[a,b]=F.estado.doc.objetos; b.parametros.largura=20; b.parametros.profundidade=6; b.parametros.altura=6; b.juncao={alvo:a.id, ponto:[0,0,4], normal:[0,0,1], giro:0, afastamento:0, face:{normal:[0,0,-1], centro:[0,0,0]}}; F.selecionar([b.id]);})()`);
      await js(`document.querySelector('#passo-giro').value='0'; document.querySelector('#passo-giro').dispatchEvent(new Event('change'))`);
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(400);
      console.log('início:', await est());
      // modo mover: arrastar desliza
      let a = await tela('6,1,10'), b = await tela('6,15,10');
      ev('mouseMove', ...a); await espera(80); ev('mouseDown', ...a); await espera(80);
      for (let k = 1; k <= 6; k++) { ev('mouseMove', a[0] + (b[0] - a[0]) * k / 6, a[1] + (b[1] - a[1]) * k / 6, true); await espera(40); }
      ev('mouseUp', ...b); await espera(400);
      console.log('mover (desliza):', await est());
      // modo girar: arrastar o corpo gira na face
      await js(`document.querySelector('[data-cmd=alternarGizmo]').click()`); await espera(300);
      console.log('dica:', await js(`document.querySelector('#propriedades .dica.destaque')?.textContent`));
      const c = await js(`(()=>{const F=window.__anvil; const m=F.malhas.get(F.estado.doc.objetos[1].id); m.updateMatrixWorld(true); const b=new F.THREE.Box3().setFromObject(m,true); const c=b.getCenter(new F.THREE.Vector3()); c.x+=8; const p=c.project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
      const cc = await js(`(()=>{const F=window.__anvil; const m=F.malhas.get(F.estado.doc.objetos[1].id); const p=new F.THREE.Box3().setFromObject(m,true).getCenter(new F.THREE.Vector3()).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
      ev('mouseMove', ...c); await espera(150);
      if (await js(`window.__anvil.gizmo.axis`) !== null) console.log('(o ponto caiu no anel)');
      ev('mouseDown', ...c); await espera(80);
      // gira em volta do centro na tela, ~90°
      const R = Math.hypot(c[0] - cc[0], c[1] - cc[1]), a0 = Math.atan2(c[1] - cc[1], c[0] - cc[0]);
      for (let k = 1; k <= 10; k++) { const t = a0 - k * Math.PI / 20; ev('mouseMove', cc[0] + R * Math.cos(t), cc[1] + R * Math.sin(t), true); await espera(40); }
      console.log('etiqueta durante:', await js(`(()=>{const c=document.querySelector('#cota-mov'); const r=c.getBoundingClientRect(), v=document.querySelector('#vista').getBoundingClientRect(); return c.hidden?'oculta':c.textContent+' em '+Math.round(r.left-v.left)+','+Math.round(r.top-v.top);})()`));
      ev('mouseUp', cc[0] + R * Math.cos(a0 - Math.PI / 2), cc[1] + R * Math.sin(a0 - Math.PI / 2)); await espera(400);
      console.log('etiqueta do ângulo:', await js(`(()=>{const c=document.querySelector('#cota-mov'); const r=c.getBoundingClientRect(), v=document.querySelector('#vista').getBoundingClientRect(); return c.textContent+' em '+Math.round(r.left-v.left)+','+Math.round(r.top-v.top);})()`));
      console.log('girar (arrastando a peça):', await est(), '| presa?', await js(`!!window.__anvil.estado.doc.objetos[1].juncao`));
      console.log('anel do gizmo no meio da peça, Z do ajudante:', await js(`window.__anvil.gizmo.object?.position.z.toFixed(1)`));
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
