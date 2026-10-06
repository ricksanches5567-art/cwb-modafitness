/* CWB Moda Fitness – catálogo e sacola (JS puro, sem dependências) */
(function () {
  'use strict';
  var CFG = window.LOJA_CONFIG || {};
  var STORE = 'cwb_sacola_v1';
  var CATS = [
    ['todos', 'Todos'],
    ['macaquinhos', 'Macaquinhos'],
    ['macacoes', 'Macacões'],
    ['conj-short', 'Conjuntos com short'],
    ['conj-legging', 'Conjuntos com legging'],
    ['flare', 'Flare/calças'],
    ['leggings-shorts', 'Leggings e shorts']
  ];
  var OUTRA_COR = 'Outra cor (combinar na conversa)';
  var produtos = [], porCodigo = {}, estado = { cat: 'todos', q: '' };
  var $ = function (s, el) { return (el || document).querySelector(s); };

  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function money(v) { return brl.format(v).replace(/\u00a0/g, ' '); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function igHandle() { return (CFG.instagram || 'cwb_modafitness').replace(/^@/, ''); }
  function igUrl() { return 'https://www.instagram.com/' + igHandle() + '/'; }
  function igDirect() { return 'https://ig.me/m/' + igHandle(); }
  function waNumber() { return String(CFG.whatsappNumber || '').replace(/\D/g, ''); }
  function hasWa() { var n = waNumber(); return n.length >= 12 && n.indexOf('55DDD') === -1; }
  function waUrl(text) { return 'https://wa.me/' + waNumber() + (text ? '?text=' + encodeURIComponent(text) : ''); }

  /* ---------------- sacola ---------------- */
  var cart = [];
  try { cart = JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) { cart = []; }
  function saveCart() { try { localStorage.setItem(STORE, JSON.stringify(cart)); } catch (e) {} updateCount(); }
  function lineKey(c, t, cor) { return c + '|' + t + '|' + cor; }
  function addToCart(codigo, tamanho, cor, qtd) {
    var k = lineKey(codigo, tamanho, cor);
    var ex = cart.filter(function (l) { return l.key === k; })[0];
    if (ex) ex.qtd = Math.min(99, ex.qtd + qtd);
    else cart.push({ key: k, codigo: codigo, tamanho: tamanho, cor: cor, qtd: qtd });
    saveCart();
  }
  function validLines() { return cart.filter(function (l) { return porCodigo[l.codigo]; }); }
  function total() { return validLines().reduce(function (s, l) { return s + porCodigo[l.codigo].preco * l.qtd; }, 0); }
  function updateCount() {
    var n = validLines().reduce(function (s, l) { return s + l.qtd; }, 0);
    var el = $('#cartCount'); el.textContent = n; el.hidden = n === 0;
  }

  function buildOrderText(opts) {
    opts = opts || {};
    var linhas = validLines();
    var t = 'Olá! Quero fazer este pedido pelo site da ' + (CFG.nomeLoja || 'CWB Moda Fitness') + ':\n\n';
    linhas.forEach(function (l, i) {
      var p = porCodigo[l.codigo];
      t += (i + 1) + ') ' + p.codigo + ' – ' + p.nome + '\n';
      t += '   Tamanho: ' + l.tamanho + ' | Cor: ' + l.cor + ' | Qtd: ' + l.qtd + '\n';
      t += '   ' + money(p.preco) + (l.qtd > 1 ? ' cada = ' + money(p.preco * l.qtd) : '') + '\n';
    });
    t += '\nTotal: ' + money(total()) + ' (sem o frete)\n';
    if (opts.mercadoPago) {
      t += '\nPagamento: Mercado Pago (abri o link de pagamento pelo site).\n';
      t += '\nMeu nome:\nCEP:\n';
    } else {
      t += '\nMeu nome:\nCEP:\nForma de pagamento (Pix/cartão):\n';
    }
    return t;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { legacyCopy(text); });
    }
    legacyCopy(text); return Promise.resolve();
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
  }

  // abre em nova aba (sem 'noopener' na lista de recursos, que faria window.open retornar null)
  function openTab(url) {
    var w = window.open(url, '_blank');
    if (w) { try { w.opener = null; } catch (e) {} }
    return w;
  }

  // Envia o pedido: WhatsApp (se configurado) ou Direct do Instagram com o texto copiado
  function sendOrder(text, sameTab) {
    if (hasWa()) {
      var url = waUrl(text);
      if (sameTab) { window.location.href = url; }
      else { var w = openTab(url); if (!w) window.location.href = url; }
      return;
    }
    copyText(text);
    toast('Pedido copiado! No Direct do Instagram, toque e segure na caixa de mensagem e escolha "Colar".', 7000);
    if (sameTab) { setTimeout(function () { window.location.href = igDirect(); }, 1800); }
    else { var w2 = openTab(igDirect()); if (!w2) setTimeout(function () { window.location.href = igDirect(); }, 1800); }
  }

  function mpLinkForCart() {
    var linhas = validLines();
    var per = CFG.mercadoPagoLinks || {};
    if (linhas.length === 1 && linhas[0].qtd === 1 && per[linhas[0].codigo]) return per[linhas[0].codigo];
    return CFG.mercadoPagoLink || '';
  }

  /* ---------------- catálogo ---------------- */
  function renderFilters() {
    var counts = {}; produtos.forEach(function (p) { counts[p.categoria] = (counts[p.categoria] || 0) + 1; });
    $('#filters').innerHTML = CATS.filter(function (c) { return c[0] === 'todos' || counts[c[0]]; }).map(function (c) {
      return '<button class="chip" role="tab" data-cat="' + c[0] + '" aria-selected="' + (estado.cat === c[0]) + '">' + c[1] + '</button>';
    }).join('');
  }
  function filtered() {
    var q = norm(estado.q);
    return produtos.filter(function (p) {
      if (estado.cat !== 'todos' && p.categoria !== estado.cat) return false;
      if (!q) return true;
      return norm(p.codigo).indexOf(q) !== -1 || norm(p.nome).indexOf(q) !== -1;
    });
  }
  function catName(id) { var c = CATS.filter(function (x) { return x[0] === id; })[0]; return c ? c[1] : ''; }
  function renderGrid() {
    var list = filtered();
    $('#resultInfo').textContent = list.length + (list.length === 1 ? ' peça' : ' peças') + (estado.cat !== 'todos' ? ' em ' + catName(estado.cat) : '') + (estado.q ? ' para "' + estado.q + '"' : '');
    if (!list.length) { $('#grid').innerHTML = '<p class="empty">Nenhuma peça encontrada. Confira o código ou escolha outra categoria.</p>'; return; }
    $('#grid').innerHTML = list.map(function (p, i) {
      var img = 'img/t/' + p.fotos[0] + '.webp';
      return '<article class="card" data-codigo="' + esc(p.codigo) + '">' +
        '<button class="card__img" data-open="' + esc(p.codigo) + '" aria-label="Ver ' + esc(p.nome) + ' ' + esc(p.codigo) + '">' +
        '<img src="' + img + '" alt="' + esc(p.nome) + ' – ' + esc(p.codigo) + '" width="400" height="400" ' + (i < 4 ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async">' +
        (p.fotos.length > 1 ? '<span class="card__tag">' + p.fotos.length + ' fotos</span>' : '') + '</button>' +
        '<div class="card__body"><h3 class="card__name">' + esc(p.nome) + '</h3>' +
        '<span class="card__code">Cód. ' + esc(p.codigo) + '</span>' +
        '<span class="card__price">' + money(p.preco) + '</span>' +
        '<button class="card__btn" data-open="' + esc(p.codigo) + '">Ver detalhes</button></div></article>';
    }).join('');
  }

  /* ---------------- modal do produto ---------------- */
  var openedByClick = false, currentCode = null;
  function openProduct(codigo, push) {
    var p = porCodigo[codigo]; if (!p) return;
    currentCode = codigo;
    if (push) { openedByClick = true; history.pushState({ p: codigo }, '', '#p/' + encodeURIComponent(codigo)); }
    var multi = p.cores.length > 1;
    var cores = multi ? p.cores : p.cores.concat([OUTRA_COR]);
    var html =
      '<div class="pm__gallery"><img class="pm__main" id="pmMain" src="img/p/' + p.fotos[0] + '.webp" alt="' + esc(p.nome) + ' – ' + esc(p.codigo) + '" width="1000" height="1000">' +
      (p.fotos.length > 1 ? '<div class="pm__thumbs">' + p.fotos.map(function (f, i) {
        return '<button data-foto="' + f + '" aria-label="Foto ' + (i + 1) + '" aria-current="' + (i === 0) + '"><img src="img/t/' + f + '.webp" alt="" loading="lazy"></button>';
      }).join('') + '</div>' : '') + '</div>' +
      '<div class="pm__info"><span class="pm__code">Cód. ' + esc(p.codigo) + ' · ' + esc(catName(p.categoria)) + '</span>' +
      '<h2 class="pm__title" id="pmTitle">' + esc(p.nome) + '</h2>' +
      '<div class="pm__price">' + money(p.preco) + '</div>' +
      '<p class="pm__desc">' + esc(p.descricao) + '</p>' +
      '<div class="field"><span class="field__label">Tamanho</span><div class="sizes" id="pmSizes">' +
      p.tamanhos.map(function (t) { return '<button class="size" data-size="' + esc(t) + '" aria-pressed="false">' + esc(t) + '</button>'; }).join('') +
      '</div><p class="hint">P, M e G: tecido com elasticidade que se ajusta ao corpo.</p></div>' +
      '<div class="field"><label class="field__label" for="pmCor">' + (multi ? 'Cor' : 'Cor desejada') + '</label>' +
      '<select class="select" id="pmCor">' + (multi ? '<option value="">Escolha a cor</option>' : '') +
      cores.map(function (c) { return '<option value="' + esc(c) + '">' + esc(cap(c)) + '</option>'; }).join('') + '</select>' +
      '<p class="hint">Disponibilidade de cor e tamanho confirmada na finalização do pedido.</p></div>' +
      '<div class="field"><span class="field__label">Quantidade</span><div class="qty"><button data-q="-1" aria-label="Diminuir">−</button>' +
      '<input id="pmQty" type="number" min="1" max="99" value="1" inputmode="numeric" aria-label="Quantidade"><button data-q="1" aria-label="Aumentar">+</button></div></div>' +
      '<p class="err" id="pmErr" hidden></p>' +
      '<button class="btn btn--plum" id="pmAdd">Adicionar ao carrinho</button></div>';
    $('#pmBody').innerHTML = html;
    var m = $('#productModal'); m.hidden = false; document.body.classList.add('lock');
    $('.modal__panel', m).scrollTop = 0;
    document.title = p.nome + ' ' + p.codigo + ' | ' + (CFG.nomeLoja || 'CWB Moda Fitness');
    setTimeout(function () { var b = $('.close-btn', m); if (b) b.focus({ preventScroll: true }); }, 30);
  }
  function closeProduct(fromHistory) {
    var m = $('#productModal'); if (m.hidden) return;
    m.hidden = true; document.body.classList.remove('lock');
    document.title = 'CWB Moda Fitness | Moda fitness em poliamida canelada – Curitiba';
    if (!fromHistory && location.hash.indexOf('#p/') === 0) {
      if (openedByClick) history.back(); else history.replaceState(null, '', location.pathname + location.search);
    }
    openedByClick = false;
  }
  function routeFromHash() {
    var h = decodeURIComponent(location.hash || '');
    if (h.indexOf('#p/') === 0) openProduct(h.slice(3), false); else closeProduct(true);
  }

  /* ---------------- sacola (gaveta) ---------------- */
  function openCart() { renderCart(); $('#cartDrawer').hidden = false; document.body.classList.add('lock'); }
  function closeCart() { $('#cartDrawer').hidden = true; if ($('#productModal').hidden) document.body.classList.remove('lock'); $('#mpConfirm').hidden = true; }
  function renderCart() {
    var linhas = validLines();
    $('#cartFoot').hidden = linhas.length === 0;
    if (!linhas.length) { $('#cartItems').innerHTML = '<div class="cart-empty"><p>Sua sacola está vazia.</p><button class="btn btn--plum" data-close-cart style="width:auto">Ver catálogo</button></div>'; return; }
    $('#cartItems').innerHTML = linhas.map(function (l) {
      var p = porCodigo[l.codigo];
      return '<div class="line" data-key="' + esc(l.key) + '"><img src="img/t/' + p.fotos[0] + '.webp" alt="" loading="lazy">' +
        '<div><p class="line__name">' + esc(p.nome) + '</p><p class="line__meta">Cód. ' + esc(p.codigo) + ' · Tam. ' + esc(l.tamanho) + ' · ' + esc(cap(l.cor)) + '</p>' +
        '<div class="line__row"><div class="qty"><button data-lq="-1" aria-label="Diminuir">−</button><input type="number" min="1" max="99" value="' + l.qtd + '" data-lqi aria-label="Quantidade"><button data-lq="1" aria-label="Aumentar">+</button></div>' +
        '<span class="line__price">' + money(p.preco * l.qtd) + '</span></div>' +
        '<button class="remove" data-remove>Remover</button></div></div>';
    }).join('');
    $('#cartSubtotal').textContent = money(total());
    var mp = mpLinkForCart();
    $('#checkoutMp').hidden = !mp || !$('#mpConfirm').hidden;
    $('#checkoutMp').textContent = 'Pagar com Mercado Pago · ' + money(total());
    $('#mpTotal').textContent = money(total());
    $('#checkoutWaLabel').textContent = hasWa() ? 'Finalizar pelo WhatsApp' : 'Finalizar pelo Direct do Instagram';
  }
  function setLineQty(key, q) {
    cart.forEach(function (l) { if (l.key === key) l.qtd = Math.max(1, Math.min(99, q || 1)); });
    saveCart(); renderCart();
  }

  var toastTimer;
  function toast(msg, ms) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 2600);
  }

  /* ---------------- eventos ---------------- */
  function bind() {
    $('#filters').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]'); if (!b) return;
      estado.cat = b.getAttribute('data-cat'); renderFilters(); renderGrid();
    });
    $('#search').addEventListener('input', function (e) { estado.q = e.target.value.trim(); renderGrid(); });
    $('#grid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-open]'); if (b) openProduct(b.getAttribute('data-open'), true);
    });
    $('#productModal').addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) return closeProduct(false);
      var f = e.target.closest('[data-foto]');
      if (f) {
        $('#pmMain').src = 'img/p/' + f.getAttribute('data-foto') + '.webp';
        Array.prototype.forEach.call(document.querySelectorAll('.pm__thumbs button'), function (x) { x.setAttribute('aria-current', x === f); });
      }
      var s = e.target.closest('[data-size]');
      if (s) { Array.prototype.forEach.call(document.querySelectorAll('#pmSizes .size'), function (x) { x.setAttribute('aria-pressed', x === s); }); $('#pmErr').hidden = true; }
      var q = e.target.closest('[data-q]');
      if (q) { var i = $('#pmQty'); i.value = Math.max(1, Math.min(99, (parseInt(i.value, 10) || 1) + parseInt(q.getAttribute('data-q'), 10))); }
      if (e.target.closest('#pmAdd')) {
        var sel = document.querySelector('#pmSizes .size[aria-pressed="true"]');
        var cor = $('#pmCor').value;
        var err = $('#pmErr');
        if (!sel) { err.textContent = 'Escolha o tamanho (P, M ou G).'; err.hidden = false; return; }
        if (!cor) { err.textContent = 'Escolha a cor.'; err.hidden = false; return; }
        err.hidden = true;
        var qtd = Math.max(1, Math.min(99, parseInt($('#pmQty').value, 10) || 1));
        var p = porCodigo[currentCode];
        addToCart(p.codigo, sel.getAttribute('data-size'), cor, qtd);
        toast('Adicionado à sacola ✓');
        closeProduct(false); setTimeout(openCart, 60);
      }
    });
    $('#productModal').addEventListener('change', function (e) { if (e.target.id === 'pmCor') $('#pmErr').hidden = true; });
    $('#openCart').addEventListener('click', openCart);
    $('#cartDrawer').addEventListener('click', function (e) {
      if (e.target.closest('[data-close-cart]')) return closeCart();
      var line = e.target.closest('.line'); if (!line) return;
      var key = line.getAttribute('data-key');
      if (e.target.closest('[data-remove]')) { cart = cart.filter(function (l) { return l.key !== key; }); saveCart(); renderCart(); return; }
      var b = e.target.closest('[data-lq]');
      if (b) { var l = cart.filter(function (x) { return x.key === key; })[0]; setLineQty(key, l.qtd + parseInt(b.getAttribute('data-lq'), 10)); }
    });
    $('#cartDrawer').addEventListener('change', function (e) {
      if (e.target.hasAttribute('data-lqi')) setLineQty(e.target.closest('.line').getAttribute('data-key'), parseInt(e.target.value, 10));
    });
    $('#checkoutWa').addEventListener('click', function () { if (validLines().length) sendOrder(buildOrderText({}), false); });
    $('#checkoutMp').addEventListener('click', function () { $('#mpConfirm').hidden = false; $('#checkoutMp').hidden = true; });
    $('#mpCancel').addEventListener('click', function () { $('#mpConfirm').hidden = true; renderCart(); });
    $('#mpGo').addEventListener('click', function () {
      var link = mpLinkForCart(); if (!link || !validLines().length) return;
      var text = buildOrderText({ mercadoPago: true });
      var w = openTab(link);                     // Mercado Pago em nova aba
      if (!w) { window.location.href = link; return; }
      sendOrder(text, true);                     // pedido pelo WhatsApp nesta aba
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (!$('#cartDrawer').hidden) closeCart(); else closeProduct(false); }
    });
    window.addEventListener('popstate', routeFromHash);
    window.addEventListener('hashchange', routeFromHash);
  }
  function applyConfig() {
    ['#igLinkTop', '#igLinkHero', '#igLinkFooter'].forEach(function (s) { $(s).href = igUrl(); });
    $('#igLinkHero').textContent = '@' + igHandle();
    $('#igLinkFooter').textContent = 'Instagram @' + igHandle();
    $('#altContact').href = igDirect();
    if (CFG.cidade) $('#footerCity').textContent = CFG.cidade;
    if (CFG.textoEnvio) $('#footerNote').textContent = CFG.textoEnvio;
    if (hasWa()) {
      var n = waNumber(); $('#waFooterItem').hidden = false; $('#waLinkFooter').href = waUrl('');
      $('#waLinkFooter').textContent = 'WhatsApp (' + n.slice(2, 4) + ') ' + n.slice(4, n.length - 4) + '-' + n.slice(-4);
    } else { $('#altContact').hidden = true; }
    $('#year').textContent = new Date().getFullYear();
  }

  function init() {
    applyConfig(); bind(); updateCount();
    fetch('data/produtos.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (data) {
      produtos = data; data.forEach(function (p) { porCodigo[p.codigo] = p; });
      renderFilters(); renderGrid(); updateCount(); routeFromHash();
    }).catch(function () {
      $('#grid').innerHTML = '<p class="empty">Não foi possível carregar o catálogo. Atualize a página.</p>';
    });
  }

  // exposto para testes
  window.CWB = { buildOrderText: buildOrderText, waUrl: waUrl, addToCart: addToCart, cart: function () { return cart; }, total: total, hasWa: hasWa };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
