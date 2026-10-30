/* =========================================================================
   CONFIGURAÇÕES DA LOJA — CWB Moda Fitness
   Edite só os valores entre aspas. Depois de salvar no GitHub, o site
   atualiza sozinho em 1 ou 2 minutos.
   ⚠️ NUNCA coloque aqui senha, token ou "Access Token" do pagamento online:
      este arquivo é público. Use apenas LINKS de pagamento.
   ========================================================================= */
window.LOJA_CONFIG = {
  // Nome da loja (aparece no topo, nas mensagens e no título da página)
  nomeLoja: "CWB Moda Fitness",

  // WhatsApp que recebe os pedidos: 55 + DDD + número, só números.
  // Exemplo: "55". Se ficar vazio (""), o botão de finalizar
  // abre o Direct do Instagram e copia o pedido para a cliente colar.
  whatsappNumber: "",

  // Instagram da loja (sem o @)
  instagram: "cwb_modafitness",

  // ----------------------------------------------------------------------
  // PAGAMENTO ONLINE + FRETE EM TEMPO REAL (servidor da loja no Cloudflare)
  // A sacola consulta /frete (Melhor Envio: JeT, Jadlog, Correios, Loggi…)
  // e o botão "Pagar com pagamento online" chama /checkout, que já cobra
  // peças + frete juntos. Se o servidor não responder, a sacola usa a
  // tabela de frete abaixo como estimativa e oferece o WhatsApp.
  apiPagamento: "https://cwb-modafitness-pagamento.cwbmodafitness.workers.dev",

  // Links fixos antigos do pagamento online (cobravam só a peça, sem frete).
  // NÃO são mais usados pelo site; ficam aqui só como referência:
  //   49,90 https:// · 64,90 https://
  //   74,90 https:// · 79,90 https://
  //   89,90 https:// · 94,90 https://
  //   99,90 https://

  // ----------------------------------------------------------------------
  // FRETE (estimativa automática pelo CEP — origem: Curitiba-PR, Correios)
  // Valores de balcão para pacote de até 1 kg (cerca de 2 peças) e prazos
  // em dias úteis após a postagem. Cada kg a mais soma "kgAdicional".
  // Usada só quando o frete em tempo real não responde (vira ESTIMATIVA,
  // confirmada no WhatsApp).
  // ----------------------------------------------------------------------
  freteGratisAcima: 199.90,      // frete grátis (na entrega mais barata) a partir deste subtotal. O servidor manda o valor oficial.
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
  textoEnvio: "Enviamos para todo o Brasil (Correios, Jadlog, JeT, Loggi); dúvidas e trocas pelo Direct do Instagram."
};
