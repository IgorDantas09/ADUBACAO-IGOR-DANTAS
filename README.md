# Monitor de Aplicação de Fertilizantes

Aplicação web em React + Vite pronta para subir no GitHub e publicar na Vercel.

## O que o sistema faz

- Upload de 2 planilhas:
  - **Planilha 1:** plantio e área plantada por data.
  - **Planilha 2:** aplicações de fertilizante por produto.
- Calcula automaticamente a **data determinada de plantio** quando a área plantada acumulada atinge **70% da área total** do talhão.
- Inicia a contagem do **DAE 5 dias após** essa data determinada de plantio.
- Permite cadastrar o **planejamento por produto** com DAE previsto.
- Exibe:
  - gráfico de colunas com **DAE previsto x DAE aplicado**;
  - filtros por visualização, fazenda, talhão e produto;
  - **coeficiente de variação** por aplicação/produto;
  - **variação média em dias**;
  - tabela de apoio.

## Fórmulas usadas

### 1) Data determinada de plantio

Para cada talhão:

```text
% área plantada acumulada = (soma acumulada da Área Plantada(ha) / Área Total(ha)) * 100
```

A primeira data em que esse valor atingir ou ultrapassar **70%** passa a ser a **data determinada de plantio**.

### 2) Início da contagem de DAE

```text
Data base do DAE = Data determinada de plantio + 5 dias
```

### 3) DAE aplicado

```text
DAE aplicado = Data de aplicação - Data base do DAE
```

### 4) Variação média

```text
Variação em dias = DAE realizado - DAE previsto
```

### 5) CV mostrado no painel

```text
CV (%) = desvio padrão da variação em dias / média do DAE previsto * 100
```

## Estrutura esperada das planilhas

### Planilha 1
Colunas esperadas:

- Divisão
- Safra
- Ano Agrícola
- Cultura
- Fazenda
- Talhão
- Variedade
- Data Plantio
- Espaçamento
- Stand
- Área Total(ha)
- Área Plantada(ha)

### Planilha 2
Colunas esperadas:

- Divisão
- Safra
- PRODUTO
- Cultura
- Fazenda
- Talhão
- Variedade
- Data Plantio

> Na planilha 2, a coluna `Data Plantio` está sendo usada como **data de aplicação**, conforme o layout enviado.

## Como rodar localmente

```bash
npm install
npm run dev
```

## Como gerar build

```bash
npm run build
```

## Como publicar no GitHub

1. Crie um repositório novo no GitHub.
2. Envie todos os arquivos desta pasta para o repositório.
3. Commit inicial.

Exemplo:

```bash
git init
git add .
git commit -m "Projeto inicial monitor de fertilizantes"
git branch -M main
git remote add origin SEU_REPOSITORIO_GITHUB
git push -u origin main
```

## Como publicar na Vercel

1. Acesse a Vercel.
2. Clique em **Add New Project**.
3. Conecte o repositório do GitHub.
4. A Vercel detectará automaticamente **Vite**.
5. Clique em **Deploy**.

## Observações

- O planejamento fica salvo no navegador via `localStorage`.
- Os arquivos enviados não são mandados para servidor; o processamento acontece no navegador.
- O filtro **por fazenda** mostra a **média dos talhões da fazenda** para cada produto.
