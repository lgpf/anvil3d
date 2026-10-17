// importar imagem: diálogo com prévia → peça (relevo / silhueta); e STL arrastado/vários
const { app } = require('electron'); const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (/rror/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  // imagem de teste desenhada num canvas: "A3D" preto em fundo branco
  await js(`(async()=>{const c=document.createElement('canvas'); c.width=240; c.height=120; const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,240,120); g.fillStyle='#000'; g.font='bold 90px sans-serif'; g.fillText('A3D',10,95);
    const b=await new Promise(r=>c.toBlob(r,'image/png')); window.__arq=new File([b],'logo.png',{type:'image/png'}); return 1;})()`);
  await js(`window.__anvil.abrirImagem(window.__arq)`); await espera(800);
  console.log('diálogo:', await js(`document.querySelector('.conteudo-modal h2, .modal h2, .titulo-modal')?.textContent || [...document.querySelectorAll('.conteudo-modal canvas')].length + ' canvas'`), '|', await js(`document.querySelector('.conteudo-modal .dica')?.textContent`));
  await js(`(()=>{const s=document.querySelector('.conteudo-modal select'); s.value='silhueta'; s.dispatchEvent(new Event('change'));})()`); await espera(300);
  fs.writeFileSync('/tmp/shots/110-dialogo.png', (await w.webContents.capturePage()).toPNG());
  await js(`[...document.querySelectorAll('.conteudo-modal button')].find(b=>b.textContent==='Criar peça').click()`); await espera(1500);
  console.log('peça:', await js(`document.querySelector('#msg').textContent`), '|', await js(`(()=>{const F=window.__anvil,o=F.estado.doc.objetos.at(-1),m=F.malhas.get(o.id); const b=new F.THREE.Box3().setFromObject(m); const s=b.getSize(new F.THREE.Vector3()); return o.nome+' '+s.toArray().map(v=>v.toFixed(1)).join(' × ')+' | erro: '+(F.estado.erros.get(o.id)||'nenhum');})()`));
  // muda para relevo pelo painel
  await js(`(()=>{const c=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith('Modo')); const s=c.querySelector('select'); s.value='relevo'; s.dispatchEvent(new Event('change'));})()`); await espera(1500);
  console.log('relevo:', await js(`(()=>{const F=window.__anvil,o=F.estado.doc.objetos.at(-1); return o.parametros.modo+' | erro: '+(F.estado.erros.get(o.id)||'nenhum')+' | campos ocultos no painel? '+[...document.querySelectorAll('#propriedades .campo')].some(c=>/^(dados|px|py)/.test(c.textContent));})()`));
  await js(`window.__anvil.selecionar([])`); await js(`document.querySelector('[data-cmd=vistaIso]').click()`); await espera(300); await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(600);
  fs.writeFileSync('/tmp/shots/110-peca.png', (await w.webContents.capturePage()).toPNG());
  // vários STL de uma vez (mesmo caminho do arrastar)
  const stl = fs.readFileSync('/mnt/user-data/uploads/projeto.stl').toString('base64');
  await js(`(()=>{const b=Uint8Array.from(atob('${stl}'),c=>c.charCodeAt(0)); window.__anvil.importarStls([{nome:'um',bytes:b},{nome:'dois',bytes:b},{nome:'tres',bytes:b}]);})()`); await espera(1500);
  console.log('3 STL:', await js(`document.querySelector('#msg').textContent`), '| x das peças:', await js(`window.__anvil.estado.doc.objetos.slice(-3).map(o=>o.nome+'@'+o.transformacao.posicao[0]).join(' ')`));
  app.exit(0);
}); });
require('../main.js');
