// ── Supabase Config ───────────────────────────────────────────────────────────
const SB_URL = 'https://hrmnvtbpjjpsxmhtacgz.supabase.co';
const SB_KEY = 'sb_publishable_jlbV4rkPHukjiGew8jV9Mw_k2Mo4_rg';

// ── Session (stored in localStorage, NOT cookies) ─────────────────────────────
const SESSION_KEY = 'ns_clicker_session';

let currentUser = null; // { id, username }

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setSession(user) {
  currentUser = user;
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}

// ── Supabase fetch helper ─────────────────────────────────────────────────────
async function sbFetch(path, method = 'GET', body = null, extra = {}) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      ...extra,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(SB_URL + path, opts);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ── Password hashing (simple SHA-256 via Web Crypto) ──────────────────────────
async function hashPassword(password) {
  const enc = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Build game_data snapshot ──────────────────────────────────────────────────
function buildGameData() {
  return {
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
  };
}

// ── Apply loaded game_data into game state ────────────────────────────────────
function applyGameData(data) {
  if (!data) return;
  clickCount  = data.clickCount  || 0;
  clickPower  = data.clickPower  || 1;
  rebirthCount = data.rebirthCount || 0;
  if (typeof totalClicksEver  !== 'undefined') totalClicksEver  = data.totalClicksEver  || 0;
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

  if (data.achievementsUnlocked && typeof achievements !== 'undefined') {
    achievementCpsBonus = 0;
    achievementClickBonus = 0;
    if (typeof achievementRebirthBonus !== 'undefined') achievementRebirthBonus = 0;
    data.achievementsUnlocked.forEach(id => {
      const ach = achievements.find(a => a.id === id);
      if (ach) { ach.unlocked = true; ach.onUnlock(); }
    });
  }

  if (data.multMinigame && typeof clickMultiplier !== 'undefined') {
    clickMultiplier = data.multMinigame.clickMultiplier || 1;
    multCurrency    = data.multMinigame.multCurrency    || 0;
    if (data.multMinigame.upgradeLevels) {
      multUpgrades.forEach(u => {
        u.level = data.multMinigame.upgradeLevels[u.id] || 0;
      });
    }
  }

  updateCps();
  updateDisplay();
  renderShop();
  renderRebirthShop();
  if (typeof renderAchievements === 'function') renderAchievements();
  if (typeof renderMultMinigame === 'function') renderMultMinigame();
}

// ── Sign Up ───────────────────────────────────────────────────────────────────
async function accountSignUp(username, password) {
  if (!username || !password) return { ok: false, error: 'fill in all fields' };
  if (username.length < 3)    return { ok: false, error: 'username must be 3+ chars' };
  if (password.length < 6)    return { ok: false, error: 'password must be 6+ chars' };

  // Check username taken
  const check = await sbFetch(`/rest/v1/players?username=eq.${encodeURIComponent(username)}&select=id`);
  if (check.data && check.data.length > 0) return { ok: false, error: 'username already taken' };

  const hashed = await hashPassword(password);
  const gameData = buildGameData();

  const res = await sbFetch('/rest/v1/players', 'POST', {
    username,
    password_hash: hashed,
    clicks: Math.floor(clickCount),
    rebirths: rebirthCount,
    game_data: gameData,
  }, { 'Prefer': 'return=representation' });

  if (!res.ok) return { ok: false, error: res.data?.message || 'signup failed' };

  const user = res.data[0];
  setSession({ id: user.id, username: user.username });
  return { ok: true };
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function accountLogin(username, password) {
  if (!username || !password) return { ok: false, error: 'fill in all fields' };

  const hashed = await hashPassword(password);
  const res = await sbFetch(
    `/rest/v1/players?username=eq.${encodeURIComponent(username)}&password_hash=eq.${hashed}&select=*`
  );

  if (!res.ok || !res.data || res.data.length === 0)
    return { ok: false, error: 'wrong username or password' };

  const user = res.data[0];
  setSession({ id: user.id, username: user.username });

  // Load cloud save into game
  if (user.game_data) applyGameData(user.game_data);

  return { ok: true };
}

// ── Logout — clears session AND resets progress to guest state ────────────────
function accountLogout() {
  if (!confirm('logging out will reset your local progress to guest. your cloud save is safe — you can log back in anytime!')) return;
  setSession(null);

  // wipe all local progress
  localStorage.removeItem('ns_clicker_save');
  clickCount    = 0;
  clickPower    = 1;
  rebirthCount  = 0;
  totalClicksEver  = 0;
  manualClickCount = 0;
  shopItems.forEach(i => i.count = 0);
  Object.values(rebirthUpgrades).forEach(u => u.level = 0);
  if (typeof achievements !== 'undefined') {
    achievements.forEach(a => a.unlocked = false);
    achievementCpsBonus   = 0;
    achievementClickBonus = 0;
    if (typeof achievementRebirthBonus !== 'undefined') achievementRebirthBonus = 0;
  }
  if (typeof clickMultiplier !== 'undefined') {
    clickMultiplier = 1.0;
    multCurrency    = 0.0;
    multUpgrades.forEach(u => u.level = 0);
  }

  updateCps();
  updateDisplay();
  renderShop();
  renderRebirthShop();
  if (typeof renderAchievements === 'function') renderAchievements();
  if (typeof renderMultMinigame === 'function') renderMultMinigame();
  renderSettingsPanel();
}

// ── Cloud save (push local → Supabase) ───────────────────────────────────────
async function cloudSave() {
  if (!currentUser) return;
  const gameData = buildGameData();
  await sbFetch(`/rest/v1/players?id=eq.${currentUser.id}`, 'PATCH', {
    clicks:    Math.floor(clickCount),
    rebirths:  rebirthCount,
    game_data: gameData,
  });
}

// Auto cloud-save every 15 seconds when logged in
setInterval(() => { if (currentUser) cloudSave(); }, 15000);

// ── Render into settings panel ────────────────────────────────────────────────
function renderAccountPanel() { renderSettingsPanel(); } // alias for backwards compat

function renderSettingsPanel() {
  const container = document.getElementById('account-panel');
  if (!container) return;

  if (currentUser) {
    container.innerHTML = `
      <div class="acc-card">
        <div class="acc-title">👤 ${currentUser.username}</div>
        <div class="acc-desc">progress is synced to the cloud every 15 seconds</div>
        <div class="acc-stat-row">
          <span class="acc-stat-label">clicks</span>
          <span class="acc-stat-val">${formatNum(Math.floor(clickCount))}</span>
        </div>
        <div class="acc-stat-row">
          <span class="acc-stat-label">rebirths</span>
          <span class="acc-stat-val">${rebirthCount}</span>
        </div>
        <button class="acc-btn acc-btn-save" onclick="cloudSaveManual()">☁️ save now</button>
        <button class="acc-btn acc-btn-logout" onclick="accountLogout()">🚪 logout</button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="acc-card">
        <div class="acc-title">👤 account</div>
        <div class="acc-desc">sign in to save progress to the cloud &amp; appear on the leaderboard. logging out resets local progress.</div>
        <div id="acc-error" class="acc-error hidden"></div>

        <div class="acc-tabs">
          <button class="acc-tab active" id="acc-tab-login" onclick="switchAccTab('login')">login</button>
          <button class="acc-tab" id="acc-tab-signup" onclick="switchAccTab('signup')">create account</button>
        </div>

        <div id="acc-form-login" class="acc-form">
          <input class="acc-input" id="acc-login-user" type="text" placeholder="username" autocomplete="username" />
          <input class="acc-input" id="acc-login-pass" type="password" placeholder="password" autocomplete="current-password" />
          <button class="acc-btn acc-btn-primary" id="acc-login-btn" onclick="handleLogin()">login</button>
        </div>

        <div id="acc-form-signup" class="acc-form hidden">
          <input class="acc-input" id="acc-signup-user" type="text" placeholder="username" autocomplete="username" />
          <input class="acc-input" id="acc-signup-pass" type="password" placeholder="password (6+ chars)" autocomplete="new-password" />
          <button class="acc-btn acc-btn-primary" id="acc-signup-btn" onclick="handleSignUp()">create account</button>
        </div>
      </div>
    `;
  }
}

function switchAccTab(tab) {
  document.getElementById('acc-tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('acc-tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('acc-form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('acc-form-signup').classList.toggle('hidden', tab !== 'signup');
  clearAccError();
}

function showAccError(msg) {
  const el = document.getElementById('acc-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearAccError() {
  const el = document.getElementById('acc-error');
  if (el) el.classList.add('hidden');
}

function setAccLoading(loading, mode) {
  // only disable the active button to avoid touching hidden form's button
  const btnId = mode === 'signup' ? 'acc-signup-btn' : 'acc-login-btn';
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'loading...' : (mode === 'signup' ? 'create account' : 'login');
}

async function handleLogin() {
  clearAccError();
  const username = document.getElementById('acc-login-user')?.value.trim();
  const password = document.getElementById('acc-login-pass')?.value;
  setAccLoading(true, 'login');
  const res = await accountLogin(username, password);
  setAccLoading(false, 'login');
  if (!res.ok) { showAccError(res.error); return; }
  renderSettingsPanel();
}

async function handleSignUp() {
  clearAccError();
  const username = document.getElementById('acc-signup-user')?.value.trim();
  const password = document.getElementById('acc-signup-pass')?.value;
  setAccLoading(true, 'signup');
  const res = await accountSignUp(username, password);
  setAccLoading(false, 'signup');
  if (!res.ok) { showAccError(res.error); return; }
  renderSettingsPanel();
}

async function cloudSaveManual() {
  const btn = document.querySelector('.acc-btn-save');
  if (btn) { btn.textContent = 'saving...'; btn.disabled = true; }
  await cloudSave();
  if (btn) {
    btn.textContent = '✅ saved!';
    setTimeout(() => { btn.textContent = '☁️ save now'; btn.disabled = false; }, 1500);
  }
}

// ── Init: restore session on page load ───────────────────────────────────────
(function initAccount() {
  const session = getSession();
  if (session) currentUser = session;
})();