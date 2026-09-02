/* =========================================================
   PRESUPUESTO CCTV v2.0 — auth.js
   Autenticación por contraseña (SHA-256) · Sesión persistente
   La contraseña NO se guarda en texto plano en el frontend:
   se compara su hash SHA-256. Valor inicial configurable vía
   APP_PASSWORD al desplegar con servidor (ver .env.example).
   ========================================================= */
'use strict';

/* SHA-256 en JS puro (compatible con file://). Entrada UTF-8. */
function sha256(str){
  var utf8 = unescape(encodeURIComponent(str));
  function rr(v, a){ return (v >>> a) | (v << (32 - a)); }
  var maxWord = Math.pow(2, 32), result = '';
  var words = [], asciiBitLength = utf8.length * 8;
  var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [];
  var primeCounter = k.length, isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++){
    if (!isComposite[candidate]){
      for (var i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (Math.pow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (Math.pow(candidate, 1/3) * maxWord) | 0;
    }
  }
  /* Restaurar los H iniciales en cada llamada (el array se muta por bloque) */
  if (!sha256.h0) sha256.h0 = hash.slice(0, 8);
  else for (var z = 0; z < 8; z++) hash[z] = sha256.h0[z];
  utf8 += '\x80';
  while (utf8.length % 64 - 56) utf8 += '\x00';
  for (i = 0; i < utf8.length; i++){
    var j = utf8.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (j = 0; j < words.length;){
    var w = words.slice(j, j += 16);
    var oldHash = hash.slice(0, 8);
    for (i = 16; i < 64; i++){
      var w15 = w[i-15], w2 = w[i-2];
      var s0 = rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3);
      var s1 = rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    var a = hash[0], b = hash[1], c = hash[2], d = hash[3], e = hash[4], f = hash[5], g = hash[6], h = hash[7];
    for (i = 0; i < 64; i++){
      var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      var ch = (e & f) ^ (~e & g);
      var t1 = (h + S1 + ch + k[i] + w[i]) | 0;
      var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0; hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0; hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
  }
  for (i = 0; i < 8; i++){
    for (j = 3; j + 1; j--){
      var b2 = (hash[i] >> (j * 8)) & 255;
      result += ((b2 >> 4).toString(16)) + ((b2 & 15).toString(16));
    }
  }
  return result;
}

const Auth = (function(){
  const SESSION_KEY = 'PCTV_SESSION';
  const HASH_KEY = 'PCTV_HASH';
  const TTL_MS = 12 * 60 * 60 * 1000; /* sesión de 12 horas */

  /* Hash de la contraseña inicial del sistema (SHA-256 de la contraseña
     definida por el propietario; cambiar desde Configuración Económica). */
  const DEFAULT_HASH = 'c239290c04493c2fa4323950aa833d205aa752f5373a40c839d81351238c071a';

  function currentHash(){ return localStorage.getItem(HASH_KEY) || DEFAULT_HASH; }
  function valid(){
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return !!(s && s.exp && s.exp > Date.now());
    } catch(e){ return false; }
  }
  function login(pw){
    return new Promise(resolve => {
      setTimeout(() => {
        const ok = sha256(String(pw || '')) === currentHash();
        if (ok) localStorage.setItem(SESSION_KEY, JSON.stringify({exp: Date.now() + TTL_MS}));
        resolve(ok);
      }, 420); /* micro-delay para estado de carga */
    });
  }
  function logout(){ localStorage.removeItem(SESSION_KEY); }
  function changePassword(cur, next){
    if (sha256(String(cur || '')) !== currentHash()) return false;
    if (!next || next.length < 4) return false;
    localStorage.setItem(HASH_KEY, sha256(next));
    return true;
  }
  return {valid, login, logout, changePassword};
})();

/* ---------- Tema claro / oscuro (persistente, sin flash) ---------- */
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('PCTV_THEME', t); } catch(e){}
}
function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

/* ---------- Bootstrap de login ---------- */
(function(){
  const form = document.getElementById('loginForm');
  const pw = document.getElementById('loginPw');
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginErr');
  const tg = document.getElementById('pwToggle');
  if (!form) return;
  tg.addEventListener('click', () => {
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    tg.textContent = show ? 'OCULTAR' : 'VER';
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.classList.add('hidden');
    btn.classList.add('loading');
    btn.textContent = 'VERIFICANDO ACCESO';
    const ok = await Auth.login(pw.value);
    btn.classList.remove('loading');
    btn.textContent = 'ENTRAR AL SISTEMA';
    if (ok){
      document.getElementById('loginScreen').classList.add('hidden');
      if (typeof window.__enterApp === 'function') window.__enterApp();
    } else {
      err.classList.remove('hidden');
      pw.value = ''; pw.focus();
    }
  });
  const t1 = document.getElementById('themeToggleLogin');
  if (t1) t1.addEventListener('click', toggleTheme);
})();
