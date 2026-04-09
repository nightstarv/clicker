const SAVE_KEY = 'ns_clicker_save';

function saveGame() {
  // Don't save until cloud/local load is complete — prevents overwriting good data with blank state
  if (!window._accountReady) return;

  const data = {
    clickCount,
    clickPower,
    rebirthCount,
    totalClicksEver: typeof totalClicksEver !== 'undefined' ? totalClicksEver : 0,
    manualClickCount: typeof manualClickCount !== 'undefined' ? manualClickCount : 0,
    items: shopItems.map(i => ({ id: i.id, count: i.count })),
    rebirthUpgradeLevels: Object.fromEntries(
      Object.entries(rebirthUpgrades).map(([k, v]) => [k, v.level])
    ),
    achievementsUnlocked: typeof achievements !== 'undefined'
      ? achievements.filter(a => a.unlocked).map(a => a.id)
      : [],
    multMinigame: typeof clickMultiplier !== 'undefined' ? {
      clickMultiplier,
      multCurrency,
      upgradeLevels: Object.fromEntries(multUpgrades.map(u => [u.id, u.level])),
    } : null,
    autoBuy: typeof autoBuyUnlocked !== 'undefined' ? {
      unlocked: { ...autoBuyUnlocked },
      enabled:  { ...autoBuyEnabled  },
    } : null,
    autoRebirth: typeof autoRebirthUnlocked !== 'undefined' ? {
      unlocked:  autoRebirthUnlocked,
      enabled:   autoRebirthEnabled,
      threshold: autoRebirthThreshold,
    } : null,
    ascension: typeof ascensionCount !== 'undefined' ? {
      count:  ascensionCount,
      shards: ascensionShards,
      upgradeLevels: Object.fromEntries(
        Object.entries(ascensionUpgrades).map(([k, v]) => [k, v.level])
      ),
    } : null,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);

    clickCount = data.clickCount || 0;
    clickPower = data.clickPower || 1;
    rebirthCount = data.rebirthCount || 0;
    if (typeof totalClicksEver !== 'undefined') totalClicksEver = data.totalClicksEver || 0;
    if (typeof manualClickCount !== 'undefined') manualClickCount = data.manualClickCount || 0;
    (data.items || []).forEach(saved => {
      const item = shopItems.find(i => i.id === saved.id);
      if (item) item.count = saved.count || 0;
    });
    if (data.rebirthUpgradeLevels) {
      Object.entries(data.rebirthUpgradeLevels).forEach(([k, lvl]) => {
        if (rebirthUpgrades[k]) rebirthUpgrades[k].level = lvl || 0;
      });
    }
    // Restore achievements - silently re-apply bonuses without toasts
    if (data.achievementsUnlocked && typeof achievements !== 'undefined') {
      achievementCpsBonus = 0;
      achievementClickBonus = 0;
      achievementRebirthBonus = 0;
      data.achievementsUnlocked.forEach(id => {
        const ach = achievements.find(a => a.id === id);
        if (ach) {
          ach.unlocked = true;
          ach.onUnlock(); // re-apply bonus
        }
      });
    }
    // Restore multiplier minigame
    if (data.multMinigame && typeof clickMultiplier !== 'undefined') {
      clickMultiplier = data.multMinigame.clickMultiplier || 1;
      multCurrency    = data.multMinigame.multCurrency    || 0;
      if (data.multMinigame.upgradeLevels) {
        multUpgrades.forEach(u => {
          u.level = data.multMinigame.upgradeLevels[u.id] || 0;
        });
      }
    }
    // Restore auto-buy
    if (data.autoBuy && typeof autoBuyUnlocked !== 'undefined') {
      Object.assign(autoBuyUnlocked, data.autoBuy.unlocked || {});
      Object.assign(autoBuyEnabled,  data.autoBuy.enabled  || {});
    }
    // Restore auto-rebirth
    if (data.autoRebirth && typeof autoRebirthUnlocked !== 'undefined') {
      autoRebirthUnlocked  = data.autoRebirth.unlocked  || false;
      autoRebirthEnabled   = data.autoRebirth.enabled   || false;
      autoRebirthThreshold = data.autoRebirth.threshold || 1_000_000;
    }
    // Restore ascension
    if (data.ascension && typeof ascensionCount !== 'undefined') {
      ascensionCount  = data.ascension.count  || 0;
      ascensionShards = data.ascension.shards || 0;
      if (data.ascension.upgradeLevels) {
        Object.entries(data.ascension.upgradeLevels).forEach(([k, lvl]) => {
          if (ascensionUpgrades[k]) ascensionUpgrades[k].level = lvl || 0;
        });
      }
    }
  } catch (e) {
    console.warn('Save data corrupted, starting fresh.', e);
  }
}

function resetGame() {
  if (!confirm('rip your progress 2026-2026. i hope that 1 rebirth was worth it!')) return;
  localStorage.removeItem(SAVE_KEY);

  // core stats
  clickCount = 0;
  clickPower = 1;
  rebirthCount = 0;
  totalClicksEver = 0;
  manualClickCount = 0;

  // shop
  shopItems.forEach(i => i.count = 0);

  // rebirth upgrades
  Object.values(rebirthUpgrades).forEach(u => u.level = 0);

  // achievements — full wipe including bonuses
  if (typeof achievements !== 'undefined') {
    achievements.forEach(a => a.unlocked = false);
    achievementCpsBonus   = 0;
    achievementClickBonus = 0;
    if (typeof achievementRebirthBonus !== 'undefined') achievementRebirthBonus = 0;
  }

  // multiplier minigame
  if (typeof resetMultMinigame === 'function') resetMultMinigame();

  // auto-buy
  if (typeof autoBuyUnlocked !== 'undefined') {
    Object.keys(autoBuyUnlocked).forEach(k => { autoBuyUnlocked[k] = false; autoBuyEnabled[k] = true; });
  }

  // auto-rebirth
  if (typeof autoRebirthUnlocked !== 'undefined') {
    autoRebirthUnlocked  = false;
    autoRebirthEnabled   = false;
    autoRebirthThreshold = 1_000_000;
  }

  // ascension — full wipe on hard reset
  if (typeof ascensionCount !== 'undefined') {
    ascensionCount  = 0;
    ascensionShards = 0;
    Object.values(ascensionUpgrades).forEach(u => u.level = 0);
  }

  updateCps();
  updateDisplay();
  renderRebirthShop();
  renderAchievements();
  if (typeof renderAscensionShop === 'function') renderAscensionShop();
}