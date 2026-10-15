import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarApp } from './app.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arquivoDb = process.env.PORTAL_DB ?? path.join(RAIZ, 'data', 'db.json');

// Primeira execução: começa com alguns exemplos para a página não nascer vazia.
if (!fs.existsSync(arquivoDb)) {
  fs.mkdirSync(path.dirname(arquivoDb), { recursive: true });
  fs.copyFileSync(path.join(RAIZ, 'data', 'exemplo.json'), arquivoDb);
}

const porta = Number(process.env.PORT ?? 3360);
criarApp({ arquivoDb }).listen(porta, () => {
  console.log(`Portal rodando em http://localhost:${porta}`);
  if (!process.env.PORTAL_TOKEN) console.log('Aviso: PORTAL_TOKEN não definido — a fábrica não conseguirá sincronizar.');
});
