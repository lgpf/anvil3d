const { app } = require('electron');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (e.level > 1 && !/Security/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`localStorage.setItem('teste:origem','1')`); await js(`window.__anvil.alcasLaterais(true)`);
  const caixa = () => js(`(()=>{const F=window.__anvil; const b=new F.THREE.Box3(); for(const o of F.estado.doc.objetos){const m=F.malhas.get(o.id); m.updateMatrixWorld(true); b.union(new F.THREE.Box3().setFromObject(m,true));} return b.min.toArray().map(v=>v.toFixed(1)).join(',')+' → '+b.max.toArray().map(v=>v.toFixed(1)).join(',');})()`);
  try {
    for (const [n, x] of [['Caixa', -15], ['Cilindro', 15]]) {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent===${JSON.stringify(n)}).click()`); await espera(200);
      await js(`(()=>{const c=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input')[0]; c.value='${x}'; c.dispatchEvent(new Event('change'));})()`); await espera(200);
    }
    await js(`(()=>{const F=window.__anvil; F.selecionar(F.estado.doc.objetos.map(o=>o.id));})()`); await espera(300);
    await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(400);
    console.log('seleção:', await caixa(), '| alças visíveis:', await js(`window.__anvil.cena.children.find(g=>g.children?.[0]?.userData?.alca)?.visible`), '| cotas:', await js(`window.__anvil.mostrarCotas(); [...document.querySelectorAll('#cotas .cota')].map(c=>c.textContent).join(' / ')`));
    // tamanho X da seleção 50 → 100 pelo painel
    await js(`(()=>{const t=[...document.querySelectorAll('#propriedades h3, #propriedades .titulo, #propriedades div')].find(e=>e.textContent.startsWith('Tamanho da seleção')); const x=[...document.querySelectorAll('#propriedades .xyz')][1].querySelectorAll('input')[0]; x.value='100'; x.dispatchEvent(new Event('change'));})()`); await espera(500);
    console.log('X da seleção → 100:', await caixa());
    // alça de canto arrastada (x+y+) com o mouse
    await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(500);
    const p = await js(`(()=>{const F=window.__anvil; const g=F.cena.children.find(g=>g.children?.[0]?.userData?.alca); const h=g.children.find(h=>h.userData.alca==='x+y+'); const q=h.position.clone().project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(q.x+1)/2*r.width, r.top+(1-q.y)/2*r.height];})()`);
    const ev = (type, x, y, b) => w.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, ...(b ? { modifiers: ['leftButtonDown'] } : {}) });
    console.log('alça em', p.map(Math.round));
    ev('mouseMove', ...p); await espera(80); ev('mouseDown', ...p); await espera(80);
    console.log('arraste iniciado?', await js(`!!window.__anvil.arrasteAlcaInfo?.()`));
    for (let k = 1; k <= 5; k++) { ev('mouseMove', p[0] + k * 12, p[1] + k * 4, true); await espera(50); }
    ev('mouseUp', p[0] + 60, p[1] + 20); await espera(500);
    console.log('depois de puxar o canto:', await caixa(), '|', await js(`document.querySelector('#msg').textContent`));
    w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Z', modifiers: ['control'] }); await espera(400);
    console.log('desfazer:', await caixa());
  } catch (e) { console.log('ERRO TESTE', e); }
  app.exit(0);
}); });
require('../main.js');
