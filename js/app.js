/*
 * app.js — interface do JARVIS: conversa, histórico, voz e ajustes.
 * O histórico fica salvo no próprio aparelho (localStorage), não em servidor.
 */
(function (J) {
  'use strict';

  var CHAVE_HISTORICO = 'jarvis.historico';
  var CHAVE_VOZ = 'jarvis.voz_resposta';
  var LIMITE_HISTORICO = 200;

  var $ = function (seletor) { return document.querySelector(seletor); };
  var el = {
    orbe: $('#orbe'),
    estado: $('#estado'),
    modo: $('#modo'),
    historico: $('#historico'),
    vazio: $('#vazio'),
    lista: $('#lista'),
    form: $('#formulario'),
    campo: $('#campo'),
    microfone: $('#microfone'),
    enviar: $('#enviar'),
    ajustes: $('#ajustes'),
    formAjustes: $('#form-ajustes'),
    abrirAjustes: $('#abrir-ajustes'),
    fecharAjustes: $('#fechar-ajustes'),
    opcaoVoz: $('#opcao-voz'),
    ajudaVoz: $('#ajuda-voz'),
    opcaoEndereco: $('#opcao-endereco'),
    erroAjustes: $('#erro-ajustes'),
    limpar: $('#limpar')
  };

  var mensagens = carregarHistorico();
  var ocupado = false;
  var escutando = false;
  var responderEmVoz = lerPreferencia(CHAVE_VOZ);

  /* ---------- Armazenamento ---------- */

  function carregarHistorico() {
    try {
      var bruto = JSON.parse(localStorage.getItem(CHAVE_HISTORICO) || '[]');
      if (!Array.isArray(bruto)) return [];
      return bruto.filter(function (m) {
        return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
      });
    } catch (e) { return []; }
  }

  function salvarHistorico() {
    try {
      localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(mensagens.slice(-LIMITE_HISTORICO)));
    } catch (e) { /* sem espaço ou bloqueado: a conversa segue funcionando */ }
  }

  function lerPreferencia(chave) {
    try { return localStorage.getItem(chave) === '1'; } catch (e) { return false; }
  }

  function salvarPreferencia(chave, valor) {
    try { localStorage.setItem(chave, valor ? '1' : '0'); } catch (e) { /* ignora */ }
  }

  /* ---------- Estado visual ---------- */

  function textoRepouso() { return 'Online'; }

  function atualizarModo() {
    el.modo.textContent = J.brain.modo() === 'ia' ? 'IA conectada' : 'Modo demonstração';
  }

  function definirEstado(nome, texto) {
    el.orbe.dataset.estado = nome;
    el.estado.textContent = texto;
  }

  function repouso() {
    definirEstado('repouso', textoRepouso());
  }

  /* ---------- Mensagens ---------- */

  function horaCurta(ts) {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function criarItem(msg) {
    var li = document.createElement('li');
    li.className = 'msg ' + (msg.role === 'user' ? 'msg-usuario' : 'msg-jarvis');

    var p = document.createElement('div');
    p.textContent = msg.content; // textContent: nunca interpreta HTML
    li.appendChild(p);

    if (msg.ts) {
      var t = document.createElement('time');
      t.dateTime = new Date(msg.ts).toISOString();
      t.textContent = horaCurta(msg.ts);
      li.appendChild(t);
    }
    return li;
  }

  function rolarParaOFim() {
    el.historico.scrollTop = el.historico.scrollHeight;
  }

  function atualizarVazio() {
    el.vazio.hidden = mensagens.length > 0 || el.lista.children.length > 0;
  }

  function desenharHistorico() {
    el.lista.textContent = '';
    mensagens.forEach(function (m) { el.lista.appendChild(criarItem(m)); });
    atualizarVazio();
    rolarParaOFim();
  }

  function adicionarMensagem(role, content) {
    var msg = { role: role, content: content, ts: Date.now() };
    mensagens.push(msg);
    salvarHistorico();
    el.lista.appendChild(criarItem(msg));
    atualizarVazio();
    rolarParaOFim();
    return msg;
  }

  function mostrarAviso(texto) {
    var li = document.createElement('li');
    li.className = 'msg msg-aviso';
    li.textContent = texto;
    el.lista.appendChild(li);
    atualizarVazio();
    rolarParaOFim();
  }

  function criarIndicador() {
    var li = document.createElement('li');
    li.className = 'msg msg-jarvis';
    li.setAttribute('aria-label', 'O JARVIS está processando');
    li.innerHTML = '<span class="pensando-pontos"><i></i><i></i><i></i></span>';
    return li;
  }

  /* ---------- Envio ---------- */

  async function enviar(texto) {
    texto = (texto || '').trim();
    if (!texto || ocupado) return;

    J.voice.pararFala();
    ocupado = true;
    el.enviar.disabled = true;

    adicionarMensagem('user', texto);
    el.campo.value = '';
    ajustarAltura();

    definirEstado('pensando', 'Processando');
    var indicador = criarIndicador();
    el.lista.appendChild(indicador);
    rolarParaOFim();

    var falando = false;
    try {
      var resposta = await J.brain.pensar(mensagens);
      indicador.remove();
      adicionarMensagem('assistant', resposta);

      if (responderEmVoz && J.voice.suportaFala) {
        falando = true;
        definirEstado('falando', 'Falando');
        J.voice.falar(resposta, { aoFim: repouso });
      }
    } catch (erro) {
      indicador.remove();
      mostrarAviso(erro.message || 'Algo deu errado. Tente de novo.');
    } finally {
      ocupado = false;
      el.enviar.disabled = false;
      if (!falando) repouso();
      el.campo.focus({ preventScroll: true });
    }
  }

  /* ---------- Campo de texto ---------- */

  function ajustarAltura() {
    el.campo.style.height = 'auto';
    el.campo.style.height = Math.min(el.campo.scrollHeight, 144) + 'px';
  }

  el.campo.addEventListener('input', ajustarAltura);

  el.campo.addEventListener('keydown', function (e) {
    // Enter envia; Shift+Enter quebra a linha
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      el.form.requestSubmit();
    }
  });

  el.form.addEventListener('submit', function (e) {
    e.preventDefault();
    enviar(el.campo.value);
  });

  document.querySelectorAll('.sugestao').forEach(function (botao) {
    botao.addEventListener('click', function () { enviar(botao.dataset.texto); });
  });

  /* ---------- Microfone ---------- */

  function finalizarEscuta() {
    escutando = false;
    el.microfone.setAttribute('aria-pressed', 'false');
    if (!ocupado) repouso();
  }

  if (J.voice.suportaEscuta) {
    el.microfone.hidden = false;

    el.microfone.addEventListener('click', function () {
      if (escutando) { J.voice.pararEscuta(); return; }
      if (ocupado) return;

      J.voice.pararFala();
      escutando = true;
      el.microfone.setAttribute('aria-pressed', 'true');
      definirEstado('ouvindo', 'Ouvindo');

      J.voice.escutar({
        aoTexto: function (texto) { el.campo.value = texto; ajustarAltura(); },
        aoErro: function (msg) { mostrarAviso(msg); },
        aoFim: function (texto) {
          finalizarEscuta();
          if (texto && texto.trim()) enviar(texto);
        }
      });
    });
  }

  /* ---------- Ajustes ---------- */

  function abrirAjustes() {
    el.opcaoVoz.checked = responderEmVoz;
    el.opcaoVoz.disabled = !J.voice.suportaFala;
    el.ajudaVoz.textContent = J.voice.suportaFala ? '' : 'Este navegador não consegue falar em voz alta.';
    el.opcaoEndereco.value = J.brain.lerEndereco();
    el.erroAjustes.hidden = true;
    el.ajustes.showModal();
  }

  function enderecoValido(valor) {
    if (!valor) return true; // vazio = modo demonstração
    try {
      var u = new URL(valor);
      var local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
      return u.protocol === 'https:' || (u.protocol === 'http:' && local);
    } catch (e) { return false; }
  }

  el.abrirAjustes.addEventListener('click', abrirAjustes);
  el.fecharAjustes.addEventListener('click', function () { el.ajustes.close(); });

  el.formAjustes.addEventListener('submit', function (e) {
    e.preventDefault();
    var endereco = el.opcaoEndereco.value.trim();

    if (!enderecoValido(endereco)) {
      el.erroAjustes.textContent = 'Use um endereço que comece com https://';
      el.erroAjustes.hidden = false;
      el.opcaoEndereco.focus();
      return;
    }

    responderEmVoz = el.opcaoVoz.checked;
    salvarPreferencia(CHAVE_VOZ, responderEmVoz);
    if (!responderEmVoz) J.voice.pararFala();
    J.brain.salvarEndereco(endereco);
    atualizarModo();
    el.ajustes.close();
  });

  el.limpar.addEventListener('click', function () {
    if (!window.confirm('Apagar todo o histórico de mensagens deste aparelho?')) return;
    mensagens = [];
    salvarHistorico();
    desenharHistorico();
    el.ajustes.close();
  });

  /* ---------- Início ---------- */

  atualizarModo();
  repouso();
  desenharHistorico();
})(window.JARVIS = window.JARVIS || {});
