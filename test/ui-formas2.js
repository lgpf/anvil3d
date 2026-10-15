const { app } = require('electron');
const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => {
  w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.level, e.message); });
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    const forma = n => js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent===${JSON.stringify(n)}).click()`);
    const campo = (rot, val) => js(`(()=>{const c=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith(${JSON.stringify(rot)})); const i=c.querySelector('input,select,textarea'); i.value=${JSON.stringify(String(val))}; i.dispatchEvent(new Event('change'));})()`);
    const tri = () => js(`(()=>{const F=window.__anvil, o=F.estado.doc.objetos.at(-1); return F.estado.erros.get(o.id) ?? (F.malhas.get(o.id).geometry.attributes.position.count/3+' triângulos');})()`);
    await espera(3500);
    await js(`localStorage.setItem('teste:origem','1')`);
    try {
      console.log('miniaturas novas:', await js(`['Polígono','Estrela','Texto'].map(n=>n+':'+!![...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent===n)?.querySelector('img')).join(' ')`));
      await forma('Polígono'); await espera(300); console.log('polígono:', await tri());
      await forma('Estrela'); await espera(300); await campo('Formato', 'conica'); await espera(300); console.log('estrela cônica:', await tri());
      await forma('Texto'); await espera(800); console.log('texto:', await tri(), '| fontes no seletor:', await js(`document.querySelector('#propriedades select option') ? [...document.querySelectorAll('#propriedades optgroup')].map(g=>g.label+'='+g.children.length).join(', ') : '-'`));
      await js(`window.__anvil.selecionar([])`); await js(`(()=>{const F=window.__anvil; F.estado.doc.objetos=[]; })()`);
      // cilindro com texto gravado em volta
      await forma('Cilindro'); await espera(200);
      await campo('Diâmetro', 40); await campo('Altura', 30); await espera(200);
      await forma('Texto'); await espera(500);
      await campo('Texto', 'ANVIL 3D'); await campo('Forma', 'cilindro'); await campo('Raio do cilindro', 20); await campo('Sentido no cilindro', 'dentro');
      await campo('Altura das letras', 8); await campo('Espessura / profundidade', 1.5); await espera(500);
      await js(`(()=>{const F=window.__anvil, t=F.estado.doc.objetos.at(-1); t.transformacao.posicao=[0,0,11]; t.furo=true; F.selecionar(F.estado.doc.objetos.map(o=>o.id));})()`);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'G', modifiers: ['control'] }); await espera(2500);
      console.log('cilindro gravado:', await tri());
      await js(`document.querySelector('[data-cmd=vistaFrente]').click()`); await espera(500);
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(800);
      fs.writeFileSync('/tmp/shots/57-gravado.png', (await w.webContents.capturePage()).toPNG());
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
