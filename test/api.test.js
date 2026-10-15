import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp } from '../src/app.mjs';

let servidor, base;
const TOKEN = 'token-de-teste';

before(async () => {
  servidor = criarApp({ token: TOKEN, limiarVotos: 2 });
  await new Promise((r) => servidor.listen(0, r));
  base = `http://localhost:${servidor.address().port}`;
});
after(() => servidor.close());

const chamar = async (caminho, { metodo = 'GET', corpo, votante = 'votante-teste-1', token } = {}) => {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-votante': votante, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, corpo: await r.json() };
};

test('cria ideia, vota até aprovar e ela aparece na fila da fábrica', async () => {
  const { status, corpo: ideia } = await chamar('/api/itens', { metodo: 'POST', corpo: { tipo: 'ideia', titulo: 'Exportar relatório em PDF', descricao: 'Para mandar ao cliente.' } });
  assert.equal(status, 201);
  assert.equal(ideia.status, 'em-votacao');

  await chamar(`/api/itens/${ideia.id}/voto`, { metodo: 'POST', votante: 'votante-teste-1' });
  const { corpo: aprovada } = await chamar(`/api/itens/${ideia.id}/voto`, { metodo: 'POST', votante: 'votante-teste-2' });
  assert.equal(aprovada.status, 'aprovada-para-dev');

  const { corpo: fila } = await chamar('/api/fabrica/fila', { token: TOKEN });
  assert.ok(fila.some((i) => i.id === ideia.id));
});

test('retorna erros de validação por campo', async () => {
  const { status, corpo } = await chamar('/api/itens', { metodo: 'POST', corpo: { tipo: 'bug', titulo: 'x', descricao: 'y' } });
  assert.equal(status, 400);
  assert.ok(corpo.erros.titulo);
  assert.ok(corpo.erros.descricao);
});

test('rotas da fábrica exigem token e atualizam o status', async () => {
  const { corpo: bug } = await chamar('/api/itens', { metodo: 'POST', corpo: { tipo: 'bug', titulo: 'Botão salvar não responde', descricao: 'Clico em salvar e nada acontece.' } });
  assert.equal((await chamar('/api/fabrica/fila')).status, 401);
  assert.equal((await chamar('/api/fabrica/fila', { token: 'errado' })).status, 401);

  const { corpo } = await chamar(`/api/fabrica/itens/${bug.id}`, { metodo: 'PATCH', token: TOKEN, corpo: { fabricaId: 'demanda-1', status: 'em-desenvolvimento' } });
  assert.equal(corpo.status, 'em-desenvolvimento');
  assert.equal(corpo.fabricaId, 'demanda-1');

  const { corpo: fila } = await chamar('/api/fabrica/fila', { token: TOKEN });
  assert.ok(!fila.some((i) => i.id === bug.id));
});

test('não serve arquivos fora da pasta pública', async () => {
  const r = await fetch(`${base}/..%2Fpackage.json`);
  assert.equal(r.status, 404);
});
