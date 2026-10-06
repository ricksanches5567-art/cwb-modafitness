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

  // lines: [{codigo, tamanho, cor, qtd}]  |  opts.pagamento: 'mp' (pagou no link) ou vazio
  function buildOrderText(opts, lines) {
    opts = opts || {};
    var linhas = (lines || validLines()).filter(function (l) { return porCodigo[l.codigo]; });
    var soma = linhas.reduce(function (s, l) { return s + porCodigo[l.codigo].preco * l.qtd; }, 0);
    var t = 'Olá! Quero fazer este pedido pelo site da ' + (CFG.nomeLoja || 'CWB Moda Fitness') + ':\n\n';
    linhas.forEach(function (l, i) {
      var p = porCodigo[l.codigo];
      t += (i + 1) + ') ' + p.codigo + ' – ' + p.nome + '\n';
      t += '   Tamanho: ' + l.tamanho + ' | Cor: ' + l.cor + ' | Qtd: ' + l.qtd + '\n';
      t += '   ' + money(p.preco) + (l.qtd > 1 ? ' cada = ' + money(p.preco * l.qtd) : '') + '\n';
    });
    var nP = linhas.reduce(function (s, l) { return s + l.qtd; }, 0);
    var op = opcaoEscolhida(nP, soma);
    t += '\nProdutos: ' + money(soma) + '\n';
    if (op) {
      t += 'Entrega: CEP ' + fmtCep(frete.cep) + ' – ' + lugarTxt() + '\n';
      t += 'Frete ' + op.modal + ' (' + prazoTxt(op.prazo) + '): ' + (op.gratis ? 'GRÁTIS' : money(op.valor)) + ' (estimativa — confirmar no WhatsApp)\n';
      t += 'Total com frete: ' + money(soma + op.valor) + '\n';
    } else {
      t += 'Frete: a calcular (vou informar meu CEP)\n';
    }
    if (opts.pagamento === 'mp') {
      t += '\nPagamento: paguei as peças pelo link do Mercado Pago (' + money(soma) + ').' + (op && op.valor > 0 ? ' O frete eu pago à parte (Pix ou link).' : '') + ' Vou enviar o comprovante aqui.\n';
      t += '\nMeu nome:\n' + (op ? 'Endereço (rua, número, bairro):\n' : 'CEP:\n');
    } else {
      t += '\nMeu nome:\n' + (op ? 'Endereço (rua, número, bairro):\n' : 'CEP:\n') + 'Forma de pagamento (Pix ou cartão pelo link Mercado Pago):\n';
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

  function priceKey(v) { return Number(v).toFixed(2).replace('.', ','); }
  function mpLinkForProduct(p) {
    var links = CFG.mercadoPagoLinks || {};
    return (p && (links[p.codigo] || links[priceKey(p.preco)])) || '';
  }
  // Mercado Pago só quando a sacola tem exatamente 1 peça (quantidade 1)
  function cartSingle() { var l = validLines(); return l.length === 1 && l[0].qtd === 1 ? l[0] : null; }
  function mpLinkForCart() { var one = cartSingle(); return one ? mpLinkForProduct(porCodigo[one.codigo]) : ''; }
  var cartPaidMp = false;

  /* ---------------- frete (estimativa por CEP) ---------------- */
  var FRETE_KEY = 'cwb_frete_v1';
  var frete = { cep: '', cidade: '', uf: '', regiao: '', modal: 'PAC' };
  try { var fs0 = JSON.parse(localStorage.getItem(FRETE_KEY)); if (fs0 && fs0.cep) frete = fs0; } catch (e) {}
  var freteBusy = false, freteErr = '';
  function saveFrete() { try { localStorage.setItem(FRETE_KEY, JSON.stringify(frete)); } catch (e) {} }
  function fmtCep(c) { c = String(c).replace(/\D/g, '').slice(0, 8); return c.length > 5 ? c.slice(0, 5) + '-' + c.slice(5) : c; }
  var UF_REG = { PR: 'pr', SC: 'sul_sp', RS: 'sul_sp', SP: 'sul_sp', RJ: 'sudeste_co', MG: 'sudeste_co', ES: 'sudeste_co', DF: 'sudeste_co', GO: 'sudeste_co', MS: 'sudeste_co', MT: 'sudeste_co',
    BA: 'nordeste', SE: 'nordeste', AL: 'nordeste', PE: 'nordeste', PB: 'nordeste', RN: 'nordeste', CE: 'nordeste', PI: 'nordeste', MA: 'nordeste',
    PA: 'norte', AP: 'norte', AM: 'norte', RR: 'norte', AC: 'norte', RO: 'norte', TO: 'norte' };
  // região pela faixa de CEP (usada quando as APIs de CEP não respondem)
  function regiaoPorFaixa(n) {
    if (n < 20000) return 'sul_sp';            // SP
    if (n < 40000) return 'sudeste_co';        // RJ, ES, MG
    if (n < 66000) return 'nordeste';
    if (n < 70000) return 'norte';             // PA, AP, AM, RR, AC
    if (n >= 76800 && n < 78000) return 'norte'; // RO, TO
    if (n < 80000) return 'sudeste_co';        // DF, GO, MT, MS
    if (n < 88000) return 'pr';
    return 'sul_sp';                           // SC, RS
  }
  function regiaoDe(cep, uf) {
    var n = parseInt(cep.slice(0, 5), 10);
    if (n >= 80000 && n <= 83899) return 'local';  // Curitiba e região metropolitana
    return (uf && UF_REG[uf]) || regiaoPorFaixa(n);
  }
  function fetchJson(url) {
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      clearTimeout(to);
      if (r.status === 404 || r.status === 400) { var e = new Error('notfound'); e.notfound = true; throw e; }
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }, function (e) { clearTimeout(to); throw e; });
  }
  function lookupCep(cep) {
    function notFound() { var x = new Error('notfound'); x.notfound = true; return x; }
    // ViaCEP é a fonte principal; se ela responder "erro", o CEP não existe.
    // BrasilAPI só entra quando a ViaCEP não responde (rede/servidor).
    return fetchJson('https://viacep.com.br/ws/' + cep + '/json/').then(function (d) {
      if (d.erro) throw notFound();
      return { cidade: d.localidade, uf: d.uf };
    }).catch(function (e) {
      if (e && e.notfound) throw e;
      return fetchJson('https://brasilapi.com.br/api/cep/v1/' + cep).then(function (d) {
        return { cidade: d.city, uf: d.state };
      }).catch(function (e2) {
        if (e2 && e2.notfound) throw e2;
        return { cidade: '', uf: '' };    // APIs fora do ar: estima pela faixa do CEP
      });
    });
  }
  function calcCep(raw, done) {
    var cep = String(raw || '').replace(/\D/g, '');
    if (cep.length !== 8) { freteErr = 'Digite os 8 números do CEP.'; done(); return; }
    freteBusy = true; freteErr = ''; done();
    lookupCep(cep).then(function (r) {
      frete = { cep: cep, cidade: r.cidade || '', uf: r.uf || '', regiao: regiaoDe(cep, r.uf), modal: frete.modal || 'PAC' };
      saveFrete();
    }).catch(function () {
      freteErr = 'CEP não encontrado. Confira os números.';
    }).then(function () { freteBusy = false; done(); });
  }
  function pesoKg(n) { return (CFG.freteEmbalagemKg || 0.1) + n * (CFG.fretePesoPecaKg || 0.4); }
  function gratisAcima() { return Number(CFG.freteGratisAcima) || 0; }
  // opções de frete para n peças e subtotal (R$)
  function cotar(nPecas, subtotal) {
    var tab = (CFG.freteTabela || {})[frete.regiao]; if (!frete.cep || !tab || !nPecas) return null;
    var extra = Math.max(0, Math.ceil(pesoKg(nPecas) - 1 - 1e-9));
    return ['PAC', 'SEDEX'].map(function (m) {
      var r = tab[m.toLowerCase()]; var v = Math.round((r.preco + extra * (r.kgAdicional || 0)) * 100) / 100;
      var gr = m === 'PAC' && gratisAcima() > 0 && subtotal >= gratisAcima();
      return { modal: m, valor: gr ? 0 : v, cheio: v, gratis: gr, prazo: r.prazo };
    });
  }
  function opcaoEscolhida(nPecas, subtotal) {
    var ops = cotar(nPecas, subtotal); if (!ops) return null;
    return ops.filter(function (o) { return o.modal === frete.modal; })[0] || ops[0];
  }
  function prazoTxt(p) { return p ? (p[0] === p[1] ? p[0] : p[0] + ' a ' + p[1]) + ' dias úteis' : ''; }
  function lugarTxt() { return frete.cidade ? frete.cidade + '/' + frete.uf : ((CFG.freteTabela || {})[frete.regiao] || {}).nome || ''; }
  function freteWidget(scope, nPecas, subtotal) {
    var id = 'cep_' + scope;
    var ops = cotar(nPecas, subtotal);
    var h = '<div class="frete" data-frete="' + scope + '">' +
      '<label class="field__label" for="' + id + '">Calcular frete</label>' +
      '<div class="cep-row"><input class="cep-input" id="' + id + '" type="text" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="Seu CEP (00000-000)" value="' + esc(fmtCep(frete.cep)) + '">' +
      '<button type="button" class="cep-btn" data-cep-calc' + (freteBusy ? ' disabled' : '') + '>' + (freteBusy ? 'Calculando…' : 'Calcular') + '</button></div>' +
      '<a class="cep-help" href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener">Não sei meu CEP</a>';
    if (freteErr) h += '<p class="err cep-err">' + esc(freteErr) + '</p>';
    if (ops) {
      h += '<p class="frete__dest">Entrega em <strong>' + esc(lugarTxt()) + '</strong> · CEP ' + esc(fmtCep(frete.cep)) + '</p><div class="frete__ops" role="radiogroup" aria-label="Modalidade de envio">';
      ops.forEach(function (o) {
        var on = o.modal === (opcaoEscolhida(nPecas, subtotal) || {}).modal;
        h += '<label class="frete__op' + (on ? ' is-on' : '') + '"><input type="radio" name="frete_' + scope + '" value="' + o.modal + '"' + (on ? ' checked' : '') + '>' +
          '<span class="frete__name">' + o.modal + '<small>' + prazoTxt(o.prazo) + '</small></span>' +
          '<span class="frete__val">' + (o.gratis ? '<s>' + money(o.cheio) + '</s> Grátis' : money(o.valor)) + '</span></label>';
      });
      h += '</div><p class="frete__note">Estimativa — confirmamos o valor final no WhatsApp.</p>';
    }
    return h + '</div>';
  }
  function freteProgress(subtotal) {
    var g = gratisAcima(); if (!g) return '';
    var falta = g - subtotal, pct = Math.max(4, Math.min(100, subtotal / g * 100));
    return '<div class="freebar' + (falta <= 0 ? ' is-done' : '') + '"><p>' + (falta > 0 ? 'Faltam <strong>' + money(falta) + '</strong> para frete grátis (PAC)' : '<strong>Você ganhou frete grátis (PAC)!</strong>') + '</p>' +
      '<span class="freebar__track"><span style="width:' + pct.toFixed(1) + '%"></span></span></div>';
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
      '<div id="pmFrete"></div>' +
      '<p class="err" id="pmErr" hidden></p>' +
      '<button class="btn btn--plum" id="pmAdd">Adicionar ao carrinho</button>' +
      (mpLinkForProduct(p) ?
        '<div class="pm__mp"><p class="pm__mp-title">Ou compre só esta peça agora:</p>' +
        '<button class="btn btn--mp" id="pmMpBtn">Pagar com Mercado Pago · ' + money(p.preco) + '</button>' +
        '<p class="mp-note mp-frete" id="pmMpFrete"></p>' +
        '<p class="mp-note" id="pmMpNote">Depois de pagar, envie o comprovante com código, tamanho e cor no WhatsApp.</p>' +
        '<button class="btn btn--wa-outline" id="pmWaBtn">Enviar pedido no WhatsApp</button>' +
        '<p class="hint" id="pmMpQtyHint" hidden>O link do Mercado Pago é para 1 peça. Para mais peças, adicione ao carrinho e finalize pelo WhatsApp.</p></div>' : '') +
      '</div>';
    $('#pmBody').innerHTML = html;
    renderPmFrete();
    var m = $('#productModal'); m.hidden = false; document.body.classList.add('lock');
    $('.modal__panel', m).scrollTop = 0;
    document.title = p.nome + ' ' + p.codigo + ' | ' + (CFG.nomeLoja || 'CWB Moda Fitness');
    setTimeout(function () { var b = $('.close-btn', m); if (b) b.focus({ preventScroll: true }); }, 30);
  }
  function pmQty() { var i = $('#pmQty'); return Math.max(1, Math.min(99, parseInt(i && i.value, 10) || 1)); }
  function mpFreteNote(op, valorPecas) {
    if (!op) return 'O link cobra só a peça (' + money(valorPecas) + '). Calcule o frete pelo CEP: ele é pago à parte, por Pix ou link que enviamos no WhatsApp.';
    if (op.gratis || op.valor === 0) return 'Frete grátis: o pagamento no Mercado Pago já cobre tudo.';
    return 'O Mercado Pago cobra só a peça (' + money(valorPecas) + '). O frete ' + op.modal + ' de ' + money(op.valor) + ' é pago à parte: por Pix ou link que enviamos no WhatsApp.';
  }
  function renderPmFrete() {
    var box = $('#pmFrete'); var p = porCodigo[currentCode]; if (!box || !p) return;
    var q = pmQty(), sub = p.preco * q;
    box.innerHTML = freteWidget('pm', q, sub) + (gratisAcima() ? '<p class="hint free-hint">' + (sub >= gratisAcima() ? 'Frete grátis (PAC) neste pedido!' : 'Frete grátis (PAC) em compras a partir de ' + money(gratisAcima()) + '.') + '</p>' : '');
    var n = $('#pmMpFrete'); if (n) n.textContent = mpFreteNote(opcaoEscolhida(1, p.preco), p.preco);
  }
  // tamanho/cor escolhidos na página da peça (quantidade 1) – mostra erro se faltar
  function currentSelection() {
    var sel = document.querySelector('#pmSizes .size[aria-pressed="true"]');
    var cor = $('#pmCor').value, err = $('#pmErr');
    if (!sel) { err.textContent = 'Escolha o tamanho (P, M ou G).'; err.hidden = false; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); return null; }
    if (!cor) { err.textContent = 'Escolha a cor.'; err.hidden = false; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); return null; }
    err.hidden = true;
    return { codigo: currentCode, tamanho: sel.getAttribute('data-size'), cor: cor, qtd: 1 };
  }
  function updatePmQtyState() {
    var b = $('#pmMpBtn'); if (!b) return;
    var many = (parseInt($('#pmQty').value, 10) || 1) > 1;
    b.disabled = many; $('#pmWaBtn').disabled = many; $('#pmMpQtyHint').hidden = !many;
  }
  function onPmQty() { updatePmQtyState(); renderPmFrete(); }
  function closeProduct(fromHistory) {
    var m = $('#productModal'); if (m.hidden) return;
    m.hidden = true; document.body.classList.remove('lock');
    document.title = 'CWB Moda Fitness | Moda fitness em Curitiba';
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
  function closeCart() { $('#cartDrawer').hidden = true; if ($('#productModal').hidden) document.body.classList.remove('lock'); }
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
    var sub = total(), nP = linhas.reduce(function (s, l) { return s + l.qtd; }, 0);
    $('#cartItems').innerHTML += '<div class="cart-frete">' + freteProgress(sub) + freteWidget('cart', nP, sub) + '</div>';
    var op = opcaoEscolhida(nP, sub);
    $('#cartSubtotal').textContent = money(sub);
    $('#cartFreteLabel').textContent = op ? 'Frete ' + op.modal + ' (' + prazoTxt(op.prazo) + ')' : 'Frete';
    $('#cartFrete').textContent = op ? (op.gratis ? 'Grátis' : money(op.valor)) : 'Calcule pelo CEP';
    $('#cartFrete').classList.toggle('is-free', !!(op && op.gratis));
    $('#cartTotal').textContent = money(sub + (op ? op.valor : 0));
    $('#cartTotalLabel').textContent = op ? 'Total com frete' : 'Total sem frete';
    $('#shipNote').textContent = op ? 'Frete: estimativa — confirmamos o valor final no WhatsApp.' : 'Informe o CEP acima para ver o frete (estimativa, confirmada no WhatsApp).';
    var mp = mpLinkForCart();
    if (!mp) cartPaidMp = false;
    $('#cartMp').hidden = !mp;
    $('#checkoutMp').textContent = 'Pagar com Mercado Pago · ' + money(total());
    $('#cartMpFrete').textContent = mpFreteNote(op, total());
    $('#cartMp .mp-note').classList.toggle('is-active', cartPaidMp);
    var canal = hasWa() ? 'WhatsApp' : 'Direct do Instagram';
    $('#checkoutWaLabel').textContent = mp
      ? (cartPaidMp ? 'Enviar pedido e comprovante no ' + canal : 'Finalizar pelo ' + canal + ' (Pix)')
      : 'Finalizar pelo ' + canal + ' (pagamento por Pix ou link Mercado Pago)';
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
      if (e.target.closest('#pmMpBtn')) {
        var one = currentSelection(); if (!one) return;
        var link = mpLinkForProduct(porCodigo[currentCode]); if (!link) return;
        openTab(link) || (window.location.href = link);
        var note = $('#pmMpNote'); if (note) note.classList.add('is-active');
        toast('Depois de pagar, envie o comprovante no WhatsApp 👇', 4500);
        return;
      }
      if (e.target.closest('#pmWaBtn')) {
        var sel1 = currentSelection(); if (!sel1) return;
        sendOrder(buildOrderText({ pagamento: 'mp' }, [sel1]), false);
        return;
      }
      if (q) onPmQty();
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
    $('#productModal').addEventListener('change', function (e) { if (e.target.id === 'pmCor') $('#pmErr').hidden = true; if (e.target.id === 'pmQty') onPmQty(); });
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
    $('#checkoutWa').addEventListener('click', function () {
      if (!validLines().length) return;
      sendOrder(buildOrderText(cartPaidMp && mpLinkForCart() ? { pagamento: 'mp' } : {}), false);
    });
    $('#checkoutMp').addEventListener('click', function () {
      var link = mpLinkForCart(); if (!link) return;
      openTab(link) || (window.location.href = link);
      cartPaidMp = true; renderCart();
      toast('Depois de pagar, envie o comprovante no WhatsApp 👇', 4500);
    });
    // frete: máscara, calcular, escolher modalidade (página da peça e sacola)
    function rerenderFrete(scope) { if (scope === 'cart') renderCart(); else renderPmFrete(); }
    function scopeOf(el) { var f = el.closest('[data-frete]'); return f && f.getAttribute('data-frete'); }
    function runCalc(el) {
      var scope = scopeOf(el), inp = el.closest('[data-frete]').querySelector('.cep-input');
      calcCep(inp.value, function () {
        rerenderFrete(scope);
        if (!freteBusy && !freteErr) { var o = document.querySelector('[data-frete="' + scope + '"] .frete__ops'); if (o && o.scrollIntoView) o.scrollIntoView({ block: 'nearest' }); }
      });
    }
    document.addEventListener('input', function (e) {
      if (!e.target.classList || !e.target.classList.contains('cep-input')) return;
      var v = fmtCep(e.target.value); if (v !== e.target.value) e.target.value = v;
      if (v.replace(/\D/g, '').length === 8 && v.replace(/\D/g, '') !== frete.cep && !freteBusy) runCalc(e.target);
    });
    document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-cep-calc]'); if (b) runCalc(b); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('cep-input')) { e.preventDefault(); runCalc(e.target); }
    });
    document.addEventListener('change', function (e) {
      if (e.target.name && /^frete_/.test(e.target.name)) { frete.modal = e.target.value; saveFrete(); rerenderFrete(scopeOf(e.target)); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (!$('#cartDrawer').hidden) closeCart(); else closeProduct(false); }
    });
    window.addEventListener('popstate', routeFromHash);
    window.addEventListener('hashchange', routeFromHash);
  }
  function applyConfig() {
    var si = $('#search'); if (si && si.getAttribute('data-ph')) si.setAttribute('placeholder', si.getAttribute('data-ph'));
    var wc = $('#waCta'); if (wc) { if (hasWa()) wc.href = waUrl('Olá! Vim pelo site da ' + (CFG.nomeLoja || 'CWB Moda Fitness') + ' e tenho uma dúvida.'); else wc.hidden = true; }
    var dc = $('#igDirectCta'); if (dc) dc.href = igDirect();
    ['#igLinkTop', '#igLinkHero', '#igLinkFooter'].forEach(function (s) { $(s).href = igUrl(); });
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
  window.CWB = { buildOrderText: buildOrderText, waUrl: waUrl, addToCart: addToCart, cart: function () { return cart; }, total: total, hasWa: hasWa, mpLinkForProduct: function (c) { return mpLinkForProduct(porCodigo[c]); }, mpLinkForCart: mpLinkForCart, frete: function () { return frete; }, cotar: cotar, openCart: openCart, openProduct: function (c) { openProduct(c, true); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
