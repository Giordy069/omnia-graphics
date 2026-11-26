const { open } = require('./harness');
(async () => {
  const h = await open(); const { ev, d, w, sleep } = h;
  let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
  // 1. matrice completa: nessuna eccezione e livelli presenti
  const modes = JSON.parse(ev('JSON.stringify(MODES.map(m=>m.id))'));
  let combos = 0, bad = [];
  for (const g of ['valorant', 'lol', 'tft', 'omnia']) {
    ev(`setGame('${g}')`);
    for (const m of modes) {
      const lays = JSON.parse(ev(`JSON.stringify((LAYOUTS['${m}']||[{id:''}]).map(l=>l.id))`));
      for (const l of lays) for (const f of ['post', 'story']) {
        try {
          ev(`setMode('${m}'); if ('${l}') setLayout('${l}'); setFormat('${f}'); renderGraphic(true)`); combos++;
          if (ev('layerList.length') < 3) bad.push(`${g}/${m}/${l}/${f}: livelli ${ev('layerList.length')}`);
        } catch (e) { bad.push(`${g}/${m}/${l}/${f}: ${e.message.split('\n')[0]}`); }
      }
    }
  }
  ok(bad.length === 0, `matrice ${combos} combinazioni OK` + (bad.length ? ' ERR: ' + bad.slice(0, 5).join(' | ') : ''));
  ev("setGame('valorant'); setFormat('post')");
  // 2. pannelli e bottoni
  ok(d.querySelectorAll('#modeButtons button').length === 9, '9 modalita');
  for (const m of modes) {
    ev(`setMode('${m}')`);
    const vis = modes.filter(x => !d.getElementById('panel-' + x).classList.contains('hidden'));
    ok(vis.length === 1 && vis[0] === m, 'pannello ' + m);
  }
  ev("setMode('announce')");
  ok(d.querySelectorAll('#layoutButtons button').length === 3 && d.getElementById('layoutSelectorWrap').style.display !== 'none', 'layout announce x3');
  ev("setMode('roster')"); ok(d.querySelectorAll('#layoutButtons button').length === 2, 'layout roster x2');
  ev("setMode('bracket')"); ok(d.getElementById('layoutSelectorWrap').style.display === 'none', 'bracket senza layout');
  // 3. layout per modalita' ricordato
  ev("setMode('announce'); setLayout('centered'); setMode('roster'); setLayout('grid'); setMode('announce')");
  ok(ev('currentLayout') === 'centered', 'announce ricorda centrato');
  ev("setMode('roster')"); ok(ev('currentLayout') === 'grid', 'roster ricorda griglia');
  // 4. stato: tutto nel progetto
  ev("resultMaps.push({map:'X',a:'1',b:'2'}); standRows[0].team='ZZZ'; bracket.r1[0].a='BBB'; casters[0].name='QQQ'; document.getElementById('cdValue').value='7'; document.getElementById('mvpName').value='ABC'");
  const snap = JSON.parse(ev('snapshot().core'));
  ok(snap.res.length === 4 && snap.stand[0].team === 'ZZZ' && snap.bracketData.r1[0].a === 'BBB' && snap.casters[0].name === 'QQQ' && snap.fields.cdValue === '7' && snap.fields.mvpName === 'ABC', 'stato nuove modalita');
  ok(snap.layouts.announce === 'centered' && snap.layouts.roster === 'grid', 'stato layout per modalita');
  await ev('newProject()'); await sleep(100);
  ok(ev('resultMaps.length') === 3 && ev('standRows[0].team') === 'OMNIA ESPORTS' && d.getElementById('cdValue').value === '2', 'new resetta');
  await ev('applyState(' + JSON.stringify(snap) + ', {})');
  ok(ev('resultMaps.length') === 4 && ev('standRows[0].team') === 'ZZZ' && ev('currentLayout') === 'grid' && ev('currentMode') === 'roster', 'restore nuove modalita + layout ' + ev('currentLayout'));
  ok(d.querySelectorAll('#resMapsList input').length >= 12 && d.querySelectorAll('#standList input').length === 24, 'UI array ricostruite');
  // 5. compatibilita' con progetti vecchi
  const old = JSON.parse(JSON.stringify(snap)); delete old.layouts; delete old.res; delete old.stand; delete old.bracketData; delete old.casters; old.layout = 'poster'; old.mode = 'announce';
  await ev('applyState(' + JSON.stringify(old) + ', {})');
  ok(ev('currentMode') === 'announce' && ev('currentLayout') === 'poster', 'progetto vecchio: layout poster ' + ev('currentLayout'));
  ev('renderGraphic(true)'); ok(true, 'progetto vecchio renderizza');
  // 6. bracket
  ev("bracket.r1=[{a:'A',b:'B',sa:'2',sb:'0'},{a:'C',b:'D',sa:'1',sb:'2'},{a:'E',b:'F',sa:'',sb:''},{a:'G',b:'H',sa:'3',sb:'1'}]; bracket.r2=[{sa:'',sb:''},{sa:'',sb:''}]; bracket.r3=[{sa:'',sb:''}]; document.getElementById('bracketSize').value='8'");
  let r = JSON.parse(ev('JSON.stringify(bracketCompute())'));
  ok(r.length === 3 && r[0].length === 4 && r[1].length === 2 && r[2].length === 1, 'bracket 8: 3 turni');
  ok(r[1][0].a === 'A' && r[1][0].b === 'D' && r[1][1].a === 'DA DEFINIRE' && r[1][1].b === 'G', 'vincitori avanzano: ' + r[1][0].a + '/' + r[1][0].b + ' ' + r[1][1].a + '/' + r[1][1].b);
  ev("bracket.r2[0]={sa:'2',sb:'1'}"); r = JSON.parse(ev('JSON.stringify(bracketCompute())')); ok(r[2][0].a === 'A', 'finale: vincitore semifinale');
  ev("document.getElementById('bracketSize').value='4'"); r = JSON.parse(ev('JSON.stringify(bracketCompute())'));
  ok(r.length === 2 && r[0].length === 2 && r[1].length === 1 && r[1][0].a === 'A', 'bracket 4');
  ev("renderBracketUI(); updateBracket(0,0,'sa','0'); updateBracket(0,0,'sb','5')");
  ok(d.getElementById('brn-1-0-a').textContent === 'B', 'nomi derivati aggiornati senza ricostruire: ' + d.getElementById('brn-1-0-a').textContent);
  // 7. countdown
  const today = new Date();
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const plus = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
  d.getElementById('cdTarget').value = iso(plus(3)); ev('cdCompute()'); ok(d.getElementById('cdValue').value === '3' && d.getElementById('cdUnit').value === 'GIORNI', 'countdown +3 giorni');
  d.getElementById('cdTarget').value = iso(plus(1)); ev('cdCompute()'); ok(d.getElementById('cdValue').value === '1' && d.getElementById('cdUnit').value === 'GIORNO', 'countdown domani');
  d.getElementById('cdTarget').value = iso(plus(0)); ev('cdCompute()'); ok(d.getElementById('cdValue').value === 'OGGI', 'countdown oggi');
  // 8. limiti
  for (let i = 0; i < 6; i++) ev('addCaster()');
  ok(ev('casters.length') === 4 && d.getElementById('btnAddCaster').disabled, 'caster max 4');
  for (let i = 0; i < 6; i++) ev('removeCaster(0)');
  ok(ev('casters.length') === 1, 'caster min 1');
  for (let i = 0; i < 12; i++) ev('addStand()'); ok(ev('standRows.length') === 10, 'classifica max 10');
  for (let i = 0; i < 8; i++) ev('addResMap()'); ok(ev('resultMaps.length') === 5, 'mappe max 5');
  // 9. allineamento nelle nuove modalita'
  ev("setMode('countdown'); setAlign('title','left'); renderGraphic(true)"); ok(true, 'countdown allineato a sinistra');
  ev("setAlign('title','right'); setMode('standings'); renderGraphic(true); setMode('caster'); renderGraphic(true); resetAlign()"); ok(true, 'allineamenti nuove modalita');
  // 10. livelli nelle nuove modalita'
  ev("setMode('result'); renderGraphic(true)");
  ok(['resWinner', 'resLoser', 'heroTitle'].every(id => ev(`layerList.some(l=>l.id==='${id}')`)), 'livelli risultato');
  ev("toggleLayer('resWinner','hidden')"); ok(!ev("hitBoxes.some(b=>b.id==='resWinner')"), 'nascondi vincitore'); ev('showAllLayers()');
  console.log(fails ? 'FAILS ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
