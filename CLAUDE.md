# acelera-portal

Portal "Ideias e roadmap" da comunidade acelera.360. Membros pedem funcionalidades, votam e reportam bugs;
a fábrica autônoma (repositório `machine.machine--rea`) busca os itens aprovados, constrói e devolve o status.
Este repositório também é desenvolvido pela própria fábrica, então mantenha tudo testável.

## Stack
- Node.js ≥ 18, ES Modules, **sem dependências npm** — use só a biblioteca padrão.
- Servidor HTTP próprio em `src/app.mjs` (sem framework). Front-end estático em `public/` (HTML + CSS + JS puro, sem build).
- Persistência em arquivo JSON (`data/db.json`, criado a partir de `data/exemplo.json` na primeira execução).

## Mapa do código
- `src/itens.mjs` — regras de domínio, funções puras: validação, criação, votos, mudança de status, saída pública.
- `src/db.mjs` — leitura/escrita do JSON (gravação atômica via arquivo temporário + rename).
- `src/app.mjs` — rotas HTTP e arquivos estáticos. `criarApp({ arquivoDb, token, limiarVotos })` devolve um `http.Server`.
- `src/server.mjs` — ponto de entrada (`npm start`), porta `PORT` (padrão 3360).
- `public/` — `index.html`, `style.css` (tokens de cor em `:root`, modo escuro), `app.js` (renderização com `el()`).

## API
| Rota | Quem usa | O que faz |
|---|---|---|
| `GET /api/config` | página | estações, categorias, limiar de votos |
| `GET /api/itens?tipo=ideia\|bug` | página | lista pública (contagem de votos, nunca quem votou) |
| `POST /api/itens` | página | cria ideia ou bug; erros de validação por campo em `erros` |
| `POST /api/itens/:id/voto` | página | alterna o voto do visitante (`x-votante`) |
| `GET /api/fabrica/fila` | fábrica | itens `aprovada-para-dev` ainda sem `fabricaId` |
| `PATCH /api/fabrica/itens/:id` | fábrica | `{ fabricaId?, status?, detalhe? }` |

Rotas `/api/fabrica/*` exigem `Authorization: Bearer $PORTAL_TOKEN`; sem `PORTAL_TOKEN` no servidor, ficam desativadas.

## Regras de negócio
- Ciclo: `em-votacao → aprovada-para-dev → em-desenvolvimento → em-homologacao → entregue` (ou `recusada`).
- Ideia nasce `em-votacao`; com `LIMIAR_VOTOS` votos (padrão 10) vai para `aprovada-para-dev`.
- Bug nasce direto em `aprovada-para-dev` (não tem votação).
- Um voto por visitante por ideia; votar de novo remove o voto. Votação encerra a partir de `em-desenvolvimento`.
- Título ≥ 8 e ≤ 120 caracteres; descrição ≥ 10 e ≤ 5000; página do bug, se informada, precisa começar com http.

## Convenções
- Código, nomes e mensagens em **português**. Mensagens de erro dizem o que fazer, sem pedir desculpas.
- Toda regra nova vai para `src/itens.mjs` com teste em `test/itens.test.js`; toda rota nova ganha teste em `test/api.test.js`.
- Front-end: interface em português, sentence case, botões dizem a ação ("Enviar ideia", não "Enviar").

## Testes
`npm test` (runner nativo `node --test`). Os testes de API sobem o servidor numa porta aleatória, sem arquivo de banco.

## Zonas de risco
- Autenticação das rotas `/api/fabrica/*` (comparação de token em tempo constante).
- Privacidade: a lista de votantes nunca sai pela API.
- `servirEstatico`: não pode servir nada fora de `public/`.
