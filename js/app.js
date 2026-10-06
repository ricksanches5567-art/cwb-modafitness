/* CWB Moda Fitness – catálogo, sacola, frete em tempo real e pagamento (JS puro) */
(function () {
  'use strict';
  var CFG = window.LOJA_CONFIG || {};
  var API = String(CFG.apiPagamento || '').replace(/\/+$/, '');
  var STORE = 'cwb_sacola_v1', FRETE_KEY = 'cwb_frete_v2', CLIENTE_KEY = 'cwb_cliente_v1', PEDIDO_KEY = 'cwb_pedido_v1';
  var CATS = [
    ['todos', 'Todos'], ['macaquinhos', 'Macaquinhos'], ['macacoes', 'Macacões'], ['conj-short', 'Conjuntos com short'],
    ['conj-legging', 'Conjuntos com legging'], ['flare', 'Flare/calças'], ['leggings-shorts', 'Leggings e shorts']
  ];
  var OUTRA_COR = 'Outra cor (combinar no WhatsApp)';
  var produtos = [], porCodigo = {}, estado = { cat: 'todos', q: '' };
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function money(v) { return brl.format(v).replace(/\u00a0/g, ' '); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function igHandle() { return (CFG.instagram || 'cwb_modafitness').replace(/^@/, ''); }
  function igUrl() { return 'https://www.instagram.com/' + igHandle() + '/'; }
  function igDirect() { return 'https://ig.me/m/' + igHandle(); }
  function waNumber() { return digits(CFG.whatsappNumber); }
  function hasWa() { var n = waNumber(); return n.length >= 12; }
  function waUrl(text) { return 'https://wa.me/' + waNumber() + (text ? '?text=' + encodeURIComponent(text) : ''); }
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function fmtCep(c) { c = digits(c).slice(0, 8); return c.length > 5 ? c.slice(0, 5) + '-' + c.slice(5) : c; }
  function gratisMin() { return Number(CFG.freteGratisAcima) || 0; }

  /* ---------------- sacola ---------------- */
  var cart = load(STORE, []);
  if (!Array.isArray(cart)) cart = [];
  function saveCart() { save(STORE, cart); updateCount(); }
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
  function pecas() { return validLines().reduce(function (s, l) { return s + l.qtd; }, 0); }
  function updateCount() { var n = pecas(), el = $('#cartCount'); el.textContent = n; el.hidden = n === 0; }
  function cartSig() { return validLines().map(function (l) { return l.codigo + ':' + l.qtd; }).sort().join(','); }

  /* ---------------- API do pagamento ---------------- */
  var api = { online: null, tempoReal: null };   // null = ainda não sabemos
  function apiCall(path, body, ms) {
    if (!API) return Promise.reject({ rede: true });
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 15000);
    return fetch(API + path, {
      method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      clearTimeout(to);
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || d.ok === false) { d = d || {}; d.status = r.status; throw d; }
        return d;
      });
    }, function () { clearTimeout(to); throw { rede: true }; });
  }
  function checkHealth() {
    apiCall('/health', null, 8000).then(function (d) {
      api.online = !!d.pagamento_online; api.tempoReal = !!d.frete_tempo_real;
      if (d.frete_gratis_minimo != null) CFG.freteGratisAcima = Number(d.frete_gratis_minimo);
      if (!$('#cartDrawer').hidden) renderCart();
    }).catch(function () { api.online = false; if (!$('#cartDrawer').hidden) renderCart(); });
  }

  /* ---------------- frete ---------------- */
  // frete.cep/cidade/uf/bairro/rua ficam salvos; as opções são recotadas sempre que a sacola muda.
  var frete = load(FRETE_KEY, {}) || {};
  frete.opcoes = null; frete.sig = ''; frete.busy = false; frete.err = '';
  function saveFrete() { save(FRETE_KEY, { cep: frete.cep, cidade: frete.cidade, uf: frete.uf, bairro: frete.bairro, rua: frete.rua, servico: frete.servico }); }
  var UF_REG = { PR: 'pr', SC: 'sul_sp', RS: 'sul_sp', SP: 'sul_sp', RJ: 'sudeste_co', MG: 'sudeste_co', ES: 'sudeste_co', DF: 'sudeste_co', GO: 'sudeste_co', MS: 'sudeste_co', MT: 'sudeste_co',
    BA: 'nordeste', SE: 'nordeste', AL: 'nordeste', PE: 'nordeste', PB: 'nordeste', RN: 'nordeste', CE: 'nordeste', PI: 'nordeste', MA: 'nordeste',
    PA: 'norte', AP: 'norte', AM: 'norte', RR: 'norte', AC: 'norte', RO: 'norte', TO: 'norte' };
  function regiaoPorFaixa(n) {
    if (n < 20000) return 'sul_sp'; if (n < 40000) return 'sudeste_co'; if (n < 66000) return 'nordeste'; if (n < 70000) return 'norte';
    if (n >= 76800 && n < 78000) return 'norte'; if (n < 80000) return 'sudeste_co'; if (n < 88000) return 'pr'; return 'sul_sp';
  }
  function regiaoDe(cep, uf) { var n = parseInt(cep.slice(0, 5), 10); if (n >= 80000 && n <= 83899) return 'local'; return (uf && UF_REG[uf]) || regiaoPorFaixa(n); }
  function viaCep(cep) {
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);
    return fetch('https://viacep.com.br/ws/' + cep + '/json/', ctl ? { signal: ctl.signal } : {}).then(function (r) { clearTimeout(to); return r.json(); })
      .then(function (d) { if (d.erro) throw { naoExiste: true }; return { cidade: d.localidade, uf: d.uf, bairro: d.bairro, rua: d.logradouro }; });
  }
  // tabela regional do config.js (reserva quando o servidor de frete não responde)
  function cotarTabela(cep, uf, nPecas, subtotal) {
    var tab = (CFG.freteTabela || {})[regiaoDe(cep, uf)]; if (!tab || !nPecas) return [];
    var peso = (CFG.freteEmbalagemKg || 0.1) + nPecas * (CFG.fretePesoPecaKg || 0.4), extra = Math.max(0, Math.ceil(peso - 1 - 1e-9));
    var ops = ['pac', 'sedex'].map(function (k) {
      var r = tab[k], v = Math.round((r.preco + extra * (r.kgAdicional || 0)) * 100) / 100;
      return { servico_id: 'tabela-' + k, empresa: 'Correios', nome: k.toUpperCase(), preco: v, preco_original: v, gratis: false,
        prazo_texto: (r.prazo[0] === r.prazo[1] ? r.prazo[0] : r.prazo[0] + ' a ' + r.prazo[1]) + ' dias úteis', estimado: true };
    }).sort(function (a, b) { return a.preco - b.preco; });
    if (gratisMin() && subtotal >= gratisMin()) { ops[0].gratis = true; ops[0].preco = 0; }
    return ops;
  }
  // cota para uma lista de itens [{codigo,qtd}] -> Promise<{opcoes, destino, estimado, aviso, falta, tabela}>
  function cotar(cep, itens) {
    var sub = itens.reduce(function (s, i) { return s + (porCodigo[i.codigo] ? porCodigo[i.codigo].preco * i.qtd : 0); }, 0);
    var n = itens.reduce(function (s, i) { return s + i.qtd; }, 0);
    return apiCall('/frete', { cep_destino: cep, itens: itens.map(function (i) { return { codigo: i.codigo, qtd: i.qtd }; }) }, 15000).then(function (d) {
      return { opcoes: d.opcoes || [], destino: d.destino || null, estimado: !!d.estimado, aviso: d.aviso || '', falta: d.falta_para_frete_gratis, tabela: false };
    }, function (e) {
      if (!e.rede && e.status && e.status < 500) throw e;          // CEP inválido / não encontrado etc.
      return viaCep(cep).catch(function (x) { if (x && x.naoExiste) throw { erro: 'CEP não encontrado. Confira os números.' }; return null; }).then(function (dest) {
        return { opcoes: cotarTabela(cep, dest && dest.uf, n, sub), destino: dest, estimado: true, tabela: true,
          aviso: 'Frete estimado pela tabela da loja — confirmamos o valor no WhatsApp.', falta: Math.max(0, gratisMin() - sub) };
      });
    });
  }
  function aplicarDestino(d) { if (!d) return; frete.cidade = d.cidade || ''; frete.uf = d.uf || ''; frete.bairro = d.bairro || ''; frete.rua = d.rua || ''; }
  function cotarSacola(cep, force) {
    cep = digits(cep || frete.cep);
    if (cep.length !== 8) { frete.err = 'Digite os 8 números do CEP.'; renderCart(); return; }
    var sig = cartSig() + '|' + cep;
    if (!force && frete.sig === sig && frete.opcoes) return;
    if (!force && frete.badCep === cep) return;
    if (!validLines().length) return;
    frete.busy = true; frete.err = ''; frete.cep = cep; frete.sig = sig; renderCart();
    var itens = validLines().map(function (l) { return { codigo: l.codigo, qtd: l.qtd }; });
    cotar(cep, itens).then(function (r) {
      if (frete.sig !== sig) return;
      frete.badCep = null;
      var tinhaGratis = (frete.opcoes || []).some(function (o) { return o.gratis; });
      if (r.opcoes[0] && r.opcoes[0].gratis && !tinhaGratis) frete.servico = r.opcoes[0].servico_id;   // passou do mínimo: já marca a entrega grátis
      frete.opcoes = r.opcoes; frete.estimado = r.estimado; frete.aviso = r.aviso; frete.tabela = r.tabela; frete.falta = r.falta;
      aplicarDestino(r.destino);
      if (!frete.opcoes.some(function (o) { return String(o.servico_id) === String(frete.servico); })) frete.servico = frete.opcoes.length ? frete.opcoes[0].servico_id : null;
      saveFrete(); fillAddressFromFrete(false);
    }).catch(function (e) {
      if (frete.sig !== sig) return;
      frete.opcoes = null; frete.err = (e && e.erro) || 'Não foi possível calcular o frete agora.';
      if (e && e.status && e.status < 500) frete.badCep = cep;   // não fica recotando um CEP que o servidor recusou
    }).then(function () { if (frete.sig === sig) { frete.busy = false; renderCart(); } });
  }
  function opcaoEscolhida() {
    if (!frete.opcoes) return null;
    return frete.opcoes.filter(function (o) { return String(o.servico_id) === String(frete.servico); })[0] || null;
  }
  function nomeOpcao(o) { return (o.empresa && o.empresa !== o.nome ? o.empresa + ' ' : '') + o.nome; }
  function opcoesHtml(ops, name, selected, selectable) {
    return '<div class="frete__ops" role="' + (selectable ? 'radiogroup' : 'list') + '" aria-label="Opções de entrega">' + ops.map(function (o) {
      var on = selectable && String(o.servico_id) === String(selected);
      var inner = (o.empresa_logo ? '<img class="frete__logo" src="' + esc(o.empresa_logo) + '" alt="" loading="lazy" width="40" height="20">' : '') +
        '<span class="frete__name">' + esc(nomeOpcao(o)) + '<small>' + esc(o.prazo_texto || '') + '</small></span>' +
        '<span class="frete__val">' + (o.gratis ? '<s>' + money(o.preco_original) + '</s> Grátis' : money(o.preco)) + '</span>';
      return selectable
        ? '<label class="frete__op' + (on ? ' is-on' : '') + (o.gratis ? ' is-free' : '') + '"><input type="radio" name="' + name + '" value="' + esc(o.servico_id) + '"' + (on ? ' checked' : '') + '>' + inner + '</label>'
        : '<div class="frete__op' + (o.gratis ? ' is-free' : '') + '" role="listitem">' + inner + '</div>';
    }).join('') + '</div>';
  }
  function freteProgress(subtotal, faltaServidor) {
    var g = gratisMin(); if (!g) return '';
    var falta = faltaServidor != null ? faltaServidor : g - subtotal, pct = Math.max(4, Math.min(100, subtotal / g * 100));
    return '<div class="freebar' + (falta <= 0 ? ' is-done' : '') + '"><p>' + (falta > 0 ? 'Faltam <strong>' + money(falta) + '</strong> para frete grátis' : '<strong>Você ganhou frete grátis!</strong> A entrega mais barata sai por nossa conta.') + '</p>' +
      '<span class="freebar__track"><span style="width:' + pct.toFixed(1) + '%"></span></span></div>';
  }

  /* ---------------- texto do pedido (WhatsApp) ---------------- */
  function buildOrderText(lines) {
    var linhas = (lines || validLines()).filter(function (l) { return porCodigo[l.codigo]; });
    var soma = linhas.reduce(function (s, l) { return s + porCodigo[l.codigo].preco * l.qtd; }, 0);
    var t = 'Olá! Quero fazer este pedido pelo site da ' + (CFG.nomeLoja || 'CWB Moda Fitness') + ':\n\n';
    linhas.forEach(function (l, i) {
      var p = porCodigo[l.codigo];
      t += (i + 1) + ') ' + p.codigo + ' – ' + p.nome + '\n   Tamanho: ' + l.tamanho + ' | Cor: ' + l.cor + ' | Qtd: ' + l.qtd + '\n';
      t += '   ' + money(p.preco) + (l.qtd > 1 ? ' cada = ' + money(p.preco * l.qtd) : '') + '\n';
    });
    t += '\nProdutos: ' + money(soma) + '\n';
    var op = !lines ? opcaoEscolhida() : null;
    if (op) {
      t += 'Entrega: CEP ' + fmtCep(frete.cep) + (frete.cidade ? ' – ' + frete.cidade + '/' + frete.uf : '') + '\n';
      t += 'Frete: ' + nomeOpcao(op) + ' (' + op.prazo_texto + '): ' + (op.gratis ? 'GRÁTIS' : money(op.preco)) + (op.estimado ? ' (estimativa — confirmar no WhatsApp)' : '') + '\n';
      t += 'Total com frete: ' + money(soma + (op.gratis ? 0 : op.preco)) + '\n';
    } else t += 'Frete: a calcular (vou informar meu CEP)\n';
    var c = readForm(true);
    t += '\nMeu nome: ' + (c.nome || '') + '\n';
    if (c.rua && c.numero) t += 'Endereço: ' + c.rua + ', ' + c.numero + (c.complemento ? ' – ' + c.complemento : '') + ' – ' + (c.bairro || '') + ' – ' + (c.cidade || '') + '/' + (c.uf || '') + '\n';
    else t += 'Endereço (rua, número, bairro):\n';
    t += 'Forma de pagamento (Pix ou cartão):\n';
    return t;
  }
  function openTab(url) { var w = window.open(url, '_blank'); if (w) { try { w.opener = null; } catch (e) {} } return w; }
  function sendWhatsApp(text) {
    if (hasWa()) { var url = waUrl(text), w = openTab(url); if (!w) window.location.href = url; return; }
    var w2 = openTab(igDirect()); if (!w2) window.location.href = igDirect();
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
      return !q || norm(p.codigo).indexOf(q) !== -1 || norm(p.nome).indexOf(q) !== -1;
    });
  }
  function catName(id) { var c = CATS.filter(function (x) { return x[0] === id; })[0]; return c ? c[1] : ''; }
  function renderGrid() {
    var list = filtered();
    $('#resultInfo').textContent = list.length + (list.length === 1 ? ' peça' : ' peças') + (estado.cat !== 'todos' ? ' em ' + catName(estado.cat) : '') + (estado.q ? ' para "' + estado.q + '"' : '');
    if (!list.length) { $('#grid').innerHTML = '<p class="empty">Nenhuma peça encontrada. Confira o código ou escolha outra categoria.</p>'; return; }
    $('#grid').innerHTML = list.map(function (p, i) {
      return '<article class="card" data-codigo="' + esc(p.codigo) + '">' +
        '<button class="card__img" data-open="' + esc(p.codigo) + '" aria-label="Ver ' + esc(p.nome) + ' ' + esc(p.codigo) + '">' +
        '<img src="img/t/' + p.fotos[0] + '.webp" alt="' + esc(p.nome) + ' – ' + esc(p.codigo) + '" width="400" height="400" ' + (i < 4 ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async">' +
        (p.fotos.length > 1 ? '<span class="card__tag">' + p.fotos.length + ' fotos</span>' : '') + '</button>' +
        '<div class="card__body"><h3 class="card__name">' + esc(p.nome) + '</h3><span class="card__code">Cód. ' + esc(p.codigo) + '</span>' +
        '<span class="card__price">' + money(p.preco) + '</span><button class="card__btn" data-open="' + esc(p.codigo) + '">Ver detalhes</button></div></article>';
    }).join('');
  }

  /* ---------------- página da peça ---------------- */
  var openedByClick = false, currentCode = null, pmFrete = { sig: '', busy: false, err: '', r: null };
  function openProduct(codigo, push) {
    var p = porCodigo[codigo]; if (!p) return;
    currentCode = codigo; pmFrete = { sig: '', busy: false, err: '', r: null };
    if (push) { openedByClick = true; history.pushState({ p: codigo }, '', '#p/' + encodeURIComponent(codigo)); }
    var multi = p.cores.length > 1, cores = multi ? p.cores : p.cores.concat([OUTRA_COR]);
    $('#pmBody').innerHTML =
      '<div class="pm__gallery"><img class="pm__main" id="pmMain" src="img/p/' + p.fotos[0] + '.webp" alt="' + esc(p.nome) + ' – ' + esc(p.codigo) + '" width="1000" height="1000">' +
      (p.fotos.length > 1 ? '<div class="pm__thumbs">' + p.fotos.map(function (f, i) {
        return '<button data-foto="' + f + '" aria-label="Foto ' + (i + 1) + '" aria-current="' + (i === 0) + '"><img src="img/t/' + f + '.webp" alt="" loading="lazy"></button>';
      }).join('') + '</div>' : '') + '</div>' +
      '<div class="pm__info"><span class="pm__code">Cód. ' + esc(p.codigo) + ' · ' + esc(catName(p.categoria)) + '</span>' +
      '<h2 class="pm__title" id="pmTitle">' + esc(p.nome) + '</h2><div class="pm__price">' + money(p.preco) + '</div>' +
      '<p class="pm__desc">' + esc(p.descricao) + '</p>' +
      '<div class="field"><span class="field__label">Tamanho</span><div class="sizes" id="pmSizes">' +
      p.tamanhos.map(function (t) { return '<button class="size" data-size="' + esc(t) + '" aria-pressed="false">' + esc(t) + '</button>'; }).join('') +
      '</div><p class="hint">P, M e G: tecido com elasticidade que se ajusta ao corpo.</p></div>' +
      '<div class="field"><label class="field__label" for="pmCor">' + (multi ? 'Cor' : 'Cor desejada') + '</label>' +
      '<select class="select" id="pmCor">' + (multi ? '<option value="">Escolha a cor</option>' : '') +
      cores.map(function (c) { return '<option value="' + esc(c) + '">' + esc(cap(c)) + '</option>'; }).join('') + '</select>' +
      '<p class="hint">Disponibilidade de cor e tamanho confirmada após o pedido.</p></div>' +
      '<div class="field"><span class="field__label">Quantidade</span><div class="qty"><button data-q="-1" aria-label="Diminuir">−</button>' +
      '<input id="pmQty" type="number" min="1" max="99" value="1" inputmode="numeric" aria-label="Quantidade"><button data-q="1" aria-label="Aumentar">+</button></div></div>' +
      '<p class="err" id="pmErr" hidden></p>' +
      '<button class="btn btn--grad btn--block" id="pmAdd">Adicionar à sacola</button>' +
      '<p class="pm__pay">Pague com Pix, cartão ou boleto no Mercado Pago, com o frete incluso, ou finalize pelo WhatsApp.</p>' +
      '<div id="pmFrete"></div></div>';
    renderPmFrete();
    var m = $('#productModal'); m.hidden = false; document.body.classList.add('lock');
    $('.modal__panel', m).scrollTop = 0;
    document.title = p.nome + ' ' + p.codigo + ' | ' + (CFG.nomeLoja || 'CWB Moda Fitness');
    setTimeout(function () { var b = $('.close-btn', m); if (b) b.focus({ preventScroll: true }); }, 30);
  }
  function pmQty() { var i = $('#pmQty'); return Math.max(1, Math.min(99, parseInt(i && i.value, 10) || 1)); }
  function renderPmFrete() {
    var box = $('#pmFrete'), p = porCodigo[currentCode]; if (!box || !p) return;
    var r = pmFrete.r;
    box.innerHTML = '<div class="frete" data-frete="pm"><label class="field__label" for="cep_pm">Calcular frete</label>' +
      '<div class="cep-row"><input class="cep-input" id="cep_pm" type="text" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="Seu CEP (00000-000)" value="' + esc(fmtCep(frete.cep || '')) + '">' +
      '<button type="button" class="cep-btn" data-cep-calc' + (pmFrete.busy ? ' disabled' : '') + '>' + (pmFrete.busy ? 'Calculando…' : 'Calcular') + '</button></div>' +
      '<a class="cep-help" href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener">Não sei meu CEP</a>' +
      (pmFrete.err ? '<p class="err cep-err">' + esc(pmFrete.err) + '</p>' : '') +
      (r ? '<p class="frete__dest">Entrega em <strong>' + esc(frete.cidade ? frete.cidade + '/' + frete.uf : fmtCep(frete.cep)) + '</strong> · ' + pmQty() + (pmQty() > 1 ? ' peças' : ' peça') + '</p>' +
        opcoesHtml(r.opcoes, 'frete_pm', null, false) + (r.estimado ? '<p class="frete__note">' + esc(r.aviso || 'Frete estimado.') + '</p>' : '<p class="frete__note">Você escolhe a entrega na sacola.</p>') : '') +
      '</div>' + (gratisMin() ? '<p class="hint free-hint">Frete grátis em compras a partir de ' + money(gratisMin()) + ' (na entrega mais barata).</p>' : '');
  }
  function cotarPm(cep) {
    cep = digits(cep); var p = porCodigo[currentCode]; if (!p) return;
    if (cep.length !== 8) { pmFrete.err = 'Digite os 8 números do CEP.'; renderPmFrete(); return; }
    var sig = cep + '|' + pmQty(); if (pmFrete.sig === sig && pmFrete.r) return;
    pmFrete.sig = sig; pmFrete.busy = true; pmFrete.err = ''; renderPmFrete();
    cotar(cep, [{ codigo: p.codigo, qtd: pmQty() }]).then(function (r) {
      if (pmFrete.sig !== sig) return;
      pmFrete.r = r; frete.cep = cep; aplicarDestino(r.destino); saveFrete();
    }).catch(function (e) { if (pmFrete.sig === sig) { pmFrete.r = null; pmFrete.err = (e && e.erro) || 'Não foi possível calcular o frete agora.'; } })
      .then(function () { if (pmFrete.sig === sig) { pmFrete.busy = false; renderPmFrete(); } });
  }
  function closeProduct(fromHistory) {
    var m = $('#productModal'); if (m.hidden) return;
    m.hidden = true; if ($('#cartDrawer').hidden && $('#orderPanel').hidden) document.body.classList.remove('lock');
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

  /* ---------------- formulário de entrega ---------------- */
  var cliente = load(CLIENTE_KEY, {}) || {};
  try { cliente.cpf = sessionStorage.getItem('cwb_cpf') || ''; } catch (e) {}
  var FIELDS = [
    ['nome', 'Nome e sobrenome', 'text', 'name', 'full'], ['email', 'E-mail', 'email', 'email', 'full'],
    ['telefone', 'WhatsApp / telefone', 'tel', 'tel', 'half'], ['cpf', 'CPF', 'text', 'off', 'half'],
    ['cep', 'CEP', 'text', 'postal-code', 'half'], ['numero', 'Número', 'text', 'address-line2', 'half'],
    ['rua', 'Rua / avenida', 'text', 'address-line1', 'full'], ['complemento', 'Complemento (opcional)', 'text', 'off', 'full'],
    ['bairro', 'Bairro', 'text', 'off', 'full'], ['cidade', 'Cidade', 'text', 'address-level2', 'twothirds'], ['uf', 'UF', 'text', 'address-level1', 'third']
  ];
  var fieldErr = {};
  function cpfValido(c) {
    c = digits(c); if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    for (var t = 9; t <= 10; t++) { var s = 0; for (var i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i); if (((s * 10) % 11) % 10 !== Number(c[t])) return false; }
    return true;
  }
  function maskCpf(v) { v = digits(v).slice(0, 11); return v.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2'); }
  function maskTel(v) { v = digits(v); if (v.length > 11 && v.indexOf('55') === 0) v = v.slice(2); v = v.slice(0, 11);
    return v.length > 10 ? v.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3') : v.replace(/^(\d{2})(\d{0,4})(\d{0,4}).*/, function (m, a, b, c) { return '(' + a + ') ' + b + (c ? '-' + c : ''); }); }
  function validar(c) {
    var e = {};
    if (!/\S+\s+\S+/.test(c.nome || '')) e.nome = 'Digite nome e sobrenome.';
    if (!/^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i.test(c.email || '')) e.email = 'E-mail inválido.';
    var tel = digits(c.telefone); if (tel.length > 11 && tel.indexOf('55') === 0) tel = tel.slice(2);
    if (tel.length < 10 || tel.length > 11) e.telefone = 'Celular com DDD (ex.: 41 99999-9999).';
    if (!cpfValido(c.cpf)) e.cpf = 'CPF inválido. Confira os números.';
    if (digits(c.cep).length !== 8) e.cep = 'CEP com 8 números.';
    if (!(c.rua || '').trim()) e.rua = 'Informe a rua.';
    if (!(c.numero || '').trim()) e.numero = 'Informe o número (ou S/N).';
    if (!(c.bairro || '').trim()) e.bairro = 'Informe o bairro.';
    if (!(c.cidade || '').trim()) e.cidade = 'Informe a cidade.';
    if (!/^[A-Za-z]{2}$/.test((c.uf || '').trim())) e.uf = 'UF';
    return e;
  }
  function readForm(soft) {
    var f = $('#checkoutForm'); if (!f) return cliente;
    FIELDS.forEach(function (d) { var i = f.elements[d[0]]; if (i) cliente[d[0]] = i.value.trim(); });
    if (cliente.uf) cliente.uf = cliente.uf.toUpperCase();
    var keep = {}; Object.keys(cliente).forEach(function (k) { if (k !== 'cpf') keep[k] = cliente[k]; });
    save(CLIENTE_KEY, keep); try { sessionStorage.setItem('cwb_cpf', cliente.cpf || ''); } catch (e) {}
    return cliente;
  }
  function fillAddressFromFrete(overwrite) {
    if (!cliente.cep || digits(cliente.cep) !== frete.cep) { cliente.cep = fmtCep(frete.cep || ''); overwrite = true; }
    ['rua', 'bairro', 'cidade', 'uf'].forEach(function (k) { if (frete[k] && (overwrite || !cliente[k])) cliente[k] = frete[k]; });
  }
  function formHtml() {
    var c = cliente;
    return '<form class="coform" id="checkoutForm" novalidate>' + FIELDS.map(function (d) {
      var k = d[0], val = k === 'cpf' ? maskCpf(c.cpf || '') : k === 'telefone' ? (c.telefone || '') : k === 'cep' ? fmtCep(c.cep || '') : (c[k] || '');
      var extra = k === 'cpf' || k === 'cep' ? ' inputmode="numeric"' : '';
      if (k === 'cpf') extra += ' maxlength="14"'; if (k === 'cep') extra += ' maxlength="9"'; if (k === 'uf') extra += ' maxlength="2"';
      return '<div class="f f--' + d[4] + (fieldErr[k] ? ' f--err' : '') + '"><label for="co_' + k + '">' + d[1] + (k === 'cpf' ? ' <small>(para a nota da entrega)</small>' : '') + '</label>' +
        '<input id="co_' + k + '" name="' + k + '" type="' + d[2] + '" autocomplete="' + d[3] + '"' + extra + ' value="' + esc(val) + '"' + (k === 'complemento' ? '' : ' required') + '>' +
        (fieldErr[k] ? '<p class="f__err">' + esc(fieldErr[k]) + '</p>' : '') + '</div>';
    }).join('') + '<button type="submit" hidden></button></form>';
  }

  /* ---------------- sacola (gaveta) ---------------- */
  var cartStep = 1, payBusy = false, payMsg = null;   // payMsg: {tipo, texto}
  function openCart(step) {
    cartStep = step || 1; payMsg = null; renderCart(); $('#cartDrawer').hidden = false; document.body.classList.add('lock');
    if (frete.cep && validLines().length) cotarSacola(frete.cep);
  }
  function closeCart() { $('#cartDrawer').hidden = true; if ($('#productModal').hidden && $('#orderPanel').hidden) document.body.classList.remove('lock'); }
  function setStep(n) { if (cartStep === 2) readForm(true); cartStep = n; payMsg = null; renderCart(); $('#cartItems').scrollTop = 0; }
  function online() { return api.online !== false && !frete.tabela; }
  function hasOutraCor() { return validLines().some(function (l) { return /^outra cor/i.test(l.cor); }); }
  function renderCart() {
    var linhas = validLines(), body = $('#cartItems'), sub = total(), op = opcaoEscolhida();
    $('#cartFoot').hidden = linhas.length === 0;
    $('#cartBack').hidden = cartStep !== 2;
    $('#cartTitle').textContent = cartStep === 2 ? 'Entrega e pagamento' : 'Sua sacola';
    $$('.cart-steps li').forEach(function (li, i) { li.classList.toggle('on', i + 1 === cartStep); });
    if (!linhas.length) {
      cartStep = 1; $('#cartBack').hidden = true;
      body.innerHTML = '<div class="cart-empty"><p>Sua sacola está vazia.</p><button class="btn btn--grad" data-close-cart>Ver catálogo</button></div>'; return;
    }
    if (frete.cep && frete.cep !== frete.badCep && cartSig() + '|' + frete.cep !== frete.sig && !frete.busy) setTimeout(function () { cotarSacola(frete.cep); }, 0);
    var freteBox = '<div class="frete" data-frete="cart">' +
      (cartStep === 1 ? '<label class="field__label" for="cep_cart">Calcular frete</label>' +
        '<div class="cep-row"><input class="cep-input" id="cep_cart" type="text" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="Seu CEP (00000-000)" value="' + esc(fmtCep(frete.cep || '')) + '">' +
        '<button type="button" class="cep-btn" data-cep-calc' + (frete.busy ? ' disabled' : '') + '>' + (frete.busy ? 'Calculando…' : 'Calcular') + '</button></div>' +
        '<a class="cep-help" href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener">Não sei meu CEP</a>'
        : '<span class="field__label">Entrega para o CEP ' + esc(fmtCep(frete.cep || '')) + '</span>') +
      (frete.err ? '<p class="err cep-err">' + esc(frete.err) + '</p>' : '') +
      (frete.busy ? '<div class="frete__loading"><span class="spin"></span>Buscando as melhores entregas…</div>' : '') +
      (!frete.busy && frete.opcoes ? (frete.cidade && cartStep === 1 ? '<p class="frete__dest">Entrega em <strong>' + esc(frete.cidade + '/' + frete.uf) + '</strong></p>' : '') +
        (frete.opcoes.length ? opcoesHtml(frete.opcoes, 'frete_cart', frete.servico, true) : '<p class="err">Nenhuma entrega disponível para este CEP. Fale com a gente no WhatsApp.</p>') +
        (frete.estimado ? '<p class="frete__note">' + esc(frete.aviso || 'Frete estimado — confirmamos o valor no WhatsApp.') + '</p>' : '<p class="frete__note">Prazos em dias úteis após a postagem.</p>') : '') +
      '</div>';
    if (cartStep === 1) {
      body.innerHTML = linhas.map(function (l) {
        var p = porCodigo[l.codigo];
        return '<div class="line" data-key="' + esc(l.key) + '"><img src="img/t/' + p.fotos[0] + '.webp" alt="" loading="lazy">' +
          '<div><p class="line__name">' + esc(p.nome) + '</p><p class="line__meta">Cód. ' + esc(p.codigo) + ' · Tam. ' + esc(l.tamanho) + ' · ' + esc(cap(l.cor)) + '</p>' +
          '<div class="line__row"><div class="qty"><button data-lq="-1" aria-label="Diminuir">−</button><input type="number" min="1" max="99" value="' + l.qtd + '" data-lqi aria-label="Quantidade"><button data-lq="1" aria-label="Aumentar">+</button></div>' +
          '<span class="line__price">' + money(p.preco * l.qtd) + '</span></div><button class="remove" data-remove>Remover</button></div></div>';
      }).join('') + '<div class="cart-frete">' + freteProgress(sub, frete.opcoes && !frete.busy ? frete.falta : null) + freteBox + '</div>';
    } else {
      body.innerHTML = '<div class="co-summary"><span>' + pecas() + (pecas() > 1 ? ' peças' : ' peça') + ' · ' + money(sub) + '</span><button type="button" class="link-btn" data-step="1">Editar sacola</button></div>' +
        formHtml() + freteBox;
    }
    // resumo e botões
    var freteVal = op ? (op.gratis ? 0 : op.preco) : 0;
    $('#cartSubtotal').textContent = money(sub);
    $('#cartFreteLabel').textContent = op ? 'Frete · ' + nomeOpcao(op) : 'Frete';
    $('#cartFrete').textContent = op ? (op.gratis ? 'Grátis' : money(op.preco)) : (frete.busy ? 'Calculando…' : 'Informe o CEP');
    $('#cartFrete').classList.toggle('is-free', !!(op && op.gratis));
    $('#cartTotal').textContent = money(sub + freteVal);
    $('#cartTotalLabel').textContent = op ? 'Total com frete' : 'Total sem frete';
    $('#shipNote').textContent = op ? (op.estimado ? 'Frete estimado — confirmamos o valor no WhatsApp.' : 'Entrega ' + op.prazo_texto + ' após a postagem.') : 'Calcule o frete pelo CEP para ver o total.';
    var canPay = online() && op && !frete.busy && !hasOutraCor();
    var next = $('#cartNext'), pay = $('#checkoutMp');
    next.hidden = cartStep !== 1 || !online(); pay.hidden = cartStep !== 2;
    next.disabled = !op || frete.busy;
    next.textContent = op ? 'Continuar para entrega e pagamento' : 'Calcule o frete para continuar';
    pay.disabled = !canPay || payBusy;
    pay.innerHTML = payBusy ? '<span class="spin spin--light"></span>Gerando pagamento seguro…' : 'Pagar com Mercado Pago · ' + money(sub + freteVal);
    $('#mpSecure').hidden = !online() || cartStep !== 2;
    $('#altContact').hidden = cartStep === 2;
    $('#legalNote').hidden = cartStep !== 2 || !online();
    var msg = payMsg;
    if (!msg && hasOutraCor() && online()) msg = { tipo: 'aviso', texto: 'Uma peça está com "outra cor". Para pagar online, escolha uma das cores da peça ou finalize pelo WhatsApp.' };
    if (!msg && api.online === false) msg = { tipo: 'aviso', texto: 'Pagamento online indisponível no momento. Finalize pelo WhatsApp: respondemos rapidinho.' };
    else if (!msg && frete.tabela && frete.opcoes) msg = { tipo: 'aviso', texto: 'Não conseguimos falar com o sistema de pagamento agora. Finalize pelo WhatsApp ou tente de novo em instantes.' };
    var pm = $('#payMsg'); pm.hidden = !msg; if (msg) { pm.className = 'pay-msg pay-msg--' + msg.tipo; pm.innerHTML = msg.html || esc(msg.texto); }
    $('#checkoutWaLabel').textContent = online() ? 'Prefiro finalizar pelo WhatsApp' : 'Finalizar pelo WhatsApp';
    $('#checkoutWa').className = 'btn ' + (online() ? 'btn--wa-outline' : 'btn--wa') + ' btn--block';
  }
  function setLineQty(key, q) { cart.forEach(function (l) { if (l.key === key) l.qtd = Math.max(1, Math.min(99, q || 1)); }); saveCart(); renderCart(); }

  /* ---------------- pagar (Mercado Pago via backend) ---------------- */
  function pagar() {
    if (payBusy) return;
    var c = readForm(); fieldErr = validar(c);
    var op = opcaoEscolhida();
    if (Object.keys(fieldErr).length) {
      payMsg = { tipo: 'erro', texto: 'Confira os campos destacados.' }; renderCart();
      var first = $('#checkoutForm .f--err input'); if (first) { first.focus(); first.scrollIntoView({ block: 'center' }); }
      return;
    }
    if (digits(c.cep) !== frete.cep || !op) {      // CEP do endereço mudou: recotar e escolher de novo
      payMsg = { tipo: 'aviso', texto: 'O CEP mudou: confira e escolha a entrega de novo.' };
      frete.servico = null; cotarSacola(c.cep, true); return;
    }
    payBusy = true; payMsg = null; renderCart();
    var body = {
      itens: validLines().map(function (l) { var p = porCodigo[l.codigo]; return { codigo: l.codigo, nome: p.nome, tamanho: l.tamanho, cor: l.cor, qtd: l.qtd }; }),
      frete: { servico_id: op.servico_id, preco: op.gratis ? 0 : op.preco },
      cliente: { nome: c.nome, email: c.email, telefone: c.telefone, cpf: c.cpf, cep: fmtCep(c.cep), rua: c.rua, numero: c.numero, complemento: c.complemento || '', bairro: c.bairro, cidade: c.cidade, uf: (c.uf || '').toUpperCase() }
    };
    apiCall('/checkout', body, 25000).then(function (d) {
      save(PEDIDO_KEY, { id: d.pedido_id, total: d.total, subtotal: d.subtotal, frete: d.frete, itens: body.itens, quando: Date.now() });
      var go = function () { window.__lastInitPoint = d.init_point; if (!window.__noRedirect) window.location.href = d.init_point; };
      if (d.frete_mudou && d.frete) { payMsg = { tipo: 'aviso', texto: 'O frete foi atualizado para ' + (d.frete.gratis ? 'grátis' : money(d.frete.preco)) + '. Abrindo o Mercado Pago…' }; renderCart(); setTimeout(go, 1600); }
      else go();
    }).catch(function (e) {
      payBusy = false; e = e || {};
      if (e.rede) payMsg = { tipo: 'erro', texto: 'Sem conexão com o pagamento. Tente de novo ou finalize pelo WhatsApp.' };
      else if (e.codigo === 'mp_nao_configurado') { api.online = false; payMsg = { tipo: 'aviso', texto: e.erro || 'Pagamento online indisponível. Finalize pelo WhatsApp.' }; }
      else if (e.codigo === 'frete_indisponivel') {
        if (e.opcoes) { frete.opcoes = e.opcoes; frete.servico = e.opcoes.length ? e.opcoes[0].servico_id : null; }
        payMsg = { tipo: 'aviso', texto: e.erro || 'A entrega escolhida mudou. Escolha o frete de novo.' };
      } else if (e.campo && e.campo !== 'frete') { fieldErr = {}; fieldErr[e.campo] = e.erro; payMsg = { tipo: 'erro', texto: e.erro }; }
      else payMsg = { tipo: 'erro', texto: e.erro || 'Não foi possível abrir o pagamento. Tente de novo ou finalize pelo WhatsApp.' };
      renderCart();
      var bad = $('#checkoutForm .f--err input'); if (bad) bad.scrollIntoView({ block: 'center' });
    });
  }

  /* ---------------- volta do Mercado Pago ---------------- */
  function handleReturn() {
    var h = location.hash, m = /^#pedido-(ok|pendente|erro)$/.exec(h); if (!m) return;
    var qs = new URLSearchParams(location.search), id = qs.get('pedido') || '', saved = load(PEDIDO_KEY, null) || {};
    if (!/^CWB-[\w-]{6,40}$/.test(id)) id = saved.id || '';
    history.replaceState(null, '', location.pathname);       // limpa ?pedido=...#pedido-*
    var st = m[1], panel = $('#orderPanel'), totalTxt = saved.id === id && saved.total ? ' · ' + money(saved.total) : '';
    var cfg = {
      ok: { icon: '✓', eyebrow: 'Pagamento aprovado', title: 'Pedido recebido!', msg: 'Obrigada por comprar com a gente! Você vai receber a confirmação e o código de rastreio. Qualquer dúvida, chama no WhatsApp.' },
      pendente: { icon: '⏳', eyebrow: 'Aguardando pagamento', title: 'Quase lá!', msg: 'Se você escolheu Pix ou boleto, é só concluir o pagamento. Assim que ele for confirmado, separamos e enviamos o seu pedido.' },
      erro: { icon: '!', eyebrow: 'Pagamento não concluído', title: 'Não deu certo desta vez', msg: 'O pagamento não foi concluído e nada foi cobrado. Sua sacola continua salva: tente de novo ou finalize pelo WhatsApp.' }
    }[st];
    if (st === 'ok') { cart = []; saveCart(); localStorage.removeItem(PEDIDO_KEY); }
    panel.className = 'modal order order--' + st;
    $('#orderIcon').textContent = cfg.icon; $('#orderEyebrow').textContent = cfg.eyebrow; $('#orderTitle').textContent = cfg.title; $('#orderMsg').textContent = cfg.msg;
    $('#orderId').textContent = id ? 'Pedido ' + id + totalTxt : '';
    var waText = 'Olá! ' + (st === 'ok' ? 'Acabei de pagar o pedido ' : st === 'pendente' ? 'Fiz o pedido ' : 'Tentei pagar o pedido ') + (id || '') + ' pelo site.';
    $('#orderBtns').innerHTML = (st === 'erro' ? '<button class="btn btn--grad" data-retry>Tentar pagar de novo</button>' : '<button class="btn btn--grad" data-close-order>Continuar comprando</button>') +
      (hasWa() ? '<a class="btn btn--wa-outline" href="' + esc(waUrl(waText)) + '" target="_blank" rel="noopener">Falar no WhatsApp</a>' : '');
    panel.hidden = false; document.body.classList.add('lock');
  }
  function closeOrder() { $('#orderPanel').hidden = true; if ($('#productModal').hidden && $('#cartDrawer').hidden) document.body.classList.remove('lock'); }

  var toastTimer;
  function toast(msg, ms) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 2600); }

  /* ---------------- eventos ---------------- */
  function bind() {
    $('#filters').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; estado.cat = b.getAttribute('data-cat'); renderFilters(); renderGrid(); });
    $('#search').addEventListener('input', function (e) { estado.q = e.target.value.trim(); renderGrid(); });
    $('#grid').addEventListener('click', function (e) { var b = e.target.closest('[data-open]'); if (b) openProduct(b.getAttribute('data-open'), true); });
    $('#productModal').addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) return closeProduct(false);
      var f = e.target.closest('[data-foto]');
      if (f) { $('#pmMain').src = 'img/p/' + f.getAttribute('data-foto') + '.webp'; $$('.pm__thumbs button').forEach(function (x) { x.setAttribute('aria-current', x === f); }); }
      var s = e.target.closest('[data-size]');
      if (s) { $$('#pmSizes .size').forEach(function (x) { x.setAttribute('aria-pressed', x === s); }); $('#pmErr').hidden = true; }
      var q = e.target.closest('[data-q]');
      if (q) { var i = $('#pmQty'); i.value = Math.max(1, Math.min(99, (parseInt(i.value, 10) || 1) + parseInt(q.getAttribute('data-q'), 10))); if (pmFrete.r) cotarPm(frete.cep); }
      if (e.target.closest('#pmAdd')) {
        var sel = $('#pmSizes .size[aria-pressed="true"]'), cor = $('#pmCor').value, err = $('#pmErr');
        if (!sel) { err.textContent = 'Escolha o tamanho (P, M ou G).'; err.hidden = false; err.scrollIntoView({ block: 'center' }); return; }
        if (!cor) { err.textContent = 'Escolha a cor.'; err.hidden = false; err.scrollIntoView({ block: 'center' }); return; }
        err.hidden = true;
        addToCart(currentCode, sel.getAttribute('data-size'), cor, pmQty());
        toast('Adicionado à sacola ✓'); closeProduct(false); setTimeout(function () { openCart(1); }, 60);
      }
    });
    $('#productModal').addEventListener('change', function (e) { if (e.target.id === 'pmCor') $('#pmErr').hidden = true; if (e.target.id === 'pmQty' && pmFrete.r) cotarPm(frete.cep); });
    $('#openCart').addEventListener('click', function () { openCart(1); });
    $('#cartDrawer').addEventListener('click', function (e) {
      if (e.target.closest('[data-close-cart]')) return closeCart();
      if (e.target.closest('#cartBack') || e.target.closest('[data-step="1"]')) return setStep(1);
      if (e.target.closest('#cartNext')) { if (opcaoEscolhida()) { fillAddressFromFrete(false); setStep(2); } return; }
      if (e.target.closest('#checkoutMp')) { e.preventDefault(); return pagar(); }
      if (e.target.closest('#checkoutWa')) { if (cartStep === 2) readForm(true); if (validLines().length) sendWhatsApp(buildOrderText()); return; }
      var line = e.target.closest('.line'); if (!line) return;
      var key = line.getAttribute('data-key');
      if (e.target.closest('[data-remove]')) { cart = cart.filter(function (l) { return l.key !== key; }); saveCart(); renderCart(); return; }
      var b = e.target.closest('[data-lq]');
      if (b) { var l = cart.filter(function (x) { return x.key === key; })[0]; setLineQty(key, l.qtd + parseInt(b.getAttribute('data-lq'), 10)); }
    });
    $('#cartDrawer').addEventListener('submit', function (e) { e.preventDefault(); pagar(); });
    $('#cartDrawer').addEventListener('change', function (e) {
      if (e.target.hasAttribute('data-lqi')) setLineQty(e.target.closest('.line').getAttribute('data-key'), parseInt(e.target.value, 10));
      if (e.target.name === 'frete_cart') { frete.servico = e.target.value; saveFrete(); if (cartStep === 2) readForm(true); renderCart(); }
    });
    // máscaras e CEP (peça, sacola e formulário)
    document.addEventListener('input', function (e) {
      var t = e.target; if (!t.classList) return;
      if (t.classList.contains('cep-input')) {
        var v = fmtCep(t.value); if (v !== t.value) t.value = v;
        if (digits(v).length === 8) { if (t.id === 'cep_pm') cotarPm(v); else if (digits(v) !== frete.cep || !frete.opcoes) cotarSacola(v); }
      }
      if (t.form && t.form.id === 'checkoutForm') {
        if (t.name === 'cpf') t.value = maskCpf(t.value);
        if (t.name === 'telefone') t.value = maskTel(t.value);
        if (t.name === 'cep') {
          t.value = fmtCep(t.value);
          if (digits(t.value).length === 8 && digits(t.value) !== frete.cep) {
            readForm(true); var cep = digits(t.value);
            ['rua', 'bairro', 'cidade', 'uf'].forEach(function (k) { cliente[k] = ''; });
            frete.servico = null; payMsg = { tipo: 'aviso', texto: 'Novo CEP: escolha a entrega de novo.' };
            viaCep(cep).then(function (d) { aplicarDestino(d); fillAddressFromFrete(true); if (cartStep === 2) renderCart(); }).catch(function () {});
            cotarSacola(cep, true);
          }
        }
        if (fieldErr[t.name]) { delete fieldErr[t.name]; var box = t.closest('.f'); box.classList.remove('f--err'); var fe = box.querySelector('.f__err'); if (fe) fe.remove(); }
      }
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-cep-calc]'); if (!b) return;
      var inp = b.closest('[data-frete]').querySelector('.cep-input');
      if (inp.id === 'cep_pm') { pmFrete.sig = ''; cotarPm(inp.value); } else cotarSacola(inp.value, true);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('cep-input')) { e.preventDefault(); var c = e.target.closest('[data-frete]').querySelector('[data-cep-calc]'); if (c) c.click(); }
      if (e.key === 'Escape') { if (!$('#orderPanel').hidden) closeOrder(); else if (!$('#cartDrawer').hidden) closeCart(); else closeProduct(false); }
    });
    $('#orderPanel').addEventListener('click', function (e) {
      if (e.target.closest('[data-close-order]')) return closeOrder();
      if (e.target.closest('[data-retry]')) { closeOrder(); openCart(2); }
    });
    window.addEventListener('popstate', routeFromHash);
    window.addEventListener('hashchange', function () { if (/^#pedido-/.test(location.hash)) handleReturn(); else routeFromHash(); });
  }
  function applyConfig() {
    var si = $('#search'); if (si && si.getAttribute('data-ph')) si.setAttribute('placeholder', si.getAttribute('data-ph'));
    var wc = $('#waCta'); if (wc) { if (hasWa()) wc.href = waUrl('Olá! Vim pelo site da ' + (CFG.nomeLoja || 'CWB Moda Fitness') + ' e tenho uma dúvida.'); else wc.hidden = true; }
    var dc = $('#igDirectCta'); if (dc) dc.href = igDirect();
    ['#igLinkTop', '#igLinkHero', '#igLinkFooter'].forEach(function (s) { var el = $(s); if (el) el.href = igUrl(); });
    $('#igLinkFooter').textContent = 'Instagram @' + igHandle();
    $('#altContact').href = igDirect();
    if (CFG.cidade) $('#footerCity').textContent = CFG.cidade;
    if (CFG.textoEnvio) $('#footerNote').textContent = CFG.textoEnvio;
    if (hasWa()) { var n = waNumber(); $('#waFooterItem').hidden = false; $('#waLinkFooter').href = waUrl(''); $('#waLinkFooter').textContent = 'WhatsApp (' + n.slice(2, 4) + ') ' + n.slice(4, n.length - 4) + '-' + n.slice(-4); }
    $('#year').textContent = new Date().getFullYear();
  }
  function init() {
    applyConfig(); bind(); updateCount(); checkHealth();
    fetch('data/produtos.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (data) {
      produtos = data; data.forEach(function (p) { porCodigo[p.codigo] = p; });
      renderFilters(); renderGrid(); updateCount(); routeFromHash(); handleReturn();
    }).catch(function () { $('#grid').innerHTML = '<p class="empty">Não foi possível carregar o catálogo. Atualize a página.</p>'; });
  }
  // exposto para testes
  window.CWB = { buildOrderText: buildOrderText, addToCart: addToCart, cart: function () { return cart; }, total: total, frete: function () { return frete; }, api: api,
    openCart: openCart, openProduct: function (c) { openProduct(c, true); }, cpfValido: cpfValido, opcaoEscolhida: opcaoEscolhida };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
