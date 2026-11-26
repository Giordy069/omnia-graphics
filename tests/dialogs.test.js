const { open } = require('./harness');
(async () => {
  const h = await open(); const { ev, d, sleep } = h;
  let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
  ev('delete window.__dialogAuto');
  const hidden = (id) => d.getElementById(id).classList.contains('hidden');
  const key = (k) => d.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

  // conferma: OK
  ev("window.__p = askConfirm('Titolo prova', 'Messaggio', 'Elimina')");
  ok(!hidden('dlgBack') && d.getElementById('dlgTitle').textContent === 'Titolo prova' && d.getElementById('dlgOk').textContent === 'Elimina', 'dialogo aperto con testi');
  ok(d.activeElement.id === 'dlgCancel', 'focus sul pulsante sicuro (Annulla)');
  d.getElementById('dlgOk').click(); await sleep(10);
  ok(await ev('window.__p') === true && hidden('dlgBack'), 'OK -> true e chiude');
  // Esc = annulla
  ev("window.__p = askConfirm('A','B')"); key('Escape'); await sleep(10);
  ok(await ev('window.__p') === false && hidden('dlgBack'), 'Esc -> false');
  // click sullo sfondo = annulla
  ev("window.__p = askConfirm('A','B')");
  d.getElementById('dlgBack').dispatchEvent(new h.w.MouseEvent('mousedown', { bubbles: true })); await sleep(10);
  ok(await ev('window.__p') === false, 'clic fuori -> annulla');
  // alert: un solo pulsante
  ev("window.__p = showAlert('Errore','Dettaglio')");
  ok(d.getElementById('dlgCancel').style.display === 'none' && d.activeElement.id === 'dlgOk', 'alert senza Annulla');
  d.getElementById('dlgOk').click(); await sleep(10); await ev('window.__p');
  // nuovo progetto passa dal dialogo
  ev("window.__p = newProject()"); await sleep(10);
  ok(!hidden('dlgBack') && d.getElementById('dlgTitle').textContent === 'Nuovo progetto', 'newProject apre il dialogo');
  ev("document.getElementById('inputTitle').value='RESTA'");
  d.getElementById('dlgCancel').click(); await ev('window.__p');
  ok(d.getElementById('inputTitle').value === 'RESTA', 'annullando non resetta');
  // caricamento
  ok(hidden('loader'), 'loader nascosto a riposo');
  const p = ev("window.__l = withLoading('Lavoro…', async () => { await new Promise(r => setTimeout(r, 120)); return 7; })");
  await sleep(60);
  ok(!hidden('loader') && d.getElementById('ldText').textContent === 'Lavoro…', 'loader visibile durante il lavoro');
  ok(await p === 7 && hidden('loader'), 'loader chiuso e risultato restituito');
  let threw = false; try { await ev("withLoading('x', async () => { throw new Error('boom'); })"); } catch (e) { threw = true; }
  ok(threw && hidden('loader'), 'loader chiuso anche se il lavoro fallisce');
  // annidati
  ev("showLoading('a'); showLoading('b'); hideLoading()"); ok(!hidden('loader'), 'annidato: resta aperto'); ev('hideLoading()'); ok(hidden('loader'), 'annidato: chiude alla fine');
  // export mostra il loader
  ev('window.omnia={pickFolder:async()=>"C:/o",saveFiles:async(dd,f)=>{await new Promise(r=>setTimeout(r,900));return f.map(x=>dd+"/"+x.name)},revealFile(){}}; localStorage.setItem("omnia.outDir","C:/o")');
  const ex = ev('exportBoth()'); await sleep(250);
  ok(!hidden('loader'), 'loader visibile durante l\'export: ' + d.getElementById('ldText').textContent);
  ev("window.__u = 0; undo = function(){ window.__u++; }");
  d.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
  ok(ev('window.__u') === 0, 'Ctrl+Z ignorato durante il caricamento');
  await ex; ok(hidden('loader'), 'export finito: loader chiuso');
  console.log(fails ? 'FAILS ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
