# Fertilizante Monitor - versão sem pasta src

Projeto React + Vite pronto para subir no GitHub web e publicar na Vercel.

## Estrutura simples
Todos os arquivos do app ficam na raiz:
- App.tsx
- main.tsx
- styles.css
- types.ts
- utils.ts
- index.html
- package.json
- vite.config.ts
- tsconfig.json
- vercel.json
- .gitignore
- .npmrc

## Como subir no GitHub pelo navegador
1. Entre no seu repositório.
2. Apague os arquivos antigos que deram erro, principalmente `package-lock.json`.
3. Clique em **Add file** > **Upload files**.
4. Envie todos os arquivos desta pasta de uma vez.
5. Clique em **Commit changes**.

## Como publicar na Vercel
1. Importe o repositório na Vercel.
2. Framework preset: **Vite**.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Deploy.

## Observação importante
Na planilha 2, a coluna usada como data de aplicação está com o cabeçalho `Data Plantio`, porque foi assim que o arquivo de exemplo veio. O sistema lê essa coluna como a data real de aplicação.
