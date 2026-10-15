// Regras de domínio dos itens do portal (ideias e bugs). Funções puras, sem I/O.

// Ciclo de vida exibido na linha de montagem. "recusada" fica fora da esteira.
export const ESTACOES = ['em-votacao', 'aprovada-para-dev', 'em-desenvolvimento', 'em-homologacao', 'entregue'];
export const STATUS = [...ESTACOES, 'recusada'];
export const TIPOS = ['ideia', 'bug'];
export const CATEGORIAS = ['IA & Agentes', 'Plataforma', 'Integrações', 'Conteúdo', 'Outro'];

export class ErroValidacao extends Error {
  constructor(erros) {
    super('Dados inválidos.');
    this.status = 400;
    this.erros = erros;
  }
}

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

export function validarNovoItem(dados = {}) {
  const tipo = texto(dados.tipo);
  const titulo = texto(dados.titulo);
  const descricao = texto(dados.descricao);
  const erros = {};
  if (!TIPOS.includes(tipo)) erros.tipo = 'Escolha entre ideia e bug.';
  if (titulo.length < 8) erros.titulo = 'O título precisa de pelo menos 8 caracteres.';
  if (titulo.length > 120) erros.titulo = 'O título pode ter no máximo 120 caracteres.';
  if (descricao.length < 10) erros.descricao = 'Descreva com pelo menos 10 caracteres.';
  if (descricao.length > 5000) erros.descricao = 'A descrição pode ter no máximo 5000 caracteres.';
  const categoria = texto(dados.categoria) || 'Outro';
  if (!CATEGORIAS.includes(categoria)) erros.categoria = 'Categoria desconhecida.';
  const pagina = texto(dados.pagina);
  if (tipo === 'bug' && pagina && !/^https?:\/\/\S+$/.test(pagina)) erros.pagina = 'Informe o endereço completo da página (começando com http).';
  if (Object.keys(erros).length) throw new ErroValidacao(erros);
  return { tipo, titulo, descricao, categoria, pagina: tipo === 'bug' ? pagina : '', autor: texto(dados.autor).slice(0, 60) || 'Anônimo' };
}

export function novoItem(id, dados, agora = new Date()) {
  const em = agora.toISOString();
  // Bugs não passam por votação: vão direto para a fábrica.
  const status = dados.tipo === 'bug' ? 'aprovada-para-dev' : 'em-votacao';
  return { id, ...dados, votantes: [], status, fabricaId: null, criadoEm: em, atualizadoEm: em, historico: [{ status, em }] };
}

export function mudarStatus(item, status, detalhe, agora = new Date()) {
  if (!STATUS.includes(status)) throw new ErroValidacao({ status: `Status desconhecido: ${status}` });
  if (item.status === status) return item;
  item.status = status;
  item.atualizadoEm = agora.toISOString();
  item.historico.push({ status, em: item.atualizadoEm, ...(detalhe ? { detalhe } : {}) });
  return item;
}

// Liga/desliga o voto. Ao atingir o limiar, a ideia é aprovada para desenvolvimento.
export function alternarVoto(item, votante, limiarVotos, agora = new Date()) {
  if (item.tipo !== 'ideia') throw Object.assign(new Error('Só ideias recebem votos.'), { status: 400 });
  if (item.status !== 'em-votacao' && item.status !== 'aprovada-para-dev') {
    throw Object.assign(new Error('A votação desta ideia já foi encerrada.'), { status: 409 });
  }
  const i = item.votantes.indexOf(votante);
  if (i >= 0) item.votantes.splice(i, 1);
  else item.votantes.push(votante);
  if (item.status === 'em-votacao' && item.votantes.length >= limiarVotos) {
    mudarStatus(item, 'aprovada-para-dev', `atingiu ${limiarVotos} votos`, agora);
  }
  return item;
}

// O que sai pela API: nunca expõe quem votou, só a contagem e se o visitante votou.
export function publico(item, votante) {
  const { votantes, ...resto } = item;
  return { ...resto, votos: votantes.length, votei: Boolean(votante) && votantes.includes(votante) };
}
