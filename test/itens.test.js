import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarNovoItem, novoItem, alternarVoto, mudarStatus, publico, ErroValidacao } from '../src/itens.mjs';

const ideiaValida = { tipo: 'ideia', titulo: 'Exportar relatório em PDF', descricao: 'Preciso mandar para o cliente.' };

test('valida título e descrição mínimos', () => {
  assert.throws(() => validarNovoItem({ tipo: 'ideia', titulo: 'curto', descricao: 'curta' }), (e) => {
    assert.ok(e instanceof ErroValidacao);
    assert.ok(e.erros.titulo);
    assert.ok(e.erros.descricao);
    return true;
  });
});

test('rejeita tipo desconhecido e página malformada em bug', () => {
  assert.throws(() => validarNovoItem({ ...ideiaValida, tipo: 'outro' }), (e) => Boolean(e.erros.tipo));
  assert.throws(() => validarNovoItem({ ...ideiaValida, tipo: 'bug', pagina: 'pipeline' }), (e) => Boolean(e.erros.pagina));
});

test('ideia nasce em votação; bug vai direto para a fábrica', () => {
  assert.equal(novoItem('1', validarNovoItem(ideiaValida)).status, 'em-votacao');
  assert.equal(novoItem('2', validarNovoItem({ ...ideiaValida, tipo: 'bug' })).status, 'aprovada-para-dev');
});

test('voto alterna e aprova ao atingir o limiar', () => {
  const item = novoItem('1', validarNovoItem(ideiaValida));
  alternarVoto(item, 'votante-a', 2);
  alternarVoto(item, 'votante-a', 2);
  assert.equal(item.votantes.length, 0);
  alternarVoto(item, 'votante-a', 2);
  alternarVoto(item, 'votante-b', 2);
  assert.equal(item.status, 'aprovada-para-dev');
  assert.equal(item.historico.at(-1).detalhe, 'atingiu 2 votos');
});

test('não aceita voto em bug nem em ideia já em desenvolvimento', () => {
  const bug = novoItem('1', validarNovoItem({ ...ideiaValida, tipo: 'bug' }));
  assert.throws(() => alternarVoto(bug, 'votante-a', 10), /Só ideias/);
  const ideia = novoItem('2', validarNovoItem(ideiaValida));
  mudarStatus(ideia, 'em-desenvolvimento');
  assert.throws(() => alternarVoto(ideia, 'votante-a', 10), /encerrada/);
});

test('saída pública esconde quem votou', () => {
  const item = novoItem('1', validarNovoItem(ideiaValida));
  alternarVoto(item, 'votante-a', 10);
  const p = publico(item, 'votante-a');
  assert.equal(p.votantes, undefined);
  assert.equal(p.votos, 1);
  assert.equal(p.votei, true);
  assert.equal(publico(item, 'votante-b').votei, false);
});
