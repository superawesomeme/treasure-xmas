// script.js — v0.2 (overlay + confetti + Katibeh end-game title)
document.addEventListener('DOMContentLoaded', () => {
  // Disable board interactions while the setup overlay is open
  document.body.classList.add('overlay-open');

  // ---- DOM refs ----
  const setupForm = document.getElementById('setup-form');
  const gameSetup = document.getElementById('game-setup');
  const gridElement = document.getElementById('grid');
  const scoreboard = document.getElementById('scoreboard');
  const playerNamesContainer = document.getElementById('player-names-container');
  const playerCountDropdown = document.getElementById('num-players');
  const fsBtn = document.getElementById('fs-btn');

  // Result overlay (added in HTML for v0.2)
  const resultOverlay = document.getElementById('result-overlay');
  const resultTitle = document.getElementById('result-title');
  const restartBtnOverlay = document.getElementById('restart-btn-overlay');
  const confettiCanvas = document.getElementById('confetti-canvas');

  // Ensure scoreboard has logo + players container (defensive)
  ensureScoreboardShell();

  // ---- Config ----
  const totalTiles = 36; // 6x6
  // Assets (your latest versions)
  const trapImg  = '/treasure/images/skull-25.png';
  const chestImg = '/treasure/images/treasure-25.png';
  const logoSrc  = '/treasure/images/logo.png';

  // ---- Game state ----
  let trapCount = 0;
  let treasureCount = 0;
  let tiles, treasureIndices, trapIndices, treasures;
  let players = [];
  let currentPlayerIndex = 0;
  let turns = 0;
  let gameEnded = false;

  // ---- Setup inputs ----
  generatePlayerNameFields(parseInt(playerCountDropdown.value, 10));
  playerCountDropdown.addEventListener('change', e => {
    generatePlayerNameFields(parseInt(e.target.value, 10));
  });

  // Columns rule for the setup panel:
  // 1–5 players  => 1 column
  // 6–10 players => 2 columns
  // 11–20 players => 4 columns (5 per column)
  function generatePlayerNameFields(numPlayers) {
    playerNamesContainer.innerHTML = '';

    // Reset layout classes
    playerNamesContainer.classList.remove('two-col', 'four-col');

    if (numPlayers >= 11) {
      playerNamesContainer.classList.add('four-col');
    } else if (numPlayers >= 6) {
      playerNamesContainer.classList.add('two-col');
    }

    for (let i = 0; i < numPlayers; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.classList.add('player-name');
      input.placeholder = `Jugador ${i + 1}`;
      playerNamesContainer.appendChild(input);
    }
  }

  // ---- Fullscreen helpers ----
  async function enterFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); // Safari
    } catch {}
  }
  async function exitFullscreen() {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); // Safari
    } catch {}
  }

  fsBtn?.addEventListener('click', () => {
    document.fullscreenElement ? exitFullscreen() : enterFullscreen();
  });

  // ---- Start game from setup ----
  setupForm.addEventListener('submit', async e => {
    e.preventDefault();
    await enterFullscreen();

    const difficulty = document.getElementById('difficulty').value;
    const numPlayers = parseInt(playerCountDropdown.value, 10);

    players = Array.from(document.querySelectorAll('.player-name'), (input, i) => ({
      name: input.value || `Jugador ${i + 1}`,
      score: 0,
      skipTurn: false
    }));

    // Randomize traps/treasures per game
    trapCount = getRandomInt(4, 8);
    treasureCount = getRandomInt(15, 23);

    // Hide overlay, enable board interactions
    gameSetup.classList.add('hidden');
    document.body.classList.remove('overlay-open');

    startGame(difficulty);
  });

  // ---- Overlay restart ----
  restartBtnOverlay?.addEventListener('click', () => location.reload());

  // ---- Game loop helpers ----
  function startGame(difficulty) {
    turns = 0;
    gameEnded = false;
    currentPlayerIndex = 0;

    const [min, max] = difficulty === 'easy' ? [1, 99] : [100, 999];
    tiles = generateUniqueTiles(totalTiles, min, max).sort((a, b) => a - b);

    treasureIndices = generateUniqueIndices(treasureCount, totalTiles);
    treasures = generateTreasureValues(treasureIndices.length);
    trapIndices = generateTrapIndices(trapCount, totalTiles, treasureIndices);

    renderScoreboard();
    renderGrid();
  }

  // Scoreboard rule:
  // 1–10 players => 1 column
  // 11–20 players => 2 columns
  function renderScoreboard() {
    scoreboard.classList.toggle('two-col', players.length >= 11);

    const list = players.map((p, i) =>
      `<div class="player ${i === currentPlayerIndex ? 'current-player' : ''} ${p.skipTurn ? 'skipping' : ''}">
         ${p.name}: €${p.score}
       </div>`
    ).join('');

    const playersContainer = scoreboard.querySelector('.players');
    if (playersContainer) {
      playersContainer.innerHTML = list;
    } else {
      // Fallback: ensure shell exists if missing
      scoreboard.innerHTML = `
        <img src="${logoSrc}" alt="Isla del Tesoro" class="scoreboard-logo" />
        <div class="players">${list}</div>
      `;
    }
  }

  function renderGrid() {
    gridElement.innerHTML = '';
    tiles.forEach((tile, index) => {
      const el = document.createElement('div');
      el.classList.add('tile');
      el.innerHTML = `
        <div class="tile-inner">
          <div class="tile-front">${tile}</div>
          <div class="tile-back">&nbsp;</div>
        </div>`;
      el.dataset.index = index;
      el.addEventListener('click', () => handleTileClick(el, index), { once: true });
      gridElement.appendChild(el);
    });
  }

  function handleTileClick(tileElement, index) {
    if (gameEnded) return;
    if (tileElement.classList.contains('flipped')) return;

    // If current player was marked to skip (edge race), consume and advance
    if (players[currentPlayerIndex].skipTurn) {
      players[currentPlayerIndex].skipTurn = false;
      advanceTurn(true);
      return;
    }

    turns++;
    const tileBack = tileElement.querySelector('.tile-back');

    if (treasureIndices.includes(index)) {
      const val = treasures[treasureIndices.indexOf(index)];
      players[currentPlayerIndex].score += val;
      tileBack.classList.add('treasure');
      tileBack.innerHTML = `<img src="${chestImg}" alt="Tesoro" /><div class="value">€${val}</div>`;
    } else if (trapIndices.includes(index)) {
      tileBack.classList.add('trap');
      tileBack.innerHTML = `<img src="${trapImg}" alt="Trampa" />`;

      if (players.length === 1) {
        tileElement.classList.add('flipped');
        setTimeout(() => endGame(true), 300);
        return;
      }

      // Multi-player: mark this player to skip next turn
      players[currentPlayerIndex].skipTurn = true;
    } else {
      tileBack.classList.add('safe');
    }

    // Reveal the tile
    tileElement.classList.add('flipped');

    // Update scoreboard immediately (so skipping/red or fainting/etc. shows now)
    renderScoreboard();

    // If that was the last tile, end game shortly after
    if (document.querySelectorAll('.tile:not(.flipped)').length === 0) {
      setTimeout(() => endGame(false), 300);
      return;
    }

    // Next player's turn
    advanceTurn(false);
  }

  // Advance logic that CONSUMES skip only when the player's turn arrives.
  function advanceTurn(skipOnly) {
    // Move to next player
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;

    // If next player is flagged to skip, consume now (this is their missed go)
    while (players[currentPlayerIndex].skipTurn) {
      players[currentPlayerIndex].skipTurn = false; // consume the skipped turn
      renderScoreboard(); // reflect that this player is no longer in skip state
      // Move on to following player
      currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
      // Loop continues in case multiple consecutive players were skipping
    }

    renderScoreboard();
    if (skipOnly) renderScoreboard();
  }

  // End-game now uses overlay (Katibeh styled via CSS)
  function endGame(isTrapLoss) {
    gameEnded = true;

    if (isTrapLoss) {
      // Single player lost to trap
      if (resultTitle) resultTitle.textContent =
        `¡Juego terminado! ${players[0].name} encontró una trampa y perdió.`;
      showResultOverlay(false);
      return;
    }

    // Multi-player winner
    const winner = players.reduce((max, p) => (p.score > max.score ? p : max));
    if (resultTitle) resultTitle.textContent =
      `¡Victoria! ${winner.name} gana con €${winner.score}`;
    showResultOverlay(true);
  }

  function showResultOverlay(withConfetti) {
    if (!resultOverlay) return;
    resultOverlay.classList.remove('hidden');
    resultOverlay.setAttribute('aria-hidden', 'false');

    if (withConfetti && confettiCanvas) {
      runConfetti(confettiCanvas, 200000); 
    }
  }

  // Lightweight confetti — no external libs
  function runConfetti(canvas, durationMs = 200000) {
    const ctx = canvas.getContext('2d');
    let w, h, start, rafId;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const colors = ['#fff8dc', '#eedba6', '#d1b48b', '#fac044', '#b8860b'];
    const N = Math.floor((innerWidth + innerHeight) / 12);
    const parts = [];

    function resize() {
      w = canvas.width = Math.floor(window.innerWidth * DPR);
      h = canvas.height = Math.floor(window.innerHeight * DPR);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }
    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize, { passive: true });

    for (let i = 0; i < N; i++) {
      parts.push({
        x: Math.random() * w,
        y: -Math.random() * h * 0.5,
        vx: (Math.random() - 0.5) * 0.8 * DPR,
        vy: (1 + Math.random() * 2) * DPR,
        size: (4 + Math.random() * 8) * DPR,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() < 0.5 ? 'rect' : 'circle'
      });
    }

    function draw(t) {
      if (!start) start = t;
      const elapsed = t - start;
      ctx.clearRect(0, 0, w, h);

      for (const p of parts) {
        p.vy += 0.02 * DPR;   // gravity
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;

        // wrap horizontally
        if (p.x < -20 * DPR) p.x = w + 20 * DPR;
        if (p.x >  w + 20 * DPR) p.x = -20 * DPR;

        // draw
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (elapsed < durationMs) {
        rafId = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, w, h);
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', onResize);
      }
    }
    rafId = requestAnimationFrame(draw);
  }

  // ---- Utilities ----
  function generateUniqueTiles(count, min, max) {
    const set = new Set();
    while (set.size < count) set.add(getRandomInt(min, max));
    return Array.from(set);
  }

  function generateUniqueIndices(count, total) {
    const set = new Set();
    while (set.size < count) set.add(getRandomInt(0, total - 1));
    return Array.from(set);
  }

  function generateTrapIndices(count, total, exclude) {
    const excludeSet = new Set(exclude);
    const out = new Set();
    while (out.size < count) {
      const idx = getRandomInt(0, total - 1);
      if (!excludeSet.has(idx)) out.add(idx);
    }
    return Array.from(out);
  }

  function generateTreasureValues(count) {
    return Array.from({ length: count }, () => getRandomInt(1, 99));
  }

  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function ensureScoreboardShell() {
    if (!scoreboard) return;
    // Ensure logo
    if (!scoreboard.querySelector('.scoreboard-logo')) {
      const img = document.createElement('img');
      img.className = 'scoreboard-logo';
      img.alt = 'Isla del Tesoro';
      img.src = logoSrc;
      scoreboard.prepend(img);
    }
    // Ensure players container
    if (!scoreboard.querySelector('.players')) {
      const div = document.createElement('div');
      div.className = 'players';
      scoreboard.appendChild(div);
    }
  }
});


