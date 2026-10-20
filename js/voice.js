/*
 * voice.js — voz do JARVIS, usando recursos gratuitos que já vêm no navegador.
 *
 *  - Ouvir (ditado):  Web Speech API / SpeechRecognition  (Chrome e Edge funcionam melhor)
 *  - Falar:           speechSynthesis                      (vozes em português do sistema)
 *
 * Observações:
 *  - O microfone só funciona em páginas https (ou em localhost).
 *  - No Chrome, o ditado usa um serviço de reconhecimento do próprio navegador.
 *  - Mais tarde dá para trocar por uma voz melhor sem mexer no resto do app:
 *    basta manter as funções escutar(), falar() e parar().
 */
(function (J) {
  'use strict';

  var Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
  var suportaEscuta = !!Reconhecimento;
  var suportaFala = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  var reconhecedor = null;

  var MENSAGENS_ERRO = {
    'not-allowed': 'O microfone está bloqueado. Permita o acesso nas configurações do navegador.',
    'service-not-allowed': 'O navegador não liberou o serviço de voz neste endereço.',
    'no-speech': 'Não ouvi nada. Tente falar mais perto do microfone.',
    'audio-capture': 'Não encontrei um microfone neste aparelho.',
    'network': 'O reconhecimento de voz precisa de internet.'
  };

  function escutar(opcoes) {
    if (!suportaEscuta) return;
    pararEscuta();

    var rec = new Reconhecimento();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    var ultimoTexto = '';

    rec.onresult = function (evento) {
      var texto = '';
      for (var i = 0; i < evento.results.length; i++) {
        texto += evento.results[i][0].transcript;
      }
      ultimoTexto = texto;
      if (opcoes.aoTexto) opcoes.aoTexto(texto);
    };

    rec.onerror = function (evento) {
      if (evento.error === 'aborted') return;
      var msg = MENSAGENS_ERRO[evento.error] || 'Não foi possível usar o microfone (' + evento.error + ').';
      if (opcoes.aoErro) opcoes.aoErro(msg);
    };

    rec.onend = function () {
      if (reconhecedor === rec) reconhecedor = null;
      if (opcoes.aoFim) opcoes.aoFim(ultimoTexto);
    };

    reconhecedor = rec;
    try {
      rec.start();
    } catch (e) {
      reconhecedor = null;
      if (opcoes.aoErro) opcoes.aoErro('Não consegui iniciar o microfone.');
      if (opcoes.aoFim) opcoes.aoFim('');
    }
  }

  function pararEscuta() {
    if (reconhecedor) {
      try { reconhecedor.stop(); } catch (e) { /* já parado */ }
    }
  }

  function escolherVoz() {
    var vozes = window.speechSynthesis.getVoices();
    var ptBR = vozes.filter(function (v) { return /^pt[-_]BR/i.test(v.lang); });
    if (ptBR.length) return ptBR[0];
    var pt = vozes.filter(function (v) { return /^pt/i.test(v.lang); });
    return pt.length ? pt[0] : null;
  }

  function falar(texto, opcoes) {
    opcoes = opcoes || {};
    if (!suportaFala) { if (opcoes.aoFim) opcoes.aoFim(); return; }

    window.speechSynthesis.cancel();

    var fala = new SpeechSynthesisUtterance(texto);
    fala.lang = 'pt-BR';
    var voz = escolherVoz();
    if (voz) fala.voice = voz;
    fala.rate = 1.02;
    fala.pitch = 0.9;

    fala.onstart = function () { if (opcoes.aoInicio) opcoes.aoInicio(); };
    fala.onend = function () { if (opcoes.aoFim) opcoes.aoFim(); };
    fala.onerror = function () { if (opcoes.aoFim) opcoes.aoFim(); };

    window.speechSynthesis.speak(fala);
  }

  function pararFala() {
    if (suportaFala) window.speechSynthesis.cancel();
  }

  // Algumas vozes só ficam disponíveis depois de um instante.
  if (suportaFala) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function () { window.speechSynthesis.getVoices(); };
  }

  J.voice = {
    suportaEscuta: suportaEscuta,
    suportaFala: suportaFala,
    escutar: escutar,
    pararEscuta: pararEscuta,
    falar: falar,
    pararFala: pararFala
  };
})(window.JARVIS = window.JARVIS || {});
