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

  // Link de pagamento do Mercado Pago (um único link, ex.: "https://mpago.la/xxxxxx"
  // ou "https://link.mercadopago.com.br/sualoja").
  // Enquanto estiver vazio (""), o botão "Pagar com Mercado Pago" fica escondido.
  // Quando preenchido: o botão mostra o total, abre o link numa nova aba e
  // também envia o pedido pelo WhatsApp para você saber o que foi comprado.
  mercadoPagoLink: "",

  // (Opcional) Links de pagamento por peça, pelo código. Usado quando o
  // carrinho tem uma única peça (quantidade 1) que tenha link aqui.
  // Exemplo:  mercadoPagoLinks: { "YQ-1213": "https://mpago.la/abc123" },
  mercadoPagoLinks: {},

  // Cidade e texto de envio (rodapé)
  cidade: "Curitiba – PR",
  textoEnvio: "Envio pelos Correios para todo o Brasil; dúvidas e trocas pelo Direct ou WhatsApp."
};
