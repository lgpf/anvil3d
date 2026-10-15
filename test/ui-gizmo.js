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
    const mover = async (x, y, b) => { w.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y), ...(b ? { button: 'left', modifiers: ['leftButtonDown'] } : {}) }); await espera(100); };
    const clicar = async (x, y) => { await mover(x, y); for (const type of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 }); await espera(350); };
    const tela = v => js(`(()=>{const F=window.__anvil; const p=new F.THREE.Vector3(${v}).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
    const est = i => js(`(()=>{const o=window.__anvil.estado.doc.objetos[${i}]; return 'pos='+o.transformacao.posicao.join(',')+' rot='+o.transformacao.rotacao.join(',');})()`);
    const cmd = c => js(`document.querySelector('[data-cmd=${c}]').click()`);
    await espera(2500);
    await js(`window.__anvil.moverPeca(false)`);
    await w.webContents.executeJavaScript("localStorage.setItem('teste:origem','1')");
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      await cmd('vistaIso'); await espera(300);
      console.log('gizmo:', await js(`(()=>{const g=window.__anvil.gizmo; return [!!g.object, g.enabled, g.mode, g.size].join(',')})()`));
      await espera(600);
      // procura a seta X do gizmo passando o mouse ao longo do eixo
      let achou = null;
      for (let d = 0; d < 60 && !achou; d += 1.5) { const p = await tela(`${d},0,0`); await mover(...p); if (await js(`window.__anvil.gizmo.axis`) === 'X') achou = p; }
      console.log('seta X do gizmo em', achou && achou.map(Math.round));
      w.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(achou[0]), y: Math.round(achou[1]), button: 'left', clickCount: 1 }); await espera(120);
      const destino = await tela(`${(await js(`0`)) + 40},0,0`);
      for (let k = 1; k <= 5; k++) await mover(achou[0] + (destino[0] - achou[0]) * k / 5 * 0.6, achou[1] + (destino[1] - achou[1]) * k / 5 * 0.6, true);
      console.log('cota durante o arraste:', await js(`window.__anvil.mostrarCotas(); [...document.querySelectorAll('#cotas-mov .cota-mov')].map(c=>c.textContent).join(' | ')`));
      await foto('27-cota-mov');
      w.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(destino[0]), y: Math.round(destino[1]), button: 'left', clickCount: 1 }); await espera(400);
      console.log('depois:', await est(0), '| cota visível?', !(await js(`document.querySelector('#cota-mov').hidden`)));
      // clique de novo na peça: modo girar
      const corpo = await js(`(()=>{const F=window.__anvil; const m=F.malhas.get(F.estado.doc.objetos[0].id); m.updateMatrixWorld(true); const p=new F.THREE.Vector3(-6,-10,14).applyMatrix4(m.matrixWorld).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
      await clicar(...corpo);
      console.log('modo:', await js(`document.querySelector('#bt-modo').textContent`), '| gizmo:', await js(`window.__anvil.gizmo.mode`));
      await foto('28-modo-girar');
      await clicar(...corpo);
      console.log('clique de novo:', await js(`document.querySelector('#bt-modo').textContent`));
      // face na mesa: cunha deitada pela face inclinada
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Cunha')).click()`); await espera(300);
      await js(`(()=>{const x=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input')[0]; x.value='-40'; x.dispatchEvent(new Event('change'));})()`); await espera(300);
      await cmd('ajustar'); await espera(300);
      await cmd('faceNaMesa'); await espera(200);
      const inclinada = await js(`(()=>{const F=window.__anvil; const m=F.malhas.get(F.estado.doc.objetos[1].id); m.updateMatrixWorld(true); const p=new F.THREE.Vector3(2,0,10).applyMatrix4(m.matrixWorld).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
      await mover(...inclinada); await foto('29-face-mesa-hover');
      await clicar(...inclinada);
      console.log(await js(`document.querySelector('#msg').textContent`));
      console.log('cunha:', await est(1), '| min z:', await js(`(()=>{const F=window.__anvil; const m=F.malhas.get(F.estado.doc.objetos[1].id); m.updateMatrixWorld(true); return new F.THREE.Box3().setFromObject(m,true).min.z.toFixed(3);})()`));
      // menus
      await js(`document.querySelectorAll('.menu-titulo')[2].click()`); await espera(300);
      await foto('30-menu');
      console.log('itens do menu Objeto:', await js(`[...document.querySelectorAll('.menu.aberto .menu-itens button span')].map(s=>s.textContent).join(' | ')`));
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
