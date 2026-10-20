/*
 * brain.js — o "cérebro" do JARVIS.
 *
 * Etapa 1 (agora): respostas locais simples (modo demonstração).
 * Etapa 2: se houver um "endereço da IA" salvo nos Ajustes, as conversas
 *          são enviadas para esse endereço (um servidor seu, gratuito).
 *
 * Contrato do servidor de IA:
 *   Recebe  POST  { "messages": [ { "role": "user" | "assistant", "content": "..." } ] }
 *   Devolve JSON  { "reply": "texto da resposta" }
 *
 * IMPORTANTE: nenhuma chave de API fica neste arquivo. Este site é público;
 * qualquer chave colocada aqui poderia ser copiada por qualquer pessoa.
 * A chave deve ficar guardada no servidor (veja o README, etapa 2).
 */
(function (J) {
  'use strict';

  var CHAVE_ENDERECO = 'jarvis.endereco_ia';
  var LIMITE_CONTEXTO = 20; // quantas mensagens recentes são enviadas à IA

  function lerEndereco() {
    try { return localStorage.getItem(CHAVE_ENDERECO) || ''; } catch (e) { return ''; }
  }

  function salvarEndereco(valor) {
    try {
      if (valor) localStorage.setItem(CHAVE_ENDERECO, valor);
      else localStorage.removeItem(CHAVE_ENDERECO);
    } catch (e) { /* armazenamento indisponível */ }
  }

  function modo() {
    return lerEndereco() ? 'ia' : 'demo';
  }

  function normalizar(texto) {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function saudacao(data) {
    var h = data.getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function respostaLocal(texto) {
    var t = normalizar(texto);
    var agora = new Date();

    if (/\bque dia\b|\bdata\b|\bdia (e )?hoje\b/.test(t)) {
      return 'Hoje é ' + agora.toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }) + '.';
    }

    if (/\bhoras?\b|\bque horas\b/.test(t)) {
      return 'Agora são ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.';
    }

    if (/\b(oi|ola|e ai|bom dia|boa tarde|boa noite)\b/.test(t)) {
      return saudacao(agora) + '! Estou à disposição. Como posso ajudar?';
    }

    if (/quem (e|eh) voce|qual (e )?(o )?seu nome/.test(t)) {
      return 'Sou o JARVIS, seu assistente pessoal. Por enquanto estou em modo de demonstração, sem inteligência artificial conectada.';
    }

    if (/o que voce (sabe|faz|pode)|\bajuda\b|\bcomandos?\b/.test(t)) {
      return 'No modo demonstração eu sei:\n• dizer a hora e a data;\n• responder a saudações;\n• guardar o histórico desta conversa neste aparelho.\n\nPara conversas livres, conecte uma IA nos Ajustes (README, etapa 2).';
    }

    var eco = texto.length > 80 ? texto.slice(0, 80) + '…' : texto;
    return 'Recebi: “' + eco + '”. No modo demonstração só sei responder hora, data e saudações. Para conversas livres, conecte uma IA nos Ajustes (README, etapa 2).';
  }

  /**
   * Gera a resposta do assistente.
   * @param {Array<{role:string, content:string}>} historico mensagens, a última é a do usuário
   * @param {AbortSignal} [sinal] permite cancelar a requisição
   * @returns {Promise<string>}
   */
  async function pensar(historico, sinal) {
    var endereco = lerEndereco();
    var recentes = historico.slice(-LIMITE_CONTEXTO).map(function (m) {
      return { role: m.role, content: m.content };
    });

    if (!endereco) {
      await new Promise(function (ok) { setTimeout(ok, 450); }); // pausa curta, só para parecer natural
      return respostaLocal(recentes[recentes.length - 1].content);
    }

    var resposta;
    try {
      resposta = await fetch(endereco, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: recentes }),
        signal: sinal
      });
    } catch (e) {
      throw new Error('Não consegui falar com a IA. Verifique sua conexão e o endereço nos Ajustes.');
    }

    if (!resposta.ok) {
      throw new Error('A IA respondeu com erro ' + resposta.status + '. Confira o servidor da etapa 2.');
    }

    var dados;
    try { dados = await resposta.json(); } catch (e) { dados = null; }

    if (!dados || typeof dados.reply !== 'string' || !dados.reply.trim()) {
      throw new Error('A IA respondeu em um formato inesperado. Esperado: { "reply": "texto" }.');
    }
    return dados.reply;
  }

  J.brain = {
    pensar: pensar,
    modo: modo,
    lerEndereco: lerEndereco,
    salvarEndereco: salvarEndereco
  };
})(window.JARVIS = window.JARVIS || {});
