# CWB Moda Fitness – loja online

Site estático (HTML/CSS/JS puro) publicado no GitHub Pages:
https://ricksanches5567-art.github.io/cwb-modafitness/

## Configurar (arquivo `config.js`)
- `whatsappNumber`: número que recebe os pedidos (55 + DDD + número, só números).
- `mercadoPagoLink`: link de pagamento do Mercado Pago. Vazio = botão escondido.
- `mercadoPagoLinks`: (opcional) links por código de peça.
- `instagram`: usuário do Instagram, sem @.

Nunca coloque token ou senha do Mercado Pago no site: só links de pagamento.

## Mudar preços
1. Edite `data/precos.csv` (separado por `;`, preço no formato `74,90`).
2. Rode `python3 scripts/build_data.py` para gerar `data/produtos.json`.
3. Faça commit e push.

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
