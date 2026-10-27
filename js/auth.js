(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;
  const UI = WP.ui;

  const SESSION_KEY = 'wijaya-pos-session';
  const FLASH_KEY = 'wijaya-pos-auth-flash';
  const ITERATIONS = 150000;
  const MIN_PASSWORD = 4;
  const USERNAME_RE = /^[a-zA-Z0-9._-]{3,24}$/;
  const ADMIN_ONLY_ROUTES = ['reports', 'settings', 'suppliers'];

  let onAuthenticated = null;
  let initialized = false;

  function S() { return WP.store; }
  function APP() { return WP.app; }

  function authError(message) {
    const err = new Error(message);
    err.userMessage = message;
    return err;
  }

  function authData() {
    const raw = (S() && typeof S().getAuth === 'function') ? S().getAuth() : null;
    if (!raw || typeof raw !== 'object') return { version: 1, admin: null, cashierLogins: {} };
    return {
      version: 1,
      admin: raw.admin || null,
      cashierLogins: raw.cashierLogins || {}
    };
  }

  function isConfigured() {
    const admin = authData().admin;
    return !!(admin && admin.hash && admin.salt);
  }

  function cryptoReady() {
    return !!(window.crypto && window.crypto.subtle && window.crypto.getRandomValues);
  }

  /* ---------------- crypto ---------------- */
  function bytesToBase64(bytes) {
    const arr = new Uint8Array(bytes);
    let binary = '';
    for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
    return btoa(binary);
  }

  function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function randomSalt() {
    const salt = new Uint8Array(16);
    window.crypto.getRandomValues(salt);
    return bytesToBase64(salt);
  }

  async function derive(password, saltB64, iterations) {
    if (!cryptoReady()) {
      throw authError('Secure password checking is unavailable in this browser. Open the app with the Wijaya Pattalaya shortcut (Chrome).');
    }
    const enc = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
      'raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await window.crypto.subtle.deriveBits({
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64ToBytes(saltB64),
      iterations: Number(iterations) || ITERATIONS
    }, key, 256);
    return bytesToBase64(bits);
  }

  function hashesMatch(a, b) {
    const x = String(a || '');
    const y = String(b || '');
    if (x.length !== y.length) return false;
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
    return diff === 0;
  }

  function nextRevision() {
    return Date.now() * 1000 + Math.floor(Math.random() * 1000);
  }

  async function makeRecord(username, password, name) {
    const salt = randomSalt();
    const hash = await derive(password, salt, ITERATIONS);
    return {
      name: name || '',
      username: username,
      salt: salt,
      hash: hash,
      iterations: ITERATIONS,
      updatedAt: U.nowStamp(),
      revision: nextRevision()
    };
  }

  /* ---------------- validation ---------------- */
  function cleanName(value) {
    const name = String(value || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2) throw authError('Enter a name with at least 2 characters.');
    if (name.length > 60) throw authError('Keep the name under 60 characters.');
    return name;
  }

  function cleanUsername(value) {
    const username = String(value || '').trim();
    if (!USERNAME_RE.test(username)) {
      throw authError('Username must be 3–24 characters and can only use letters, numbers, dots, dashes or underscores.');
    }
    return username;
  }

  function validatePassword(password, confirm) {
    const pass = String(password || '');
    if (pass.length < MIN_PASSWORD) throw authError('Password must be at least ' + MIN_PASSWORD + ' characters.');
    if (pass.length > 120) throw authError('Keep the password under 120 characters.');
    if (String(confirm || '') !== pass) throw authError('The two passwords do not match.');
    return pass;
  }

  function usernameTaken(username, opts) {
    const options = opts || {};
    const target = String(username || '').toLowerCase();
    const auth = authData();
    if (!options.admin && auth.admin && String(auth.admin.username || '').toLowerCase() === target) return true;
    if (options.admin && auth.admin) {
      if (String(options.currentAdminUsername || '').toLowerCase() === target) {
        // same account, no conflict
      } else if (String(auth.admin.username || '').toLowerCase() === target) {
        return true;
      }
    }
    const ids = Object.keys(auth.cashierLogins);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const rec = auth.cashierLogins[id];
      if (!rec) continue;
      if (options.cashierId !== undefined && Number(options.cashierId) === Number(id)) continue;
      if (String(rec.username || '').toLowerCase() === target) return true;
    }
    return false;
  }

  function assertUsernameFree(username, opts) {
    if (usernameTaken(username, opts)) throw authError('That username is already used by another account.');
  }

  function findAccountByUsername(input) {
    const target = String(input || '').trim().toLowerCase();
    if (!target) return null;
    const auth = authData();
    if (auth.admin && String(auth.admin.username || '').toLowerCase() === target) {
      return { type: 'admin', record: auth.admin };
    }
    const ids = Object.keys(auth.cashierLogins);
    for (let i = 0; i < ids.length; i++) {
      const rec = auth.cashierLogins[ids[i]];
      if (rec && String(rec.username || '').toLowerCase() === target) {
        return { type: 'cashier', cashierId: Number(ids[i]), record: rec };
      }
    }
    return null;
  }

  function suggestUsername(name) {
    let base = String(name || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 18);
    if (base.length < 3) base = 'cashier';
    let candidate = base;
    let n = 2;
    while (usernameTaken(candidate)) {
      candidate = base.slice(0, 19) + n;
      n++;
    }
    return candidate;
  }

  /* ---------------- session ---------------- */
  function readSession() {
    try {
      return U.safeParse(sessionStorage.getItem(SESSION_KEY), null);
    } catch (e) {
      return null;
    }
  }

  function writeSession(session) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      throw authError('This browser blocked session storage, so sign-in cannot continue. Use the shop shortcut (Chrome).');
    }
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* noop */ }
  }

  function userFromSession() {
    const session = readSession();
    if (!session) return null;
    const auth = authData();
    if (session.role === 'admin') {
      if (!auth.admin) return null;
      if (Number(session.revision || 0) !== Number(auth.admin.revision || 0)) return null;
      return {
        role: 'admin',
        name: auth.admin.name || auth.admin.username,
        username: auth.admin.username,
        signedInAt: session.signedInAt || ''
      };
    }
    if (session.role === 'cashier') {
      const login = auth.cashierLogins[String(session.cashierId)];
      if (!login) return null;
      const cashier = S().cashierById(session.cashierId);
      if (!cashier || cashier.active === false) return null;
      if (Number(session.revision || 0) !== Number(login.revision || 0)) return null;
      return {
        role: 'cashier',
        cashierId: cashier.id,
        name: cashier.name,
        username: login.username,
        signedInAt: session.signedInAt || ''
      };
    }
    return null;
  }

  function getUser() { return userFromSession(); }
  function isLoggedIn() { return !!userFromSession(); }
  function isAdmin() {
    const user = userFromSession();
    return !!user && user.role === 'admin';
  }
  function isCashier() {
    const user = userFromSession();
    return !!user && user.role === 'cashier';
  }
  function getCashierId() {
    const user = userFromSession();
    return user && user.role === 'cashier' ? user.cashierId : null;
  }
  function canAccessRoute(route) {
    const user = userFromSession();
    if (!user) return false;
    if (user.role === 'admin') return true;
    return !(route && ADMIN_ONLY_ROUTES.indexOf(route.name) !== -1);
  }

  /* ---------------- signing in ---------------- */
  async function login(rawUsername, password) {
    if (!isConfigured()) throw authError('There is no admin account yet. Reload the app to finish setting it up.');
    const username = String(rawUsername || '').trim();
    const pass = String(password || '');
    if (!username || !pass) throw authError('Enter your username and password.');
    const found = findAccountByUsername(username);
    const generic = 'That username and password do not match. Try again.';
    if (!found) {
      await new Promise(resolve => setTimeout(resolve, 320));
      throw authError(generic);
    }
    const hash = await derive(pass, found.record.salt, found.record.iterations);
    if (!hashesMatch(hash, found.record.hash)) {
      throw authError(generic);
    }
    let session;
    if (found.type === 'admin') {
      session = { role: 'admin', revision: found.record.revision, signedInAt: U.nowStamp() };
    } else {
      const cashier = S().cashierById(found.cashierId);
      if (!cashier || cashier.active === false) {
        throw authError('This cashier account is inactive. Ask the shop admin to update it.');
      }
      session = { role: 'cashier', cashierId: found.cashierId, revision: found.record.revision, signedInAt: U.nowStamp() };
    }
    writeSession(session);
    const user = userFromSession();
    if (!user) throw authError('The account changed while signing in. Try again.');
    if (typeof onAuthenticated === 'function') await onAuthenticated(user);
    return user;
  }

  async function setupAccount(values) {
    if (isConfigured()) throw authError('An admin account already exists. Sign in instead.');
    const v = values || {};
    const name = cleanName(v.name);
    const username = cleanUsername(v.username);
    assertUsernameFree(username, { admin: true });
    validatePassword(v.password, v.confirmPassword);

    let cashierRecord = null;
    let cashierId = null;
    const cashierUsername = String(v.cashierUsername || '').trim();
    const cashierPassword = String(v.cashierPassword || '');
    const cashierConfirm = String(v.cashierConfirmPassword || '');
    const wantsCashier = !!(cashierUsername || cashierPassword || cashierConfirm);
    if (wantsCashier) {
      if (!v.cashierId) throw authError('Choose which cashier the optional sign-in belongs to.');
      const cashier = S().cashierById(v.cashierId);
      if (!cashier) throw authError('That cashier no longer exists.');
      cashierId = cashier.id;
      const cUsername = cleanUsername(cashierUsername);
      if (cUsername.toLowerCase() === username.toLowerCase()) {
        throw authError('The cashier username must be different from the admin username.');
      }
      assertUsernameFree(cUsername, { cashierId: cashierId });
      validatePassword(cashierPassword, cashierConfirm);
      cashierRecord = await makeRecord(cUsername, cashierPassword);
    }

    const adminRecord = await makeRecord(username, v.password, name);
    const auth = authData();
    const next = {
      version: 1,
      admin: adminRecord,
      cashierLogins: Object.assign({}, auth.cashierLogins)
    };
    if (cashierRecord) next.cashierLogins[String(cashierId)] = cashierRecord;
    await S().saveAuth(next);
    writeSession({ role: 'admin', revision: adminRecord.revision, signedInAt: U.nowStamp() });
    const user = userFromSession();
    if (typeof onAuthenticated === 'function') await onAuthenticated(user);
    return user;
  }

  function signOut() {
    clearSession();
    restart('You have signed out. Sign in to continue.');
  }

  async function confirmSignOut() {
    const user = userFromSession();
    const ok = await UI.confirmDialog({
      title: 'Sign out of Wijaya Pattalaya?',
      text: 'Your sales and records stay saved on this computer. You will need your username and password to get back in.',
      confirmText: 'Sign out'
    });
    if (!ok) return;
    if (user) signOut();
    else restart('Sign in to continue.');
  }

  function restart(message) {
    if (message) {
      try { sessionStorage.setItem(FLASH_KEY, message); } catch (e) { /* noop */ }
    }
    location.reload();
  }

  function takeFlash() {
    try {
      const message = sessionStorage.getItem(FLASH_KEY);
      if (message) sessionStorage.removeItem(FLASH_KEY);
      return message || '';
    } catch (e) {
      return '';
    }
  }

  /* ---------------- account / passwords ---------------- */
  async function verifyPassword(record, password) {
    if (!password) throw authError('Enter your current password.');
    const hash = await derive(String(password), record.salt, record.iterations);
    if (!hashesMatch(hash, record.hash)) throw authError('Your current password is not correct.');
  }

  async function updateAccount(values) {
    const v = values || {};
    const user = userFromSession();
    if (!user) throw authError('Your session has ended. Sign in again.');
    const auth = authData();
    const isAdminAccount = user.role === 'admin';
    const record = isAdminAccount ? auth.admin : auth.cashierLogins[String(user.cashierId)];
    if (!record) throw authError('This account no longer exists. Sign in again.');
    await verifyPassword(record, v.currentPassword);

    let name = record.name || user.name;
    let username = record.username;
    if (isAdminAccount) {
      name = cleanName(v.name);
      username = cleanUsername(v.username);
      assertUsernameFree(username, { admin: true, currentAdminUsername: record.username });
    }

    const wantsPassword = !!(String(v.newPassword || '') || String(v.confirmPassword || ''));
    let nextRecord;
    if (wantsPassword) {
      validatePassword(v.newPassword, v.confirmPassword);
      nextRecord = await makeRecord(username, v.newPassword, name);
    } else {
      if (isAdminAccount && name === record.name && username === record.username) {
        throw authError('Nothing has changed.');
      }
      if (!isAdminAccount) throw authError('Choose a new password to save, or close this window.');
      nextRecord = Object.assign({}, record, {
        name: name,
        username: username,
        updatedAt: U.nowStamp(),
        revision: nextRevision()
      });
    }

    if (isAdminAccount) auth.admin = nextRecord;
    else auth.cashierLogins[String(user.cashierId)] = nextRecord;
    await S().saveAuth(auth);
    writeSession({
      role: user.role,
      cashierId: user.cashierId,
      revision: nextRecord.revision,
      signedInAt: user.signedInAt || U.nowStamp()
    });
    return userFromSession();
  }

  async function saveCashierLogin(cashierId, values) {
    if (!isAdmin()) throw authError('Only the shop admin can manage cashier sign-ins.');
    const cashier = S().cashierById(cashierId);
    if (!cashier) throw authError('That cashier no longer exists.');
    const v = values || {};
    const auth = authData();
    const existing = auth.cashierLogins[String(cashierId)] || null;
    const username = cleanUsername(v.username);
    assertUsernameFree(username, { cashierId: cashier.id });
    const password = String(v.password || '');
    const confirm = String(v.confirmPassword || '');
    let record;
    if (password || confirm || !existing) {
      validatePassword(password, confirm);
      record = await makeRecord(username, password);
    } else if (username !== existing.username) {
      record = Object.assign({}, existing, {
        username: username,
        updatedAt: U.nowStamp(),
        revision: nextRevision()
      });
    } else {
      return { username: existing.username, updatedAt: existing.updatedAt };
    }
    auth.cashierLogins[String(cashierId)] = record;
    await S().saveAuth(auth);
    return { username: record.username, updatedAt: record.updatedAt };
  }

  async function removeCashierLogin(cashierId) {
    if (!isAdmin()) throw authError('Only the shop admin can manage cashier sign-ins.');
    const auth = authData();
    if (!auth.cashierLogins[String(cashierId)]) return false;
    delete auth.cashierLogins[String(cashierId)];
    await S().saveAuth(auth);
    return true;
  }

  function getCashierLogin(cashierId) {
    const login = authData().cashierLogins[String(cashierId)];
    if (!login) return null;
    return {
      username: login.username,
      updatedAt: login.updatedAt || '',
      revision: login.revision
    };
  }

  function hasLogin(cashierId) {
    return !!authData().cashierLogins[String(cashierId)];
  }

  /* ---------------- gate ---------------- */
  function hideBoot() {
    const boot = document.getElementById('boot');
    if (boot) {
      boot.classList.add('fade');
      setTimeout(() => { if (boot.parentNode) boot.remove(); }, 420);
    }
  }

  function gateStoryHTML() {
    const shop = S().data.settings;
    return '<aside class="auth-story">' +
      '<div class="auth-brand">' +
      '<span class="auth-seal">' + UI.icon('tractor', 30) + '</span>' +
      '<div><div class="auth-brand-name">' + U.esc(shop.shopName || 'Wijaya Pattalaya') + '</div>' +
      '<div class="auth-brand-tag">' + U.esc(shop.tagline || 'Offline shop system') + '</div></div>' +
      '</div>' +
      '<div class="auth-story-body">' +
      '<div class="auth-story-eyebrow">Private counter access</div>' +
      '<h1 class="auth-story-title">The shop ledger,<br><em>under lock and key.</em></h1>' +
      '<p class="auth-story-text">Sign in to take sales, service bills and drawer handovers. Admin and cashier accounts keep every action attributed to the right person.</p>' +
      '<ul class="auth-points">' +
      '<li><span class="auth-point-ico">' + UI.icon('shield', 16) + '</span><div><b>Admin control</b><small>Stock, prices, expenses and reports stay with the owner.</small></div></li>' +
      '<li><span class="auth-point-ico">' + UI.icon('lock', 16) + '</span><div><b>Cashier drawers</b><small>Each cashier signs in to their own counter session.</small></div></li>' +
      '<li><span class="auth-point-ico">' + UI.icon('database', 16) + '</span><div><b>Fully offline</b><small>Accounts and records never leave this computer.</small></div></li>' +
      '</ul></div>' +
      '<div class="auth-story-foot"><span class="offline-dot"></span>Works without internet · data saved on this device</div>' +
      '</aside>';
  }

  function flashHTML() {
    const message = takeFlash();
    if (!message) return '';
    return '<div class="auth-flash">' + UI.icon('info', 15) + '<span>' + U.esc(message) + '</span></div>';
  }

  function loginCardHTML() {
    return '<div class="auth-card">' +
      '<div class="auth-card-head">' +
      '<span class="auth-lock">' + UI.icon('lock', 20) + '</span>' +
      '<div class="auth-eyebrow">Secure sign-in</div>' +
      '<h2 class="auth-title">Welcome back</h2>' +
      '<p class="auth-sub">Use your admin or cashier username and password to open the counter.</p>' +
      '</div>' +
      flashHTML() +
      '<form id="login-form" class="auth-form" autocomplete="on" novalidate>' +
      '<div class="field"><label class="label" for="login-username">Username</label>' +
      '<input class="input" id="login-username" name="username" autocomplete="username" spellcheck="false" autocapitalize="none" placeholder="e.g. owner" required autofocus></div>' +
      '<div class="field"><label class="label" for="login-password">Password</label>' +
      '<div class="auth-pass"><input class="input" id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Your password" required>' +
      '<button type="button" class="auth-eye" data-eye="login-password" aria-label="Show password">' + UI.icon('eye', 16) + '</button></div></div>' +
      '<div class="auth-error" id="login-error" hidden></div>' +
      '<button type="submit" class="btn btn-primary btn-lg btn-block" id="login-submit" data-loading-label="Signing in…">' + UI.icon('key', 16) + 'Sign in</button>' +
      '</form>' +
      '<div class="auth-foot">Admin can add cashier sign-ins from <b>Cashiers</b>. Forgot a password? The shop admin can reset it.</div>' +
      '</div>' +
      '<div class="auth-device-note">' + UI.icon('shield', 13) + 'Passwords are salted and hashed on this device. There is no online account.</div>' +
      '<div class="auth-credit">Designed &amp; developed by <b>Ruchitha Vakista</b></div>';
  }

  function cashierOptionHTML() {
    const cashiers = S().activeCashiers();
    return cashiers.map((c, i) => UI.option(c.id, c.name, i === 0 ? c.id : '')).join('');
  }

  function setupCardHTML() {
    const cashiers = S().activeCashiers();
    const optionalCashier = cashiers.length
      ? '<div class="auth-optional">' +
        '<div class="auth-optional-head"><span class="auth-optional-badge">Optional</span>' +
        '<div><b>First cashier sign-in</b><small>You can also set this later from the Cashiers page.</small></div></div>' +
        '<div class="form-grid">' +
        '<div class="field full"><label class="label" for="setup-cashier">Cashier</label>' +
        '<select class="select" id="setup-cashier" name="cashierId">' + cashierOptionHTML() + '</select></div>' +
        '<div class="field"><label class="label" for="setup-cashier-username">Cashier username</label>' +
        '<input class="input" id="setup-cashier-username" name="cashierUsername" autocomplete="off" spellcheck="false" placeholder="Leave blank to skip"></div>' +
        '<div class="field"><label class="label" for="setup-cashier-password">Cashier password</label>' +
        '<div class="auth-pass"><input class="input" id="setup-cashier-password" name="cashierPassword" type="password" autocomplete="new-password" placeholder="At least ' + MIN_PASSWORD + ' characters">' +
        '<button type="button" class="auth-eye" data-eye="setup-cashier-password" aria-label="Show password">' + UI.icon('eye', 16) + '</button></div></div>' +
        '<div class="field full"><label class="label" for="setup-cashier-confirm">Confirm cashier password</label>' +
        '<input class="input" id="setup-cashier-confirm" name="cashierConfirmPassword" type="password" autocomplete="new-password" placeholder="Repeat cashier password"></div>' +
        '</div></div>'
      : '';

    return '<div class="auth-card auth-card-setup">' +
      '<div class="auth-card-head">' +
      '<span class="auth-lock">' + UI.icon('shield', 20) + '</span>' +
      '<div class="auth-eyebrow">First-time setup</div>' +
      '<h2 class="auth-title">Create the shop admin</h2>' +
      '<p class="auth-sub">This owner account controls stock, prices, expenses, reports, backups and every cashier sign-in.</p>' +
      '</div>' +
      flashHTML() +
      '<form id="setup-form" class="auth-form" autocomplete="off" novalidate>' +
      '<div class="form-grid">' +
      '<div class="field"><label class="label" for="setup-name">Your name</label>' +
      '<input class="input" id="setup-name" name="name" autocomplete="name" placeholder="e.g. Wijaya Kumar" required autofocus></div>' +
      '<div class="field"><label class="label" for="setup-username">Admin username</label>' +
      '<input class="input" id="setup-username" name="username" autocomplete="username" spellcheck="false" autocapitalize="none" placeholder="e.g. owner" required></div>' +
      '<div class="field"><label class="label" for="setup-password">Admin password</label>' +
      '<div class="auth-pass"><input class="input" id="setup-password" name="password" type="password" autocomplete="new-password" placeholder="At least ' + MIN_PASSWORD + ' characters" required>' +
      '<button type="button" class="auth-eye" data-eye="setup-password" aria-label="Show password">' + UI.icon('eye', 16) + '</button></div></div>' +
      '<div class="field"><label class="label" for="setup-confirm">Confirm admin password</label>' +
      '<input class="input" id="setup-confirm" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Repeat admin password" required></div>' +
      '</div>' +
      optionalCashier +
      '<div class="auth-error" id="setup-error" hidden></div>' +
      '<button type="submit" class="btn btn-primary btn-lg btn-block" id="setup-submit" data-loading-label="Creating account…">' + UI.icon('check', 16) + 'Create admin account</button>' +
      '</form>' +
      '<div class="auth-foot">Write your password down and keep it safe. There is no online reset if you forget it.</div>' +
      '</div>' +
      '<div class="auth-device-note">' + UI.icon('shield', 13) + 'Passwords are salted and hashed on this device. Shop data never leaves this computer.</div>' +
      '<div class="auth-credit">Designed &amp; developed by <b>Ruchitha Vakista</b></div>';
  }

  function renderGate() {
    const root = document.getElementById('app');
    if (!root) return;
    const setup = !isConfigured();
    root.innerHTML = '<div class="auth-screen">' + gateStoryHTML() +
      '<main class="auth-entry">' +
      '<div class="auth-mobile-brand"><span class="brand-seal">' + UI.icon('tractor', 24) + '</span>' +
      '<div><div class="auth-brand-name">' + U.esc(S().data.settings.shopName || 'Wijaya Pattalaya') + '</div>' +
      '<div class="auth-brand-tag">' + U.esc(S().data.settings.tagline || 'Offline shop system') + '</div></div></div>' +
      (setup ? setupCardHTML() : loginCardHTML()) +
      '</main></div>';
    bindEyes(root);
    const loginForm = root.querySelector('#login-form');
    if (loginForm) bindLoginForm(root, loginForm);
    const setupForm = root.querySelector('#setup-form');
    if (setupForm) bindSetupForm(root, setupForm);
    hideBoot();
  }

  function bindEyes(scope) {
    scope.querySelectorAll('[data-eye]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = scope.querySelector('#' + btn.dataset.eye);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.classList.toggle('is-on', show);
        btn.innerHTML = UI.icon(show ? 'eyeOff' : 'eye', 16);
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });
  }

  function setFormError(el, message) {
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  function bindLoginForm(root, form) {
    const error = root.querySelector('#login-error');
    const submit = root.querySelector('#login-submit');
    form.addEventListener('input', () => setFormError(error, ''));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      setFormError(error, '');
      const values = UI.formValues(form);
      try {
        await UI.withLoading(submit, async () => {
          await login(values.username, values.password);
        });
      } catch (err) {
        setFormError(error, err.userMessage || err.message || 'Could not sign in.');
      }
    });
  }

  function bindSetupForm(root, form) {
    const error = root.querySelector('#setup-error');
    const submit = root.querySelector('#setup-submit');
    form.addEventListener('input', () => setFormError(error, ''));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      setFormError(error, '');
      const values = UI.formValues(form);
      try {
        await UI.withLoading(submit, async () => {
          await setupAccount(values);
        });
      } catch (err) {
        setFormError(error, err.userMessage || err.message || 'Could not create the admin account.');
      }
    });
  }

  /* ---------------- modals ---------------- */
  async function openAccountModal() {
    const user = userFromSession();
    if (!user) { restart('Sign in to continue.'); return; }
    const auth = authData();
    const record = user.role === 'admin'
      ? auth.admin
      : auth.cashierLogins[String(user.cashierId)];
    if (!record) return;
    const isAdminAccount = user.role === 'admin';
    const roleLabel = isAdminAccount ? 'Administrator' : 'Cashier';
    const m = UI.modal({
      title: 'My account',
      subtitle: 'Sign-in details for this device.',
      size: 'md',
      body:
        '<div class="account-hero">' +
        UI.avatar(user.name, 'lg') +
        '<div class="account-hero-info"><div class="account-hero-name">' + U.esc(user.name) + '</div>' +
        '<div class="account-hero-sub">@' + U.esc(user.username) + ' · ' + roleLabel + '</div></div>' +
        '<span class="badge ' + (isAdminAccount ? 'gold' : 'green') + '">' + roleLabel + '</span>' +
        '</div>' +
        '<form id="account-form" autocomplete="off" novalidate><div class="form-grid">' +
        (isAdminAccount
          ? '<div class="field"><label class="label" for="ac-name">Your name</label>' +
            '<input class="input" id="ac-name" name="name" value="' + U.attr(record.name || user.name) + '" required autocomplete="name"></div>' +
            '<div class="field"><label class="label" for="ac-username">Username</label>' +
            '<input class="input" id="ac-username" name="username" value="' + U.attr(record.username) + '" required spellcheck="false" autocapitalize="none" autocomplete="username"></div>'
          : '<div class="field full"><div class="account-readonly"><span>Cashier name</span><b>' + U.esc(user.name) + '</b></div></div>' +
            '<div class="field full"><div class="account-readonly"><span>Username</span><b>@' + U.esc(record.username) + '</b></div></div>') +
        '</div>' +
        '<div class="divider"></div>' +
        '<div class="account-section"><div class="account-section-title">' + UI.icon('key', 15) + 'Change password</div>' +
        '<p class="hint">' + (isAdminAccount ? 'Confirm your current password to change your sign-in details.' : 'Enter your current password, then choose a new one.') + '</p></div>' +
        '<div class="form-grid mt-12">' +
        '<div class="field full"><label class="label" for="ac-current">Current password</label>' +
        '<div class="auth-pass"><input class="input" id="ac-current" name="currentPassword" type="password" autocomplete="current-password" required placeholder="Your current password">' +
        '<button type="button" class="auth-eye" data-eye="ac-current" aria-label="Show password">' + UI.icon('eye', 16) + '</button></div></div>' +
        '<div class="field"><label class="label" for="ac-new">New password <span class="opt">(optional)</span></label>' +
        '<div class="auth-pass"><input class="input" id="ac-new" name="newPassword" type="password" autocomplete="new-password" placeholder="At least ' + MIN_PASSWORD + ' characters">' +
        '<button type="button" class="auth-eye" data-eye="ac-new" aria-label="Show password">' + UI.icon('eye', 16) + '</button></div></div>' +
        '<div class="field"><label class="label" for="ac-confirm">Confirm new password</label>' +
        '<input class="input" id="ac-confirm" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Repeat new password"></div>' +
        '</div>' +
        '<div class="auth-error" id="account-error" hidden></div>' +
        '</form>' +
        '<div class="account-meta">' + UI.icon('clock', 13) + 'Last credential update: ' + U.esc(record.updatedAt ? U.fmtDateTime(record.updatedAt) : '—') + '</div>',
      footer: '<button type="button" class="btn btn-ghost" data-account-signout>' + UI.icon('logout', 14) + 'Sign out</button>' +
        '<span style="flex:1"></span>' +
        '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="account-form">' + UI.icon('check', 15) + 'Save account</button>'
    });
    bindEyes(m.panel);
    const form = m.panel.querySelector('#account-form');
    const error = m.panel.querySelector('#account-error');
    form.addEventListener('input', () => setFormError(error, ''));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      setFormError(error, '');
      const submit = m.panel.querySelector('[type="submit"][form="account-form"]');
      const values = UI.formValues(form);
      try {
        await UI.withLoading(submit, async () => {
          await updateAccount(values);
          m.close();
          UI.toast('Account updated.');
          if (typeof APP().refreshChrome === 'function') APP().refreshChrome();
          else APP().refresh();
        });
      } catch (err) {
        setFormError(error, err.userMessage || err.message || 'Could not update the account.');
      }
    });
    const signout = m.panel.querySelector('[data-account-signout]');
    if (signout) signout.addEventListener('click', () => {
      m.close();
      confirmSignOut();
    });
  }

  async function openCashierLoginModal(cashier, opts) {
    if (!isAdmin()) {
      UI.toast('Only the shop admin can manage cashier sign-ins.', 'error');
      return null;
    }
    if (!cashier) return null;
    const options = opts || {};
    const existing = authData().cashierLogins[String(cashier.id)] || null;
    const suffix = U.uidSuffix();
    const usernameId = 'cl-username-' + suffix;
    const passwordId = 'cl-password-' + suffix;
    const confirmId = 'cl-confirm-' + suffix;
    const suggested = existing ? existing.username : suggestUsername(cashier.name);
    const m = UI.modal({
      title: existing ? 'Cashier sign-in' : 'Create cashier sign-in',
      subtitle: cashier.name + ' · sign in with a username and password.',
      size: 'md',
      body:
        '<div class="account-hero">' + UI.avatar(cashier.name, 'lg') +
        '<div class="account-hero-info"><div class="account-hero-name">' + U.esc(cashier.name) + '</div>' +
        '<div class="account-hero-sub">' + U.esc(cashier.phone || 'No phone') + ' · Cashier</div></div>' +
        (existing ? '<span class="badge green">Sign-in active</span>' : '<span class="badge grey">No sign-in yet</span>') +
        '</div>' +
        '<form id="cashier-login-form" autocomplete="off" novalidate><div class="form-grid">' +
        '<div class="field full"><label class="label" for="' + usernameId + '">Sign-in username</label>' +
        '<input class="input" id="' + usernameId + '" name="username" value="' + U.attr(suggested) + '" required spellcheck="false" autocapitalize="none" autocomplete="off"></div>' +
        '<div class="field"><label class="label" for="' + passwordId + '">' + (existing ? 'Reset password' : 'Password') + ' <span class="opt">' + (existing ? '(leave blank to keep)' : '') + '</span></label>' +
        '<div class="auth-pass"><input class="input" id="' + passwordId + '" name="password" type="password" autocomplete="new-password" placeholder="At least ' + MIN_PASSWORD + ' characters">' +
        '<button type="button" class="auth-eye" data-eye="' + passwordId + '" aria-label="Show password">' + UI.icon('eye', 16) + '</button></div></div>' +
        '<div class="field"><label class="label" for="' + confirmId + '">Confirm password</label>' +
        '<input class="input" id="' + confirmId + '" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Repeat password"></div>' +
        '</div>' +
        '<div class="auth-error" id="cashier-login-error" hidden></div>' +
        '</form>' +
        (existing
          ? '<div class="hint mt-12">' + UI.icon('info', 13) + ' Saving a new username or password signs this cashier out of any open session on this device.</div>'
          : '<div class="pay-note mt-12">This cashier will sign in with these details on this device. Only the admin can reset them.</div>'),
      footer: (existing ? '<button type="button" class="btn btn-danger" data-remove-cashier-login>' + UI.icon('trash', 14) + 'Remove sign-in</button>' : '') +
        '<span style="flex:1"></span>' +
        '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="cashier-login-form">' + UI.icon('check', 15) + (existing ? 'Save sign-in' : 'Create sign-in') + '</button>'
    });
    bindEyes(m.panel);
    const form = m.panel.querySelector('#cashier-login-form');
    const error = m.panel.querySelector('#cashier-login-error');
    form.addEventListener('input', () => setFormError(error, ''));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      setFormError(error, '');
      const submit = m.panel.querySelector('[type="submit"][form="cashier-login-form"]');
      const values = UI.formValues(form);
      try {
        await UI.withLoading(submit, async () => {
          await saveCashierLogin(cashier.id, values);
          m.close();
          UI.toast('Sign-in saved for ' + cashier.name + '.');
          if (typeof APP().refresh === 'function') APP().refresh();
        });
      } catch (err) {
        setFormError(error, err.userMessage || err.message || 'Could not save the sign-in.');
      }
    });
    const remove = m.panel.querySelector('[data-remove-cashier-login]');
    if (remove) remove.addEventListener('click', async () => {
      m.close();
      const ok = await UI.confirmDialog({
        title: 'Remove ' + cashier.name + '’s sign-in?',
        text: 'They will no longer be able to sign in on this device until you create a new sign-in. Their cashier record and history stay saved.',
        confirmText: 'Remove sign-in'
      });
      if (!ok) return;
      try {
        await removeCashierLogin(cashier.id);
        UI.toast('Sign-in removed for ' + cashier.name + '.');
        if (typeof APP().refresh === 'function') APP().refresh();
      } catch (err) {
        UI.toast(err.userMessage || err.message || 'Could not remove the sign-in.', 'error');
      }
    });
    if (options.afterCreate) options.afterCreate();
    return m;
  }

  /* ---------------- boot ---------------- */
  async function init(opts) {
    if (initialized) return;
    initialized = true;
    onAuthenticated = opts && opts.onAuthenticated;
    if (!cryptoReady()) {
      console.warn('WebCrypto is unavailable; auth screens will show an error.');
    }
    const session = readSession();
    if (isConfigured() && session) {
      const user = userFromSession();
      if (user) {
        if (typeof onAuthenticated === 'function') await onAuthenticated(user);
        return;
      }
      clearSession();
    }
    if (!isConfigured() && session) clearSession();
    renderGate();
  }

  WP.auth = {
    init,
    isConfigured,
    isLoggedIn,
    isAdmin,
    isCashier,
    getUser,
    getCashierId,
    canAccessRoute,
    login,
    signOut,
    confirmSignOut,
    restart,
    updateAccount,
    saveCashierLogin,
    removeCashierLogin,
    getCashierLogin,
    hasLogin,
    suggestUsername,
    openAccountModal,
    openCashierLoginModal,
    renderGate
  };
})();
