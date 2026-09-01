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
