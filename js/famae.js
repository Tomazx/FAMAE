/* ============================================================
   FAMAE — SCRIPTS PRINCIPALES
   famae.js
   ============================================================

   ÍNDICE:
   01. Boot Screen (secuencia de arranque + audio sintetizado)
   02. Splash Post-Boot (pantalla de bienvenida)
   03. Barra de Estado (reloj + uptime)
   04. Discord Member Counter (fetch cada 60s)
   05. Ventana HUD (close + drag)
   06. Partículas (3 capas: polvo, streaks, flares)
   07. Scroll Reveal + Ping de radar
   08. Barra de Tensión (animación al entrar en vista)
   09. Terminal de Logs Tácticos
   10. HUD Data Streams (texto lateral)
   11. Audio Táctico (SFX de interfaz)
   12. Glitch del título FAMAE (sincronizado)
   ============================================================ */
// ════════════════════════════════════════════════════════
  //  CONFIGURACIÓN DE AUDIO — editá solo esta sección
  // ════════════════════════════════════════════════════════

  const MUSIC_FILE = 'Sounds/ambient.mp3'; // música ambiental en loop — mp3/ogg/wav
  const MUSIC_VOLUME = 0.18;               // qué tan fuerte suena la música (0.0–1.0)
                                           // mantenelo bajo (0.1–0.25) para que no tape los sfx

  const SFX_FILES = {
    hover:    'Sounds/hover.mp3',    // pasar el mouse por nav, cards, botones
    click:    'Sounds/click.mp3',    // click en links del nav
    confirm:  'Sounds/confirm.flac', // click en Discord / CTA / redes
    ping:     'Sounds/ping.wav',     // al aparecer cada sección en el scroll
    glitch:   'Sounds/glitch.mp3',   // cada 8s sincronizado con el glitch del título
    poweron:  'Sounds/poweron.wav',  // al activar el audio
    poweroff: 'Sounds/poweroff.wav'  // al desactivar el audio
  };

  const SFX_VOLUME = 0.8; // volumen general de los efectos (0.0–1.0)

  // ════════════════════════════════════════════════════════

  let soundOn = false;
  const sfxCache = {};

  // precarga de efectos
  Object.entries(SFX_FILES).forEach(([key, path]) => {
    const a = new Audio(path);
    a.preload = 'auto';
    sfxCache[key] = a;
  });

  // música ambiental — se crea una sola vez y hace loop
  const musicTrack = new Audio(MUSIC_FILE);
  musicTrack.loop    = true;
  musicTrack.volume  = MUSIC_VOLUME;
  musicTrack.preload = 'auto';

  function playSFX(key, vol = 1) {
    if (!soundOn && key !== 'poweron' && key !== 'poweroff') return;
    const base = sfxCache[key];
    if (!base) return;
    const node = base.cloneNode(true);
    node.volume = Math.min(1, Math.max(0, vol * SFX_VOLUME));
    node.play().catch(() => {});
  }

  // ── TOGGLE DE SONIDO ──
  const soundBtn  = document.getElementById('sound-toggle');
  const wavesPath = document.getElementById('sound-waves');
  const xLine1    = document.getElementById('sound-x1');
  const xLine2    = document.getElementById('sound-x2');
  const soundLabel = document.getElementById('sound-label');

  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.classList.toggle('active', soundOn);
    wavesPath.style.display  = soundOn ? '' : 'none';
    xLine1.style.display     = soundOn ? 'none' : '';
    xLine2.style.display     = soundOn ? 'none' : '';
    soundLabel.textContent   = soundOn ? 'AUDIO ACTIVO' : 'ACTIVAR AUDIO';

    if (soundOn) {
      playSFX('poweron');
      musicTrack.play().catch(() => {});  // arranca la música
    } else {
      playSFX('poweroff');
      // fade out de la música en 1.5 segundos en vez de cortar seco
      const fadeOut = setInterval(() => {
        if (musicTrack.volume > 0.015) {
          musicTrack.volume = Math.max(0, musicTrack.volume - 0.015);
        } else {
          musicTrack.pause();
          musicTrack.currentTime = 0;
          musicTrack.volume = MUSIC_VOLUME; // restaura para el próximo play
          clearInterval(fadeOut);
        }
      }, 30);
    }
  });

  // ── HOOKS DE INTERACCIÓN ──
  document.querySelectorAll('.nav-links a').forEach(el => {
    el.addEventListener('mouseenter', () => playSFX('hover', 0.8));
    el.addEventListener('click',      () => playSFX('click'));
  });

  document.querySelectorAll('.card, .member, .stat').forEach(el => {
    el.addEventListener('mouseenter', () => playSFX('hover', 0.55));
    el.addEventListener('click',      () => playSFX('hover', 0.55));
  });

  document.querySelectorAll('.hero-cta, .discord-cta, .social-link').forEach(el => {
    el.addEventListener('mouseenter', () => playSFX('hover', 0.8));
    el.addEventListener('click',      () => playSFX('confirm'));
  });

  // ══════════════════════════════════════
  // JS § 06 — PARTÍCULAS (3 capas: polvo, streaks, flares)
  // ══════════════════════════════════════
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  let W, H;
  let dust = [], streaks = [], flares = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // CAPA 1 — polvo flotante (partículas clásicas, más densas)
  class Dust {
    constructor(init) { this.reset(init); }
    reset(init) {
      this.x     = Math.random() * W;
      this.y     = init ? Math.random() * H : H + 5;
      this.size  = Math.random() * 1.8 + 0.2;
      this.vy    = -(Math.random() * 0.35 + 0.08);
      this.vx    = (Math.random() - 0.5) * 0.18;
      this.alpha = Math.random() * 0.55 + 0.08;
      this.pulse = Math.random() * Math.PI * 2;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.pulse += 0.018;
      if (this.y < -5) this.reset(false);
    }
    draw() {
      const a = this.alpha * (0.65 + 0.35 * Math.sin(this.pulse));
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(192,57,43,${a})`;
      ctx.fill();
    }
  }

  // CAPA 2 — líneas de datos que caen (tipo HUD táctico)
  class Streak {
    constructor(init) { this.reset(init); }
    reset(init) {
      this.x      = Math.random() * W;
      this.y      = init ? Math.random() * H : -60;
      this.len    = Math.random() * 55 + 18;
      this.speed  = Math.random() * 1.2 + 0.4;
      this.alpha  = Math.random() * 0.18 + 0.04;
      this.width  = Math.random() < 0.15 ? 1.5 : 0.7; // alguna más gruesa
    }
    update() {
      this.y += this.speed;
      if (this.y - this.len > H) this.reset(false);
    }
    draw() {
      const grad = ctx.createLinearGradient(this.x, this.y - this.len, this.x, this.y);
      grad.addColorStop(0, `rgba(192,57,43,0)`);
      grad.addColorStop(1, `rgba(192,57,43,${this.alpha})`);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - this.len);
      ctx.lineTo(this.x, this.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth   = this.width;
      ctx.stroke();
    }
  }

  // CAPA 3 — destellos de radar (cruces que parpadean y desaparecen)
  class Flare {
    constructor() { this.spawn(); }
    spawn() {
      this.x      = Math.random() * W;
      this.y      = Math.random() * H;
      this.life   = 0;
      this.maxLife = Math.random() * 90 + 40;
      this.size   = Math.random() * 3 + 1.5;
      this.delay  = Math.random() * 300; // frames antes de aparecer el próximo
    }
    update() {
      if (this.delay > 0) { this.delay--; return; }
      this.life++;
      if (this.life > this.maxLife) this.spawn();
    }
    draw() {
      if (this.delay > 0) return;
      const t = this.life / this.maxLife;
      const a = t < 0.3
        ? t / 0.3                  // fade in
        : t > 0.7
          ? (1 - t) / 0.3          // fade out
          : 1;                     // pleno
      const s = this.size * (0.8 + 0.2 * Math.sin(this.life * 0.25));
      ctx.strokeStyle = `rgba(192,57,43,${a * 0.6})`;
      ctx.lineWidth = 0.8;
      // cruz
      ctx.beginPath();
      ctx.moveTo(this.x - s, this.y); ctx.lineTo(this.x + s, this.y);
      ctx.moveTo(this.x, this.y - s); ctx.lineTo(this.x, this.y + s);
      ctx.stroke();
      // punto central
      ctx.beginPath();
      ctx.arc(this.x, this.y, 0.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(192,57,43,${a * 0.9})`;
      ctx.fill();
    }
  }

  // inicializar las 3 capas
  for (let i = 0; i < 160; i++) dust.push(new Dust(true));
  for (let i = 0; i < 35;  i++) streaks.push(new Streak(true));
  for (let i = 0; i < 18;  i++) flares.push(new Flare());

  function loop() {
    ctx.clearRect(0, 0, W, H);
    streaks.forEach(s => { s.update(); s.draw(); });
    dust.forEach(d    => { d.update(); d.draw(); });
    flares.forEach(f  => { f.update(); f.draw(); });
    requestAnimationFrame(loop);
  }
  loop();

  // ══════════════════════════════════════
  // JS § 07 — SCROLL REVEAL + TENSIÓN
  // ══════════════════════════════════════
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        if (e.target.dataset.sound === 'ping') playSFX('ping');
        // animar barra de tensión cuando entra en vista
        if (e.target.closest('#intel')) {
          setTimeout(() => {
            const fill = document.getElementById('tension-fill');
            if (fill && fill.style.width === '0%') fill.style.width = '28%';
          }, 400);
        }
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach(r => observer.observe(r));

  // ══════════════════════════════════════
  // JS § 01 — BOOT SCREEN + SPLASH
  // ══════════════════════════════════════
  (function() {
    const screen    = document.getElementById('boot-screen');
    const container = document.getElementById('boot-lines');

    // ─ Audio sintetizado para el tecleo (no necesita archivos externos) ─
    let bootCtx = null;
    let audioUnlocked = false;

    function unlockBootAudio() {
      if (audioUnlocked) return;
      try {
        bootCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (bootCtx.state === 'suspended') bootCtx.resume();
        audioUnlocked = true;
      } catch(e) {}
    }

    // click mecánico de tecla — ruido blanco cortísimo con highpass
    function keyClick(vol = 0.35) {
      if (!bootCtx) return;
      try {
        const t   = bootCtx.currentTime;
        const buf = bootCtx.createBuffer(1, bootCtx.sampleRate * 0.03, bootCtx.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = bootCtx.createBufferSource();
        src.buffer = buf;
        const hp  = bootCtx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 4000;
        const g   = bootCtx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
        src.connect(hp).connect(g).connect(bootCtx.destination);
        src.start(t); src.stop(t + 0.03);
      } catch(e) {}
    }

    // beep de error/corrupción — tono bajo que cae
    function corruptBeep() {
      if (!bootCtx) return;
      try {
        const t   = bootCtx.currentTime;
        const osc = bootCtx.createOscillator();
        const g   = bootCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.25);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.3, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(g).connect(bootCtx.destination);
        osc.start(t); osc.stop(t + 0.3);
      } catch(e) {}
    }

    // ─ Líneas del boot ─
    const lines = [
      { text: 'FAMAE TACTICAL OS v2.4.1 — BIOS POST OK',           tag: null,  delay: 0   },
      { text: 'CPU: FAMAE-X4 @ 3.8GHz ... [4 cores detected]',     tag: null,  delay: 180 },
      { text: 'RAM: 32768MB DDR5 ... ',                             tag: 'OK',  delay: 320 },
      { text: 'STORAGE: /dev/sda1 FAMAE_ROOT ... ',                 tag: 'OK',  delay: 440 },
      { text: 'Initializing cryptographic modules ... ',            tag: 'OK',  delay: 580 },
      { text: 'Loading kernel: famae-tactical-5.15.0 ...',          tag: null,  delay: 700 },
      { text: '[    0.000] Booting Linux kernel 5.15.0-famae',      tag: null,  delay: 820 },
      { text: '[    0.183] ACPI: IRQ0 used by override',            tag: null,  delay: 900 },
      { text: '[    0.421] PCI: Bus 0000:00 root complex',          tag: null,  delay: 980 },
      { text: '[    0.834] NET: Registered PF_INET protocol family',tag: null,  delay: 1060 },
      { text: 'Starting AES-256 encryption layer ... ',             tag: 'OK',  delay: 1180 },
      { text: 'Mounting encrypted volumes ... ',                    tag: 'OK',  delay: 1300 },
      { text: 'Starting tactical comms daemon ... ',                tag: 'OK',  delay: 1420 },
      { text: 'Loading FAMAE PMC mission database ... ',            tag: 'OK',  delay: 1540 },
      { text: 'Authenticating operator credentials ...',            tag: null,  delay: 1660 },
      { text: '>>> ACCESS GRANTED — CLEARANCE LEVEL: ALPHA',        tag: null,  delay: 1900 },
      { text: 'Starting FAMAE interface ... ',                      tag: 'OK',  delay: 2050 },
      { text: '',                                                    tag: null,  delay: 2200 },
      { text: 'Welcome, operator. Stay frosty.',                    tag: null,  delay: 2300 },
    ];

    let timers = [];

    function spawnLine(data) {
      const div = document.createElement('div');
      div.className = 'boot-line' + (data.tag === 'OK' ? ' ok' : data.tag === 'FAIL' ? ' fail' : '');
      if (data.text) {
        div.textContent = data.text;
        if (data.tag) {
          const span = document.createElement('span');
          span.className = 'boot-tag';
          span.textContent = ' [ ' + data.tag + ' ]';
          div.appendChild(span);
        }
      }
      container.appendChild(div);
      // aparece de golpe — sin fade, instantáneo como un boot real
      div.style.opacity = '1';
      div.classList.add('show');
      // sonido de enter/línea nueva
      keyClick(0.3 + Math.random() * 0.1);
    }

    // Desbloquear audio al primer movimiento/click — la pantalla cubre todo
    document.addEventListener('mousemove', unlockBootAudio, { once: true });
    document.addEventListener('keydown',   unlockBootAudio, { once: true });
    document.addEventListener('touchstart',unlockBootAudio, { once: true, passive: true });
    // intento inmediato (funciona en algunos navegadores sin interacción)
    setTimeout(unlockBootAudio, 100);

    lines.forEach(line => {
      timers.push(setTimeout(() => spawnLine(line), line.delay));
    });

    // cursor parpadeando
    timers.push(setTimeout(() => {
      const cur = document.createElement('div');
      cur.className = 'boot-line show';
      cur.innerHTML = '<span class="boot-cursor"></span>';
      container.appendChild(cur);
    }, 2450));

    // corrupción
    timers.push(setTimeout(() => {
      corruptBeep();
      screen.classList.add('corrupting');
      container.querySelectorAll('.boot-line').forEach(el => {
        if (Math.random() > 0.4) el.classList.add('boot-glitch');
      });
    }, 3000));

    timers.push(setTimeout(() => {
      const chars = '█▓▒░╔╗╚╝║═╠╣╦╩╬▄▀■□▪▫';
      const all = container.querySelectorAll('.boot-line');
      let itr = 0;
      const corrupt = setInterval(() => {
        if (itr > 18) { clearInterval(corrupt); return; }
        // beep rápido de estática durante la corrupción
        if (itr % 4 === 0) keyClick(0.4);
        all.forEach(el => {
          if (Math.random() > 0.6) {
            const arr = el.textContent.split('');
            for (let i = 0; i < 4; i++) {
              const pos = Math.floor(Math.random() * arr.length);
              arr[pos] = chars[Math.floor(Math.random() * chars.length)];
            }
            el.textContent = arr.join('');
          }
        });
        itr++;
      }, 60);
    }, 3200));

    timers.push(setTimeout(() => {
      // detener la corrupción
      screen.classList.remove('corrupting');
      screen.style.animation = 'none';
      // limpiar y mostrar splash
      container.innerHTML = '';
      screen.style.opacity = '1';
      screen.style.transition = 'none';
      const splash = document.getElementById('boot-splash');
      if (splash) {
        splash.classList.add('show');
        // animar porcentaje
        const pct = document.getElementById('splash-pct');
        if (pct) {
          let v = 0;
          const iv = setInterval(() => {
            v = Math.min(100, v + Math.floor(Math.random() * 8 + 2));
            pct.textContent = v + '%';
            if (v >= 100) clearInterval(iv);
          }, 60);
        }
      }
      // fade out del boot + splash juntos
      setTimeout(() => {
        screen.style.transition = 'opacity 0.5s ease';
        screen.style.opacity = '0';
        if (splash) {
          splash.style.transition = 'opacity 0.5s ease';
          splash.style.opacity = '0';
        }
        setTimeout(() => {
          screen.classList.add('hidden');
          if (splash) splash.classList.remove('show');
          if (bootCtx) bootCtx.close();
        }, 520);
      }, 2200);
    }, 3500));

    screen.addEventListener('click', () => {
      unlockBootAudio();
      timers.forEach(clearTimeout);
      screen.style.transition = 'opacity 0.2s';
      screen.style.opacity = '0';
      setTimeout(() => {
        screen.classList.add('hidden');
        if (bootCtx) bootCtx.close();
      }, 220);
    });
  })();

  // ══════════════════════════════════════
  // JS § 02 — RELOJ & UPTIME (barra + panel intel + neofetch)
  // ══════════════════════════════════════
  const startTime = Date.now();
  function pad(n) { return String(n).padStart(2, '0'); }
  function updateClock() {
    const now = new Date();
    const hh = pad(now.getHours()), mm = pad(now.getMinutes()), ss = pad(now.getSeconds());
    const timeStr = `${hh}:${mm}:${ss}`;
    ['hud-clock','intel-clock'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = timeStr;
    });
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const uh = pad(Math.floor(elapsed / 3600));
    const um = pad(Math.floor((elapsed % 3600) / 60));
    const us = pad(elapsed % 60);
    const uptimeStr = `${uh}:${um}:${us}`;
    ['hud-uptime','intel-uptime'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = uptimeStr;
    });
    // neofetch uptime en formato más humano
    const neo = document.getElementById('neo-uptime');
    if (neo) {
      const days = Math.floor(elapsed / 86400);
      const hrs  = Math.floor((elapsed % 86400) / 3600);
      const mins = Math.floor((elapsed % 3600) / 60);
      neo.textContent = days > 0
        ? `${days} days, ${hrs} hours, ${mins} mins`
        : hrs > 0 ? `${hrs} hours, ${mins} mins`
        : `${mins} mins`;
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ══════════════════════════════════════
  // JS § 03 — CONTADOR DISCORD
  // ══════════════════════════════════════
  async function fetchDiscordStats() {
    try {
      const res  = await fetch('https://discord.com/api/v9/invites/UkWFk54NVW?with_counts=true');
      const data = await res.json();
      const total  = data.approximate_member_count;
      const online = data.approximate_presence_count;
      if (total) {
        document.getElementById('dc-total').textContent = total.toLocaleString();
        const sm = document.getElementById('stat-members');
        if (sm) sm.textContent = total.toLocaleString();
      }
      if (online) {
        document.getElementById('dc-online').textContent = online.toLocaleString();
        const so = document.getElementById('stat-online');
        if (so) so.textContent = online.toLocaleString();
      }
    } catch (e) { /* sin conexión, queda en — */ }
  }
  fetchDiscordStats();
  setInterval(fetchDiscordStats, 60000);

  // ══════════════════════════════════════
  // JS § 09 — TERMINAL TÁCTICA (logs)
  // ══════════════════════════════════════
  (function() {
    const body   = document.getElementById('term-body');
    if (!body) return;
    const MAX_LINES = 18;
    let lines = [];

    function ts() {
      const n = new Date();
      const mo = String(n.getMonth()+1).padStart(2,'0');
      const d  = String(n.getDate()).padStart(2,'0');
      const h  = String(n.getHours()).padStart(2,'0');
      const mi = String(n.getMinutes()).padStart(2,'0');
      const s  = String(n.getSeconds()).padStart(2,'0');
      return `${mo}/${d} ${h}:${mi}:${s}`;
    }
    function pid() { return Math.floor(Math.random()*32000+1000); }
    function ip()  { return `10.${r(0,4)}.${r(1,254)}.${r(1,254)}`; }
    function r(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
    function seq(){ return String(r(1000,9999)); }
    function ms() { return r(1,180)+'ms'; }
    const hosts = ['famae-alpha','famae-bravo','famae-cmd','famae-int01','famae-vpn'];
    const ifaces = ['eth0','wg0','tun0','lo'];
    const ports  = [443,22,51820,4500,1194,8443];
    function host(){ return hosts[r(0,hosts.length-1)]; }

    // Plantillas de logs — contextualmente coherentes
    const templates = [
      // systemd / kernel
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-s">systemd[1]:</span> <span class="term-d">famae-tactical.service: active (running) since ${r(0,23)}h${r(0,59)}m</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-s">kernel:</span> <span class="term-d">wg0: peer ${r(1,9)} handshake initiated (${ip()}:${51820})</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-s">kernel:</span> <span class="term-d">nf_conntrack: new connection src=${ip()} dst=${ip()} proto=UDP</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-s">systemd[1]:</span> <span class="term-d">Starting famae-comms-daemon.service...</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-s">systemd[1]:</span> <span class="term-s">Started famae-comms-daemon.service.</span>`,
      // WireGuard VPN
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">wg-quick[${pid()}]:</span> <span class="term-s">[wg0] Peer authenticated — AllowedIPs 10.0.0.0/24</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">wg-quick[${pid()}]:</span> <span class="term-d">handshake for peer ${r(1,9)} (${ip()}:${51820}) completed in ${ms()}</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-w">wg-quick[${pid()}]:</span> <span class="term-w">peer ${r(1,9)}: keepalive timeout, retrying...</span>`,
      // SSH / auth
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">sshd[${pid()}]:</span> <span class="term-s">Accepted publickey for famae-ops from ${ip()} port ${r(40000,65000)} ssh2: RSA SHA256</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">sshd[${pid()}]:</span> <span class="term-d">pam_unix(sshd:session): session opened for user famae-ops</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-e">sshd[${pid()}]:</span> <span class="term-e">Failed password for invalid user root from ${ip()} port ${r(40000,65000)}</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">sshd[${pid()}]:</span> <span class="term-d">Disconnected from ${ip()} port ${r(40000,65000)}: user requested [preauth]</span>`,
      // iptables / nftables
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-w">kernel:</span> <span class="term-w">iptables DROP IN=eth0 SRC=${ip()} DST=${ip()} PROTO=TCP DPT=${ports[r(0,ports.length-1)]}</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">nftables[${pid()}]:</span> <span class="term-s">rule added: ip saddr ${ip()} accept chain input</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">nftables[${pid()}]:</span> <span class="term-d">flushing ruleset... reloading famae-firewall.nft</span>`,
      // GPG / cifrado
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-c">gpg[${pid()}]:</span> <span class="term-c">encrypted message for key 0xFAMAE${seq()}: AES256/SHA512</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-c">gpg[${pid()}]:</span> <span class="term-c">signature verification OK — uid: famae-comms <ops@famae.mil></span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-c">openssl[${pid()}]:</span> <span class="term-c">TLS 1.3 session established — cipher TLS_AES_256_GCM_SHA384</span>`,
      // PostgreSQL — base de datos táctica
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">postgres[${pid()}]:</span> <span class="term-d">LOG: connection received: host=${ip()} port=${r(40000,65000)} user=famae_db</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">postgres[${pid()}]:</span> <span class="term-d">LOG: execute: SELECT * FROM operativos WHERE estado='activo'</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">postgres[${pid()}]:</span> <span class="term-d">LOG: checkpoint complete: wrote ${r(10,400)} buffers (${r(0,5)}.${r(0,9)}%)</span>`,
      // rsync / backup
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">rsync[${pid()}]:</span> <span class="term-s">sent ${r(10,999)}K bytes received ${r(1,9)}K — /var/famae/intel/ → backup@${ip()}</span>`,
      // cron
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">cron[${pid()}]:</span> <span class="term-d">CMD (/opt/famae/scripts/sync-discord.sh)</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">cron[${pid()}]:</span> <span class="term-d">CMD (/opt/famae/scripts/threat-assessment.py --region sahel)</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">cron[${pid()}]:</span> <span class="term-d">CMD (/opt/famae/scripts/check-comms.sh --encrypt --key famae-primary)</span>`,
      // red / interfaz
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">NetworkManager[${pid()}]:</span> <span class="term-s">${ifaces[r(0,3)]}: link connected (${r(100,1000)} Mbit/s)</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-n">dhclient[${pid()}]:</span> <span class="term-n">bound to ${ip()} — lease time ${r(3600,86400)}s</span>`,
      // journald / misc
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-d">systemd-journald[${pid()}]:</span> <span class="term-d">Rotating journal file /var/log/journal/ (${r(10,500)}M used)</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-w">kernel:</span> <span class="term-w">audit: rate limit exceeded — ${r(1,50)} messages suppressed</span>`,
      () => `<span class="term-t">${ts()}</span> <span class="term-h">famae-srv-01</span> <span class="term-s">famae-watchdog[${pid()}]:</span> <span class="term-s">all services nominal — uptime ${r(1,99)}d ${r(0,23)}h ${r(0,59)}m</span>`,
    ];

    function addLine(html) {
      const div = document.createElement('div');
      div.className = 'term-line';
      div.innerHTML = html;
      // insertar antes del cursor
      const cursor = body.querySelector('.term-cursor')?.parentElement || body;
      body.insertBefore(div, body.lastChild);
      lines.push(div);
      // mantener máximo de líneas visibles
      if (lines.length > MAX_LINES) {
        lines[0].remove();
        lines.shift();
      }
      // scroll suave al fondo
      body.scrollTop = body.scrollHeight;
    }

    function addRandomLog() {
      const t = templates[r(0, templates.length-1)];
      addLine(t());
    }

    // carga inicial — 6 líneas para que no arranque vacío
    for (let i = 0; i < 6; i++) addRandomLog();

    // velocidad variable — como un sistema real que tiene picos
    function scheduleNext() {
      const delay = r(800, 3200);
      setTimeout(() => { addRandomLog(); scheduleNext(); }, delay);
    }
    scheduleNext();
  })();
  // ══════════════════════════════════════
  // JS § 04 — VENTANA SYS: CERRAR + ARRASTRAR
  // ══════════════════════════════════════
  (function() {
    const win      = document.querySelector('.hud-window');
    const closeBtn = document.getElementById('hud-close');
    if (!win) return;

    // ── cerrar ──
    if (closeBtn) {
      closeBtn.addEventListener('click', e => {
        e.stopPropagation();
        win.style.transition = 'opacity 0.25s, transform 0.25s';
        win.style.opacity    = '0';
        win.style.transform  = 'translateY(8px)';
        setTimeout(() => win.style.display = 'none', 260);
      });
    }

    // ── arrastrar ──
    let dragging = false, ox = 0, oy = 0;
    win.addEventListener('mousedown', e => {
      if (e.target === closeBtn) return;
      dragging = true;
      ox = e.clientX - win.getBoundingClientRect().left;
      oy = e.clientY - win.getBoundingClientRect().top;
      win.style.transition = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const x = Math.max(0, Math.min(window.innerWidth  - win.offsetWidth,  e.clientX - ox));
      const y = Math.max(0, Math.min(window.innerHeight - win.offsetHeight, e.clientY - oy));
      win.style.left = x + 'px'; win.style.top = y + 'px'; win.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => { dragging = false; });
    win.addEventListener('touchstart', e => {
      const t = e.touches[0]; dragging = true;
      ox = t.clientX - win.getBoundingClientRect().left;
      oy = t.clientY - win.getBoundingClientRect().top;
    }, { passive: true });
    document.addEventListener('touchmove', e => {
      if (!dragging) return;
      const t = e.touches[0];
      const x = Math.max(0, Math.min(window.innerWidth  - win.offsetWidth,  t.clientX - ox));
      const y = Math.max(0, Math.min(window.innerHeight - win.offsetHeight, t.clientY - oy));
      win.style.left = x + 'px'; win.style.top = y + 'px'; win.style.bottom = 'auto';
    }, { passive: true });
    document.addEventListener('touchend', () => { dragging = false; });
  })();

  // ══════════════════════════════════════
  // JS § 05 — HUD DATA STREAMS (laterales)
  // ══════════════════════════════════════
  const streamData = [
    'FAMAE','PMC','BRM5','OPERATIVO','CIFRADO','COORD',
    '27°S','70°W','SAHEL','ESCOLTA','CONVOY','INTEL',
    'SEC-04','AUTH','SYS','ONLINE','ACTIVO','RTB',
    'CALLSIGN','BRAVO','ROMEO','MIKE','FOXTROT','KILO',
    'AES256','ENCRYPT','CANAL','SEGURO','ACK','XMIT',
    'LAT','LNG','ALT','MGRS','WP','LZ','HLZ','EVA',
  ];
  function buildStream(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const repeated = Array.from({length: 120}, () =>
      streamData[Math.floor(Math.random() * streamData.length)]
    ).join(' ∙ ');
    el.textContent = repeated + ' ∙ ' + repeated; // doble para loop suave
  }
  buildStream('stream-left');
  buildStream('stream-right');
  // animation: glitch 8s 2s infinite → el glitch ocurre ~93% del ciclo de 8s
  const GLITCH_FIRST = 2000 + 8000 * 0.93;
  setTimeout(function glitchLoop() {
    playSFX('glitch');
    setInterval(() => playSFX('glitch'), 8000);
  }, GLITCH_FIRST);
