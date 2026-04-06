let rebirthCount = 0;
const REBIRTH_COST = 1_000_000;

// ── Rebirth upgrades ────────────────────────────────────────────────────────

const rebirthUpgrades = {

  insaneCps: {
    id: 'insaneCps',
    title: 'insane cps',
    maxLevel: 5,
    level: 0,
    costs:  [1, 2, 15, 25, 50],
    descs:  [
      '+1.2x total cps speed',
      '+1.4x total cps speed',
      '+1.6x total cps speed',
      '+1.8x total cps speed',
      '+2.0x total cps speed',
    ],
    // multiplier applied to cps
    getMultiplier() {
      const mults = [1, 1.2, 1.4, 1.6, 1.8, 2.0];
      return mults[this.level];
    },
  },

  multiRebirth: {
    id: 'multiRebirth',
    title: 'rebirth increased',
    maxLevel: 3,
    level: 0,
    costs:  [2, 8, 16],
    descs:  [
      'increases rebirth: 2x',
      'increases rebirth: 3x',
      'increases rebirth: 4x',
    ],
    getMultiplier() {
      return this.level + 1; // 1x, 2x, 3x, 4x
    },
  },

  RBcaling: {
    id: 'RBcaling',
    title: 'rebirth gain scaling',
    maxLevel: 3,
    level: 0,
    costs:  [7, 20, 75],
    descs:  [
      '3 rebirths per 3M clicks',
      '7 rebirths per 7M clicks',
      '15 rebirths per 15M clicks',
    ],
    // returns {RB, threshold} for the current level
    getScaling() {
      const table = [
        { RB: 1, threshold: 1_000_000 },   // level 0 – base (not purchased)
        { RB: 3, threshold: 3_000_000 },   // level 1
        { RB: 7, threshold: 7_000_000 },   // level 2
        { RB: 15, threshold: 15_000_000 }, // level 3
      ];
      return table[this.level];
    },
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function getRebirthRB() {
  if (clickCount < REBIRTH_COST) return 0;

  const scaling = rebirthUpgrades.RBcaling;
  const multiplier = rebirthUpgrades.multiRebirth.getMultiplier();
  const maxRebirthsByLevel = [1, 3, 7, 15];
  const maxRebirths = maxRebirthsByLevel[scaling.level] || 1;
  const baseRebirths = Math.min(Math.floor(clickCount / 1_000_000), maxRebirths);

  let rb;
  if (scaling.level === 0) {
    rb = baseRebirths >= 1 ? baseRebirths * multiplier : 0;
  } else {
    rb = baseRebirths * multiplier;
  }

  // Apply achievement rebirth bonus
  const achBonus = (typeof achievementRebirthBonus !== 'undefined') ? achievementRebirthBonus : 0;
  return Math.floor(rb * (1 + achBonus));
}

function updateRebirthCenter() {
  const container = document.getElementById('rebirth-items');
  if (!container) return;

  const card = container.querySelector('.rebirth-card');
  if (!card) return;

  const canRebirth = clickCount >= REBIRTH_COST;
  const RBOnRebirth = canRebirth ? getRebirthRB() : 0;
  const scaling = rebirthUpgrades.RBcaling.getScaling();

  const button = card.querySelector('.rebirth-btn');
  const costLabel = card.querySelector('.rebirth-cost-label');
  const gainLabel = card.querySelector('.rebirth-gain-label');
  const ownedLabel = card.querySelector('.rebirth-owned');

  if (button) {
    button.classList.toggle('rebirth-buyable', canRebirth);
    button.disabled = !canRebirth;
  }

  if (costLabel) {
    const targetClicks = canRebirth ? clickCount : scaling.threshold;
    const targetRB = canRebirth ? RBOnRebirth : scaling.RB;
    costLabel.textContent = `need ${formatNum(targetClicks)} clicks for ${targetRB} rebirth${targetRB !== 1 ? 's' : ''}`;
  }

  if (gainLabel) {
    gainLabel.innerHTML = canRebirth ? `you will gain: <b>${RBOnRebirth}</b> RB` : '';
  }

  if (ownedLabel) {
    ownedLabel.textContent = `rebirths: ${rebirthCount}`;
  }
}

// ── Core rebirth ─────────────────────────────────────────────────────────────

function doRebirth() {
  if (clickCount < REBIRTH_COST) return;

  const RB = getRebirthRB();
  rebirthCount += RB;

  clickCount = 0;
  shopItems.forEach(i => i.count = 0);

  updateCps();
  updateDisplay();
  renderRebirthShop();
}

function updateRebirthDisplay() {
  const el = document.getElementById('rebirth-display');
  if (el) el.textContent = rebirthCount;
}

// ── Buying upgrades ──────────────────────────────────────────────────────────

function buyRebirthUpgrade(id) {
  const upg = rebirthUpgrades[id];
  if (!upg || upg.level >= upg.maxLevel) return;
  const cost = upg.costs[upg.level];
  if (rebirthCount < cost) return;

  rebirthCount -= cost;
  upg.level++;

  // if insane CPS changed, recalc
  if (id === 'insaneCps') updateCps();

  updateDisplay();
  renderRebirthShop();
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderRebirthShop() {
  const container = document.getElementById('rebirth-items');
  if (!container) return;

  const canRebirth  = clickCount >= REBIRTH_COST;
  const RBOnRebirth = canRebirth ? getRebirthRB() : 0;
  const scaling = rebirthUpgrades.RBcaling.getScaling();

  // ── upgrade cards ──────────────────────────────────────────────────────────
  const upgradeCards = Object.values(rebirthUpgrades).map(upg => {
    const maxed    = upg.level >= upg.maxLevel;
    const cost     = maxed ? '—' : upg.costs[upg.level] + ' RB';
    const desc     = maxed ? '(maxed)' : upg.descs[upg.level];
    const canBuy   = !maxed && rebirthCount >= upg.costs[upg.level];
    const btnClass = maxed ? 'rb-upg-btn maxed' : canBuy ? 'rb-upg-btn buyable' : 'rb-upg-btn';
    const btnLabel = maxed ? 'maxed' : `buy (${upg.costs[upg.level]} RB)`;

    return `
      <div class="rb-upg-card">
        <div class="rb-upg-title">${upg.title}</div>
        <div class="rb-upg-desc">${desc}</div>
        <button class="${btnClass}" ${maxed ? 'disabled' : ''}
          onclick="buyRebirthUpgrade('${upg.id}')">
          ${btnLabel}
        </button>
        <div class="rb-upg-level">level: ${upg.level}/${upg.maxLevel}</div>
      </div>
    `;
  }).join('');

  // ── rebirth center card ────────────────────────────────────────────────────
  const rebirthCard = `
    <div class="rebirth-card">
      <div class="rebirth-title">✨ rebirth</div>
      <div class="rebirth-desc">
        reset all clicks &amp; shop items<br>
        scaling rewards based on rebirth gain tier
      </div>
      <div class="rebirth-cost-label">
        need ${formatNum(scaling.threshold)} clicks for ${scaling.RB} rebirth${scaling.RB > 1 ? 's' : ''}
      </div>
      ${canRebirth ? `<div class="rebirth-gain-label">you will gain: <b>${RBOnRebirth}</b> RB</div>` : '<div class="rebirth-gain-label"></div>'}
      <div class="rebirth-owned">rebirths: ${rebirthCount}</div>
      <button class="rebirth-btn ${canRebirth ? 'rebirth-buyable' : ''}" ${canRebirth ? '' : 'disabled'} onclick="doRebirth()">
        REBIRTH
      </button>
    </div>
  `;

  container.innerHTML = `
    <div class="rb-section-label">PERMANENT UPGRADES</div>
    <div class="rb-upg-grid">${upgradeCards}</div>
    <div class="rb-section-label" style="margin-top:24px;">REBIRTH CENTER</div>
    ${rebirthCard}
  `;

  updateRebirthDisplay();
  updateRebirthCenter();
}

  // ── setmultiplier ───────────────────────────────────────────────────────────

function buyRebirthUpgrade(id) {
  const upg = rebirthUpgrades[id];
  if (!upg || upg.level >= upg.maxLevel) return;

  // determine how many we want to buy
  let countToBuy = (buyMultiplier === 'max') ? (upg.maxLevel - upg.level) : buyMultiplier;
  
  for (let i = 0; i < countToBuy; i++) {
    if (upg.level >= upg.maxLevel) break;
    const cost = upg.costs[upg.level];
    if (rebirthCount < cost) break;

    rebirthCount -= cost;
    upg.level++;
  }

  if (id === 'insaneCps') updateCps();
  updateDisplay();
  renderRebirthShop();
}

// inside renderRebirthShop, change the upgradeCards mapping:
const upgradeCards = Object.values(rebirthUpgrades).map(upg => {
    const maxed = upg.level >= upg.maxLevel;
    
    // logic to calculate how many levels you can actually afford/buy
    let levelsToBuy = 0;
    let totalCost = 0;
    let tempLevel = upg.level;
    
    // determine the limit based on multiplier
    let limit = (buyMultiplier === 'max') ? (upg.maxLevel - upg.level) : buyMultiplier;

    for (let i = 0; i < limit; i++) {
      if (tempLevel < upg.maxLevel) {
        let nextCost = upg.costs[tempLevel];
        // only add to total if we can actually afford it with current rebirthCount
        if (buyMultiplier === 'max') {
           if (totalCost + nextCost <= rebirthCount) {
             totalCost += nextCost;
             levelsToBuy++;
             tempLevel++;
           } else { break; }
        } else {
           // for 10x, 25x, etc., we just sum the costs of the next N levels
           totalCost += nextCost;
           levelsToBuy++;
           tempLevel++;
        }
      }
    }

    const canBuy = !maxed && rebirthCount >= totalCost && levelsToBuy > 0;
    const btnClass = maxed ? 'rb-upg-btn maxed' : canBuy ? 'rb-upg-btn buyable' : 'rb-upg-btn';
    
    // this makes the button text dynamic!
    const btnLabel = maxed ? 'maxed' : `buy ${levelsToBuy} (${totalCost} RB)`;

    return `
      <div class="rb-upg-card">
        <div class="rb-upg-title">${upg.title}</div>
        <div class="rb-upg-desc">${maxed ? '(maxed)' : upg.descs[upg.level]}</div>
        <button class="${btnClass}" ${maxed ? 'disabled' : ''}
          onclick="buyRebirthUpgrade('${upg.id}')">
          ${btnLabel}
        </button>
        <div class="rb-upg-level">level: ${upg.level}/${upg.maxLevel}</div>
      </div>
    `;
  }).join('');

function buyrebirthupgrade(id) {
  const upg = rebirthupgrades[id];
  if (!upg || upg.level >= upg.maxlevel) return;

  let limit = (buymultiplier === 'max') ? (upg.maxlevel - upg.level) : buymultiplier;
  let totalbought = 0;

  for (let i = 0; i < limit; i++) {
    if (upg.level >= upg.maxlevel) break;
    const cost = upg.costs[upg.level];
    if (rebirthcount < cost) break;

    rebirthcount -= cost;
    upg.level++;
    totalbought++;
  }

  if (totalbought > 0) {
    if (id === 'insanecps') updatecps();
    updatedisplay();
    renderrebirthshop();
  }
}