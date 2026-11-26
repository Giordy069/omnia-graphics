const { open } = require('./harness');
(async () => {
  const h = await open(); const { ev, d, sleep } = h;
  let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
  const set = (id, v) => { d.getElementById(id).value = v; };

  // 1. rifiniture: ogni opzione renderizza senza errori
  let bad = [];
  for (const bg of ['none', 'vertical', 'radial', 'diagonal']) for (const g of ['1', '0']) for (const c of ['1', '0']) for (const hf of ['1', '0']) {
    set('finBg', bg); set('finGrid', g); set('finCross', c); set('finHalf', hf); set('inputGrain2', '15'); set('finSafe', '1');
    try { ev('renderGraphic(true); renderGraphic(false)'); } catch (e) { bad.push(`${bg}/${g}${c}${hf}: ${e.message.split('\n')[0]}`); }
  }
  ok(bad.length === 0, 'finitura: 32 combinazioni' + (bad.length ? ' ERR ' + bad[0] : ''));
  set('finSafe', '0'); set('finBg', 'none'); set('inputGrain2', '0');

  // 2. scala 2x e formato JPG
  set('expScale', '2'); set('expFormat', 'jpg');
  const url = ev("renderToDataURL('post')");
  ok(url.startsWith('data:image/jpeg'), 'export JPG');
  ok(/_2x\.jpg$/.test(ev("exportFileName('post')")), 'nome file 2x jpg: ' + ev("exportFileName('post')"));
  ok(ev('canvas.width') === 2160 && ev('canvas.height') === 2700, 'export 2x: canvas 2160x2700');
  ev('renderGraphic(false)');
  ok(ev('canvas.width') === 1080 && ev('canvas.height') === 1350, 'anteprima torna a 1080x1350 dopo export 2x');
  set('expScale', '1'); set('expFormat', 'png');
  ok(ev("renderToDataURL('story')").startsWith('data:image/png') && ev('canvas.height') === 1920, 'export PNG storia');
  ev("setFormat('post')");

  // 3. carosello: composizione e limiti
  ev('clearCarSlides()');
  ev("setMode('announce'); addCarSlide(); setMode('roster'); addCarSlide(); setLayout('grid'); addCarSlide(); setMode('result'); addCarSlide()");
  ok(ev('carSlides.length') === 4 && d.querySelectorAll('#carList button').length >= 4, 'carosello 4 slide');
  ok(ev('carSlides[2].layout') === 'grid', 'layout salvato nella slide');
  ev('moveCarSlide(3,-1)'); ok(ev('carSlides[2].mode') === 'result', 'riordino');
  for (let i = 0; i < 12; i++) ev('addCarSlide()');
  ok(ev('carSlides.length') === 10, 'max 10 slide');
  ev('removeCarSlide(9); removeCarSlide(8); removeCarSlide(7); removeCarSlide(6); removeCarSlide(5); removeCarSlide(4)');
  ok(ev('carSlides.length') === 4, 'rimozione');

  // 4. export carosello: file numerati, stato ripristinato
  ev("setMode('countdown')");
  let captured = null;
  ev("window.__orig = deliverFiles; deliverFiles = async (f) => { window.__files = f; }");
  await ev('exportCarousel()'); await sleep(50);
  const files = JSON.parse(ev('JSON.stringify(window.__files.map(f=>f.name))'));
  ok(files.length === 4 && /CAROSELLO_01di04/.test(files[0]) && /CAROSELLO_04di04/.test(files[3]), 'file numerati: ' + files[0]);
  ok(ev('currentMode') === 'countdown' && ev('carouselCtx') === null, 'stato ripristinato dopo export');
  ok(new Set(files).size === 4, 'nomi unici');

  // 5. anteprima slide + overlay con tutte le opzioni
  ev('gotoCarSlide(1)');
  ok(ev('currentMode') === 'roster' && ev('carouselCtx.i') === 1, 'vai alla slide');
  set('carCounter', '0'); set('carArrow', '0'); ev('renderGraphic(true)'); set('carCounter', '1'); set('carArrow', '1'); ev('renderGraphic(true)');
  ev("setMode('announce')"); ok(ev('carouselCtx') === null, 'cambio modalita toglie overlay');

  // 6. stato: roundtrip e progetti vecchi
  set('finBg', 'radial'); set('finGrid', '0'); ev("carSlides.length = 0; carSlides.push({mode:'mvp',layout:''})");
  const snap = JSON.parse(ev('snapshot().core'));
  ok(snap.car.length === 1 && snap.fields.finBg === 'radial' && snap.fields.finGrid === '0', 'stato include carosello e finitura');
  await ev('newProject()'); await sleep(100);
  ok(ev('carSlides.length') === 0 && d.getElementById('finBg').value === 'none' && d.getElementById('finGrid').value === '1', 'new resetta');
  await ev('applyState(' + JSON.stringify(snap) + ', {})');
  ok(ev('carSlides[0].mode') === 'mvp' && d.getElementById('finBg').value === 'radial', 'restore');
  const old = JSON.parse(JSON.stringify(snap)); delete old.car;
  await ev('applyState(' + JSON.stringify(old) + ', {})');
  ok(ev('carSlides.length') === 0, 'progetto vecchio senza carosello');
  set('finBg', 'diagonal'); set('finGrid', '0'); set('inputGrain2', '20');
  const old2 = JSON.parse(JSON.stringify(snap)); ['finBg', 'finGrid', 'inputGrain2'].forEach(k => delete old2.fields[k]);
  await ev('applyState(' + JSON.stringify(old2) + ', {})');
  ok(d.getElementById('finBg').value === 'none' && d.getElementById('finGrid').value === '1' && d.getElementById('inputGrain2').value === '0', 'progetto vecchio: finitura torna ai default');
  console.log(fails ? 'FAILS ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
