// Armazenamento em arquivo JSON. Simples de propósito: troca por Supabase/Postgres quando o volume pedir.
import fs from 'node:fs';
import path from 'node:path';

export function criarDb(arquivo) {
  let dados = { seq: 0, itens: [] };
  if (arquivo && fs.existsSync(arquivo)) dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));

  function salvar() {
    if (!arquivo) return;
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    const tmp = `${arquivo}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(dados, null, 2));
    fs.renameSync(tmp, arquivo);
  }

  return {
    itens: () => dados.itens,
    buscar: (id) => dados.itens.find((i) => i.id === id),
    proximoId: () => String(++dados.seq),
    inserir(item) { dados.itens.push(item); salvar(); return item; },
    salvar,
  };
}
