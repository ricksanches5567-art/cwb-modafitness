/* =========================================================================
   CONFIGURAÇÕES DA LOJA — CWB Moda Fitness
   Edite só os valores entre aspas. Depois de salvar no GitHub, o site
   atualiza sozinho em 1 ou 2 minutos.
   ⚠️ NUNCA coloque aqui senha, token ou "Access Token" do Mercado Pago:
      este arquivo é público. Use apenas LINKS de pagamento.
   ========================================================================= */
window.LOJA_CONFIG = {
  // Nome da loja (aparece no topo, nas mensagens e no título da página)
  nomeLoja: "CWB Moda Fitness",

  // WhatsApp que recebe os pedidos: 55 + DDD + número, só números.
  // Exemplo: "5541991064167". Se ficar vazio (""), o botão de finalizar
  // abre o Direct do Instagram e copia o pedido para a cliente colar.
  whatsappNumber: "5541991064167",

  // Instagram da loja (sem o @)
  instagram: "cwb_modafitness",

  // Links de pagamento do Mercado Pago, um por FAIXA DE PREÇO (valor fixo).
  // A chave é o preço exatamente como está em data/precos.csv (ex.: "74,90").
  // Cada peça usa o link do seu preço. O botão "Pagar com Mercado Pago"
  // aparece na página da peça e na sacola quando há só 1 peça (quantidade 1).
  // Com mais peças, a cliente finaliza pelo WhatsApp (Pix ou link Mercado Pago).
  // Se mudar um preço no CSV, crie/cole aqui o link do novo valor.
  // Para esconder o Mercado Pago, deixe:  mercadoPagoLinks: {},
  mercadoPagoLinks: {
    "49,90": "https://mpago.la/1ja811w",   // Short poliamida – CWB Moda Fitness
    "64,90": "https://mpago.la/2Dga6aw",   // Legging poliamida – CWB Moda Fitness
    "74,90": "https://mpago.la/2UxwBdm",   // Macaquinho poliamida – CWB Moda Fitness
    "79,90": "https://mpago.la/1SLnsd1",   // Conjunto top + short poliamida – CWB Moda Fitness
    "89,90": "https://mpago.la/1QhajdQ",   // Calça flare poliamida – CWB Moda Fitness
    "94,90": "https://mpago.la/1tE8FAR",   // Conjunto top + legging poliamida – CWB Moda Fitness
    "99,90": "https://mpago.la/2DKbH4H"   // Macacão longo / flare poliamida – CWB Moda Fitness
  },

  // ----------------------------------------------------------------------
  // FRETE (estimativa automática pelo CEP — origem: Curitiba-PR, Correios)
  // Valores de balcão para pacote de até 1 kg (cerca de 2 peças) e prazos
  // em dias úteis após a postagem. Cada kg a mais soma "kgAdicional".
  // Edite à vontade: é só uma ESTIMATIVA; o valor final é confirmado no WhatsApp.
  // ----------------------------------------------------------------------
  freteGratisAcima: 199.90,      // frete grátis (PAC) a partir deste subtotal. Use 0 para desligar.
  fretePesoPecaKg: 0.4,          // peso médio de cada peça embalada
  freteEmbalagemKg: 0.1,         // peso da embalagem
  freteTabela: {
    local:      { nome: "Curitiba e região metropolitana",
                  pac:   { preco: 18.90, prazo: [3, 5],  kgAdicional: 3 },
                  sedex: { preco: 22.90, prazo: [1, 2],  kgAdicional: 4 } },
    pr:         { nome: "Interior do Paraná",
                  pac:   { preco: 22.90, prazo: [4, 7],  kgAdicional: 4 },
                  sedex: { preco: 32.90, prazo: [2, 3],  kgAdicional: 6 } },
    sul_sp:     { nome: "SC, RS e SP",
                  pac:   { preco: 25.90, prazo: [5, 8],  kgAdicional: 5 },
                  sedex: { preco: 41.90, prazo: [2, 4],  kgAdicional: 8 } },
    sudeste_co: { nome: "RJ, MG, ES e Centro-Oeste (DF, GO, MS, MT)",
                  pac:   { preco: 31.90, prazo: [6, 10], kgAdicional: 6 },
                  sedex: { preco: 56.90, prazo: [3, 5],  kgAdicional: 11 } },
    nordeste:   { nome: "Nordeste",
                  pac:   { preco: 41.90, prazo: [8, 13], kgAdicional: 8 },
                  sedex: { preco: 79.90, prazo: [3, 7],  kgAdicional: 16 } },
    norte:      { nome: "Norte",
                  pac:   { preco: 48.90, prazo: [10, 16], kgAdicional: 10 },
                  sedex: { preco: 99.90, prazo: [4, 9],  kgAdicional: 20 } }
  },

  // Cidade e texto de envio (rodapé)
  cidade: "Curitiba – PR",
  textoEnvio: "Envio pelos Correios para todo o Brasil; dúvidas e trocas pelo Direct ou WhatsApp."
};
