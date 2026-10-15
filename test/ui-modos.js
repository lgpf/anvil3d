// operações não se misturam: entrar numa conclui a outra; clicar fora conclui; apagar a peça cancela
const { app } = require('electron');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (e.level > 1 && !/Security/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`localStorage.setItem('teste:origem','1')`);
  const modos = () => js(`(()=>{const F=window.__anvil; return ['ALN:'+!!F.alinharObj, 'ESP:'+!!F.espelho, 'MA:'+!!F.modoAresta, 'setas:'+F.cena.children.flatMap(g=>g.children||[]).filter(o=>o.userData?.espelho).length, 'pontos:'+F.cena.children.flatMap(g=>g.children||[]).filter(o=>o.userData?.alinhar).length].join(' ');})()`);
  const tecla = (k, m = []) => w.webContents.sendInputEvent({ type: 'keyDown', keyCode: k, modifiers: m });
  try {
    for (const n of ['Caixa', 'Cilindro']) { await js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent==='${n}').click()`); await espera(200); }
    await js(`(()=>{const c=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input')[0]; c.value='25'; c.dispatchEvent(new Event('change'));})()`); await espera(200);
    await js(`(()=>{const F=window.__anvil; F.selecionar(F.estado.doc.objetos.map(o=>o.id));})()`); await espera(200);
    tecla('M'); await espera(300); console.log('espelhar:', await modos());
    tecla('L'); await espera(300); console.log('L durante espelhar:', await modos());
    await js(`document.querySelector('[data-cmd=espelharModo]').click()`); await espera(300); console.log('botão Espelhar durante alinhar:', await modos());
    // clique no vazio conclui
    const vazio = await js(`(()=>{const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+20, r.top+20];})()`);
    for (const t of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type: t, x: vazio[0], y: vazio[1], button: 'left', clickCount: 1 });
    await espera(300); console.log('clique no vazio:', await modos(), '|', await js(`document.querySelector('#msg').textContent`));
    // apagar a peça no meio do espelhar cancela e não deixa setas para trás
    await js(`(()=>{const F=window.__anvil; F.selecionar([F.estado.doc.objetos[0].id]);})()`); await espera(200);
    tecla('M'); await espera(300);
    tecla('Delete'); await espera(500); console.log('Delete durante espelhar:', await modos(), '| objetos:', await js(`window.__anvil.estado.doc.objetos.length`));
    // desfazer a criação da peça com a operação aberta: a operação é cancelada
    tecla('Z', ['control']); await espera(400);
    await js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent==='Cone').click()`); await espera(300);
    tecla('M'); await espera(300);
    await js(`document.querySelector('[data-cmd=desfazer]')?.click() ?? null`); await espera(500);
    console.log('desfazer (a peça some) durante espelhar:', await modos(), '|', await js(`document.querySelector('#msg').textContent`));
    // fillet aberto e clique em Alinhar: fillet sai
    await js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent==='Caixa').click()`); await espera(300);
    await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Fillet…').click()`); await espera(500);
    console.log('fillet aberto:', await modos());
    tecla('M'); await espera(400); console.log('M durante fillet:', await modos());
  } catch (e) { console.log('ERRO TESTE', e); }
  app.exit(0);
}); });
require('../main.js');
