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
    const forma = n => js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes(${JSON.stringify(n)})).click()`);
    const xyz = (k, i, v) => js(`(()=>{const x=document.querySelectorAll('#propriedades .xyz')[${k}].querySelectorAll('input')[${i}]; x.value='${v}'; x.dispatchEvent(new Event('change'));})()`);
    const campo = (rot, val) => js(`(()=>{const c=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith(${JSON.stringify(rot)})); const i=c.querySelector('input,select'); i.value=${JSON.stringify(String(val))}; i.dispatchEvent(new Event('change'));})()`);
    const msg = () => js(`document.querySelector('#msg').textContent`);
    const tecla = (k, mods = []) => w.webContents.sendInputEvent({ type: 'keyDown', keyCode: k, modifiers: mods });
    const mouse = async (type, x, y, mods = [], botao = 'left') => { w.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: botao, clickCount: 1, modifiers: mods }); await espera(60); };
    const arrastar = async (a, b) => { await mouse('mouseMove', ...a); await mouse('mouseDown', ...a); for (let k = 1; k <= 6; k++) await mouse('mouseMove', a[0] + (b[0] - a[0]) * k / 6, a[1] + (b[1] - a[1]) * k / 6, ['leftButtonDown']); await mouse('mouseUp', ...b); await espera(300); };
    await espera(2500);
    // abre todas as categorias da biblioteca
    for (let k = 0; k < 2; k++) { await w.webContents.executeJavaScript(`[...document.querySelectorAll('.cat-titulo.fechada')].forEach(b=>b.click())`); await new Promise(r => setTimeout(r, 200)); }
    await w.webContents.executeJavaScript("localStorage.setItem('teste:origem','1')");
    try {
      // 5. miniaturas
      console.log('miniaturas:', await js(`document.querySelectorAll('.grade-formas img').length`), 'de', await js(`document.querySelectorAll('.grade-formas .forma').length`));
      // 1. grupo multicolorido
      await forma('Caixa'); await espera(200); await forma('Cilindro'); await espera(200); await xyz(0, 0, 10); await espera(200);
      tecla('A', ['control']); await espera(200); tecla('G', ['control']); await espera(600);
      console.log('grupo multicolorido:', await js(`(()=>{const F=window.__anvil; const m=F.malhas.get(F.estado.doc.objetos[0].id); const c=m.geometry.attributes.color; if(!c) return 'sem cores'; const s=new Set(); for(let i=0;i<c.count;i+=3) s.add([c.getX(i),c.getY(i),c.getZ(i)].map(v=>v.toFixed(2)).join()); return m.material.vertexColors+' cores distintas: '+s.size;})()`));
      // 2. opacidade
      await js(`(()=>{const f=document.querySelector('#propriedades .faixa'); f.value='40'; f.dispatchEvent(new Event('input')); f.dispatchEvent(new Event('change'));})()`); await espera(300);
      console.log('opacidade:', await js(`(()=>{const F=window.__anvil; const o=F.estado.doc.objetos[0]; return o.opacidade+' / material '+F.malhas.get(o.id).material.opacity;})()`));
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300); await foto('35-multicor');
      tecla('Delete'); await espera(300);
      // 3. furo preso por junção mostra a área afetada
      await forma('Caixa'); await espera(200); await campo('Largura', 40); await campo('Profundidade', 30); await campo('Altura', 10); await espera(200);
      await forma('Cilindro'); await espera(200); await campo('Diâmetro', 10); await campo('Altura', 15);
      await js(`[...document.querySelectorAll('#propriedades .segmentado button')].find(b=>b.textContent==='Furo').click()`); await espera(200);
      await js(`(()=>{const F=window.__anvil, E=F.estado; const [cx, fu]=E.doc.objetos; fu.juncao={alvo:cx.id, ponto:[8,5,10], normal:[0,0,1], giro:0, afastamento:-6, face:{normal:[0,0,-1], centro:[0,0,0]}};})()`);
      await xyz(0, 0, 1); await espera(500);
      console.log('área afetada (malhas escuras):', await js(`window.__anvil.grupoAfetado.children.length`));
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300); await foto('36-area-afetada');
      tecla('A', ['control']); await espera(100); tecla('Delete'); await espera(300);
      // 4. alinhar
      for (const [x, y] of [[-30, 0], [0, 15], [35, -10]]) { await forma('Caixa'); await espera(150); await xyz(0, 0, x); await xyz(0, 1, y); await espera(150); }
      await js(`(()=>{const c=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith('Largura')); const i=c.querySelector('input'); i.value='10'; i.dispatchEvent(new Event('change'));})()`); await espera(200);
      tecla('A', ['control']); await espera(200); tecla('L'); await espera(300);
      await js(`[...document.querySelectorAll('.alinhar')][1].querySelectorAll('button')[0].click()`); await espera(400);
      console.log('alinhar Y mínimo (média):', await js(`window.__anvil.estado.doc.objetos.map(o=>{const m=window.__anvil.malhas.get(o.id); m.updateMatrixWorld(true); return new window.__anvil.THREE.Box3().setFromObject(m,true).min.y.toFixed(2);}).join(' | ')`));
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      const ref = await js(`(()=>{const F=window.__anvil; const m=F.malhas.get(F.estado.doc.objetos[2].id); m.updateMatrixWorld(true); const p=new F.THREE.Box3().setFromObject(m,true).getCenter(new F.THREE.Vector3()).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
      console.log('ALN antes:', await js(`JSON.stringify(window.__anvil.alinharObj)`), 'ref em', ref.map(Math.round));
      await js(`window.__log=[]; document.querySelector('#vista canvas').addEventListener('pointerup', e=>window.__log.push('up '+e.button+' '+e.clientX+','+e.clientY), true); document.querySelector('#vista canvas').addEventListener('pointerdown', e=>window.__log.push('down'), true);`);
      await mouse('mouseMove', ...ref); await mouse('mouseDown', ...ref); await mouse('mouseUp', ...ref); await espera(300);
      console.log('eventos:', await js(`window.__log.join(';')`), '| ALN depois:', await js(`JSON.stringify(window.__anvil.alinharObj)`));
      console.log('referência:', await js(`document.querySelector('#propriedades .dica').textContent`));
      console.log('pontos X em volta da referência:', await js(`(()=>{const F=window.__anvil; const xs=F.cena.children.flatMap(g=>g.children||[]).filter(m=>m.userData?.alinhar?.[0]===0).map(m=>m.position.x.toFixed(1)); const ref=F.estado.doc.objetos[2]; const m=F.malhas.get(ref.id); m.updateMatrixWorld(true); const b=new F.THREE.Box3().setFromObject(m,true); return xs.join(',')+' | caixa da ref '+b.min.x.toFixed(1)+'…'+b.max.x.toFixed(1);})()`));
      await js(`[...document.querySelectorAll('.alinhar')][0].querySelectorAll('button')[2].click()`); await espera(400);
      console.log('alinhar X máximo pela referência:', await js(`window.__anvil.estado.doc.objetos.map(o=>{const m=window.__anvil.malhas.get(o.id); m.updateMatrixWorld(true); return new window.__anvil.THREE.Box3().setFromObject(m,true).max.x.toFixed(2);}).join(' | ')`));
      await foto('37-alinhar');
      await bt('Concluir'); await espera(200);
      // 8. seleção por área a partir de um espaço vazio
      tecla('Escape'); await espera(200);
      const r = await js(`(()=>{const c=document.querySelector('#vista canvas').getBoundingClientRect(); return [c.left,c.top,c.width,c.height];})()`);
      await arrastar([r[0] + 8, r[1] + 8], [r[0] + r[2] - 8, r[1] + r[3] - 8]);
      console.log('área (tudo):', await msg(), '| selecionados:', await js(`window.__anvil.estado.sel.length`));
      // 6. guia de IA
      await js(`document.querySelector('[data-cmd=guiaIA]').click()`); await espera(600);
      console.log('guia IA:', await js(`document.querySelector('.guia-ia')?.textContent.length`), 'caracteres');
      await foto('38-guia-ia');
      tecla('Escape'); await espera(300);
      tecla('A', ['control']); await espera(100); tecla('Delete'); await espera(300);
      // 7. editor 2D do REVSURF
      await forma('Revolução'); await espera(300);
      await bt('✎ Desenhar perfil…'); await espera(500);
      await bt('Limpar'); await espera(100);
      const tela = await js(`(()=>{const c=document.querySelector('.editor2d-tela').getBoundingClientRect(); return [c.left,c.top,c.width,c.height];})()`);
      const pt = (fx, fy) => [tela[0] + tela[2] * fx, tela[1] + tela[3] * fy];
      const clique = async (fx, fy) => { const p = pt(fx, fy); await mouse('mouseMove', ...p); await mouse('mouseDown', ...p); await mouse('mouseUp', ...p); await espera(80); };
      await clique(0.45, 0.85); await clique(0.75, 0.85); await clique(0.75, 0.75);
      await bt('Curva'); await clique(0.6, 0.5); await clique(0.7, 0.25);
      await bt('Reta'); await clique(0.45, 0.2);
      await foto('39-editor2d');
      console.log('pontos no editor:', await js(`document.querySelectorAll('.editor2d').length`));
      await js(`[...document.querySelectorAll('.editor2d .primario')][0].click()`); await espera(500);
      console.log('perfil gerado:', await js(`window.__anvil.estado.doc.objetos[0].parametros.perfil.split('\\n').length`), 'linhas;', await js(`window.__anvil.estado.doc.objetos[0].parametros.perfil__desenho.length`), 'pontos de controle; erros:', await js(`window.__anvil.estado.erros.size`));
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300); await foto('40-revsurf');
      await bt('✎ Desenhar perfil…'); await espera(400);
      console.log('reabriu com', await js(`document.querySelectorAll('.editor2d').length`), 'editor');
      tecla('Escape');
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
