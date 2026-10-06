// Verificação headless: node scripts/verify_site.js <url-base> <pasta-saida>
// Requer puppeteer-core (ex.: NODE_PATH=/workspace/site-ref/scroll-film-studio/scripts/node_modules)
const puppeteer = require('puppeteer-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/cwb-modafitness/';
const OUT = process.argv[3] || '/workspace/cwb-site-shots/v3';
let window_expect400 = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { errors: [], checks: [] };
function check(name, ok, info) { results.checks.push({ name, ok: !!ok, info }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); }

async function newPage(browser, vp) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  page.on('console', (m) => { if (m.type() === 'error' && !(window_expect400 && /status of 400/.test(m.text()))) results.errors.push(`[${vp.width}] console: ${m.text()}`); });
  page.on('pageerror', (e) => results.errors.push(`[${vp.width}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { const u = r.url(); if (!/\.(mp4|webm)$/.test(u)) results.errors.push(`[${vp.width}] requestfailed: ${u} ${r.failure() && r.failure().errorText}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !(r.status() === 400 && /\/frete$/.test(r.url()) && window_expect400)) results.errors.push(`[${vp.width}] HTTP ${r.status()}: ${r.url()}`); });
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
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'] });
  const vps = [
    { tag: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    { tag: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  ];
  for (const vp of vps) {
    const page = await newPage(browser, vp);
    await page.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem('__clr')) { localStorage.clear(); sessionStorage.setItem('__clr', '1'); } } catch (e) {} });
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
    // ---- carrossel de fotos nos cards ----
    await sleep(700);
    const carInfo = await page.evaluate(() => {
      const cars = [...document.querySelectorAll('#grid .card .car')];
      return { cards: cars.length, multi: cars.filter((c) => +c.dataset.n > 1).length, slides: cars.reduce((s, c) => s + +c.dataset.n, 0),
        noGrain: document.body.classList.contains('no-grain'), grainOpacity: getComputedStyle(document.querySelector('.grain')).opacity,
        imgFilters: [...document.querySelectorAll('#grid .car img')].slice(0, 12).map((i) => getComputedStyle(i).filter).filter((f) => f !== 'none').length,
        lazyPending: document.querySelectorAll('#grid .car img[data-src]').length };
    });
    check(`${vp.tag}: carrossel em todas as peças (${carInfo.multi} com mais de uma foto, ${carInfo.slides} fotos)`, carInfo.cards === 69 && carInfo.multi >= 55 && carInfo.lazyPending > 0, JSON.stringify(carInfo));
    check(`${vp.tag}: catálogo sem grão/filtro sobre as fotos`, carInfo.noGrain && carInfo.grainOpacity === '0' && carInfo.imgFilters === 0, JSON.stringify(carInfo));
    const carSel = '#grid .card:nth-child(1) .car';
    await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), carSel); await sleep(500);
    const res0 = await page.evaluate((s) => { const im = document.querySelector(s + ' .car__slide img'); const r = im.getBoundingClientRect(); return { nat: im.naturalWidth, natH: im.naturalHeight, css: Math.round(r.width), cssH: Math.round(r.height), dpr: devicePixelRatio, fit: getComputedStyle(im).objectFit }; }, carSel);
    const cobre = res0.fit === 'cover' ? Math.max(res0.css / res0.nat, res0.cssH / res0.natH) : Math.min(res0.css / res0.nat, res0.cssH / res0.natH);
    check(`${vp.tag}: foto do card sem ampliação (nítida)`, cobre * res0.dpr <= 1.15, JSON.stringify(res0) + ' escala ' + (cobre * res0.dpr).toFixed(2));
    if (vp.isMobile) {
      const box = await (await page.$(carSel)).boundingBox();
      const ty = box.y + box.height / 2, tx = box.x + box.width * 0.8;
      await page.touchscreen.touchStart(tx, ty);
      for (let k = 1; k <= 10; k++) { await page.touchscreen.touchMove(tx - k * box.width * 0.07, ty); await sleep(16); }
      await page.touchscreen.touchEnd(); await sleep(900);
    } else {
      await page.hover(carSel); await sleep(300);
      const navVis = await page.$eval(carSel + ' .car__nav--next', (b) => getComputedStyle(b).opacity);
      check(`${vp.tag}: setas aparecem no hover`, +navVis > 0.5, navVis);
      await page.click(carSel + ' .car__nav--next'); await sleep(900);
    }
    const car1 = await page.evaluate((s) => { const c = document.querySelector(s), t = c.querySelector('.car__track'), ims = c.querySelectorAll('.car__slide img');
      return { idx: Math.round(t.scrollLeft / t.clientWidth), dot: [...c.querySelectorAll('.car__dots button')].findIndex((b) => b.getAttribute('aria-current') === 'true'), loaded: ims[1].complete && ims[1].naturalWidth > 0, modalOpen: !document.querySelector('#productModal').hidden }; }, carSel);
    check(`${vp.tag}: ${vp.isMobile ? 'arrastar com o dedo' : 'seta'} passa para a 2ª foto (carregada sob demanda)`, car1.idx === 1 && car1.dot === 1 && car1.loaded && !car1.modalOpen, JSON.stringify(car1));
    await page.screenshot({ path: `${OUT}/${vp.tag}-11-carrossel-card.png` });
    if (!vp.isMobile) { await page.click(carSel + ' .car__dots button:nth-child(1)'); await sleep(800);
      const back = await page.$eval(carSel + ' .car__track', (t) => Math.round(t.scrollLeft / t.clientWidth)); check(`${vp.tag}: bolinha volta para a 1ª foto`, back === 0, String(back)); }
    // página da peça com carrossel grande + miniaturas
    await page.evaluate(() => CWB.openProduct('YQ-1207')); await sleep(700);
    const pm0 = await page.evaluate(() => ({ n: document.querySelectorAll('#pmBody .car__slide').length, thumbs: document.querySelectorAll('#pmBody .pm__thumbs button').length, grain: getComputedStyle(document.querySelector('.grain')).opacity }));
    await page.click('#pmBody .pm__thumbs button:nth-child(3)'); await sleep(900);
    const pm1 = await page.evaluate(() => { const t = document.querySelector('#pmBody .car__track'); const im = document.querySelectorAll('#pmBody .car__slide img')[2]; return { idx: Math.round(t.scrollLeft / t.clientWidth), thumb: [...document.querySelectorAll('#pmBody .pm__thumbs button')].findIndex((b) => b.getAttribute('aria-current') === 'true'), loaded: im.complete && im.naturalWidth > 0, src: im.currentSrc.split('/').pop() }; });
    check(`${vp.tag}: página da peça com carrossel e miniaturas`, pm0.n === 3 && pm0.thumbs === 3 && pm0.grain === '0' && pm1.idx === 2 && pm1.thumb === 2 && pm1.loaded && /YQ-1207-3/.test(pm1.src), JSON.stringify([pm0, pm1]));
    await page.screenshot({ path: `${OUT}/${vp.tag}-11b-carrossel-peca.png` });
    await page.keyboard.press('Escape'); await sleep(500);
    await page.type('#search', 'YQ-1213'); await sleep(200);
    const nS = await page.$$eval('#grid .card', (c) => c.length);
    check(`${vp.tag}: busca por código`, nS === 1, String(nS));
    // ---- peça + frete em tempo real (SP) ----
    await page.evaluate(() => { localStorage.removeItem('cwb_frete_v2'); });
    await page.click('#grid [data-open]'); await sleep(600);
    await page.click('#pmSizes .size[data-size="M"]');
    await page.select('#pmCor', await page.$eval('#pmCor', (s) => [...s.options].map((o) => o.value).filter((v) => v && !/^Outra/.test(v))[0]));
    await page.type('#cep_pm', '01310100'); // São Paulo
    await page.waitForSelector('[data-frete="pm"] .frete__ops', { timeout: 20000 });
    await sleep(300);
    await page.evaluate(() => document.querySelector('[data-frete="pm"]').scrollIntoView({ block: 'center' }));
    await sleep(300);
    await page.screenshot({ path: `${OUT}/${vp.tag}-12-produto-frete-ao-vivo.png` });
    const pmInfo = await page.evaluate(() => ({ dest: document.querySelector('.frete__dest').textContent, ops: [...document.querySelectorAll('[data-frete="pm"] .frete__op')].map((o) => o.textContent), note: document.querySelector('[data-frete="pm"] .frete__note').textContent, hint: (document.querySelector('.free-hint') || {}).textContent, pay: document.querySelector('.pm__pay').textContent }));
    check(`${vp.tag}: /frete real na peça (SP, várias transportadoras)`, /São Paulo\/SP/.test(pmInfo.dest) && pmInfo.ops.length >= 2 && !/tabela da loja/.test(pmInfo.note), JSON.stringify(pmInfo));
    check(`${vp.tag}: textos "frete grátis" (sem PAC grátis / frete à parte)`, /Frete grátis em compras a partir de R\$ 199,90/.test(pmInfo.hint) && /frete incluso/.test(pmInfo.pay), pmInfo.hint + ' | ' + pmInfo.pay);
    await page.evaluate(() => document.querySelector('.modal__panel').scrollTop = 0);
    await sleep(200);
    await page.screenshot({ path: `${OUT}/${vp.tag}-13-produto.png` });
    // adiciona à sacola -> cotação automática ao vivo
    await page.click('#pmAdd'); await sleep(500);
    await page.waitForFunction(() => { const f = CWB.frete(); return f.opcoes && !f.busy && document.querySelector('[data-frete="cart"] .frete__op'); }, { timeout: 20000 });
    await sleep(300);
    const c1 = await page.evaluate(() => ({ open: !document.querySelector('#cartDrawer').hidden, ops: [...document.querySelectorAll('[data-frete="cart"] .frete__op')].map((o) => o.textContent), on: (document.querySelector('[data-frete="cart"] .frete__op.is-on') || {}).textContent, frete: document.querySelector('#cartFrete').textContent, total: document.querySelector('#cartTotal').textContent, totalLabel: document.querySelector('#cartTotalLabel').textContent, bar: (document.querySelector('.freebar') || {}).textContent, est: CWB.frete().estimado, next: !document.querySelector('#cartNext').hidden }));
    check(`${vp.tag}: sacola cota ao vivo e já marca a mais barata`, c1.open && c1.ops.length >= 2 && c1.on === c1.ops[0] && !c1.est && /R\$/.test(c1.frete) && c1.totalLabel === 'Total com frete' && c1.next, JSON.stringify(c1));
    check(`${vp.tag}: barra "Faltam R$ X para frete grátis"`, /^Faltam R\$ [\d,.]+ para frete grátis$/.test((c1.bar || '').trim()), c1.bar);
    await page.screenshot({ path: `${OUT}/${vp.tag}-14-sacola-cotacao-ao-vivo.png` });
    // escolhe a 2ª opção -> total muda
    await page.click('[data-frete="cart"] .frete__op:nth-child(2) input'); await sleep(300);
    const c2 = await page.evaluate(() => ({ frete: document.querySelector('#cartFrete').textContent, label: document.querySelector('#cartFreteLabel').textContent, total: document.querySelector('#cartTotal').textContent }));
    check(`${vp.tag}: trocar a entrega atualiza o total`, c2.total !== c1.total, JSON.stringify(c2));
    // WhatsApp com a entrega escolhida
    await page.evaluate(() => { window.__opened = []; });
    await page.click('#checkoutWa'); await sleep(200);
    let opened = await page.evaluate(() => window.__opened.slice());
    const wa = decodeURIComponent((opened[0] || '').split('?text=')[1] || '');
    check(`${vp.tag}: WhatsApp 5541991064167 com CEP, cidade, entrega e total`, /wa\.me\/5541991064167/.test(opened[0] || '') && /CEP 01310-100/.test(wa) && /São Paulo\/SP/.test(wa) && wa.indexOf(c2.label.replace('Frete · ', '')) !== -1 && /Total com frete/.test(wa), wa.replace(/\n/g, ' | '));
    // várias peças -> frete grátis na mais barata
    await page.evaluate(() => { CWB.addToCart('YQ-1212', 'G', 'preto', 2); });
    await page.evaluate(() => { const p = CWB.cart(); return p; });
    await page.evaluate(() => CWB.openCart(1));
    await page.waitForFunction(() => { const f = CWB.frete(); return f.opcoes && !f.busy && /YQ-1212:2/.test(f.sig); }, { timeout: 20000 }).catch(() => {});
    await sleep(400);
    const free = await page.evaluate(() => ({ n: CWB.cart().length, frete: document.querySelector('#cartFrete').textContent, first: (document.querySelector('[data-frete="cart"] .frete__op') || {}).textContent, sub: document.querySelector('#cartSubtotal').textContent, total: document.querySelector('#cartTotal').textContent, bar: (document.querySelector('.freebar') || {}).textContent }));
    check(`${vp.tag}: várias peças ≥ R$ 199,90 → a entrega mais barata fica grátis`, free.n === 2 && /Grátis/.test(free.first) && free.frete === "Grátis" && /ganhou frete grátis/.test(free.bar), JSON.stringify(free));
    await page.evaluate(() => document.querySelector('.cart-frete').scrollIntoView({ block: 'start' }));
    await sleep(300);
    await page.screenshot({ path: `${OUT}/${vp.tag}-15-sacola-frete-gratis.png` });
    // etapa 2: formulário
    await page.click('#cartNext'); await sleep(500);
    const f0 = await page.evaluate(() => { const f = document.querySelector('#checkoutForm'); return f && { rua: f.rua.value, bairro: f.bairro.value, cidade: f.cidade.value, uf: f.uf.value, cep: f.cep.value, pay: document.querySelector('#checkoutMp').textContent, payVisible: !document.querySelector('#checkoutMp').hidden }; });
    check(`${vp.tag}: formulário com endereço preenchido pelo CEP`, f0 && /Paulista/.test(f0.rua) && f0.cidade === 'São Paulo' && f0.uf === 'SP' && f0.cep === '01310-100' && f0.payVisible && /Pagar com Mercado Pago · R\$/.test(f0.pay), JSON.stringify(f0));
    await page.screenshot({ path: `${OUT}/${vp.tag}-16-checkout-formulario.png` });
    const legal = await page.evaluate(() => { const n = document.querySelector('#legalNote'); return { vis: !n.hidden, links: [...n.querySelectorAll('a')].map((a) => a.getAttribute('href')) }; });
    check(`${vp.tag}: aviso "Ao pagar você concorda" com Termos e Privacidade perto do botão`, legal.vis && legal.links.indexOf('termos.html') !== -1 && legal.links.indexOf('privacidade.html') !== -1, JSON.stringify(legal));
    // validação: CPF inválido e campos vazios
    await page.type('#co_cpf', '11111111111');
    await page.click('#checkoutMp'); await sleep(300);
    const v = await page.evaluate(() => ({ errs: [...document.querySelectorAll('#checkoutForm .f--err input')].map((i) => i.name), cpfMsg: (document.querySelector('#co_cpf').closest('.f').querySelector('.f__err') || {}).textContent, msg: document.querySelector('#payMsg').textContent, url: location.href }));
    check(`${vp.tag}: validação (nome, e-mail, telefone, número, CPF com dígito)`, ['nome', 'email', 'telefone', 'cpf', 'numero'].every((k) => v.errs.indexOf(k) !== -1) && /CPF inválido/.test(v.cpfMsg), JSON.stringify(v));
    await page.screenshot({ path: `${OUT}/${vp.tag}-17-checkout-erros.png` });
    // preenche certo
    const fill = async (n, val) => { await page.$eval('#co_' + n, (i) => { i.value = ''; }); await page.type('#co_' + n, val); };
    await fill('nome', 'Teste Verificacao Site'); await fill('email', 'teste.site@example.com'); await fill('telefone', '41988887777');
    await fill('cpf', '52998224725'); await fill('numero', '1000'); await fill('complemento', 'teste automatico - nao enviar');
    const masks = await page.evaluate(() => ({ cpf: document.querySelector('#co_cpf').value, tel: document.querySelector('#co_telefone').value, errs: document.querySelectorAll('#checkoutForm .f--err').length }));
    check(`${vp.tag}: máscaras de CPF e telefone`, masks.cpf === '529.982.247-25' && masks.tel === '(41) 98888-7777' && masks.errs === 0, JSON.stringify(masks));
    if (vp.tag === 'mobile') {
      // /checkout REAL: só gera o link do Mercado Pago (não paga)
      await page.evaluate(() => { window.__noRedirect = true; window.__lastInitPoint = null; });
      const t0 = Date.now();
      await page.click('#checkoutMp');
      await sleep(150);
      const loading = await page.evaluate(() => document.querySelector('#checkoutMp').textContent);
      await page.waitForFunction(() => window.__lastInitPoint || !document.querySelector('#payMsg').hidden, { timeout: 30000 }).catch(() => {});
      const ck = await page.evaluate(() => ({ init: window.__lastInitPoint, msg: document.querySelector('#payMsg').hidden ? '' : document.querySelector('#payMsg').textContent, pedido: JSON.parse(localStorage.getItem('cwb_pedido_v1') || 'null') }));
      check(`${vp.tag}: /checkout real devolve init_point do Mercado Pago`, ck.init && /^https:\/\/(www\.)?mercadopago\.com\.br\//.test(ck.init) && ck.pedido && /^CWB-/.test(ck.pedido.id), JSON.stringify({ loading, ms: Date.now() - t0, init: ck.init, pedido: ck.pedido && ck.pedido.id, total: ck.pedido && ck.pedido.total, msg: ck.msg }));
      results.initPoint = ck.init; results.pedido = ck.pedido;
      if (ck.init) {
        // 1) como o curl: segue os redirects e confere a página de checkout
        const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
        const r = await fetch(ck.init, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' }, redirect: 'follow' });
        const html = await r.text();
        const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
        check(`${vp.tag}: init_point responde 200 "Mercado Pago - Checkout" com o pedido`, r.status === 200 && /Mercado Pago - Checkout/.test(title || '') && html.indexOf(ck.pedido.id) !== -1, `${r.status} ${title} ${r.url.slice(0, 80)}`);
        const mp = await browser.newPage();
        await mp.setUserAgent(UA);
        await mp.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const resp = await mp.goto(ck.init, { waitUntil: 'networkidle2', timeout: 60000 }).catch((e) => ({ status: () => 'ERR ' + e.message }));
        await mp.waitForFunction(() => /pagar/i.test(document.body && document.body.innerText || ''), { timeout: 30000 }).catch(() => {});
        await sleep(1500);
        const mpInfo = await mp.evaluate(() => ({ url: location.href.slice(0, 90), title: document.title, text: document.body.innerText.slice(0, 700).replace(/\s+/g, ' ') })).catch((e) => ({ err: e.message }));
        const st = resp && typeof resp.status === 'function' ? resp.status() : 'nav';
        check(`${vp.tag}: página do Mercado Pago abre no navegador (sem pagar)`, st !== 403 && /mercadopago\.com\.br/.test(mpInfo.url || '') && /pagar/i.test(mpInfo.text || '') && /Pix/.test(mpInfo.text || ''), st + ' ' + JSON.stringify(mpInfo));
        results.mpPage = mpInfo;
        await mp.screenshot({ path: `${OUT}/${vp.tag}-18-mercado-pago.png` });
        await mp.close();
      }
    }
    // retorno #pedido-pendente mantém a sacola; #pedido-erro oferece tentar de novo; #pedido-ok limpa
    await page.goto(BASE + '?pedido=CWB-261006-1612-TESTE&pagamento=1#pedido-pendente', { waitUntil: 'networkidle2' }); await sleep(1200);
    const pend = await page.evaluate(() => ({ vis: !document.querySelector('#orderPanel').hidden, t: document.querySelector('#orderTitle').textContent, msg: document.querySelector('#orderMsg').textContent, id: document.querySelector('#orderId').textContent, url: location.href, cart: CWB.cart().length }));
    check(`${vp.tag}: #pedido-pendente (Pix/boleto) mantém pedido e limpa a URL`, pend.vis && /Pix ou boleto/.test(pend.msg) && /CWB-261006-1612-TESTE/.test(pend.id) && pend.cart === 2 && pend.url === BASE, JSON.stringify(pend));
    await page.goto(BASE + '?pedido=CWB-261006-1612-TESTE&pagamento=1#pedido-erro', { waitUntil: 'networkidle2' }); await sleep(1200);
    await page.screenshot({ path: `${OUT}/${vp.tag}-19-pedido-erro.png` });
    await page.click('[data-retry]'); await sleep(500);
    const retry = await page.evaluate(() => ({ cart: !document.querySelector('#cartDrawer').hidden, step2: !!document.querySelector('#checkoutForm'), url: location.href }));
    check(`${vp.tag}: #pedido-erro → "Tentar pagar de novo" volta ao formulário`, retry.cart && retry.step2 && retry.url === BASE, JSON.stringify(retry));
    await page.goto(BASE + '?pedido=CWB-261006-1612-TESTE&pagamento=1#pedido-ok', { waitUntil: 'networkidle2' }); await sleep(1500);
    const ok = await page.evaluate(() => ({ vis: !document.querySelector('#orderPanel').hidden, t: document.querySelector('#orderTitle').textContent, url: location.href, cart: CWB.cart().length, count: document.querySelector('#cartCount').hidden }));
    check(`${vp.tag}: #pedido-ok agradece, esvazia a sacola e limpa a URL`, ok.vis && /Pedido recebido/.test(ok.t) && ok.cart === 0 && ok.count && ok.url === BASE, JSON.stringify(ok));
    await page.screenshot({ path: `${OUT}/${vp.tag}-20-pedido-ok.png` });
    await page.click('[data-close-order]'); await sleep(300);
    const direct = await page.$eval('#altContact', (a) => a.href);
    check(`${vp.tag}: link do Direct`, direct === 'https://ig.me/m/cwb_modafitness', direct);
    // CEP inexistente (resposta do /frete)
    await page.evaluate(() => { CWB.addToCart('YQ-1213', 'P', 'marrom', 1); CWB.openCart(1); }); await sleep(800);
    await page.$eval('#cep_cart', (i) => { i.value = ''; });
    window_expect400 = true; // o servidor responde 400 "CEP não encontrado" de propósito
    await page.type('#cep_cart', '99999999');
    await page.waitForFunction(() => !!document.querySelector('.cep-err'), { timeout: 20000 }).catch(() => {});
    const err = await page.evaluate(() => (document.querySelector('.cep-err') || {}).textContent || '');
    check(`${vp.tag}: CEP inexistente avisa`, /não encontrado/.test(err), err);
    await sleep(300); window_expect400 = false;
    if (vp.tag === 'desktop') {
      // "Outra cor" não vai pro Mercado Pago (o servidor só aceita as cores da peça)
      await page.evaluate(() => { CWB.addToCart('YQ-1205', 'M', 'Outra cor (combinar no WhatsApp)', 1); CWB.openCart(1); });
      await page.$eval('#cep_cart', (i) => { i.value = ''; }); await page.type('#cep_cart', '80010000');
      await page.waitForFunction(() => { const f = CWB.frete(); return f.opcoes && !f.busy; }, { timeout: 20000 }).catch(() => {});
      await sleep(300);
      const oc = await page.evaluate(() => ({ msg: document.querySelector('#payMsg').textContent, hidden: document.querySelector('#payMsg').hidden }));
      check('desktop: item "Outra cor" pede WhatsApp em vez do Mercado Pago', !oc.hidden && /outra cor/.test(oc.msg), JSON.stringify(oc));
    }
    await page.close();
  }
  // páginas legais + rodapé com vendedor
  {
    const page = await newPage(browser, { tag: 'legal', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    for (const f of ['trocas.html', 'privacidade.html', 'termos.html']) {
      const r = await page.goto(BASE + f, { waitUntil: 'networkidle2' });
      const t = await page.evaluate(() => document.body.innerText);
      check(`página ${f} (200, CNPJ, contato)`, r.status() === 200 && /37\.789\.447\/0001-00/.test(t) && /99106-4167/.test(t) && /rafaoliveiracwb23@gmail\.com/.test(t), r.status() + ' ' + t.length + ' chars');
      await page.screenshot({ path: `${OUT}/legal-${f.replace('.html', '')}.png` });
    }
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    const ft = await page.evaluate(() => ({ seller: document.querySelector('.footer__seller').textContent, links: [...document.querySelectorAll('.footer__legal a')].map((a) => a.getAttribute('href')) }));
    check('rodapé: vendedor com CNPJ e links legais', /CNPJ 37\.789\.447\/0001-00/.test(ft.seller) && /Curitiba/.test(ft.seller) && ft.links.length === 3, JSON.stringify(ft));
    await page.close();
  }
  // reserva: servidor do frete fora do ar -> tabela regional "estimativa" e só WhatsApp
  {
    const page = await newPage(browser, { tag: 'fallback', width: 1440, height: 900 });
    await page.setRequestInterception(true);
    page.on('request', (r) => (/workers\.dev/.test(r.url()) ? r.abort() : r.continue()));
    await page.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem('__clr')) { localStorage.clear(); sessionStorage.setItem('__clr', '1'); } } catch (e) {} });
    results.errors.length; const before = results.errors.length;
    await page.goto(BASE, { waitUntil: 'networkidle2' }); await sleep(800);
    await page.evaluate(() => { CWB.addToCart('YQ-1213', 'M', 'marrom', 1); CWB.openCart(1); });
    await page.type('#cep_cart', '50030230'); // Recife
    await page.waitForFunction(() => /Recife/.test((document.querySelector('[data-frete="cart"] .frete__dest') || {}).textContent || ''), { timeout: 15000 }).catch(() => {});
    await sleep(300);
    const ne = await page.evaluate(() => ({ ops: [...document.querySelectorAll('[data-frete="cart"] .frete__op')].map((o) => o.textContent).join(' / '), note: (document.querySelector('[data-frete="cart"] .frete__note') || {}).textContent, next: document.querySelector('#cartNext').hidden, wa: document.querySelector('#checkoutWaLabel').textContent, msg: document.querySelector('#payMsg').textContent }));
    check('reserva: sem servidor usa a tabela regional (Nordeste, estimativa) e só WhatsApp', /41,90/.test(ne.ops) && /tabela da loja/.test(ne.note) && ne.next && ne.wa === 'Finalizar pelo WhatsApp', JSON.stringify(ne));
    await page.screenshot({ path: `${OUT}/desktop-21-reserva-tabela.png` });
    results.errors.splice(before); // erros de rede aqui são esperados (bloqueados de propósito)
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
  console.log('\nINIT_POINT:', results.initPoint || '-', '\nPEDIDO:', JSON.stringify(results.pedido || null));
  console.log(`\n${results.checks.length - fails}/${results.checks.length} checks ok`);
  process.exit(fails || results.errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
