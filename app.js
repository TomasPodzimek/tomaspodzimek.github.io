// ============================================
// Kozel – Zapisovač bodů – Hlavní logika
// ============================================

(function () {
  'use strict';

  // --- State ---
  let playerCount = 4;
  let playerNames = [];
  let scores = [];
  let history = [];
  let roundNumber = 0;
  let gameOver = false;
  let roundScores = []; // body zadané v aktuálním kole
  let isHlasene = false;
  let eliminated = []; // indexy vyřazených hráčů

  // --- DOM refs ---
  const $ = (id) => document.getElementById(id);
  const screenSetup = $('screen-setup');
  const screenScore = $('screen-score');
  const screenRound = $('screen-round');

  // ============================================
  // SCREEN MANAGEMENT
  // ============================================
  function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
    window.scrollTo(0, 0);
  }

  // ============================================
  // SETUP SCREEN
  // ============================================
  function initSetup() {
    renderPlayerCount();
    renderPlayerNames();

    // Player count buttons
    $('player-count-btns').addEventListener('click', (e) => {
      const btn = e.target.closest('.count-btn');
      if (!btn) return;
      playerCount = parseInt(btn.dataset.count);
      renderPlayerCount();
      renderPlayerNames();
    });

    // Start game
    $('btn-start-game').addEventListener('click', startGame);

    // Lineups
    $('btn-save-lineup').addEventListener('click', showSaveLineupModal);
    $('btn-load-lineup').addEventListener('click', showLoadLineupModal);
    $('btn-close-lineup-modal').addEventListener('click', () => $('modal-lineup').classList.add('hidden'));
    $('btn-confirm-save-lineup').addEventListener('click', confirmSaveLineup);
    $('btn-cancel-save-lineup').addEventListener('click', () => $('modal-save-lineup').classList.add('hidden'));
  }

  function renderPlayerCount() {
    document.querySelectorAll('.count-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.count) === playerCount);
    });
  }

  function renderPlayerNames() {
    const container = $('player-names');
    const existingNames = [];
    container.querySelectorAll('input').forEach(inp => existingNames.push(inp.value));

    container.innerHTML = '';
    for (let i = 0; i < playerCount; i++) {
      const row = document.createElement('div');
      row.className = 'player-name-row';
      row.innerHTML = `
        <span class="player-number">${i + 1}</span>
        <input type="text" class="input player-name-input" placeholder="Hráč ${i + 1}" value="${existingNames[i] || ''}" data-index="${i}">
      `;
      container.appendChild(row);
    }
  }

  function getPlayerNames() {
    const names = [];
    document.querySelectorAll('.player-name-input').forEach((inp, i) => {
      names.push(inp.value.trim() || `Hráč ${i + 1}`);
    });
    return names;
  }

  // --- Lineups ---
  function getLineups() {
    try {
      return JSON.parse(localStorage.getItem('kozel-lineups') || '[]');
    } catch {
      return [];
    }
  }

  function saveLineups(lineups) {
    localStorage.setItem('kozel-lineups', JSON.stringify(lineups));
  }

  function showSaveLineupModal() {
    $('lineup-name-input').value = '';
    $('modal-save-lineup').classList.remove('hidden');
    $('lineup-name-input').focus();
  }

  function confirmSaveLineup() {
    const name = $('lineup-name-input').value.trim();
    if (!name) return;

    const names = getPlayerNames();
    const lineups = getLineups();
    lineups.push({ name, count: playerCount, players: names });
    saveLineups(lineups);
    $('modal-save-lineup').classList.add('hidden');
  }

  function showLoadLineupModal() {
    const lineups = getLineups();
    const container = $('modal-lineup-list');

    if (lineups.length === 0) {
      container.innerHTML = '<p style="color:#999;text-align:center;padding:16px 0">Žádné uložené sestavy</p>';
    } else {
      container.innerHTML = lineups.map((l, i) => `
        <div class="modal-lineup-item">
          <div class="modal-lineup-info">
            <div class="modal-lineup-name">${esc(l.name)}</div>
            <div class="modal-lineup-players">${l.count} hráčů: ${l.players.map(esc).join(', ')}</div>
          </div>
          <div class="modal-lineup-btns">
            <button class="btn-icon load" data-idx="${i}" title="Načíst">✓</button>
            <button class="btn-icon delete" data-idx="${i}" title="Smazat">✕</button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.btn-icon.load').forEach(btn => {
        btn.addEventListener('click', () => {
          const lineup = lineups[parseInt(btn.dataset.idx)];
          playerCount = lineup.count;
          renderPlayerCount();
          renderPlayerNames();
          // Fill names
          const inputs = document.querySelectorAll('.player-name-input');
          lineup.players.forEach((name, i) => {
            if (inputs[i]) inputs[i].value = name;
          });
          $('modal-lineup').classList.add('hidden');
        });
      });

      container.querySelectorAll('.btn-icon.delete').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          lineups.splice(idx, 1);
          saveLineups(lineups);
          showLoadLineupModal(); // refresh
        });
      });
    }

    $('modal-lineup').classList.remove('hidden');
  }

  // ============================================
  // START GAME
  // ============================================
  function startGame() {
    playerNames = getPlayerNames();
    scores = new Array(playerCount).fill(0);
    history = [];
    roundNumber = 0;
    gameOver = false;
    eliminated = [];
    showScoreScreen();
  }

  // ============================================
  // SCORE SCREEN
  // ============================================
  function showScoreScreen() {
    showScreen(screenScore);
    renderScoreTable();
    renderHistory();
    $('round-badge').textContent = `Kolo ${roundNumber + 1}`;
    $('btn-undo-round').disabled = history.length === 0;
    $('btn-next-round').style.display = gameOver ? 'none' : '';
    $('game-over').classList.add('hidden');

    if (gameOver) {
      showGameOver();
    }
  }

  function renderScoreTable(lastRoundScores) {
    const tbody = screenScore.querySelector('.score-table tbody');
    tbody.innerHTML = '';

    // Find max score (closest to 100)
    let maxScore = -Infinity;
    scores.forEach((s, i) => {
      if (!eliminated.includes(i) && s > maxScore) maxScore = s;
    });

    scores.forEach((score, i) => {
      const tr = document.createElement('tr');

      // Determine row class
      if (eliminated.includes(i)) {
        tr.className = 'eliminated';
      } else if (score >= 80) {
        tr.className = 'danger';
      } else if (score === maxScore && score > 0) {
        tr.className = 'warning';
      }

      let changeHtml = '';
      if (lastRoundScores && lastRoundScores[i] !== undefined) {
        const val = lastRoundScores[i];
        if (val > 0) {
          changeHtml = `<span class="score-change positive">+${val}</span>`;
        } else if (val < 0) {
          changeHtml = `<span class="score-change negative">${val}</span>`;
        }
      }

      tr.innerHTML = `
        <td>${esc(playerNames[i])}</td>
        <td>${score}${changeHtml}${eliminated.includes(i) ? ' ☠️' : ''}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function showGameOver() {
    const overlay = $('game-over');
    const losers = eliminated.map(i => playerNames[i]);
    $('game-over-msg').textContent = `${losers.join(', ')} prohrál${losers.length > 1 ? 'i' : ''}!`;

    const scoresDiv = $('game-over-scores');
    scoresDiv.innerHTML = scores.map((s, i) => `
      <div class="score-line ${eliminated.includes(i) ? 'loser' : ''}">
        <span>${esc(playerNames[i])}</span>
        <span>${s} bodů${eliminated.includes(i) ? ' ☠️' : ''}</span>
      </div>
    `).join('');

    overlay.classList.remove('hidden');
  }

  // --- Score screen events ---
  function initScoreScreen() {
    $('btn-next-round').addEventListener('click', () => {
      if (gameOver) return;
      showRoundScreen();
    });

    $('btn-undo-round').addEventListener('click', undoLastRound);

    $('btn-new-game').addEventListener('click', () => {
      if (confirm('Opravdu chceš začít novou hru?')) {
        showScreen(screenSetup);
      }
    });

    $('btn-new-game-over').addEventListener('click', () => {
      showScreen(screenSetup);
    });

    $('btn-toggle-history').addEventListener('click', () => {
      const container = $('history-container');
      const btn = $('btn-toggle-history');
      if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.textContent = 'Historie kol ▲';
      } else {
        container.classList.add('hidden');
        btn.textContent = 'Historie kol ▼';
      }
    });
  }

  function undoLastRound() {
    if (history.length === 0) return;
    const last = history.pop();
    roundNumber--;

    // Restore scores
    scores = last.scoresBefore.slice();
    eliminated = last.eliminatedBefore ? last.eliminatedBefore.slice() : [];
    gameOver = false;

    showScoreScreen();
  }

  function renderHistory() {
    const container = $('history-list');
    if (history.length === 0) {
      container.innerHTML = '<p style="color:#999;text-align:center;padding:8px">Zatím žádná kola</p>';
      return;
    }

    // Calculate cumulative scores after each round
    const cumulScores = [];
    const running = new Array(playerCount).fill(0);
    history.forEach((h, i) => {
      for (let j = 0; j < playerCount; j++) {
        running[j] += h.roundScores[j];
        // Apply 100 → 90 rule for display
        if (running[j] === 100) running[j] = 90;
      }
      cumulScores.push(running.slice());
    });

    container.innerHTML = history.map((h, i) => `
      <div class="history-round">
        <div class="history-round-header">
          <span>Kolo ${i + 1}</span>
          <span class="history-round-type">${h.type === 'hlasene' ? 'Hlášené (40)' : 'Běžné (20)'}</span>
        </div>
        <div class="history-round-scores">
          ${h.roundScores.map((s, j) => `
            <span class="history-score-item">${esc(playerNames[j])}: <span class="history-score-value">${s > 0 ? '+' + s : s}</span> <span class="history-cumul">(${cumulScores[i][j]})</span></span>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  // ============================================
  // ROUND SCREEN
  // ============================================
  function showRoundScreen(editMode) {
    showScreen(screenRound);
    isHlasene = false;
    $('toggle-hlasene').checked = false;
    roundScores = new Array(playerCount).fill(null);
    renderRoundPlayers();
    updateRemainingBadge();

    $('btn-confirm-round').disabled = true;
  }

  function initRoundScreen() {
    $('toggle-hlasene').addEventListener('change', (e) => {
      isHlasene = e.target.checked;
      // Reset all selections when toggling
      roundScores = new Array(playerCount).fill(null);
      renderRoundPlayers();
      updateRemainingBadge();
      $('btn-confirm-round').disabled = true;
    });

    $('btn-confirm-round').addEventListener('click', confirmRound);
    $('btn-cancel-round').addEventListener('click', () => showScoreScreen());
  }

  function getLimit() {
    return isHlasene ? 40 : 20;
  }

  function getOdmazValue() {
    return isHlasene ? -20 : -10;
  }

  function getAllowedBaseValues() {
    // Regular: 0, 1-8, 12-20 (gap at 9-11: can't have 9-11 with 1 big=12 + 8 small=1)
    // Hlášené: same values ×2: 0, 2, 4, 6, 8, 10, 12, 14, 16, 24, 26, 28, 30, 32, 34, 36, 38, 40
    const mult = isHlasene ? 2 : 1;
    const vals = [0];
    for (let i = 1; i <= 8; i++) vals.push(i * mult);
    for (let i = 12; i <= 20; i++) vals.push(i * mult);
    return vals;
  }

  function getNonOdmazSum() {
    // Sum only non-odmaz (>= 0) assigned values
    return roundScores.reduce((sum, v) => {
      if (v !== null && v >= 0) return sum + v;
      return sum;
    }, 0);
  }

  function getAvailableValues(playerIndex) {
    const canOdmaz = playerCount <= 4;
    const available = [];

    // Odmaz is always available for 3-4 players (doesn't count in sum)
    if (canOdmaz) {
      available.push(getOdmazValue());
    }

    // Card model works for both regular and hlášené (just ×2)
    const allBase = getAllowedBaseValues();
    for (const val of allBase) {
      if (canOthersCoverCards(playerIndex, val)) {
        available.push(val);
      }
    }

    return available;
  }

  function canOthersCoverCards(playerIndex, valueForPlayer) {
    // Card model:
    // Regular: 1 big card (12) + 8 small cards (1 each) = 20
    // Hlášené: 1 big card (24) + 8 small cards (2 each) = 40
    // The big card threshold is 12*mult, small card value is 1*mult
    const mult = isHlasene ? 2 : 1;
    const bigCardVal = 12 * mult;  // 12 or 24
    const smallCardVal = 1 * mult; // 1 or 2
    const totalSmallCards = 8;     // always 8 small cards

    let usedSmall = 0;  // count of small cards used (not points)
    let bigTaken = false;
    let nonOdmazUnassigned = 0;

    // Tally already assigned non-odmaz values (excluding current player)
    roundScores.forEach((v, i) => {
      if (i === playerIndex) return;
      if (v === null) {
        nonOdmazUnassigned++;
      } else if (v >= bigCardVal) {
        bigTaken = true;
        usedSmall += (v - bigCardVal) / smallCardVal;
      } else if (v >= 0) {
        usedSmall += v / smallCardVal;
      }
      // odmaz values (< 0) are ignored
    });

    // Apply current player's value
    if (valueForPlayer >= bigCardVal) {
      if (bigTaken) return false; // only one big card
      bigTaken = true;
      usedSmall += (valueForPlayer - bigCardVal) / smallCardVal;
    } else {
      usedSmall += valueForPlayer / smallCardVal;
    }

    const remainingSmall = totalSmallCards - usedSmall;
    if (remainingSmall < 0) return false;

    if (!bigTaken) {
      if (nonOdmazUnassigned < 1) return false;
      return remainingSmall <= nonOdmazUnassigned * totalSmallCards;
    }

    return remainingSmall <= nonOdmazUnassigned * totalSmallCards;
  }

  function renderRoundPlayers() {
    const container = $('round-players');
    container.innerHTML = '';

    for (let i = 0; i < playerCount; i++) {
      const card = document.createElement('div');
      card.className = 'round-player-card';

      const currentVal = roundScores[i];
      const available = getAvailableValues(i);
      const odmaz = getOdmazValue();
      const canOdmaz = playerCount <= 4;

      // All possible values for buttons
      const allBase = getAllowedBaseValues();
      let allValues = canOdmaz ? [odmaz, ...allBase] : [...allBase];

      // Build point buttons HTML
      const buttonsHtml = allValues.map(val => {
        const isSelected = currentVal === val;
        const isAvailable = available.includes(val);
        const isOdmaz = val < 0;
        const label = isOdmaz ? `${val}` : `${val}`;

        const classes = [
          'point-btn',
          isOdmaz ? 'odmaz' : '',
          isSelected ? 'selected' : '',
          !isAvailable && !isSelected ? 'disabled' : ''
        ].filter(Boolean).join(' ');

        return `<button class="${classes}" data-player="${i}" data-value="${val}">${label}</button>`;
      }).join('');

      const selectedHtml = currentVal !== null
        ? `<span class="round-player-selected">${currentVal > 0 ? '+' + currentVal : currentVal}</span>`
        : '';

      card.innerHTML = `
        <div class="round-player-header">
          <span class="round-player-name">${esc(playerNames[i])}</span>
          <div>
            <span class="round-player-score">(${scores[i]} b.)</span>
            ${selectedHtml}
          </div>
        </div>
        <div class="point-buttons">${buttonsHtml}</div>
      `;

      container.appendChild(card);
    }

    // Add click handlers
    container.querySelectorAll('.point-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pi = parseInt(btn.dataset.player);
        const val = parseInt(btn.dataset.value);

        if (roundScores[pi] === val) {
          // Deselect
          roundScores[pi] = null;
        } else {
          roundScores[pi] = val;
        }

        renderRoundPlayers();
        updateRemainingBadge();
        checkConfirmButton();
      });
    });
  }

  function updateRemainingBadge() {
    const limit = getLimit();
    const assigned = getNonOdmazSum();
    const remaining = limit - assigned;
    $('remaining-badge').textContent = `Zbývá: ${remaining}`;
  }

  function checkConfirmButton() {
    const limit = getLimit();
    const allAssigned = roundScores.every(v => v !== null);
    const nonOdmazSum = getNonOdmazSum();
    $('btn-confirm-round').disabled = !(allAssigned && nonOdmazSum === limit);
  }

  function confirmRound() {
    const limit = getLimit();
    const nonOdmazSum = getNonOdmazSum();

    if (nonOdmazSum !== limit) return;

    // Save history entry
    const entry = {
      round: roundNumber + 1,
      type: isHlasene ? 'hlasene' : 'bezne',
      roundScores: roundScores.slice(),
      scoresBefore: scores.slice(),
      eliminatedBefore: eliminated.slice()
    };
    history.push(entry);
    roundNumber++;

    // Apply scores
    const lastRoundScores = roundScores.slice();
    for (let i = 0; i < playerCount; i++) {
      scores[i] += roundScores[i];

      // Rule: exactly 100 → set to 90
      if (scores[i] === 100) {
        scores[i] = 90;
      }

      // Rule: over 100 → eliminated
      if (scores[i] > 100 && !eliminated.includes(i)) {
        eliminated.push(i);
        gameOver = true;
      }
    }

    showScoreScreen();
    renderScoreTable(lastRoundScores);
  }

  // ============================================
  // UTILITY
  // ============================================
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================
  // INIT
  // ============================================
  function init() {
    initSetup();
    initScoreScreen();
    initRoundScreen();
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
