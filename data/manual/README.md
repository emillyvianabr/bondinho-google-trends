# Base manual de contingência

Use esta pasta somente quando a atualização automática do Google Trends falhar.

## Como ativar

1. Envie a planilha para esta pasta.
2. Renomeie o arquivo exatamente para `dados.xlsx`.
3. Preserve a estrutura das abas da planilha oficial.
4. Aguarde a nova publicação do GitHub Pages.

O dashboard detectará `data/manual/dados.xlsx` e usará essa planilha antes da base automática.

## Como voltar ao modo automático

Remova somente `data/manual/dados.xlsx`. Não remova este `README.md` nem `data/dados.xlsx`.

Se a planilha manual estiver ausente ou inválida, o dashboard tentará a base automática e, depois, o fallback embutido em `data.js`.
