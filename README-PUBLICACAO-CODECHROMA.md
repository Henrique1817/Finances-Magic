# Publicação do Learn Music no CodeChroma

Este documento é o guia prático **deste repositório** para manter o projeto visível no site da CodeChroma (catálogo e página rica com mídia). A arquitetura completa do site CodeChroma está descrita em [`README-CODECHROMA.md`](README-CODECHROMA.md).

## O que o CodeChroma usa

1. **GitHub**: repositórios com o **topic** `codechroma` (ou o valor configurado em `GITHUB_PROJECT_TOPIC` no projeto CodeChroma).
2. **Manifesto**: arquivo [`codechroma.project.json`](codechroma.project.json) na **raiz** deste repo, com `slug`, `title`, `links` e `media[]`.
3. **Mídia**: URLs **públicas** (normalmente Vercel Blob, domínio `*.public.blob.vercel-storage.com`), nunca caminhos locais como `/public/...`.

Site de referência: [https://code-chroma.vercel.app](https://code-chroma.vercel.app).

## Checklist rápido

- [ ] Topic `codechroma` no repositório **Learn-Music** no GitHub.
- [ ] `codechroma.project.json` na raiz, JSON válido.
- [ ] Imagens/vídeos enviados ao Blob; `media[].src` (e `poster` em vídeos) apontando para essas URLs.
- [ ] `width` e `height` preenchidos quando souber as dimensões reais (menos layout shift).
- [ ] Após alterar o manifesto: **push** no GitHub e, se quiser atualização imediata no site, **revalidação** (veja abaixo).

## Variáveis e segredos (não commitar)

No projeto **CodeChroma** na Vercel você precisa de, entre outras:

- `REVALIDATE_SECRET`: protege `/api/upload`, `/api/blob` e `/api/revalidate`.
- `BLOB_READ_WRITE_TOKEN`: usado pelo servidor para gravar no Blob.

Guarde o `REVALIDATE_SECRET` só em ambiente seguro (Vercel, 1Password, etc.).

## 1. Enviar imagens (arquivos menores)

Imagens costumam ir pelo endpoint da função:

`POST /api/upload?secret=<REVALIDATE_SECRET>`  
`multipart/form-data`: campo `file` + opcional `project=<slug>` (ex.: `learn-music`).

**PowerShell (use `curl.exe`):**

```powershell
curl.exe -X POST "https://code-chroma.vercel.app/api/upload?secret=<REVALIDATE_SECRET>" `
  -F "file=@C:\Learn-Music\Web\public\image\01_Computer.png" `
  -F "project=learn-music"
```

A resposta é JSON com um campo **`url`**. Use essa URL em `media[].src`.

> Se o arquivo for grande demais, a Vercel pode responder **413** (`FUNCTION_PAYLOAD_TOO_LARGE`). Nesse caso use o fluxo de vídeo/upload direto (próxima seção).

## 2. Enviar vídeos ou arquivos grandes

O fluxo recomendado evita passar o arquivo inteiro pela serverless function:

- Abra no navegador: `https://code-chroma.vercel.app/uploads` e faça o upload guiado; **ou**
- Use o handshake `POST /api/blob?secret=<REVALIDATE_SECRET>` conforme a documentação em [`README-CODECHROMA.md`](README-CODECHROMA.md) (seção de upload grande / exemplos).

O Blob deve devolver uma URL pública para você colar no manifesto.

## 3. Atualizar o `codechroma.project.json`

Edite [`codechroma.project.json`](codechroma.project.json) na raiz. Exemplo de entradas em `media`:

```json
{
  "type": "image",
  "src": "https://<seu-store>.public.blob.vercel-storage.com/.../imagem.png",
  "alt": "Descrição acessível",
  "width": 1920,
  "height": 1080
}
```

```json
{
  "type": "video",
  "src": "https://<seu-store>.public.blob.vercel-storage.com/.../demo.mp4",
  "poster": "https://<seu-store>.public.blob.vercel-storage.com/.../poster.webp",
  "alt": "O que o vídeo mostra",
  "width": 1920,
  "height": 1080
}
```

Valide o JSON (por exemplo: `node -e "JSON.parse(require('fs').readFileSync('codechroma.project.json','utf8'))"`).

## 4. Revalidar o site (atualização imediata)

Depois do push no GitHub, o CodeChroma pode atualizar sozinho conforme o ISR; para forçar:

```powershell
curl.exe -X POST "https://code-chroma.vercel.app/api/revalidate?secret=<REVALIDATE_SECRET>" `
  -H "Content-Type: application/json" `
  -d "{""slug"":""learn-music""}"
```

Isso revalida `/projects/learn-music` e o catálogo `/projects` (comportamento descrito no `README-CODECHROMA.md`).

## 5. Script opcional neste repo

Existe o script [`scripts/upload-codechroma.mjs`](scripts/upload-codechroma.mjs) para automatizar uploads via `/api/upload` (imagens e arquivos que couberem no limite da função). Defina as variáveis de ambiente antes de rodar:

- `CODECHROMA_UPLOAD_ENDPOINT` — ex.: `https://code-chroma.vercel.app`
- `CODECHROMA_SECRET` — seu `REVALIDATE_SECRET`
- `CODECHROMA_PROJECT` — opcional, default `learn-music`

**cmd.exe:**

```bat
set CODECHROMA_UPLOAD_ENDPOINT=https://code-chroma.vercel.app
set CODECHROMA_SECRET=<REVALIDATE_SECRET>
set CODECHROMA_PROJECT=learn-music
node scripts\upload-codechroma.mjs
```

Para vídeos que retornarem 413, use a página `/uploads` ou o fluxo `/api.blob` descrito no `README-CODECHROMA.md`.

## Referências

- [`README-CODECHROMA.md`](README-CODECHROMA.md) — arquitetura do site, env vars, exemplos de `curl` e endpoints.
- [`codechroma.project.json`](codechroma.project.json) — manifesto atual do Learn Music.
