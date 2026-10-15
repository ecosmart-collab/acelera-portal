import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { criarDb } from './db.mjs';
import { ESTACOES, CATEGORIAS, ErroValidacao, validarNovoItem, novoItem, mudarStatus, alternarVoto, publico } from './itens.mjs';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const LIMITE_CORPO = 64 * 1024;

const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });

function responder(res, status, corpo) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(corpo));
}

async function lerJson(req) {
  let bruto = '';
  for await (const parte of req) {
    bruto += parte;
    if (bruto.length > LIMITE_CORPO) throw erro(413, 'Conteúdo grande demais.');
  }
  if (!bruto) return {};
  try { return JSON.parse(bruto); } catch { throw erro(400, 'JSON inválido.'); }
}

function iguaisSeguro(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function servirEstatico(res, caminho) {
  const alvo = path.join(PUBLIC, caminho === '/' ? 'index.html' : path.normalize(caminho).replace(/^([/\\])+/, ''));
  if (!alvo.startsWith(PUBLIC) || !fs.existsSync(alvo) || fs.statSync(alvo).isDirectory()) return false;
  res.writeHead(200, { 'content-type': MIME[path.extname(alvo)] ?? 'application/octet-stream' });
  fs.createReadStream(alvo).pipe(res);
  return true;
}

export function criarApp({ arquivoDb, token = process.env.PORTAL_TOKEN, limiarVotos = Number(process.env.LIMIAR_VOTOS ?? 10) } = {}) {
  const db = criarDb(arquivoDb);

  // Rotas administrativas (usadas pela fábrica) exigem "Authorization: Bearer <PORTAL_TOKEN>".
  function exigirAdmin(req) {
    if (!token) throw erro(403, 'Rotas administrativas desativadas: defina PORTAL_TOKEN no servidor.');
    const [tipo, valor] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !valor || !iguaisSeguro(valor, token)) throw erro(401, 'Token inválido.');
  }

  function votanteDe(req) {
    const v = String(req.headers['x-votante'] ?? '').trim();
    return /^[\w-]{8,64}$/.test(v) ? v : '';
  }

  async function rotear(req, res) {
    const url = new URL(req.url, 'http://local');
    const rota = `${req.method} ${url.pathname}`;
    const votante = votanteDe(req);
    let m;

    if (rota === 'GET /api/config') {
      return responder(res, 200, { estacoes: ESTACOES, categorias: CATEGORIAS, limiarVotos });
    }

    if (rota === 'GET /api/itens') {
      const tipo = url.searchParams.get('tipo');
      const itens = db.itens().filter((i) => !tipo || i.tipo === tipo).map((i) => publico(i, votante));
      return responder(res, 200, itens);
    }

    if (rota === 'POST /api/itens') {
      const item = db.inserir(novoItem(db.proximoId(), validarNovoItem(await lerJson(req))));
      return responder(res, 201, publico(item, votante));
    }

    if (req.method === 'POST' && (m = url.pathname.match(/^\/api\/itens\/(\w+)\/voto$/))) {
      if (!votante) throw erro(400, 'Identificação do votante ausente.');
      const item = db.buscar(m[1]);
      if (!item) throw erro(404, 'Item não encontrado.');
      alternarVoto(item, votante, limiarVotos);
      db.salvar();
      return responder(res, 200, publico(item, votante));
    }

    // Fila da fábrica: itens aprovados que ainda não foram enviados.
    if (rota === 'GET /api/fabrica/fila') {
      exigirAdmin(req);
      return responder(res, 200, db.itens().filter((i) => i.status === 'aprovada-para-dev' && !i.fabricaId).map((i) => publico(i)));
    }

    if (req.method === 'PATCH' && (m = url.pathname.match(/^\/api\/fabrica\/itens\/(\w+)$/))) {
      exigirAdmin(req);
      const item = db.buscar(m[1]);
      if (!item) throw erro(404, 'Item não encontrado.');
      const corpo = await lerJson(req);
      if (corpo.fabricaId) item.fabricaId = String(corpo.fabricaId);
      if (corpo.status) mudarStatus(item, corpo.status, corpo.detalhe ? String(corpo.detalhe).slice(0, 500) : undefined);
      db.salvar();
      return responder(res, 200, publico(item));
    }

    if (url.pathname.startsWith('/api/')) throw erro(404, 'Rota não encontrada.');
    if (req.method === 'GET' && servirEstatico(res, url.pathname)) return;
    throw erro(404, 'Página não encontrada.');
  }

  return http.createServer(async (req, res) => {
    try {
      await rotear(req, res);
    } catch (e) {
      if (!e.status) console.error(e);
      if (e instanceof ErroValidacao) return responder(res, 400, { erro: e.message, erros: e.erros });
      responder(res, e.status ?? 500, { erro: e.status ? e.message : 'Erro interno.' });
    }
  });
}
