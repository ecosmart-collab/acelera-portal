const NOMES = {
  'em-votacao': 'Em votação',
  'aprovada-para-dev': 'Aprovada para dev',
  'em-desenvolvimento': 'Em desenvolvimento',
  'em-homologacao': 'Em homologação',
  entregue: 'Entregue',
  recusada: 'Recusada',
};

const estado = { tipo: 'ideia', ordem: 'votos', filtro: null, itens: [], config: null };
const $ = (s) => document.querySelector(s);

// Identifica o visitante para "1 voto por pessoa" sem exigir login.
function votante() {
  try {
    let id = localStorage.getItem('votante');
    if (!id) { id = `v-${crypto.randomUUID()}`; localStorage.setItem('votante', id); }
    return id;
  } catch {
    return (window.__votante ??= `v-${crypto.randomUUID()}`);
  }
}

async function api(caminho, opcoes = {}) {
  const r = await fetch(caminho, {
    ...opcoes,
    headers: { 'content-type': 'application/json', 'x-votante': votante(), ...(opcoes.headers ?? {}) },
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(corpo.erro ?? 'Não foi possível concluir.'), { erros: corpo.erros });
  return corpo;
}

function el(tag, atributos = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...filhos.flat().filter((f) => f != null));
  return e;
}

function avisar(mensagem) {
  const a = $('#aviso');
  a.textContent = mensagem;
  a.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => (a.hidden = true), 3200);
}

const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

// ---------- esteira ----------

function desenharEsteira(novoId) {
  const lista = $('#estacoes');
  lista.replaceChildren(...estado.config.estacoes.map((status, i) => {
    const aqui = estado.itens.filter((it) => it.status === status).sort((a, b) => b.votos - a.votos);
    return el('li', { class: 'estacao', 'data-status': status },
      el('span', { class: 'estacao-marco', 'aria-hidden': 'true' }, String(i + 1)),
      el('h2', { class: 'estacao-nome' }, NOMES[status]),
      el('span', { class: 'estacao-total' }, String(aqui.length)),
      el('ul', { class: 'pecas' },
        aqui.slice(0, 3).map((it) => el('li', { class: `peca${it.id === novoId ? ' chegou' : ''}` }, it.titulo)),
        aqui.length > 3 ? el('li', { class: 'pecas-mais' }, `e mais ${aqui.length - 3}`) : null));
  }));
}

// ---------- mural ----------

function desenharFiltros() {
  const status = estado.tipo === 'ideia' ? [...estado.config.estacoes, 'recusada'] : estado.config.estacoes.slice(1);
  $('#filtros').replaceChildren(
    el('button', { class: 'filtro', 'aria-pressed': String(!estado.filtro), onclick: () => filtrar(null) }, 'Todas'),
    ...status.map((s) => el('button', { class: 'filtro', 'aria-pressed': String(estado.filtro === s), onclick: () => filtrar(s) }, NOMES[s])));
}

function filtrar(s) { estado.filtro = s; desenharFiltros(); desenharLista(); }

function blocoVoto(it) {
  if (it.tipo === 'bug') return el('div', { class: 'bug-marca' }, 'Bug');
  const aberta = it.status === 'em-votacao' || it.status === 'aprovada-para-dev';
  return el('button', {
    class: 'voto', 'aria-pressed': String(it.votei), disabled: !aberta,
    'aria-label': `${it.votei ? 'Remover voto' : 'Votar'} em "${it.titulo}" (${it.votos} votos)`,
    onclick: () => votar(it),
  },
  el('span', { class: 'voto-seta', 'aria-hidden': 'true' }, '▲'),
  el('span', { class: 'voto-total' }, String(it.votos)),
  el('span', { class: 'voto-rotulo' }, it.votos === 1 ? 'voto' : 'votos'));
}

function desenharLista() {
  let itens = estado.itens.filter((it) => it.tipo === estado.tipo && (!estado.filtro || it.status === estado.filtro));
  itens.sort(estado.ordem === 'votos' && estado.tipo === 'ideia'
    ? (a, b) => b.votos - a.votos || b.criadoEm.localeCompare(a.criadoEm)
    : (a, b) => b.criadoEm.localeCompare(a.criadoEm));

  if (!itens.length) {
    const ideia = estado.tipo === 'ideia';
    return $('#lista').replaceChildren(el('li', { class: 'vazio' },
      el('p', {}, estado.filtro ? `Nada em "${NOMES[estado.filtro]}" por enquanto.` : ideia ? 'Nenhuma ideia ainda. Seja a primeira pessoa a pedir algo.' : 'Nenhum bug reportado.'),
      ideia && !estado.filtro ? el('button', { class: 'botao botao-primario', onclick: () => abrir('ideia') }, 'Nova ideia') : null));
  }

  $('#lista').replaceChildren(...itens.map((it) => el('li', { class: 'item' },
    blocoVoto(it),
    el('div', {},
      el('h3', {}, it.titulo),
      el('p', {}, it.descricao),
      el('div', { class: 'item-meta' },
        el('span', { class: 'selo', 'data-status': it.status }, NOMES[it.status]),
        el('span', {}, it.categoria),
        el('span', {}, `${it.autor}, ${dataCurta(it.criadoEm)}`))))));
}

async function votar(it) {
  try {
    const atualizado = await api(`/api/itens/${it.id}/voto`, { method: 'POST' });
    const mudouEtapa = atualizado.status !== it.status;
    Object.assign(it, atualizado);
    desenharEsteira(mudouEtapa ? it.id : null);
    desenharLista();
    if (mudouEtapa) avisar('Ideia aprovada! Ela entrou na fila da fábrica.');
  } catch (e) {
    avisar(e.message);
  }
}

// ---------- formulário ----------

const TEXTOS = {
  ideia: { titulo: 'Nova ideia', ajuda: 'Conte o que você quer e por quê. As mais votadas viram prioridade.', enviar: 'Enviar ideia', ok: 'Ideia enviada. Agora é juntar votos.' },
  bug: { titulo: 'Reportar bug', ajuda: 'Só você e a equipe veem este relato. Quanto mais específico, mais rápido a gente corrige.', enviar: 'Enviar relato', ok: 'Relato enviado. O bug já está na fila da fábrica.' },
};

function abrir(tipo) {
  const f = $('#formulario');
  f.reset();
  limparErros();
  f.tipo.value = tipo;
  $('#dialogo-titulo').textContent = TEXTOS[tipo].titulo;
  $('#dialogo-ajuda').textContent = TEXTOS[tipo].ajuda;
  $('#enviar').textContent = TEXTOS[tipo].enviar;
  f.titulo.placeholder = tipo === 'bug' ? 'Ex.: Botão salvar não responde no pipeline' : 'Ex.: Exportar relatório em PDF';
  f.descricao.placeholder = tipo === 'bug'
    ? 'O que você estava fazendo, o que esperava que acontecesse e o que aconteceu de fato. Se der, os passos para repetir.'
    : 'Qual problema isso resolve para você?';
  document.querySelectorAll('[data-so-bug]').forEach((e) => (e.hidden = tipo !== 'bug'));
  if (tipo === 'bug') f.pagina.value = document.referrer || location.href;
  try { f.autor.value = localStorage.getItem('autor') ?? ''; } catch {}
  $('#dialogo').showModal();
  f.titulo.focus();
}

function limparErros() {
  document.querySelectorAll('[data-erro]').forEach((e) => (e.textContent = ''));
  document.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  $('#erro-geral').textContent = '';
}

function mostrarErros(erros) {
  for (const [campo, msg] of Object.entries(erros)) {
    const alvo = document.querySelector(`[data-erro="${campo}"]`);
    if (alvo) alvo.textContent = msg;
    $('#formulario')[campo]?.setAttribute('aria-invalid', 'true');
  }
  const primeiro = Object.keys(erros)[0];
  $('#formulario')[primeiro]?.focus();
}

async function enviar(evento) {
  evento.preventDefault();
  const f = evento.target;
  const dados = Object.fromEntries(new FormData(f));
  limparErros();
  const erros = {};
  if (dados.titulo.trim().length < 8) erros.titulo = 'O título precisa de pelo menos 8 caracteres.';
  if (dados.descricao.trim().length < 10) erros.descricao = 'Descreva com pelo menos 10 caracteres.';
  if (Object.keys(erros).length) return mostrarErros(erros);

  const botao = $('#enviar');
  botao.disabled = true;
  try {
    const item = await api('/api/itens', { method: 'POST', body: JSON.stringify(dados) });
    try { localStorage.setItem('autor', dados.autor); } catch {}
    estado.itens.push(item);
    $('#dialogo').close();
    if (item.tipo !== estado.tipo) trocarAba(item.tipo);
    desenharEsteira(item.id);
    desenharLista();
    avisar(TEXTOS[item.tipo].ok);
  } catch (e) {
    if (e.erros) mostrarErros(e.erros);
    else $('#erro-geral').textContent = e.message;
  } finally {
    botao.disabled = false;
  }
}

function trocarAba(tipo) {
  estado.tipo = tipo;
  estado.filtro = null;
  document.querySelectorAll('.aba').forEach((a) => a.setAttribute('aria-selected', String(a.dataset.tipo === tipo)));
  $('#ordem').closest('label').hidden = tipo === 'bug';
  desenharFiltros();
  desenharLista();
}

// ---------- início ----------

async function iniciar() {
  try {
    [estado.config, estado.itens] = await Promise.all([api('/api/config'), api('/api/itens')]);
  } catch {
    $('#lista').replaceChildren(el('li', { class: 'vazio' }, 'Não foi possível carregar o mural. Verifique a conexão e recarregue a página.'));
    return;
  }
  $('#limiar').textContent = estado.config.limiarVotos;
  $('#categorias').replaceChildren(...estado.config.categorias.map((c) => el('option', {}, c)));
  document.querySelectorAll('[data-abrir]').forEach((b) => b.addEventListener('click', () => abrir(b.dataset.abrir)));
  document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => $('#dialogo').close()));
  document.querySelectorAll('.aba').forEach((a) => a.addEventListener('click', () => trocarAba(a.dataset.tipo)));
  $('#ordem').addEventListener('change', (e) => { estado.ordem = e.target.value; desenharLista(); });
  $('#formulario').addEventListener('submit', enviar);
  desenharEsteira();
  desenharFiltros();
  desenharLista();
}

iniciar();
