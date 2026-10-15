# acelera-portal

Portal **Ideias e roadmap** da comunidade acelera.360: peça funcionalidades, vote nas que você mais quer,
reporte bugs e acompanhe cada pedido na linha de montagem até a entrega.

É a principal fonte de demandas da fábrica de software autônoma
([machine.machine--rea](https://github.com/ecosmart-collab/machine.machine--rea)): ideias que atingem o limiar de votos e
bugs reportados entram na fila da fábrica, e o status volta para cá automaticamente.

## Rodar

```bash
PORTAL_TOKEN=um-segredo-longo npm start     # http://localhost:3360
npm test
```

| Variável | Padrão | Para quê |
|---|---|---|
| `PORT` | `3360` | porta HTTP |
| `PORTAL_TOKEN` | — | token que a fábrica usa nas rotas `/api/fabrica/*` (sem ele, ficam desativadas) |
| `LIMIAR_VOTOS` | `10` | votos para uma ideia ser aprovada para desenvolvimento |
| `PORTAL_DB` | `data/db.json` | arquivo de dados |

No PowerShell: `$env:PORTAL_TOKEN="um-segredo-longo"; npm start`.

## Ligar à fábrica

No repositório da fábrica, `fabrica.config.json` já aponta para `../acelera-portal` e `http://localhost:3360`.
Com o portal rodando, defina o mesmo `PORTAL_TOKEN` no terminal da fábrica e rode `node src/fabrica.mjs watch`.

Detalhes de arquitetura e regras: [CLAUDE.md](CLAUDE.md).
