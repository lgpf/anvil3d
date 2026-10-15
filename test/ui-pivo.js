// o pivô escolhido vale só para a seleção; trocar de peça/grupo volta ao centro e o gizmo vai para a peça certa
const { app } = require('electron');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (/rror/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`localStorage.setItem('teste:origem','1'); window.__anvil.moverPeca(false)`);
  const forma = n => js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent===${JSON.stringify(n)}).click()`);
  const pivo = v => js(`(()=>{const s=[...document.querySelectorAll('#propriedades select')].find(s=>[...s.options].some(o=>o.value==='ponto')); s.value='${v}'; s.dispatchEvent(new Event('change'));})()`);
  const est = async nome => console.log(nome + ': modo', await js(`window.__anvil.gizmo.mode`), '| pivô', await js(`window.__anvil.estado.pivo`), '| gizmo', await js(`window.__anvil.gizmo.object?.position.toArray().map(v=>v.toFixed(1)).join(',')`), '| centro da seleção', await js(`(()=>{const F=window.__anvil,b=new F.THREE.Box3(); for(const id of F.estado.sel){const m=F.malhas.get(id); m.updateMatrixWorld(true); b.union(new F.THREE.Box3().setFromObject(m,true));} return b.getCenter(new F.THREE.Vector3()).toArray().map(v=>v.toFixed(1)).join(',');})()`));
  await forma('Pirâmide'); await espera(300);
  await js(`(()=>{const c=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input')[0]; c.value='-30'; c.dispatchEvent(new Event('change')); return 1;})()`); await espera(300);
  await pivo('base'); await js(`document.querySelector('[data-cmd=alternarGizmo]').click()`); await espera(400);
  await est('pirâmide com pivô na base');
  await forma('Esfera'); await espera(300); await js(`document.querySelector('[data-cmd=alternarGizmo]').click()`); await espera(400);
  await est('esfera (nova)');
  await js(`(()=>{const F=window.__anvil; F.selecionar(F.estado.doc.objetos.map(o=>o.id));})()`); await espera(300);
  w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'G', modifiers: ['control'] }); await espera(800);
  await js(`document.querySelector('[data-cmd=alternarGizmo]').click()`); await espera(400);
  await est('grupo das duas');
  app.exit(0);
}); });
require('../main.js');
