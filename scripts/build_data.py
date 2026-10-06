#!/usr/bin/env python3
"""Gera data/produtos.json a partir das planilhas.

Para mudar preços: edite data/precos.csv (coluna "Preço (R$)", ex.: 74,90)
e rode:  python3 scripts/build_data.py

- data/precos.csv         -> Código;Peça;Preço (R$);Tamanhos;Base do preço
- data/produtos_info.csv  -> Código;Fotos;Cores;Empina   (Fotos = fotos originais usadas, informativo)
- scripts/fotos_views.py  -> vistas do carrossel de cada peça (recortes); rode antes
                             scripts/process_images.py, que gera img/p, img/t e data/fotos.json
Produtos sem vistas em fotos_views.py não aparecem no site.
"""
import csv, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def categoria(nome):
    n = nome.lower()
    if 'flare' in n:
        return 'flare'
    if n.startswith('macaquinho'):
        return 'macaquinhos'
    if n.startswith('macacão') or n.startswith('macacao'):
        return 'macacoes'
    if n.startswith('conjunto'):
        return 'conj-legging' if 'legging' in n else 'conj-short'
    return 'leggings-shorts'

def descricao(nome, cat, empina):
    d = [f"{nome} em poliamida."]
    if empina == 'sim':
        d.append("Com efeito empina (franzido no bumbum), que valoriza as curvas.")
    elif empina == 'nao':
        d.append("Modelo sem empina (sem franzido no bumbum).")
    d.append("Ideal para treinar, caminhar ou usar no dia a dia.")
    d.append("Tamanhos P, M e G — o tecido tem elasticidade e se ajusta ao corpo. "
             "Em caso de dúvida sobre o tamanho, fale com a gente antes de finalizar.")
    return ' '.join(d)

def main():
    sys.path.insert(0, os.path.join(ROOT, 'scripts'))
    from fotos_views import VIEWS
    with open(os.path.join(ROOT, 'data', 'fotos.json'), encoding='utf-8') as f:
        fotos_info = json.load(f)
    info = {}
    with open(os.path.join(ROOT, 'data', 'produtos_info.csv'), encoding='utf-8-sig') as f:
        for r in csv.DictReader(f, delimiter=';'):
            info[r['Código'].strip()] = r
    produtos, omitidos = [], []
    with open(os.path.join(ROOT, 'data', 'precos.csv'), encoding='utf-8-sig') as f:
        for r in csv.DictReader(f, delimiter=';'):
            code = r['Código'].strip()
            nome = r['Peça'].strip()
            preco = float(r['Preço (R$)'].strip().replace('.', '').replace(',', '.'))
            tam = [t.strip() for t in r['Tamanhos'].split(',') if t.strip()]
            i = info.get(code)
            fotos = [f'{code}-{n}' for n in range(1, len(VIEWS.get(code, [])) + 1)]
            if not i or not fotos or any(f not in fotos_info for f in fotos):
                omitidos.append(code)
                continue
            cat = categoria(nome)
            empina = (i.get('Empina') or '').strip()
            produtos.append({
                'codigo': code,
                'nome': nome,
                'categoria': cat,
                'preco': round(preco, 2),
                'tamanhos': tam,
                'cores': [c.strip() for c in i['Cores'].split(',') if c.strip()],
                'fotos': fotos,
                'galeria': [{'id': f, 'w': fotos_info[f]['w'], 'h': fotos_info[f]['h'], 'rotulo': fotos_info[f]['rotulo']} for f in fotos],
                'descricao': descricao(nome, cat, empina),
            })
    def key(p):
        m = re.search(r'(\d+)', p['codigo'])
        return (p['codigo'].split('-')[0].upper(), int(m.group(1)) if m else 0)
    produtos.sort(key=key, reverse=True)  # códigos mais novos primeiro
    with open(os.path.join(ROOT, 'data', 'produtos.json'), 'w', encoding='utf-8') as f:
        json.dump(produtos, f, ensure_ascii=False, indent=1)
    print(f"{len(produtos)} produtos gravados em data/produtos.json")
    if omitidos:
        print("Sem foto (fora do site):", ', '.join(omitidos))

if __name__ == '__main__':
    main()
