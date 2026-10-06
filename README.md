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
- Volta do Mercado Pago: `#pedido-ok` (agradece e esvazia a sacola), `#pedido-pendente` (Pix/boleto aguardando),
  `#pedido-erro` (tentar de novo). Os parâmetros somem da URL.
- Se o servidor não responder, a sacola usa `freteTabela` (estimativa por região) e oferece só o WhatsApp.
- Peças com "Outra cor" vão só pelo WhatsApp (o Mercado Pago aceita apenas as cores cadastradas).
- O WhatsApp (botão "Prefiro finalizar pelo WhatsApp") leva peças, CEP, entrega escolhida e total.
- O CPF fica só na sessão do navegador (não é salvo no aparelho).

## Logo e cores
- Logo do Instagram redesenhado em vetor: `img/logo.svg` (fundo laranja), `img/logo-transparent.svg`, `favicon.svg`
  e o símbolo `#logo-full` / `#logo-fig` dentro do `index.html`. Paleta em `css/style.css` (`:root`): laranja
  `#f09f36`, degradê rosa→coral→laranja→amarelo do logo, preto quente e creme.

## Vídeos e fotos do visual
- `video/hero-*.mp4|webm` (abertura, 9:16 celular / 16:9 computador) e `video/detail-*` (seção Detalhes),
  feitos com ffmpeg a partir das fotos reais das peças (sem IA). Pôsteres: `video/*-poster.webp`.
- `img/film/cap-*.webp`: fotos reais da seção Coleção (animadas no canvas). `img/ed/*.webp`: recortes editoriais.
- Movimento: GSAP + ScrollTrigger + Lenis em `js/vendor/` (locais), lógica em `js/motion.js`.
  Com "reduzir movimento" ligado no celular, tudo fica estático.

## Verificação
`NODE_PATH=<pasta com puppeteer-core>/node_modules node scripts/verify_site.js http://127.0.0.1:8765/cwb-modafitness/ <pasta_prints>`
