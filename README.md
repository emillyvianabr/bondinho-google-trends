# Dashboard Google Trends — Parque do Caracol

Dashboard estático para GitHub Pages com atualização mensal automática (mesma arquitetura do dashboard do Bondinho).

## O que é coletado (Brasil, via pytrends)

O Google reescala cada consulta de 0 a 100, então são **6 consultas** por execução:

| Consulta | Itens | Uso no dashboard |
|---|---|---|
| 1 a 5 | cada item **sozinho** (Parque, Skyglass, Snowland, Bondinhos Canela, Pé da Cascata) | filtro, KPIs, tendência, sazonalidade, variação, momentum e volatilidade |
| 6 | os **5 juntos** | ranking e gráfico "Todos juntos" (escala comum) |

**Nunca compare números de consultas diferentes.** A coluna `escala` indica a origem (`propria` ou `comum_todos`).

**Janela:** de 2023-01-01 até o último mês fechado. O pico de cada consulta nessa janela vale 100; quando surge um pico novo, valores antigos podem se ajustar um pouco na atualização seguinte.

## Como os indicadores são calculados

Mesmas definições no dashboard (`caracol-premium.js`) e na planilha (`scripts/atualizar.py`):

- **Sazonalidade:** cada ano é dividido pela própria média; só anos completos (12 meses) entram.
- **Momentum:** média dos últimos 3 meses contra os mesmos meses do ano anterior.
- **Variação anual:** meses equivalentes do ano selecionado contra o anterior (sem ano: últimos 12 meses contra os 12 anteriores).
- **Volatilidade:** desvio dos resíduos em torno da tendência linear, dividido pela média.
- **Baixo volume:** média abaixo de 5 na consulta conjunta (constante `LOW_VOLUME`, nos dois arquivos). Essas séries recebem aviso e `*`.

## Proteção dos dados

- **Snapshot a cada atualização:** antes de substituir `data/dados.xlsx`, a versão anterior é copiada para `data/historico/dados_AAAA-MM-DD.xlsx` (e fica também no histórico do Git).
- **Falha parcial:** se uma consulta falhar, aquela parte mantém a última versão publicada; a aba `status_coleta` mostra o que foi `atualizado` e o que foi `PRESERVADO`, e o Actions mostra um aviso.
- **Falha total ou dados menores que os atuais:** nada é substituído e o workflow aparece como erro.
- **Restaurar uma versão:** copie o snapshot desejado para `data/dados.xlsx` (ou para `data/manual/dados.xlsx`, que tem prioridade) e publique.

## Configurar os temas

Em `scripts/atualizar.py`, bloco `ATRACOES`. Consulta começando com `/m/` ou `/g/` é **tema**; texto puro é **termo**.
Para achar o ID de um tema: Google Trends → digite o nome → escolha a opção marcada como tema → copie o `q=` da URL.

Todos os 5 itens estão configurados como tema.

## Atualização automática

Todo dia 1 de cada mês, às 08:20 UTC / 05:20 em Brasília (`.github/workflows/atualizar-dados.yml`, `cron: "20 8 1 * *"`) ou manualmente em **Actions → Atualizar Google Trends → Run workflow**.
Se a coleta ou a validação falhar, nenhum arquivo é substituído. Ative em Settings → Actions → General → *Read and write permissions*.

## Contingência manual

Envie uma planilha compatível em `data/manual/dados.xlsx`; ela tem prioridade até ser removida.

> O pytrends usa endpoints não oficiais do Google Trends e pode precisar de manutenção.
