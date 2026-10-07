# CWB Moda Fitness – loja online

Site estático (HTML/CSS/JS puro) publicado no GitHub Pages:
https://ricksanches5567-art.github.io/cwb-modafitness/

## Configurar (arquivo `config.js`)
- `whatsappNumber`: número que recebe os pedidos (55 + DDD + número, só números).
- `apiPagamento`: endereço do servidor da loja (Cloudflare Worker, pasta `cwb-pagamento`), que calcula o
  frete em tempo real (`POST /frete`, Melhor Envio) e cria o pagamento do Mercado Pago com peças + frete
  (`POST /checkout`). O servidor recalcula preços e frete; o site nunca guarda token.
- `instagram`: usuário do Instagram, sem @.

Nunca coloque token ou senha do Mercado Pago no site.

## Mudar preços
1. Edite `data/precos.csv` (separado por `;`, preço no formato `74,90`).
2. Rode `python3 scripts/build_data.py` para gerar `data/produtos.json`.
3. Faça commit e push. O servidor de pagamento também precisa da lista nova de produtos (veja o README do `cwb-pagamento`).

## Fotos e cores
`data/produtos_info.csv` define fotos (ex.: `WA0095`), cores e se o modelo tem empina.
Para fotos novas, rode `python3 scripts/process_images.py <pasta_das_fotos_jpg>`
(gera `img/p/*.webp` com até 1000 px e `img/t/*.webp` com até 400 px; desfoca placas de outras lojas
listadas em `BLUR`).

## Testar localmente
```
python3 -m http.server 8000
```
e abra http://localhost:8000

## Frete e pagamento
- Sacola em 2 etapas: (1) peças + CEP → opções reais de entrega (JeT, Jadlog, Correios, Loggi…) com preço e
  prazo, já marcando a mais barata; (2) entrega e pagamento: nome, e-mail, WhatsApp, CPF (obrigatório, com
  dígito verificador), CEP (preenche rua/bairro/cidade/UF), número e complemento → "Pagar com Mercado Pago"
  leva para o checkout do Mercado Pago com o frete incluso.
- Frete grátis na entrega mais barata a partir de R$ 199,90 (valor vem do servidor; `freteGratisAcima` é a reserva).
- **Forma de pagamento** (etapa 2): "Pix (5% de desconto)" ou "Cartão (parcelado) ou boleto". No Pix o Mercado Pago abre
  só com Pix e as peças já com desconto; no cartão/boleto o preço é cheio e o parcelamento continua liberado.
- **Cupom** (etapa 2): campo "Cupom" + "Aplicar" valida no servidor (`POST /cupom`) com o e-mail e o CPF digitados.
  `BEMVINDA10` = 10% OFF nas peças só na primeira compra (CPF/e-mail sem pedido pago). O servidor confere de novo no
  pagamento. Descontos empilham nas peças (subtotal × 0,90 × 0,95, centavos arredondados a cada etapa); frete sem desconto;
  frete grátis pelo subtotal antes dos descontos. O resumo mostra subtotal, cupom, Pix, frete e total.
- Aviso da promoção no topo (hero), na faixa animada e em "Como comprar"; regras em `termos.html` (seção 3).
- Volta do Mercado Pago: `#pedido-ok` (agradece e esvazia a sacola), `#pedido-pendente` (Pix/boleto aguardando),
  `#pedido-erro` (tentar de novo). Os parâmetros somem da URL.
- Se o servidor não responder, a sacola usa `freteTabela` (estimativa por região) e oferece só o WhatsApp.
- Peças com "Outra cor" vão só pelo WhatsApp (o Mercado Pago aceita apenas as cores cadastradas).
- O WhatsApp (botão "Prefiro finalizar pelo WhatsApp") leva peças, CEP, entrega escolhida e total.
- O CPF fica só na sessão do navegador (não é salvo no aparelho).

## Páginas legais
`trocas.html` (arrependimento 7 dias, trocas, defeito), `privacidade.html` (LGPD) e `termos.html`, ligadas no rodapé
e no aviso ao lado do botão de pagamento. Vendedor: CWB Moda Fitness, CNPJ 37.789.447/0001-00, Curitiba – PR.
Para editar, ajuste o texto direto nos arquivos HTML.

## Logo e cores
- Marca do site: símbolo `#logo-mark` (círculo com "cwb" em Fraunces itálico) no `index.html` e `favicon.svg`.
  Paleta em `css/style.css` (`:root`): ameixa escuro, dourado e rosé; fontes Fraunces + Manrope.

## Vídeos e fotos do visual
- `video/hero-*.mp4|webm` (abertura, 9:16 celular / 16:9 computador) e `video/detail-*` (seção Detalhes),
  feitos com ffmpeg a partir das fotos reais das peças (sem IA). Pôsteres: `video/*-poster.webp`.
- `img/film/cap-*.webp`: fotos reais da seção Coleção (animadas no canvas). `img/ed/*.webp`: recortes editoriais.
- Movimento: GSAP + ScrollTrigger + Lenis em `js/vendor/` (locais), lógica em `js/motion.js`.
  Com "reduzir movimento" ligado no celular, tudo fica estático.

## Verificação
`NODE_PATH=<pasta com puppeteer-core>/node_modules node scripts/verify_site.js http://127.0.0.1:8765/cwb-modafitness/ <pasta_prints>`
