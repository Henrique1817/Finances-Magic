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

- `UPLOAD_API_TOKEN`: token principal para autenticar chamadas de upload.
- `UPLOAD_HMAC_SECRET`: segredo usado pelo servidor para assinar e validar requisições.
- `ALLOWED_UPLOAD_ORIGINS`: lista CSV de origens permitidas (ex.: `https://code-chroma.vercel.app,http://localhost:3000`).
- `REVALIDATE_SECRET`: legado/compatibilidade para rotas antigas (não recomendado para novos clientes).
- `BLOB_READ_WRITE_TOKEN`: usado pelo servidor para gravar no Blob.

Guarde os segredos (`UPLOAD_API_TOKEN`, `UPLOAD_HMAC_SECRET`, etc.) apenas em ambiente seguro (Vercel, 1Password, etc.).

## 1. Fluxo atual de upload seguro (NUNCA confiar no frontend)

Todas as rotas de API validam no backend:

- origem (`Origin`) via `ALLOWED_UPLOAD_ORIGINS`
- limite/rate limit por IP
- bloqueio temporário de IP para falhas repetidas
- autenticação por `Authorization: Bearer <UPLOAD_API_TOKEN>`
- assinatura HMAC (`x-upload-ts`, `x-upload-nonce`, `x-upload-signature`)
- `Content-Type` esperado por rota
- validação do payload e do arquivo (MIME, extensão e tamanho)

### Etapas

1. Obter assinatura: `POST /api/upload-signature`
2. Enviar arquivo: `POST /api/upload` (ou fluxo `POST /api/blob`)
3. Salvar a URL retornada no `codechroma.project.json`

## 2. Exemplo completo (PowerShell com `curl.exe`)

### 2.1 Pedir assinatura ao servidor

```powershell
$TOKEN = "<UPLOAD_API_TOKEN>"

$sig = curl.exe -s -X POST "https://code-chroma.vercel.app/api/upload-signature" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TOKEN" `
  -d "{""method"":""POST"",""pathname"":""/api/upload""}"

$ts = ($sig | ConvertFrom-Json).headers."x-upload-ts"
$nonce = ($sig | ConvertFrom-Json).headers."x-upload-nonce"
$signature = ($sig | ConvertFrom-Json).headers."x-upload-signature"
```

### 2.2 Enviar arquivo para `/api/upload`

```powershell
curl.exe -X POST "https://code-chroma.vercel.app/api/upload" `
  -H "Authorization: Bearer $TOKEN" `
  -H "x-upload-ts: $ts" `
  -H "x-upload-nonce: $nonce" `
  -H "x-upload-signature: $signature" `
  -F "file=@C:\Learn-Music\Web\public\image\01_Computer.png" `
  -F "project=learn-music"
```

A resposta traz JSON com `ok`, `url` e `path`. Use `url` em `media[].src`.

## 3. Upload grande (vídeos) via token de Blob

Para arquivos maiores, prefira o fluxo de Blob tokenizado:

1. pedir assinatura para `pathname=/api/blob` em `/api/upload-signature`
2. usar essa assinatura no `POST /api/blob`
3. realizar o upload direto no Blob client (quando aplicável)

Também é possível usar a página interna:

- `https://code-chroma.vercel.app/uploads`

## 4. Atualizar o `codechroma.project.json`

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

## 5. Revalidar o site (atualização imediata)

Depois do push no GitHub, o CodeChroma pode atualizar sozinho conforme o ISR; para forçar:

```powershell
curl.exe -X POST "https://code-chroma.vercel.app/api/revalidate?secret=<REVALIDATE_SECRET>" `
  -H "Content-Type: application/json" `
  -d "{""slug"":""learn-music""}"
```

Isso revalida `/projects/learn-music` e o catálogo `/projects` (comportamento descrito no `README-CODECHROMA.md`).

## 6. O que não usar mais (legado)

- `POST /api/upload?secret=<...>` como fluxo principal
- `POST /api/blob?secret=<...>` sem assinatura HMAC
- confiar em validação apenas no frontend
- refletir payload completo do contato para o cliente

## 7. Referências

- [`README-CODECHROMA.md`](README-CODECHROMA.md) — arquitetura do site, env vars, exemplos de `curl` e endpoints.
- [`codechroma.project.json`](codechroma.project.json) — manifesto atual do Learn Music.
