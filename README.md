# CWB Moda Fitness – loja online

Site estático (HTML/CSS/JS puro) publicado no GitHub Pages:
https://ricksanches5567-art.github.io/cwb-modafitness/

## Configurar (arquivo `config.js`)
- `whatsappNumber`: número que recebe os pedidos (55 + DDD + número, só números).
- `mercadoPagoLinks`: links de pagamento do Mercado Pago por faixa de preço (chave = preço como no CSV, ex.: `"74,90"`).
  O botão aparece na página da peça e na sacola com 1 peça (quantidade 1). Com mais peças, a cliente
  finaliza pelo WhatsApp (Pix ou link Mercado Pago). `{}` esconde o Mercado Pago.
- `instagram`: usuário do Instagram, sem @.

Nunca coloque token ou senha do Mercado Pago no site: só links de pagamento.

## Mudar preços
1. Edite `data/precos.csv` (separado por `;`, preço no formato `74,90`).
2. Se criar um preço novo, crie o link do Mercado Pago desse valor e coloque em `config.js`.
3. Rode `python3 scripts/build_data.py` para gerar `data/produtos.json`.
4. Faça commit e push.

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

## Frete (estimativa pelo CEP)
- Em `config.js`: `freteTabela` (PAC e SEDEX por região, origem Curitiba, pacote de até 1 kg),
  `freteGratisAcima` (frete grátis PAC a partir desse subtotal; 0 desliga), `fretePesoPecaKg`, `freteEmbalagemKg`.
- A cidade/UF vem da ViaCEP (reserva: BrasilAPI). Se as duas falharem, a região é estimada pela faixa do CEP.
- O valor é sempre uma estimativa: o pedido no WhatsApp leva CEP, cidade/UF, modalidade, frete e total.

## Vídeos e fotos do visual
- `video/hero-*.mp4|webm` (abertura, 9:16 celular / 16:9 computador) e `video/detail-*` (seção Detalhes),
  feitos com ffmpeg a partir das fotos reais das peças (sem IA). Pôsteres: `video/*-poster.webp`.
- `img/film/cap-*.webp`: fotos reais da seção Coleção (animadas no canvas). `img/ed/*.webp`: recortes editoriais.
- Movimento: GSAP + ScrollTrigger + Lenis em `js/vendor/` (locais), lógica em `js/motion.js`.
  Com "reduzir movimento" ligado no celular, tudo fica estático.

## Verificação
`NODE_PATH=<pasta com puppeteer-core>/node_modules node scripts/verify_site.js http://127.0.0.1:8765/cwb-modafitness/ <pasta_prints>`
