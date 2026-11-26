const { open } = require('./harness');
(async () => {
  const h = await open(); const { d, ev, sleep } = h;
  let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
  await sleep(200);
  const unnamed = () => [...d.querySelectorAll('aside input:not([type=file]):not([type=hidden]),aside select,aside textarea')]
    .filter(i => !(i.getAttribute('aria-label') || (i.id && d.querySelector(`label[for="${i.id}"]`)) || i.closest('label')))
    .map(i => i.id || i.outerHTML.slice(0, 70));
  let u = unnamed(); ok(u.length === 0, 'tutti i campi hanno un nome' + (u.length ? ': ' + u.slice(0, 6).join(' | ') : ''));
  // campi creati dopo (liste dinamiche): nome assegnato in automatico
  ev("setMode('roster'); addCaster && 0; setMode('caster'); addCaster(); setMode('standings'); addStand(); setMode('result'); addResMap(); setMode('roster')");
  await sleep(250); u = unnamed(); ok(u.length === 0, 'campi dinamici con nome' + (u.length ? ': ' + u.slice(0, 6).join(' | ') : ''));
  ok(d.querySelectorAll('button').length > 0 && [...d.querySelectorAll('button')].every(b => (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent).trim()), 'tutti i pulsanti hanno un nome');
  ok(d.getElementById('graphicCanvas').getAttribute('role') === 'img' && !!d.getElementById('graphicCanvas').getAttribute('aria-label'), 'canvas descritto');
  ok(/role="alertdialog"/.test(d.documentElement.outerHTML) && /aria-modal="true"/.test(d.documentElement.outerHTML), 'dialogo con ruolo e aria-modal');
  console.log(fails ? 'FAILS ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
