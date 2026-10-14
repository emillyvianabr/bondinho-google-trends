# Dashboard Google Trends — Bondinho / Pão de Açúcar

Dashboard estático para GitHub Pages com atualização mensal automática, histórico preservado e planilha para download.

## Publicação

Envie todo o conteúdo desta pasta para a raiz do repositório e configure o GitHub Pages para publicar a branch principal a partir da raiz.

## Atualização automática

No primeiro dia de cada mês, o workflow `.github/workflows/atualizar-dados.yml` executa `scripts/atualizar.py`. Se a coleta ou a validação falhar, nenhum arquivo é substituído e o dashboard continua exibindo a última base válida.

Também é possível executar manualmente em **Actions → Atualizar Google Trends → Run workflow**.

## Histórico

- A série mensal de 2024 em diante permanece em `data/dados.xlsx`.
- Cada execução acrescenta um snapshot à aba `geo_historico`.
- O histórico de versões também fica preservado nos commits do GitHub.

## Contingência manual

Se o pytrends falhar por um período prolongado, envie uma planilha compatível como `data/manual/dados.xlsx`. Enquanto esse arquivo existir, o dashboard lhe dará prioridade. Remova-o para voltar ao modo automático.

## Downloads públicos

O menu **Base de dados** oferece a planilha completa e um CSV que respeita os filtros de mercado e ano.

> O pytrends utiliza endpoints não oficiais do Google Trends e pode precisar de manutenção se o Google alterar o serviço.

## Identidade visual

Combina o **Parque Bondinho Pão de Açúcar** e o **Grupo Iter**:

- **Bondinho:** símbolo e logo oficiais (`assets/bondinho-*.png`) e laranja `#FF6600` como cor principal.
- **Grupo Iter:** logo e etiqueta "Iter Parques", tipografia Stolzl (`assets/fonts/`), texto em `#233744` e acentos teal `#62BAB6` e rosa `#EB4A75` (este último para valores negativos).

As cores dos gráficos ficam no topo de `bondinho-premium.js` e de `comparison-module.js`; as demais em `:root` de `bondinho-premium.css`.

## Balões explicativos ("i")

Os títulos e indicadores com o ícone "i" mostram, ao passar o mouse, tocar ou usar Tab, o que o gráfico mostra e como lê-lo. Os textos ficam em `bondinho-tips.js` (objeto `TIPS`), ligados aos elementos pelo atributo `data-tip` no `index.html`.

## Sazonalidade

O perfil sazonal e o gráfico "Cristo × Bondinho ao longo do ano" usam o mesmo método: cada ano é dividido pela própria média e só anos completos (12 meses) entram; o resultado é a média dos anos para cada mês. Assim, o crescimento do ano e um ano em andamento não viram sazonalidade.

## Mapa-múndi

O mapa do radar internacional é próprio (D3 + `world-map-data.js`, geometria Natural Earth) e substitui o GeoChart do Google, que não permitia zoom e tentava geocodificar nomes de países.

- **Zoom:** botões + / −, duplo clique, Ctrl (⌘) + rolagem, pinça no celular; arraste para mover; atalhos de região e botão para voltar ao mundo.
- **Cores:** escala em raiz quadrada, para realçar as diferenças entre países de menor interesse (o valor exibido no balão é sempre o índice real). Cinza = sem dados.
- **Filtro "Mercado":** o país selecionado fica contornado no mapa.
- **Dados:** o mapa usa o código ISO de 2 letras (`codigo_pais`, aba `geo_2026`). Sem a coluna, tenta identificar o país pelo nome em português.
