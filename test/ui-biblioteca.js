const { app } = require('electron');
const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => {
  w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.level, e.message); });
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    await espera(7000);
    await js(`[...document.querySelectorAll('.cat-titulo.fechada')].forEach(b=>b.click())`); await espera(300); await js(`[...document.querySelectorAll('.cat-titulo.fechada')].forEach(b=>b.click())`); await espera(300);
    try {
      const cats = () => js(`[...document.querySelectorAll('.cat-titulo')].map(b=>b.textContent).join(' | ')`);
      console.log('categorias:', await cats());
      console.log('formas:', await js(`document.querySelectorAll('#lista-formas .forma').length`), '| com miniatura:', await js(`document.querySelectorAll('#lista-formas .forma img').length`));
      await js(`[...document.querySelectorAll('.cat-titulo')].find(b=>b.textContent.includes('Básicos')).click()`); await espera(200);
      console.log('fechando Básicos → formas visíveis:', await js(`document.querySelectorAll('#lista-formas .forma').length`));
      await js(`(()=>{const i=document.querySelector('#busca-formas'); i.value='paraf'; i.dispatchEvent(new Event('input'));})()`); await espera(200);
      console.log('busca "paraf":', await js(`[...document.querySelectorAll('#lista-formas .forma')].map(b=>b.textContent).join(', ')`));
      await js(`(()=>{const i=document.querySelector('#busca-formas'); i.value=''; i.dispatchEvent(new Event('input'));})()`); await espera(200);
      await js(`[...document.querySelectorAll('.cat-titulo')].find(b=>b.textContent.includes('Básicos')).click()`); await espera(200);
      await js(`document.querySelector('#lista-formas').scrollTop = 900`); await espera(300);
      fs.writeFileSync('/tmp/shots/59-biblioteca.png', (await w.webContents.capturePage()).toPNG());
      // cada forma nova é criada sem erro
      const nomes = ['Tetraedro','Octaedro','Dodecaedro','Icosaedro','Coração','Seta','Raio','Cruz','Lua','Gota','Pino','Rabo de andorinha','Cantoneira','Gancho','Arruela','Polia','Mola','Cremalheira','Caixa oca','Tampa','Pote','Tubo curvo','Junta: bola','Junta: soquete'];
      const res = [];
      for (const n of nomes) {
        await js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent===${JSON.stringify(n)}).click()`); await espera(250);
        res.push(n + (await js(`(()=>{const F=window.__anvil, o=F.estado.doc.objetos.at(-1); return F.estado.erros.has(o.id)?' ERRO '+F.estado.erros.get(o.id):'';})()`)));
      }
      console.log('criadas:', res.join(', '));
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
