// Verificação headless: node scripts/verify_site.js <url-base> <pasta-saida>
// Requer puppeteer-core (ex.: NODE_PATH=/workspace/site-ref/scroll-film-studio/scripts/node_modules)
const puppeteer = require('puppeteer-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/cwb-modafitness/';
const OUT = process.argv[3] || '/workspace/cwb-site-shots/v2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { errors: [], checks: [] };
function check(name, ok, info) { results.checks.push({ name, ok: !!ok, info }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); }

async function newPage(browser, vp) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  page.on('console', (m) => { if (m.type() === 'error') results.errors.push(`[${vp.width}] console: ${m.text()}`); });
  page.on('pageerror', (e) => results.errors.push(`[${vp.width}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { const u = r.url(); if (!/\.(mp4|webm)$/.test(u)) results.errors.push(`[${vp.width}] requestfailed: ${u} ${r.failure() && r.failure().errorText}`); });
  page.on('response', (r) => { if (r.status() >= 400) results.errors.push(`[${vp.width}] HTTP ${r.status()}: ${r.url()}`); });
  await page.evaluateOnNewDocument(() => {
    window.__opened = [];
    window.open = function (u) { window.__opened.push(String(u)); return { opener: null }; };
  });
  return page;
}
async function go(page, jump) {
  await page.goto(BASE + (jump !== undefined ? '?jump=' + Math.round(jump) : ''), { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction('window.__ready === true', { timeout: 30000 });
  await sleep(jump ? 1400 : 2600);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage'] });
  const vps = [
    { tag: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    { tag: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  ];
  for (const vp of vps) {
    const page = await newPage(browser, vp);
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
    await go(page, 0);
    await page.screenshot({ path: `${OUT}/${vp.tag}-01-top.png` });
    const pos = await page.evaluate(() => {
      const y = (s) => document.querySelector(s).getBoundingClientRect().top + scrollY;
      const ch = document.querySelector('#colecao'), dt = document.querySelector('#detalhes');
      const span = ch.offsetHeight - innerHeight, dspan = dt.offsetHeight - innerHeight;
      return { manifesto: y('#manifesto'), ch0: y('#colecao') + span * 0.1, ch1: y('#colecao') + span * 0.37, ch2: y('#colecao') + span * 0.62, ch3: y('#colecao') + span * 0.92,
        det: y('#detalhes') + dspan * 0.75, catalog: y('#catalogo') - 20, howto: y('#comprar'), cta: y('.cta'), footer: document.documentElement.scrollHeight - innerHeight,
        overflowX: document.documentElement.scrollWidth > innerWidth, video: (() => { const v = document.querySelector('#heroVideo'); return { src: v.currentSrc, w: v.videoWidth, paused: v.paused, t: v.currentTime }; })() };
    });
    check(`${vp.tag}: sem rolagem horizontal`, !pos.overflowX);
    check(`${vp.tag}: vídeo do hero tocando`, pos.video.w > 0 && pos.video.t > 0, JSON.stringify(pos.video));
    const shots = [['02-manifesto', pos.manifesto + 60], ['03-colecao-1', pos.ch0], ['04-colecao-2', pos.ch1], ['05-colecao-3', pos.ch2], ['06-colecao-4', pos.ch3],
      ['07-detalhes-video', pos.det], ['08-catalogo', pos.catalog], ['09-como-comprar', pos.howto], ['10-cta', pos.cta], ['11-rodape', pos.footer]];
    for (const [name, y] of shots) {
      await go(page, y);
      if (name.startsWith('03') || name.startsWith('05')) {
        const px = await page.evaluate(() => { const c = document.querySelector('#chapterCanvas'); const d = c.getContext('2d').getImageData(c.width >> 1, c.height >> 1, 1, 1).data; return [c.width, c.height, d[0], d[1], d[2]]; });
        check(`${vp.tag}: canvas da coleção desenhando (${name})`, px[0] > 0 && (px[2] + px[3] + px[4]) > 0 && !(px[2] === 0x22 && px[3] === 0x10 && px[4] === 0x1d), px.join(','));
      }
      await page.screenshot({ path: `${OUT}/${vp.tag}-${name}.png` });
    }
    // ---- catálogo: filtros e busca ----
    await go(page, pos.catalog);
    const nAll = await page.$$eval('#grid .card', (c) => c.length);
    check(`${vp.tag}: 69 peças no catálogo`, nAll === 69, String(nAll));
    await page.click('#filters [data-cat="flare"]'); await sleep(200);
    const nFlare = await page.$$eval('#grid .card', (c) => c.length);
    check(`${vp.tag}: filtro flare`, nFlare === 2, String(nFlare));
    await page.click('#filters [data-cat="todos"]');
    await page.type('#search', 'YQ-1213'); await sleep(200);
    const nS = await page.$$eval('#grid .card', (c) => c.length);
    check(`${vp.tag}: busca por código`, nS === 1, String(nS));
    // ---- peça + frete (CEP fora, paga frete) ----
    await page.click('#grid [data-open]'); await sleep(600);
    await page.click('#pmSizes .size[data-size="M"]');
    await page.select('#pmCor', await page.$eval('#pmCor option:last-child', (o) => o.value));
    await page.type('#cep_pm', '01310100'); // São Paulo
    await page.waitForSelector('[data-frete="pm"] .frete__ops', { timeout: 15000 });
    await sleep(300);
    await page.evaluate(() => document.querySelector('[data-frete="pm"]').scrollIntoView({ block: 'center' }));
    await sleep(300);
    await page.screenshot({ path: `${OUT}/${vp.tag}-12-produto-frete.png` });
    const pmInfo = await page.evaluate(() => ({ dest: document.querySelector('.frete__dest').textContent, ops: [...document.querySelectorAll('[data-frete="pm"] .frete__op')].map((o) => o.textContent), mp: (document.querySelector('#pmMpFrete') || {}).textContent }));
    check(`${vp.tag}: frete na peça (SP)`, /São Paulo\/SP/.test(pmInfo.dest) && pmInfo.ops.length === 2, JSON.stringify(pmInfo));
    await page.evaluate(() => document.querySelector('#pmBody').scrollIntoView());
    await page.evaluate(() => document.querySelector('.modal__panel').scrollTop = 0);
    await sleep(200);
    await page.screenshot({ path: `${OUT}/${vp.tag}-13-produto.png` });
    // MP direto da peça
    await page.click('#pmMpBtn'); await sleep(200);
    let opened = await page.evaluate(() => window.__opened.slice());
    check(`${vp.tag}: botão Mercado Pago da peça abre link mpago`, opened.some((u) => /mpago\.la/.test(u)), opened.join(' '));
    // adiciona à sacola
    await page.click('#pmAdd'); await sleep(900);
    const cartInfo = await page.evaluate(() => ({ open: !document.querySelector('#cartDrawer').hidden, mp: !document.querySelector('#cartMp').hidden, frete: document.querySelector('#cartFrete').textContent, total: document.querySelector('#cartTotal').textContent, mpNote: document.querySelector('#cartMpFrete').textContent, bar: (document.querySelector('.freebar') || {}).textContent }));
    check(`${vp.tag}: sacola com 1 peça mostra MP + frete pago à parte`, cartInfo.open && cartInfo.mp && /R\$/.test(cartInfo.frete) && /à parte/.test(cartInfo.mpNote) && /Faltam/.test(cartInfo.bar), JSON.stringify(cartInfo));
    await page.screenshot({ path: `${OUT}/${vp.tag}-14-sacola-frete-pago.png` });
    // troca para SEDEX
    await page.click('[data-frete="cart"] input[value="SEDEX"]'); await sleep(200);
    await page.evaluate(() => { window.__opened = []; });
    await page.click('#checkoutWa'); await sleep(200);
    opened = await page.evaluate(() => window.__opened.slice());
    const wa = decodeURIComponent((opened[0] || '').split('?text=')[1] || '');
    check(`${vp.tag}: WhatsApp 5541991064167 com CEP, cidade, SEDEX e total`, /wa\.me\/5541991064167/.test(opened[0] || '') && /CEP 01310-100/.test(wa) && /São Paulo\/SP/.test(wa) && /Frete SEDEX/.test(wa) && /Total com frete/.test(wa) && /estimativa/.test(wa), wa.replace(/\n/g, ' | '));
    await page.evaluate(() => { window.__opened = []; });
    await page.click('#checkoutMp'); await sleep(200);
    opened = await page.evaluate(() => window.__opened.slice());
    check(`${vp.tag}: MP na sacola (1 peça)`, opened.some((u) => /mpago\.la/.test(u)), opened.join(' '));
    // aumenta para 3 unidades -> frete grátis, MP some
    await page.click('#cartItems .line [data-lq="1"]'); await sleep(150);
    await page.click('#cartItems .line [data-lq="1"]'); await sleep(250);
    await page.click('[data-frete="cart"] input[value="PAC"]'); await sleep(250);
    const free = await page.evaluate(() => ({ mp: !document.querySelector('#cartMp').hidden, frete: document.querySelector('#cartFrete').textContent, total: document.querySelector('#cartTotal').textContent, sub: document.querySelector('#cartSubtotal').textContent, bar: (document.querySelector('.freebar') || {}).textContent }));
    check(`${vp.tag}: frete grátis acima de R$ 199,90 e MP escondido com várias peças`, !free.mp && /Grátis/.test(free.frete) && /ganhou frete grátis/.test(free.bar), JSON.stringify(free));
    await page.evaluate(() => document.querySelector('.cart-frete').scrollIntoView({ block: 'center' }));
    await sleep(300);
    await page.screenshot({ path: `${OUT}/${vp.tag}-15-sacola-frete-gratis.png` });
    await page.evaluate(() => { window.__opened = []; });
    await page.click('#checkoutWa'); await sleep(200);
    opened = await page.evaluate(() => window.__opened.slice());
    const wa2 = decodeURIComponent((opened[0] || '').split('?text=')[1] || '');
    check(`${vp.tag}: WhatsApp com frete GRÁTIS`, /GRÁTIS/.test(wa2) && /Qtd: 3/.test(wa2), wa2.replace(/\n/g, ' | '));
    const direct = await page.$eval('#altContact', (a) => a.href);
    check(`${vp.tag}: link do Direct`, direct === 'https://ig.me/m/cwb_modafitness', direct);
    // CEP inexistente
    await page.evaluate(() => { const i = document.querySelector('#cartItems .line [data-lqi]'); i.value = '1'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(250);
    await page.$eval('#cep_cart', (i) => { i.value = ''; });
    await page.type('#cep_cart', '99999999'); await sleep(4000);
    const err = await page.evaluate(() => (document.querySelector('.cep-err') || {}).textContent || '');
    check(`${vp.tag}: CEP inexistente avisa`, /não encontrado/.test(err), err);
    // Nordeste
    await page.$eval('#cep_cart', (i) => { i.value = ''; });
    await page.type('#cep_cart', '50030230'); // Recife
    await page.waitForFunction(() => /Recife/.test((document.querySelector('[data-frete="cart"] .frete__dest') || {}).textContent || ''), { timeout: 15000 }).catch(() => {});
    const ne = await page.evaluate(() => [...document.querySelectorAll('[data-frete="cart"] .frete__op')].map((o) => o.textContent).join(' / ') + ' @ ' + ((document.querySelector('[data-frete="cart"] .frete__dest') || {}).textContent || ''));
    check(`${vp.tag}: tabela Nordeste`, /41,90/.test(ne) && /Recife/.test(ne), ne);
    await page.screenshot({ path: `${OUT}/${vp.tag}-16-sacola-nordeste.png` });
    await page.close();
  }
  // reduced motion
  const rm = await browser.newPage();
  await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await rm.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true });
  rm.on('pageerror', (e) => results.errors.push('[rm] pageerror: ' + e.message));
  await rm.goto(BASE, { waitUntil: 'networkidle2' }); await sleep(800);
  const rmInfo = await rm.evaluate(() => ({ cls: document.documentElement.className, chapImgs: [...document.querySelectorAll('.chapter__img')].filter((i) => i.offsetHeight > 0).length, h: document.querySelector('#colecao').offsetHeight }));
  check('reduced-motion: capítulos estáticos com fotos', /rm/.test(rmInfo.cls) && rmInfo.chapImgs === 4, JSON.stringify(rmInfo));
  await rm.evaluate(() => document.querySelector('#colecao').scrollIntoView()); await sleep(500);
  await rm.screenshot({ path: `${OUT}/reduced-motion-colecao.png` });
  await browser.close();
  console.log('\nERRORS:', results.errors.length ? '\n' + results.errors.join('\n') : 'none');
  const fails = results.checks.filter((c) => !c.ok).length;
  console.log(`\n${results.checks.length - fails}/${results.checks.length} checks ok`);
  process.exit(fails || results.errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
