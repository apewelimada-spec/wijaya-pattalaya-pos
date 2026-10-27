(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;

  const DB_NAME = 'wijaya-pattalaya-pos';
  const DB_STORE = 'pos';
  const DB_KEY = 'state';
  const LS_KEY = 'wijaya-pattalaya-pos-state';
  const SCHEMA_VERSION = 1;
  const DB_VERSION = 2;

  const PART_GROUPS = ['Engine', 'Filters', 'Hydraulics', 'Electrical', 'Transmission', 'Body & Cabin', 'Tyres & Wheels', 'Tools & Oil', 'Other'];
  const EXPENSE_CATEGORIES = [
    { key: 'bills', label: 'Bills', icon: 'receipt' },
    { key: 'personal', label: 'Personal', icon: 'user' },
    { key: 'vehicle', label: 'Vehicle', icon: 'truck' },
    { key: 'marketing', label: 'Marketing', icon: 'megaphone' },
    { key: 'house', label: 'House', icon: 'home' },
    { key: 'other', label: 'Other', icon: 'more' }
  ];
  const PAYMENT_METHODS = ['cash', 'card', 'online', 'credit', 'cheque', 'advance'];
  const COLLECT_METHODS = ['cash', 'card', 'online', 'cheque'];
  const RETURN_METHODS = ['cash', 'card', 'online', 'credit'];

  let state = null;
  let db = null;
  let storageMode = 'indexeddb';
  let idbPromise = null;
  let saveQueue = Promise.resolve();
  let restoredFromLocal = false;
  const meta = { lastSavedAt: null, ready: false, storageError: null };

  function nowStamp() { return U.nowStamp(); }
  function today() { return U.todayISO(); }
  function fail(message) { const e = new Error(message); e.userMessage = message; throw e; }
  function assertAdmin() {
    if (!window.WP || !WP.auth || !WP.auth.isConfigured || !WP.auth.isConfigured()) return;
    if (!WP.auth.isAdmin()) fail('Only the shop admin can do this. Sign in with the admin account.');
  }
  function assertOwnDrawer(cashierId) {
    if (!window.WP || !WP.auth || !WP.auth.isCashier || !WP.auth.isCashier()) return;
    if (Number(WP.auth.getCashierId()) !== Number(cashierId)) fail('You can only open or close your own drawer.');
  }
  function round2(n) { return U.round2(n); }
  function roundQty(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }
  function cleanString(v) { return String(v === null || v === undefined ? '' : v).trim(); }
  function nextId() {
    state.seq = (Number(state.seq) || 0) + 1;
    return state.seq;
  }
  function nextNo(kind, prefix) {
    state.counters = state.counters || {};
    state.counters[kind] = (Number(state.counters[kind]) || 1000) + 1;
    return prefix + '-' + state.counters[kind];
  }

  /* ---------------- persistence ---------------- */
  function clone(value) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (e) { /* fall through */ }
    }
    return JSON.parse(JSON.stringify(value));
  }

  function withTimeout(promise, ms, message) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      promise.then(value => { clearTimeout(timer); resolve(value); }, err => { clearTimeout(timer); reject(err); });
    });
  }

  function openDatabase() {
    if (idbPromise) return idbPromise;
    idbPromise = withTimeout(new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB is unavailable')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(DB_STORE)) database.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error || new Error('Could not open local database'));
      req.onblocked = () => reject(new Error('Local database is blocked by another tab'));
    }), 4000, 'Opening the local database timed out');
    idbPromise.catch(() => { idbPromise = null; });
    return idbPromise;
  }

  function idbGet() {
    return withTimeout(new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(DB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    }), 4000, 'Reading the local database timed out');
  }

  function idbPut(value) {
    return withTimeout(new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(value, DB_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Save aborted'));
    }), 4000, 'Saving to the local database timed out');
  }

  function defaultSettings() {
    return {
      shopName: 'Wijaya Pattalaya',
      tagline: 'Tractor Spare Parts · Service · Machines',
      address: '',
      phone: '',
      email: '',
      footer: 'Thank you for your business. Please keep this receipt for returns.',
      currency: 'Rs.',
      lowStockDefault: 5,
      invoicePrefix: 'INV',
      servicePrefix: 'SRV',
      jobPrefix: 'JOB',
      quotePrefix: 'QT',
      purchasePrefix: 'GRN',
      printer: 'thermal',
      createdAt: nowStamp(),
      lastBackupAt: null
    };
  }

  function seedState() {
    const now = nowStamp();
    return {
      version: SCHEMA_VERSION,
      seq: 1,
      createdAt: now,
      updatedAt: now,
      settings: defaultSettings(),
      counters: { invoice: 1000, service: 1000, return: 1000, job: 1000, quote: 1000, grn: 1000 },
      cashiers: [{ id: 1, name: 'Main Counter', phone: '', active: true, createdAt: now }],
      auth: { version: 1, admin: null, cashierLogins: {} },
      cashierSessions: [],
      items: [],
      stockMoves: [],
      customers: [],
      invoices: [],
      invoiceItems: [],
      services: [],
      serviceParts: [],
      payments: [],
      expenses: [],
      returns: [],
      returnItems: [],
      openings: [],
      jobCards: [],
      suppliers: [],
      supplierBills: [],
      supplierPayments: [],
      quotations: []
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object') return seedState();
    const base = seedState();
    const data = Object.assign({}, base, raw);
    data.settings = Object.assign(defaultSettings(), raw.settings || {});
    data.counters = Object.assign({ invoice: 1000, service: 1000, return: 1000, job: 1000, quote: 1000, grn: 1000 }, raw.counters || {});
    ['cashiers', 'cashierSessions', 'items', 'stockMoves', 'customers', 'invoices', 'invoiceItems',
      'services', 'serviceParts', 'payments', 'expenses', 'returns', 'returnItems', 'openings',
      'jobCards', 'suppliers', 'supplierBills', 'supplierPayments', 'quotations'].forEach(k => {
      if (!Array.isArray(data[k])) data[k] = [];
    });
    if (!data.seq || typeof data.seq !== 'number') {
      const all = ['cashiers', 'items', 'invoices', 'services', 'payments', 'expenses', 'returns', 'cashierSessions'];
      data.seq = all.reduce((max, k) => Math.max(max, ...data[k].map(r => Number(r.id) || 0)), 1);
    }
    if (!data.cashiers.length) {
      data.seq += 1;
      data.cashiers.push({ id: data.seq, name: 'Main Counter', phone: '', active: true, createdAt: nowStamp() });
    }
    const rawAuth = raw.auth && typeof raw.auth === 'object' ? raw.auth : {};
    data.auth = {
      version: 1,
      admin: rawAuth.admin && typeof rawAuth.admin === 'object' && rawAuth.admin.hash && rawAuth.admin.salt ? rawAuth.admin : null,
      cashierLogins: rawAuth.cashierLogins && typeof rawAuth.cashierLogins === 'object' && !Array.isArray(rawAuth.cashierLogins)
        ? Object.assign({}, rawAuth.cashierLogins) : {}
    };
    Object.keys(data.auth.cashierLogins).forEach(id => {
      const login = data.auth.cashierLogins[id];
      if (!login || !login.hash || !login.salt || !data.cashiers.some(c => Number(c.id) === Number(id))) {
        delete data.auth.cashierLogins[id];
      }
    });
    data.version = SCHEMA_VERSION;
    return data;
  }

  async function loadInitial() {
    storageMode = 'indexeddb';
    let idbReady = false;
    try {
      await openDatabase();
      const stored = await idbGet();
      if (stored) return normalizeState(stored);
      idbReady = true;
    } catch (err) {
      meta.storageError = err && err.message;
      storageMode = 'local';
    }
    let storedLocal = null;
    try {
      const text = localStorage.getItem(LS_KEY);
      if (text) storedLocal = U.safeParse(text, null);
    } catch (e) { /* local storage blocked too */ }
    if (storedLocal) {
      restoredFromLocal = true;
      if (!idbReady) storageMode = 'local';
      return normalizeState(storedLocal);
    }
    return seedState();
  }

  async function persistState(snapshot) {
    const copy = clone(snapshot);
    if (storageMode === 'indexeddb' && db) {
      try {
        await idbPut(copy);
      } catch (err) {
        console.warn('IndexedDB save failed, falling back to localStorage', err);
        meta.storageError = err && err.message;
        storageMode = 'local';
      }
    }
    if (storageMode === 'local') {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(copy));
      } catch (err) {
        meta.storageError = err && err.message;
        throw new Error('Could not save local data. Please back up and free some browser storage.');
      }
    }
  }

  function persist() {
    if (!state) return Promise.resolve();
    state.updatedAt = nowStamp();
    const snapshot = state;
    saveQueue = saveQueue.then(() => persistState(snapshot)).then(() => {
      meta.lastSavedAt = nowStamp();
      return true;
    }, err => {
      meta.storageError = err && err.message;
      throw err;
    });
    return saveQueue;
  }

  async function init() {
    state = await loadInitial();
    meta.storageMode = storageMode;
    meta.ready = true;
    await persist();
    if (storageMode === 'indexeddb' && restoredFromLocal) {
      try { localStorage.removeItem(LS_KEY); } catch (e) { /* keep fallback if blocked */ }
      restoredFromLocal = false;
    }
    return state;
  }

  /* ---------------- lookups ---------------- */
  function itemById(id) { return state.items.find(i => Number(i.id) === Number(id)) || null; }
  function customerById(id) { return state.customers.find(c => Number(c.id) === Number(id)) || null; }
  function invoiceById(id) { return state.invoices.find(i => Number(i.id) === Number(id)) || null; }
  function serviceById(id) { return state.services.find(s => Number(s.id) === Number(id)) || null; }
  function cashierById(id) { return state.cashiers.find(c => Number(c.id) === Number(id)) || null; }
  function activeItems() { return state.items.filter(i => i.active !== false); }
  function activeCustomers() { return state.customers.filter(c => c.active !== false); }
  function activeCashiers() { return state.cashiers.filter(c => c.active !== false); }
  function lowStockItems() {
    return activeItems().filter(i => i.category === 'part' && Number(i.qty) <= Number(i.reorder || 0))
      .sort((a, b) => Number(a.qty) - Number(b.qty));
  }
  function invoiceLines(invoiceId) { return state.invoiceItems.filter(l => Number(l.invoiceId) === Number(invoiceId)); }
  function serviceLines(serviceId) { return state.serviceParts.filter(l => Number(l.serviceId) === Number(serviceId)); }
  function openSessionFor(cashierId) {
    return state.cashierSessions.find(s => Number(s.cashierId) === Number(cashierId) && !s.closedAt) || null;
  }
  function isInRange(value, from, to) {
    if (!value) return false;
    const d = String(value).slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }
  function invoiceReturnedQty(invoiceItemId) {
    return roundQty(state.returnItems.filter(r => Number(r.invoiceItemId) === Number(invoiceItemId))
      .reduce((s, r) => s + Number(r.qty || 0), 0));
  }
  function invoiceStatus(inv) {
    if (!inv) return 'draft';
    if (Number(inv.balance) > 0.009) return Number(inv.paid) > 0.009 ? 'partial' : 'credit';
    if (Number(inv.returned) > 0.009) return Number(inv.returned) >= Number(inv.total) - 0.009 ? 'returned' : 'part-returned';
    return 'paid';
  }
  const STATUS_LABELS = {
    paid: 'Paid', partial: 'Part paid', credit: 'On credit', returned: 'Returned',
    'part-returned': 'Part returned', open: 'Open', closed: 'Closed'
  };

  /* ---------------- customer balances ---------------- */
  function customerDue(customerId) {
    const c = customerById(customerId);
    if (!c) return 0;
    let due = Math.max(0, round2(Number(c.openingBalance || 0) - Number(c.openingPaid || 0)));
    state.invoices.forEach(inv => {
      if (Number(inv.customerId) === Number(customerId) && Number(inv.balance) > 0.009) due += Number(inv.balance);
    });
    state.services.forEach(svc => {
      if (Number(svc.customerId) === Number(customerId) && Number(svc.balance) > 0.009) due += Number(svc.balance);
    });
    return round2(due);
  }
  function customerAdvance(customerId) {
    let bal = 0;
    state.payments.forEach(p => {
      if (Number(p.customerId) !== Number(customerId)) return;
      if (p.type === 'advance') bal += Number(p.amount || 0);
      if (p.type === 'advance_used') bal -= Number(p.amount || 0);
    });
    return round2(Math.max(0, bal));
  }
  function customerLastActivity(customerId) {
    let dates = [];
    state.invoices.forEach(i => { if (Number(i.customerId) === Number(customerId)) dates.push(i.createdAt || i.date); });
    state.services.forEach(s => { if (Number(s.customerId) === Number(customerId)) dates.push(s.createdAt || s.date); });
    state.payments.forEach(p => { if (Number(p.customerId) === Number(customerId)) dates.push(p.createdAt || p.date); });
    dates = dates.filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
  }
  function totalReceivables() {
    let total = 0;
    state.customers.forEach(c => { total += Math.max(0, round2(Number(c.openingBalance || 0) - Number(c.openingPaid || 0))); });
    state.invoices.forEach(i => { total += Math.max(0, Number(i.balance) || 0); });
    state.services.forEach(s => { total += Math.max(0, Number(s.balance) || 0); });
    return round2(total);
  }
  function totalAdvances() {
    return round2(state.customers.reduce((sum, c) => sum + customerAdvance(c.id), 0));
  }

  /* ---------------- items ---------------- */
  function itemInput(input, existing) {
    const name = cleanString(input.name);
    if (!name) fail('Item name is required.');
    const category = input.category === 'machine' ? 'machine' : 'part';
    const cost = round2(U.toNum(input.cost, 0));
    const retail = round2(U.toNum(input.retail, 0));
    const wholesale = round2(U.toNum(input.wholesale, 0)) || retail;
    const reorder = Math.max(0, Math.round(U.toNum(input.reorder, state.settings.lowStockDefault)));
    if (cost < 0 || retail < 0 || wholesale < 0) fail('Prices cannot be negative.');
    if (retail <= 0 && category === 'part') fail('Selling price must be greater than zero.');
    let sku = cleanString(input.sku);
    const duplicate = state.items.find(i => i.active !== false && (!existing || Number(i.id) !== Number(existing.id)) &&
      sku && cleanString(i.sku).toLowerCase() === sku.toLowerCase());
    if (duplicate) fail('That SKU is already used by ' + duplicate.name + '.');
    const origin = category === 'machine' ? (input.origin === 'Local' ? 'Local' : 'Import') : (cleanString(input.origin) || '');
    return {
      name, category,
      sku,
      group: cleanString(input.group) || (category === 'machine' ? 'Machines' : 'Other'),
      brand: cleanString(input.brand),
      compatible: cleanString(input.compatible),
      origin,
      cost, retail, wholesale, reorder,
      qty: existing ? existing.qty : Math.max(0, roundQty(U.toNum(input.qty, 0))),
      active: true
    };
  }

  async function addItem(input) {
    assertAdmin();
    const values = itemInput(input, null);
    const id = nextId();
    if (!values.sku) values.sku = (values.category === 'machine' ? 'MC-' : 'P-') + String(id).padStart(4, '0');
    const item = Object.assign({ id, createdAt: nowStamp() }, values);
    state.items.push(item);
    if (Number(item.qty) > 0) {
      state.stockMoves.push({
        id: nextId(), date: today(), createdAt: nowStamp(), itemId: item.id,
        type: 'opening', qty: Number(item.qty), unitCost: Number(item.cost),
        refType: 'item', refId: item.id, refNo: item.sku, supplier: '', note: 'Opening stock'
      });
    }
    await persist();
    return item;
  }

  async function updateItem(id, input) {
    assertAdmin();
    const item = itemById(id);
    if (!item) fail('Item not found.');
    const values = itemInput(input, item);
    const oldQty = item.qty;
    Object.assign(item, values);
    item.qty = oldQty;
    if (!item.sku) item.sku = (item.category === 'machine' ? 'MC-' : 'P-') + String(item.id).padStart(4, '0');
    await persist();
    return item;
  }

  async function archiveItem(id) {
    assertAdmin();
    const item = itemById(id);
    if (!item) fail('Item not found.');
    item.active = false;
    await persist();
    return item;
  }

  async function receiveStock(itemId, input) {
    assertAdmin();
    const item = itemById(itemId);
    if (!item) fail('Item not found.');
    const qty = roundQty(U.toNum(input.qty, 0));
    if (qty <= 0) fail('Received quantity must be greater than zero.');
    const costGiven = input.unitCost !== '' && input.unitCost !== null && input.unitCost !== undefined;
    const unitCost = costGiven ? round2(U.toNum(input.unitCost, item.cost)) : round2(Number(item.cost) || 0);
    if (unitCost < 0) fail('Unit cost cannot be negative.');
    const oldQty = Number(item.qty) || 0;
    item.cost = oldQty > 0
      ? round2(((oldQty * Number(item.cost || 0)) + (qty * unitCost)) / (oldQty + qty))
      : unitCost;
    item.qty = roundQty(oldQty + qty);
    state.stockMoves.push({
      id: nextId(), date: today(), createdAt: nowStamp(), itemId: item.id, type: 'purchase', qty,
      unitCost, refType: 'stock', refId: null, refNo: '',
      supplier: cleanString(input.supplier), note: cleanString(input.note), cashierId: input.cashierId || null
    });
    await persist();
    return item;
  }

  async function setStock(itemId, newQty, reason) {
    assertAdmin();
    const item = itemById(itemId);
    if (!item) fail('Item not found.');
    const qty = roundQty(U.toNum(newQty, 0));
    if (qty < 0) fail('Stock cannot be negative.');
    const diff = roundQty(qty - Number(item.qty || 0));
    if (!diff) fail('The new stock count is unchanged.');
    item.qty = qty;
    state.stockMoves.push({
      id: nextId(), date: today(), createdAt: nowStamp(), itemId: item.id, type: 'adjust', qty: diff,
      unitCost: Number(item.cost), refType: 'adjust', refId: null, refNo: '', supplier: '',
      note: cleanString(reason) || 'Stock count adjustment'
    });
    await persist();
    return item;
  }

  /* ---------------- customers ---------------- */
  function customerInput(input, existing) {
    const name = cleanString(input.name);
    if (!name) fail('Customer name is required.');
    const opening = round2(U.toNum(input.openingBalance, 0));
    if (opening < 0) fail('Opening balance cannot be negative.');
    return {
      name,
      phone: cleanString(input.phone),
      address: cleanString(input.address),
      note: cleanString(input.note),
      openingBalance: opening
    };
  }

  async function addCustomer(input) {
    const values = customerInput(input, null);
    const customer = Object.assign({
      id: nextId(), active: true, openingPaid: 0, createdAt: nowStamp()
    }, values);
    state.customers.push(customer);
    await persist();
    return customer;
  }

  async function updateCustomer(id, input) {
    const customer = customerById(id);
    if (!customer) fail('Customer not found.');
    const before = Number(customer.openingBalance || 0);
    const values = customerInput(input, customer);
    Object.assign(customer, values);
    if (values.openingBalance !== before) {
      customer.openingPaid = Math.min(Number(customer.openingPaid || 0), values.openingBalance);
    }
    await persist();
    return customer;
  }

  async function addAdvance(customerId, input) {
    const customer = customerById(customerId);
    if (!customer) fail('Customer is required for an advance.');
    const amount = round2(U.toNum(input.amount, 0));
    if (amount <= 0) fail('Advance amount must be greater than zero.');
    const method = input.method || 'cash';
    if (!COLLECT_METHODS.includes(method)) fail('Choose a valid advance payment method.');
    if (method === 'cheque' && !cleanString(input.chequeNo)) fail('Cheque number is required.');
    const payment = {
      id: nextId(), type: 'advance', customerId: customer.id, amount, method,
      date: today(), createdAt: nowStamp(), note: cleanString(input.note),
      chequeNo: cleanString(input.chequeNo), chequeDate: input.chequeDate || (method === 'cheque' ? today() : ''),
      cashierId: input.cashierId || null, allocations: []
    };
    state.payments.push(payment);
    await persist();
    return payment;
  }

  function dueAllocations(customerId, target) {
    const items = [];
    if (target && target.type === 'invoice') {
      const inv = invoiceById(target.id);
      if (inv && Number(inv.customerId) === Number(customerId) && Number(inv.balance) > 0.009) {
        items.push({ type: 'invoice', record: inv });
      }
    }
    if (target && target.type === 'service') {
      const svc = serviceById(target.id);
      if (svc && Number(svc.customerId) === Number(customerId) && Number(svc.balance) > 0.009) {
        items.push({ type: 'service', record: svc });
      }
    }
    U.sortBy(state.invoices.filter(i => Number(i.customerId) === Number(customerId) && Number(i.balance) > 0.009),
      i => (i.date || '') + (i.createdAt || ''), 'asc').forEach(inv => {
      if (!items.some(x => x.type === 'invoice' && Number(x.record.id) === Number(inv.id))) items.push({ type: 'invoice', record: inv });
    });
    U.sortBy(state.services.filter(s => Number(s.customerId) === Number(customerId) && Number(s.balance) > 0.009),
      s => (s.date || '') + (s.createdAt || ''), 'asc').forEach(svc => {
      if (!items.some(x => x.type === 'service' && Number(x.record.id) === Number(svc.id))) items.push({ type: 'service', record: svc });
    });
    return items;
  }

  async function collectPayment(customerId, input) {
    const customer = customerById(customerId);
    if (!customer) fail('Choose a customer to receive this payment.');
    let amount = round2(U.toNum(input.amount, 0));
    if (amount <= 0) fail('Payment amount must be greater than zero.');
    const method = input.method || 'cash';
    if (!COLLECT_METHODS.includes(method)) fail('Choose a valid payment method.');
    if (method === 'cheque' && !cleanString(input.chequeNo)) fail('Cheque number is required.');
    const target = input.targetType ? { type: input.targetType, id: input.targetId } : null;
    const allocations = [];
    let left = amount;

    const applyToRecord = (type, record) => {
      if (left <= 0.009) return;
      const due = round2(Number(record.balance) || 0);
      if (due <= 0.009) return;
      const applied = round2(Math.min(left, due));
      record.balance = round2(due - applied);
      record.paid = round2(Number(record.paid || 0) + applied);
      allocations.push({ type, id: record.id, no: record.no, amount: applied });
      left = round2(left - applied);
    };

    dueAllocations(customerId, target).forEach(entry => applyToRecord(entry.type, entry.record));

    const openingDue = round2(Number(customer.openingBalance || 0) - Number(customer.openingPaid || 0));
    if (left > 0.009 && openingDue > 0.009) {
      const applied = round2(Math.min(left, openingDue));
      customer.openingPaid = round2(Number(customer.openingPaid || 0) + applied);
      allocations.push({ type: 'opening', id: customer.id, no: 'Opening balance', amount: applied });
      left = round2(left - applied);
    }

    const appliedTotal = round2(amount - left);
    const payments = [];
    if (appliedTotal > 0.009) {
      const payment = {
        id: nextId(), type: 'collection', customerId: customer.id,
        amount: appliedTotal, method, date: today(), createdAt: nowStamp(),
        note: cleanString(input.note), chequeNo: cleanString(input.chequeNo),
        chequeDate: input.chequeDate || (method === 'cheque' ? today() : ''),
        cashierId: input.cashierId || null, allocations
      };
      state.payments.push(payment);
      payments.push(payment);
    }
    if (left > 0.009) {
      const over = {
        id: nextId(), type: 'advance', customerId: customer.id, amount: left, method,
        date: today(), createdAt: nowStamp(),
        note: 'Overpayment received' + (input.note ? ' — ' + cleanString(input.note) : ''),
        chequeNo: cleanString(input.chequeNo),
        chequeDate: input.chequeDate || (method === 'cheque' ? today() : ''),
        cashierId: input.cashierId || null, allocations: []
      };
      state.payments.push(over);
      payments.push(over);
    }
    await persist();
    return { applied: appliedTotal, advance: left, allocations, payments };
  }

  async function collectForInvoice(invoiceId, input) {
    const inv = invoiceById(invoiceId);
    if (!inv) fail('Invoice not found.');
    if (!inv.customerId) fail('This invoice is not linked to a customer.');
    return collectPayment(inv.customerId, Object.assign({}, input, { targetType: 'invoice', targetId: invoiceId }));
  }

  async function collectForService(serviceId, input) {
    const svc = serviceById(serviceId);
    if (!svc) fail('Service job not found.');
    if (!svc.customerId) fail('This service job is not linked to a customer.');
    return collectPayment(svc.customerId, Object.assign({}, input, { targetType: 'service', targetId: serviceId }));
  }

  /* ---------------- invoice / service payment settling ---------------- */
  function validateCheque(method, input) {
    if (method === 'cheque') {
      if (!cleanString(input.chequeNo)) fail('Enter the cheque number.');
      return {
        chequeNo: cleanString(input.chequeNo),
        chequeDate: input.chequeDate || today()
      };
    }
    return { chequeNo: '', chequeDate: '' };
  }

  function settlePayment(input, total) {
    const method = input.method || 'cash';
    if (!PAYMENT_METHODS.includes(method)) fail('Choose a valid payment method.');
    let paid = 0;
    let advanceUsed = 0;
    let tendered = 0;
    const customer = input.customerId ? customerById(input.customerId) : null;
    if (['credit', 'advance'].includes(method) && !customer) {
      fail(method === 'credit' ? 'Choose a saved customer for a credit sale.' : 'Choose a saved customer to use an advance.');
    }
    const cheque = validateCheque(method, input);
    if (method === 'cash') {
      tendered = round2(U.toNum(input.received, total));
      if (tendered + 0.009 < total) fail('Cash received is less than the bill total.');
      paid = total;
    } else if (method === 'card' || method === 'online' || method === 'cheque') {
      paid = total;
    } else if (method === 'advance') {
      if (total <= 0.009) {
        paid = 0;
      } else {
        const available = customerAdvance(customer.id);
        advanceUsed = round2(Math.min(available, total));
        if (advanceUsed <= 0) fail('This customer has no available advance.');
        paid = advanceUsed;
      }
    } else if (method === 'credit') {
      paid = 0;
    }
    return { method, paid: round2(paid), advanceUsed, tendered, change: round2(Math.max(0, tendered - total)), cheque, customer };
  }

  function addAdvanceUsagePayment(customerId, amount, label, cashierId) {
    if (amount <= 0) return null;
    const payment = {
      id: nextId(), type: 'advance_used', customerId, amount: round2(amount), method: 'advance',
      date: today(), createdAt: nowStamp(), note: 'Applied to ' + label,
      chequeNo: '', chequeDate: '', cashierId: cashierId || null, allocations: []
    };
    state.payments.push(payment);
    return payment;
  }

  function normaliseLines(rawLines) {
    if (!Array.isArray(rawLines) || !rawLines.length) fail('Add at least one item to the bill.');
    const merged = new Map();
    rawLines.forEach(line => {
      const qty = roundQty(U.toNum(line.qty, 0));
      if (qty <= 0) fail('Every line needs a quantity greater than zero.');
      const item = itemById(line.itemId);
      if (!item || item.active === false) fail('One of the selected items is no longer available.');
      const price = round2(U.toNum(line.price, item.retail));
      if (price < 0) fail('Price cannot be negative.');
      const key = item.id;
      if (merged.has(key)) {
        const existing = merged.get(key);
        existing.qty = roundQty(existing.qty + qty);
      } else {
        merged.set(key, { item, qty, price });
      }
    });
    const lines = Array.from(merged.values());
    const stockNeeded = {};
    lines.forEach(l => {
      stockNeeded[l.item.id] = (stockNeeded[l.item.id] || 0) + l.qty;
    });
    Object.keys(stockNeeded).forEach(id => {
      const item = itemById(id);
      if (Number(item.qty) + 0.0001 < stockNeeded[id]) {
        fail('Not enough stock for ' + item.name + '. Available: ' + U.fmtQty(item.qty) + '.');
      }
    });
    return lines.map(l => {
      const total = round2(l.qty * l.price);
      return {
        itemId: l.item.id, name: l.item.name, sku: l.item.sku, category: l.item.category,
        qty: l.qty, price: l.price, cost: round2(l.item.cost), total
      };
    });
  }

  function applyStockSales(lines, refType, refId, refNo, cashierId) {
    lines.forEach(line => {
      const item = itemById(line.itemId);
      item.qty = roundQty(Number(item.qty) - Number(line.qty));
      state.stockMoves.push({
        id: nextId(), date: today(), createdAt: nowStamp(), itemId: item.id,
        type: refType === 'service' ? 'service' : 'sale', qty: -Number(line.qty),
        unitCost: Number(line.cost), refType, refId, refNo, supplier: '', note: '',
        cashierId: cashierId || null
      });
    });
  }

  async function createInvoice(input) {
    const lines = normaliseLines(input.items);
    if (input.customerId && !customerById(input.customerId)) fail('Selected customer was not found.');
    const customer = input.customerId ? customerById(input.customerId) : null;
    if (!['retail', 'wholesale'].includes(input.type)) input.type = 'retail';
    const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
    const discount = round2(U.clamp(U.toNum(input.discount, 0), 0, subtotal));
    const total = round2(subtotal - discount);
    const settled = settlePayment({
      method: input.method, received: input.received, chequeNo: input.chequeNo,
      chequeDate: input.chequeDate, customerId: input.customerId
    }, total);
    const no = nextNo('invoice', state.settings.invoicePrefix || 'INV');
    const invoice = {
      id: nextId(), no, date: today(), createdAt: nowStamp(),
      type: input.type,
      customerId: customer ? customer.id : null,
      customerName: customer ? customer.name : 'Walk-in customer',
      customerPhone: customer ? customer.phone : '',
      subtotal, discount, total,
      paid: settled.paid, salePaid: settled.paid, balance: round2(total - settled.paid),
      returned: 0, advanceUsed: settled.advanceUsed, method: settled.method,
      tendered: settled.tendered, chequeNo: settled.cheque.chequeNo, chequeDate: settled.cheque.chequeDate,
      cashierId: input.cashierId || null, note: cleanString(input.note),
      itemCount: roundQty(lines.reduce((s, l) => s + l.qty, 0))
    };
    if (invoice.balance < 0.01) invoice.balance = 0;
    const savedLines = lines.map(line => {
      const record = Object.assign({}, line, { id: nextId(), invoiceId: invoice.id });
      state.invoiceItems.push(record);
      return record;
    });
    state.invoices.push(invoice);
    applyStockSales(lines, 'invoice', invoice.id, invoice.no, input.cashierId);
    if (settled.advanceUsed > 0) {
      addAdvanceUsagePayment(customer.id, settled.advanceUsed, invoice.no, input.cashierId);
    }
    await persist();
    return { invoice, lines: savedLines, change: settled.change };
  }

  async function createService(input) {
    const customer = input.customerId ? customerById(input.customerId) : null;
    if (input.customerId && !customer) fail('Selected customer was not found.');
    const customerName = customer ? customer.name : (cleanString(input.customerName) || 'Walk-in customer');
    const technician = cleanString(input.technician);
    const work = cleanString(input.work);
    if (!technician) fail('Enter the technician who did the service.');
    if (!work) fail('Describe the work that was done.');
    let parts = [];
    if (Array.isArray(input.parts) && input.parts.length) {
      parts = normaliseLines(input.parts);
    }
    const partsTotal = round2(parts.reduce((s, p) => s + p.total, 0));
    const labor = round2(U.toNum(input.labor, 0));
    if (labor < 0) fail('Labour charge cannot be negative.');
    const subtotal = round2(partsTotal + labor);
    const discount = round2(U.clamp(U.toNum(input.discount, 0), 0, subtotal));
    const total = round2(subtotal - discount);
    const settled = settlePayment({
      method: input.method, received: input.received, chequeNo: input.chequeNo,
      chequeDate: input.chequeDate, customerId: input.customerId
    }, total);
    const no = nextNo('service', state.settings.servicePrefix || 'SRV');
    const service = {
      id: nextId(), no, date: today(), createdAt: nowStamp(),
      customerId: customer ? customer.id : null,
      customerName, phone: customer ? customer.phone : cleanString(input.customerPhone),
      machineType: cleanString(input.machineType), regNo: cleanString(input.regNo),
      technician, work,
      labor, partsTotal, subtotal, discount, total,
      paid: settled.paid, salePaid: settled.paid, balance: round2(total - settled.paid),
      returned: 0, advanceUsed: settled.advanceUsed, method: settled.method,
      tendered: settled.tendered, chequeNo: settled.cheque.chequeNo, chequeDate: settled.cheque.chequeDate,
      cashierId: input.cashierId || null, note: cleanString(input.note)
    };
    if (service.balance < 0.01) service.balance = 0;
    state.services.push(service);
    parts.forEach(line => {
      state.serviceParts.push(Object.assign({}, line, { id: nextId(), serviceId: service.id }));
    });
    applyStockSales(parts, 'service', service.id, service.no, input.cashierId);
    if (settled.advanceUsed > 0) {
      addAdvanceUsagePayment(customer.id, settled.advanceUsed, service.no, input.cashierId);
    }
    await persist();
    return { service, parts: serviceLines(service.id) };
  }

  /* ---------------- returns ---------------- */
  function addCreditRefundToAdvance(customerId, amount, sourceLabel, cashierId) {
    if (amount <= 0) return;
    if (!customerId) fail('Choose a saved customer or refund by cash/card/online for a credit note.');
    state.payments.push({
      id: nextId(), type: 'advance', customerId, amount: round2(amount), method: 'credit',
      date: today(), createdAt: nowStamp(), note: 'Credit from ' + sourceLabel,
      chequeNo: '', chequeDate: '', cashierId: cashierId || null, allocations: []
    });
  }

  async function returnInvoice(invoiceId, input) {
    const invoice = invoiceById(invoiceId);
    if (!invoice) fail('Invoice not found.');
    const requested = Array.isArray(input.lines) ? input.lines : [];
    if (!requested.length) fail('Select at least one item to return.');
    const method = input.method || 'cash';
    if (!RETURN_METHODS.includes(method)) fail('Choose a valid refund method.');
    if (method === 'credit' && !invoice.customerId) fail('A credit note needs a saved customer on the invoice.');
    const ratio = Number(invoice.subtotal) > 0 ? Number(invoice.total) / Number(invoice.subtotal) : 1;
    const raw = [];
    requested.forEach(req => {
      const line = state.invoiceItems.find(l => Number(l.id) === Number(req.invoiceItemId) && Number(l.invoiceId) === Number(invoiceId));
      if (!line) fail('Return line was not found on this invoice.');
      const qty = roundQty(U.toNum(req.qty, 0));
      if (qty <= 0) return;
      const remaining = roundQty(Number(line.qty) - invoiceReturnedQty(line.id));
      if (qty > remaining + 0.0001) fail('Return quantity for ' + line.name + ' exceeds the remaining sold quantity (' + U.fmtQty(remaining) + ').');
      raw.push({ line, qty, amount: round2(qty * Number(line.price) * ratio) });
    });
    if (!raw.length) fail('Enter a return quantity for at least one item.');
    const rawTotal = round2(raw.reduce((s, r) => s + r.amount, 0));
    const maxReturn = round2(Number(invoice.total) - Number(invoice.returned || 0));
    if (maxReturn <= 0.009) fail('This invoice has already been fully returned.');
    const targetTotal = round2(Math.min(rawTotal, maxReturn));
    let factor = rawTotal > 0 ? targetTotal / rawTotal : 0;
    const amounts = raw.map(r => round2(r.amount * factor));
    const drift = round2(targetTotal - amounts.reduce((s, a) => s + a, 0));
    if (amounts.length) amounts[amounts.length - 1] = round2(amounts[amounts.length - 1] + drift);
    const returnAmount = round2(amounts.reduce((s, a) => s + a, 0));
    const appliedToBalance = round2(Math.min(Number(invoice.balance) || 0, returnAmount));
    const refund = round2(returnAmount - appliedToBalance);
    invoice.balance = round2(Math.max(0, Number(invoice.balance) - appliedToBalance));
    invoice.returned = round2(Number(invoice.returned || 0) + returnAmount);
    const no = nextNo('return', 'RET');
    const ret = {
      id: nextId(), no, date: today(), createdAt: nowStamp(),
      refType: 'invoice', refId: invoice.id, refNo: invoice.no,
      customerId: invoice.customerId || null, customerName: invoice.customerName || 'Walk-in customer',
      amount: returnAmount, applied: appliedToBalance, refund, method,
      reason: cleanString(input.reason), restock: input.restock !== false,
      cashierId: input.cashierId || null
    };
    state.returns.push(ret);
    const restock = input.restock !== false;
    raw.forEach((r, idx) => {
      state.returnItems.push({
        id: nextId(), returnId: ret.id, invoiceId: invoice.id, invoiceItemId: r.line.id,
        itemId: r.line.itemId, name: r.line.name, qty: r.qty, price: r.line.price,
        total: amounts[idx], cost: round2(Number(r.line.cost) * r.qty)
      });
      if (restock) {
        const item = itemById(r.line.itemId);
        if (item) {
          item.qty = roundQty(Number(item.qty) + Number(r.qty));
          state.stockMoves.push({
            id: nextId(), date: today(), createdAt: nowStamp(), itemId: item.id, type: 'return',
            qty: Number(r.qty), unitCost: Number(r.line.cost), refType: 'return', refId: ret.id,
            refNo: ret.no, supplier: '', note: cleanString(input.reason), cashierId: input.cashierId || null
          });
        }
      }
    });
    if (refund > 0 && method === 'credit') {
      addCreditRefundToAdvance(invoice.customerId, refund, ret.no, input.cashierId);
    }
    await persist();
    return ret;
  }

  async function returnService(serviceId, input) {
    const service = serviceById(serviceId);
    if (!service) fail('Service job not found.');
    const amount = round2(U.toNum(input.amount, 0));
    if (amount <= 0) fail('Enter a return amount greater than zero.');
    const maxReturn = round2(Number(service.total) - Number(service.returned || 0));
    if (maxReturn <= 0.009) fail('This service bill has already been fully returned.');
    if (amount > maxReturn + 0.009) fail('Return amount cannot exceed ' + U.money(maxReturn) + '.');
    const method = input.method || 'cash';
    if (!RETURN_METHODS.includes(method)) fail('Choose a valid refund method.');
    if (method === 'credit' && !service.customerId) fail('A credit note needs a saved customer.');
    const appliedToBalance = round2(Math.min(Number(service.balance) || 0, amount));
    const refund = round2(amount - appliedToBalance);
    service.balance = round2(Math.max(0, Number(service.balance) - appliedToBalance));
    service.returned = round2(Number(service.returned || 0) + amount);
    const no = nextNo('return', 'RET');
    const ret = {
      id: nextId(), no, date: today(), createdAt: nowStamp(),
      refType: 'service', refId: service.id, refNo: service.no,
      customerId: service.customerId || null, customerName: service.customerName || 'Walk-in customer',
      amount, applied: appliedToBalance, refund, method,
      reason: cleanString(input.reason), restock: false, cashierId: input.cashierId || null
    };
    state.returns.push(ret);
    if (refund > 0 && method === 'credit') {
      addCreditRefundToAdvance(service.customerId, refund, ret.no, input.cashierId);
    }
    await persist();
    return ret;
  }

  /* ---------------- expenses ---------------- */
  async function addExpense(input) {
    const amount = round2(U.toNum(input.amount, 0));
    if (amount <= 0) fail('Expense amount must be greater than zero.');
    const category = EXPENSE_CATEGORIES.some(c => c.key === input.category) ? input.category : 'other';
    const method = input.method || 'cash';
    if (!COLLECT_METHODS.includes(method)) fail('Choose a valid payment method.');
    const expense = {
      id: nextId(), date: input.date || today(), createdAt: nowStamp(),
      category, description: cleanString(input.description) || U.titleCase(category),
      amount, method, cashierId: input.cashierId || null, note: cleanString(input.note)
    };
    state.expenses.push(expense);
    await persist();
    return expense;
  }

  async function deleteExpense(id) {
    assertAdmin();
    const idx = state.expenses.findIndex(e => Number(e.id) === Number(id));
    if (idx === -1) fail('Expense not found.');
    const removed = state.expenses.splice(idx, 1)[0];
    await persist();
    return removed;
  }

  /* ---------------- job cards ---------------- */
  function jobCardById(id) { return state.jobCards.find(j => Number(j.id) === Number(id)) || null; }

  async function addJobCard(input) {
    const customer = input.customerId ? customerById(input.customerId) : null;
    if (input.customerId && !customer) fail('Selected customer was not found.');
    const advance = round2(U.toNum(input.advance, 0));
    if (advance < 0) fail('Advance cannot be negative.');
    const method = advance > 0 ? (input.advanceMethod || 'cash') : '';
    if (advance > 0 && !COLLECT_METHODS.includes(method)) fail('Choose a valid advance payment method.');
    if (advance > 0 && method === 'cheque' && !cleanString(input.chequeNo)) fail('Cheque number is required.');
    const no = nextNo('job', state.settings.jobPrefix || 'JOB');
    const job = {
      id: nextId(), no, date: today(), createdAt: nowStamp(),
      customerId: customer ? customer.id : null,
      customerName: customer ? customer.name : (cleanString(input.customerName) || 'Walk-in customer'),
      phone: customer ? customer.phone : cleanString(input.phone),
      address: customer ? customer.address : cleanString(input.address),
      machineType: cleanString(input.machineType), regNo: cleanString(input.regNo),
      technician: cleanString(input.technician), work: cleanString(input.work),
      receivedDate: input.receivedDate || today(),
      advance, advanceMethod: method,
      chequeNo: method === 'cheque' ? cleanString(input.chequeNo) : '',
      chequeDate: method === 'cheque' ? (input.chequeDate || today()) : '',
      status: 'open', note: cleanString(input.note), cashierId: input.cashierId || null
    };
    state.jobCards.push(job);
    if (advance > 0 && customer) {
      state.payments.push({
        id: nextId(), type: 'advance', customerId: customer.id, amount: advance, method,
        date: today(), createdAt: nowStamp(), note: 'Job card advance · ' + no,
        chequeNo: job.chequeNo, chequeDate: job.chequeDate, cashierId: input.cashierId || null, allocations: []
      });
    }
    await persist();
    return job;
  }

  async function setJobCardStatus(id, status) {
    const job = jobCardById(id);
    if (!job) fail('Job card not found.');
    job.status = status === 'closed' ? 'closed' : 'open';
    if (job.status === 'closed') job.closedAt = nowStamp();
    else delete job.closedAt;
    await persist();
    return job;
  }

  async function deleteJobCard(id) {
    assertAdmin();
    const idx = state.jobCards.findIndex(j => Number(j.id) === Number(id));
    if (idx === -1) fail('Job card not found.');
    const removed = state.jobCards.splice(idx, 1)[0];
    await persist();
    return removed;
  }

  /* ---------------- suppliers ---------------- */
  function supplierById(id) { return state.suppliers.find(s => Number(s.id) === Number(id)) || null; }
  function activeSuppliers() { return state.suppliers.filter(s => s.active !== false); }
  function supplierBills() { return U.sortBy(state.supplierBills, b => (b.date || '') + (b.createdAt || ''), 'desc'); }

  async function addSupplier(input) {
    assertAdmin();
    const name = cleanString(input.name);
    if (!name) fail('Supplier name is required.');
    if (state.suppliers.some(s => s.active !== false && s.name.toLowerCase() === name.toLowerCase())) {
      fail('A supplier with that name already exists.');
    }
    const supplier = {
      id: nextId(), name, phone: cleanString(input.phone),
      category: input.category === 'expense' ? 'expense' : 'stock',
      active: true, createdAt: nowStamp()
    };
    state.suppliers.push(supplier);
    await persist();
    return supplier;
  }

  async function updateSupplier(id, input) {
    assertAdmin();
    const supplier = supplierById(id);
    if (!supplier) fail('Supplier not found.');
    const name = cleanString(input.name);
    if (!name) fail('Supplier name is required.');
    supplier.name = name;
    supplier.phone = cleanString(input.phone);
    supplier.category = input.category === 'expense' ? 'expense' : 'stock';
    await persist();
    return supplier;
  }

  async function archiveSupplier(id) {
    assertAdmin();
    const supplier = supplierById(id);
    if (!supplier) fail('Supplier not found.');
    supplier.active = false;
    await persist();
    return supplier;
  }

  function normaliseSupplierLines(rawLines, supplier) {
    const raw = Array.isArray(rawLines) ? rawLines : [];
    const lines = [];
    raw.forEach(l => {
      if (supplier.category === 'expense') {
        const amount = round2(U.toNum(l.amount, 0));
        if (amount <= 0) return;
        lines.push({ itemId: null, name: cleanString(l.name) || 'Supplied item', qty: 1, unitCost: amount, total: amount });
      } else {
        const qty = roundQty(U.toNum(l.qty, 0));
        if (qty <= 0) return;
        const unitCost = round2(U.toNum(l.unitCost, 0));
        if (unitCost < 0) fail('Unit cost cannot be negative.');
        const wantsNew = !l.itemId || String(l.itemId) === 'new';
        let item = wantsNew ? null : itemById(l.itemId);
        if (!wantsNew && !item) fail('One of the selected parts is no longer available.');
        if (!item) {
          const name = cleanString(l.newName);
          if (!name) fail('Choose a part from the list or type a new part name for every line.');
          const sell = round2(U.toNum(l.sellPrice, unitCost));
          item = {
            id: nextId(), createdAt: nowStamp(), name, category: 'part', sku: '',
            group: 'Other', brand: '', compatible: '',
            origin: l.origin === 'Import' ? 'Import' : 'Local',
            cost: unitCost, retail: sell > 0 ? sell : unitCost,
            wholesale: sell > 0 ? sell : unitCost,
            reorder: Number(state.settings.lowStockDefault) || 5, qty: 0, active: true
          };
          item.sku = 'P-' + String(item.id).padStart(4, '0');
          state.items.push(item);
        } else if (cleanString(l.origin) && item.category === 'part') {
          item.origin = l.origin;
        }
        lines.push({ itemId: item.id, name: item.name, qty, unitCost, total: round2(qty * unitCost), origin: l.origin === 'Import' ? 'Import' : 'Local' });
      }
    });
    if (!lines.length) fail('Add at least one supplied item.');
    return lines;
  }

  async function addSupplierBill(input) {
    assertAdmin();
    const supplier = supplierById(input.supplierId);
    if (!supplier) fail('Choose a supplier.');
    const date = input.date || today();
    const method = COLLECT_METHODS.includes(input.method) ? input.method : 'cash';
    const lines = normaliseSupplierLines(input.lines, supplier);
    const total = round2(lines.reduce((s, l) => s + Number(l.total), 0));
    const no = nextNo('grn', state.settings.purchasePrefix || 'GRN');
    const bill = {
      id: nextId(), no, supplierId: supplier.id, supplierName: supplier.name,
      category: supplier.category, date, createdAt: nowStamp(),
      invoiceNo: cleanString(input.invoiceNo), method, lines, total,
      cashierId: input.cashierId || null, note: cleanString(input.note)
    };
    state.supplierBills.push(bill);
    if (supplier.category === 'expense') {
      state.expenses.push({
        id: nextId(), date, createdAt: nowStamp(), category: 'other',
        description: 'Supplier purchase · ' + supplier.name + (bill.invoiceNo ? ' · ' + bill.invoiceNo : ''),
        amount: total, method, cashierId: input.cashierId || null, note: bill.no
      });
    } else {
      bill.lines.forEach(l => {
        const item = itemById(l.itemId);
        const oldQty = Number(item.qty) || 0;
        item.cost = oldQty > 0
          ? round2(((oldQty * Number(item.cost || 0)) + (l.qty * l.unitCost)) / (oldQty + l.qty))
          : l.unitCost;
        item.qty = roundQty(oldQty + l.qty);
        state.stockMoves.push({
          id: nextId(), date, createdAt: nowStamp(), itemId: item.id,
          type: 'purchase', qty: l.qty, unitCost: l.unitCost,
          refType: 'supplier', refId: bill.id, refNo: bill.no,
          supplier: supplier.name, note: bill.invoiceNo ? 'Supplier inv ' + bill.invoiceNo : '',
          cashierId: input.cashierId || null
        });
      });
    }
    await persist();
    return bill;
  }

  /* ---------------- supplier cheques & advances ---------------- */
  // A cheque or advance we handed over only reduces what we owe once it has
  // left our hand; while it is still 'withus' the bill stays unpaid.
  const SUPPLIER_PAYMENT_KINDS = ['cheque', 'advance'];
  const SUPPLIER_DIRECTIONS = ['to', 'from'];
  const SUPPLIER_PAYMENT_STATUS = {
    withus: 'With us',
    returned: 'Handed over',
    honoured: 'Honoured',
    dishonoured: 'Dishonoured',
    settled: 'Settled'
  };

  function supplierPaymentsList(supplierId) {
    const rows = state.supplierPayments.slice();
    const filtered = supplierId === undefined || supplierId === null || supplierId === ''
      ? rows : rows.filter(p => Number(p.supplierId) === Number(supplierId));
    return U.sortBy(filtered, p => (p.date || '') + (p.createdAt || ''), 'desc');
  }

  function supplierPaymentById(id) {
    return state.supplierPayments.find(p => Number(p.id) === Number(id)) || null;
  }

  function paymentCountsAsPaid(payment) {
    if (payment.status === 'dishonoured' || payment.status === 'withus') return false;
    return true;
  }

  async function addSupplierPayment(input) {
    assertAdmin();
    const supplier = supplierById(input.supplierId);
    if (!supplier) fail('Choose a supplier.');
    const kind = SUPPLIER_PAYMENT_KINDS.includes(input.kind) ? input.kind : 'cheque';
    const direction = SUPPLIER_DIRECTIONS.includes(input.direction) ? input.direction : 'to';
    const amount = round2(U.toNum(input.amount, 0));
    if (amount <= 0) fail('Enter an amount greater than zero.');
    const method = input.method === 'cash' || input.method === 'online' || input.method === 'card' ? input.method : (kind === 'cheque' ? 'cheque' : 'cash');
    if (kind === 'cheque' && !cleanString(input.chequeNo)) fail('Enter the cheque number.');
    const payment = {
      id: nextId(), supplierId: supplier.id, supplierName: supplier.name,
      supplierCategory: supplier.category, kind, direction, method,
      date: input.date || today(), createdAt: nowStamp(), amount,
      chequeNo: cleanString(input.chequeNo),
      bank: cleanString(input.bank),
      chequeDate: input.chequeDate || (kind === 'cheque' ? input.date || today() : ''),
      status: kind === 'cheque' ? 'withus' : 'settled',
      refNo: cleanString(input.refNo),
      note: cleanString(input.note), cashierId: input.cashierId || null
    };
    state.supplierPayments.push(payment);
    await persist();
    return payment;
  }

  async function setSupplierPaymentStatus(id, status) {
    assertAdmin();
    const payment = supplierPaymentById(id);
    if (!payment) fail('Payment not found.');
    if (!SUPPLIER_PAYMENT_STATUS[status]) fail('Unknown payment status.');
    if (payment.kind !== 'cheque' && status !== 'settled' && status !== 'dishonoured') {
      fail('Only cheques carry a bank status.');
    }
    payment.status = status;
    payment.statusAt = nowStamp();
    await persist();
    return payment;
  }

  async function deleteSupplierPayment(id) {
    assertAdmin();
    const idx = state.supplierPayments.findIndex(p => Number(p.id) === Number(id));
    if (idx === -1) fail('Payment not found.');
    const removed = state.supplierPayments.splice(idx, 1)[0];
    await persist();
    return removed;
  }

  function supplierAccount(supplierId) {
    const id = Number(supplierId);
    const bills = state.supplierBills.filter(b => Number(b.supplierId) === id);
    const payments = state.supplierPayments.filter(p => Number(p.supplierId) === id);
    const billsTotal = round2(U.sumBy(bills, b => Number(b.total) || 0));
    const given = payments.filter(p => p.direction === 'to');
    const givenCredited = round2(U.sumBy(given.filter(paymentCountsAsPaid), p => Number(p.amount) || 0));
    const givenHeldBack = round2(U.sumBy(given.filter(p => p.status === 'withus'), p => Number(p.amount) || 0));
    const givenBounced = round2(U.sumBy(given.filter(p => p.status === 'dishonoured'), p => Number(p.amount) || 0));
    const taken = round2(U.sumBy(payments.filter(p => p.direction === 'from' && p.status !== 'dishonoured'), p => Number(p.amount) || 0));
    const payable = round2(billsTotal - givenCredited);
    return {
      billsTotal, billCount: bills.length,
      givenCredited, givenHeldBack, givenBounced,
      advanceTaken: taken,
      payable,
      advanceToSupplier: payable < 0 ? round2(-payable) : 0,
      owedToSupplier: payable > 0 ? payable : 0,
      chequesWithUs: given.filter(p => p.status === 'withus'),
      payments
    };
  }

  function supplierLedger() {
    return U.sortBy(state.suppliers.filter(s => s.active !== false).map(s => {
      const acc = supplierAccount(s.id);
      return Object.assign({ id: s.id, name: s.name, phone: s.phone, category: s.category }, acc, {
        payments: undefined
      });
    }), r => r.name.toLowerCase(), 'asc');
  }

  /* ---------------- local / import report ---------------- */
  function lineOrigin(bill, line) {
    const direct = cleanString(line.origin);
    if (direct) return direct === 'Import' ? 'Import' : 'Local';
    const item = line.itemId ? itemById(line.itemId) : null;
    const fromItem = cleanString(item && item.origin);
    if (fromItem) return fromItem === 'Import' ? 'Import' : 'Local';
    return 'Local';
  }

  function originReport(from, to) {
    const buckets = () => ({ Local: blankOrigin('Local'), Import: blankOrigin('Import') });
    const stock = buckets();
    state.items.filter(i => i.active !== false).forEach(i => {
      const key = cleanString(i.origin) === 'Import' ? 'Import' : 'Local';
      const qty = roundQty(Number(i.qty) || 0);
      stock[key].itemCount += 1;
      stock[key].qty = roundQty(stock[key].qty + qty);
      stock[key].costValue = round2(stock[key].costValue + qty * (Number(i.cost) || 0));
      stock[key].retailValue = round2(stock[key].retailValue + qty * (Number(i.retail) || 0));
      if (qty > 0) stock[key].inStockItems += 1;
      stock[key].items.push({
        id: i.id, name: i.name, sku: i.sku, category: i.category,
        group: i.group || 'Other', qty, cost: Number(i.cost) || 0, retail: Number(i.retail) || 0,
        costValue: round2(qty * (Number(i.cost) || 0)), retailValue: round2(qty * (Number(i.retail) || 0))
      });
    });
    const purchases = buckets();
    const purchaseLines = state.supplierBills
      .filter(b => b.category === 'stock' && isInRange(b.date, from, to))
      .flatMap(b => b.lines.map(l => ({
        date: b.date, no: b.no, supplier: b.supplierName, name: l.name,
        qty: Number(l.qty) || 0, unitCost: Number(l.unitCost) || 0,
        amount: round2(Number(l.total) || 0), origin: lineOrigin(b, l)
      })));
    purchaseLines.forEach(l => {
      const key = l.origin;
      purchases[key].billCount += 1;
      purchases[key].qty = roundQty(purchases[key].qty + l.qty);
      purchases[key].amount = round2(purchases[key].amount + l.amount);
      purchases[key].lines.push(l);
    });
    ['Local', 'Import'].forEach(key => {
      stock[key].items = U.sortBy(stock[key].items, r => r.retailValue, 'desc');
      purchases[key].lines = U.sortBy(purchases[key].lines.slice(), l => l.date, 'desc');
    });
    return { stock: [stock.Local, stock.Import], purchases: [purchases.Local, purchases.Import] };
  }

  function blankOrigin(label) {
    return {
      origin: label, itemCount: 0, inStockItems: 0, qty: 0, costValue: 0, retailValue: 0,
      billCount: 0, amount: 0, items: [], lines: []
    };
  }

  /* ---------------- quotations ---------------- */
  async function addQuotation(input) {
    const raw = Array.isArray(input.lines) ? input.lines : [];
    if (!raw.length) fail('Add at least one item to the quotation.');
    const merged = new Map();
    raw.forEach(l => {
      const item = itemById(l.itemId);
      if (!item || item.active === false) fail('One of the selected items is no longer available.');
      const qty = roundQty(U.toNum(l.qty, 0));
      if (qty <= 0) fail('Every line needs a quantity greater than zero.');
      const price = round2(U.toNum(l.price, item.retail));
      if (price < 0) fail('Price cannot be negative.');
      if (merged.has(item.id)) merged.get(item.id).qty = roundQty(merged.get(item.id).qty + qty);
      else merged.set(item.id, { item, qty, price });
    });
    const lines = Array.from(merged.values()).map(l => ({
      itemId: l.item.id, name: l.item.name, sku: l.item.sku, qty: l.qty, price: l.price, total: round2(l.qty * l.price)
    }));
    const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
    const discount = round2(U.clamp(U.toNum(input.discount, 0), 0, subtotal));
    const customer = input.customerId ? customerById(input.customerId) : null;
    if (input.customerId && !customer) fail('Selected customer was not found.');
    const no = nextNo('quote', state.settings.quotePrefix || 'QT');
    const quotation = {
      id: nextId(), no, date: today(), createdAt: nowStamp(),
      customerId: customer ? customer.id : null,
      customerName: customer ? customer.name : (cleanString(input.customerName) || 'Walk-in customer'),
      phone: customer ? customer.phone : cleanString(input.phone),
      lines, subtotal, discount, total: round2(subtotal - discount),
      note: cleanString(input.note), status: 'open', cashierId: input.cashierId || null
    };
    state.quotations.push(quotation);
    await persist();
    return quotation;
  }

  async function deleteQuotation(id) {
    assertAdmin();
    const idx = state.quotations.findIndex(q => Number(q.id) === Number(id));
    if (idx === -1) fail('Quotation not found.');
    const removed = state.quotations.splice(idx, 1)[0];
    await persist();
    return removed;
  }

  /* ---------------- cheque reminders ---------------- */
  function chequeReminders() {
    const rows = [];
    state.invoices.forEach(i => {
      if (i.method !== 'cheque') return;
      rows.push({
        kind: 'Shop sale', billKind: 'invoice', id: i.id, no: i.no, date: i.date,
        customer: i.customerName || 'Walk-in customer', chequeNo: i.chequeNo || '',
        chequeDate: i.chequeDate || i.date, amount: Number(i.salePaid) || 0
      });
    });
    state.services.forEach(s => {
      if (s.method !== 'cheque') return;
      rows.push({
        kind: 'Service bill', billKind: 'service', id: s.id, no: s.no, date: s.date,
        customer: s.customerName || 'Walk-in customer', chequeNo: s.chequeNo || '',
        chequeDate: s.chequeDate || s.date, amount: Number(s.salePaid) || 0
      });
    });
    state.payments.forEach(p => {
      if (p.method !== 'cheque') return;
      const customer = p.customerId ? customerById(p.customerId) : null;
      rows.push({
        kind: p.type === 'advance' ? 'Advance' : 'Collection', billKind: 'payment', id: p.id,
        no: p.note || '', date: p.date, customer: customer ? customer.name : '',
        chequeNo: p.chequeNo || '', chequeDate: p.chequeDate || p.date, amount: Number(p.amount) || 0
      });
    });
    const todayStr = today();
    const t = new Date(todayStr + 'T00:00:00').getTime();
    rows.forEach(r => {
      const d = new Date((r.chequeDate || todayStr) + 'T00:00:00').getTime();
      r.days = Math.round((d - t) / 86400000);
    });
    return U.sortBy(rows, r => (r.chequeDate || '9999-12-31'), 'asc');
  }

  /* ---------------- cashiers ---------------- */
  async function addCashier(input) {
    assertAdmin();
    const name = cleanString(input.name);
    if (!name) fail('Cashier name is required.');
    const cashier = { id: nextId(), name, phone: cleanString(input.phone), active: true, createdAt: nowStamp() };
    state.cashiers.push(cashier);
    await persist();
    return cashier;
  }

  async function updateCashier(id, input) {
    assertAdmin();
    const cashier = cashierById(id);
    if (!cashier) fail('Cashier not found.');
    const name = cleanString(input.name);
    if (!name) fail('Cashier name is required.');
    cashier.name = name;
    cashier.phone = cleanString(input.phone);
    await persist();
    return cashier;
  }

  async function openSession(cashierId, input) {
    assertOwnDrawer(cashierId);
    const cashier = cashierById(cashierId);
    if (!cashier) fail('Cashier not found.');
    if (openSessionFor(cashierId)) fail(cashier.name + ' already has an open session. Close it first.');
    const opening = round2(U.toNum(input.openingBalance, 0));
    if (opening < 0) fail('Opening balance cannot be negative.');
    const session = {
      id: nextId(), cashierId: cashier.id, date: today(),
      openedAt: nowStamp(), openingBalance: opening,
      closedAt: null, expectedBalance: null, countedBalance: null,
      note: cleanString(input.note), closeNote: ''
    };
    state.cashierSessions.push(session);
    await persist();
    return session;
  }

  function sessionCovers(session) {
    const start = session.openedAt;
    const end = session.closedAt || nowStamp();
    return record => {
      const t = record.createdAt || (record.date ? record.date + ' 00:00:00' : '');
      return t >= start && t <= end;
    };
  }

  function sessionSummary(cashierId, session) {
    if (!session) return null;
    const covers = sessionCovers(session);
    const invoices = state.invoices.filter(i => Number(i.cashierId) === Number(cashierId) && covers(i));
    const services = state.services.filter(s => Number(s.cashierId) === Number(cashierId) && covers(s));
    const payments = state.payments.filter(p => Number(p.cashierId) === Number(cashierId) && covers(p));
    const expenses = state.expenses.filter(e => Number(e.cashierId) === Number(cashierId) && covers(e));
    const returns = state.returns.filter(r => Number(r.cashierId) === Number(cashierId) && covers(r));
    const saleCash = invoices.filter(i => i.method === 'cash').reduce((s, i) => s + Number(i.salePaid || 0), 0);
    const serviceCash = services.filter(s => s.method === 'cash').reduce((s, s2) => s + Number(s2.salePaid || 0), 0);
    const collectionsCash = payments.filter(p => p.method === 'cash' && (p.type === 'collection' || p.type === 'advance'))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const expensesCash = expenses.filter(e => e.method === 'cash').reduce((s, e) => s + Number(e.amount || 0), 0);
    const refundsCash = returns.filter(r => r.method === 'cash').reduce((s, r) => s + Number(r.refund || 0), 0);
    const cashIn = round2(saleCash + serviceCash + collectionsCash);
    const cashOut = round2(expensesCash + refundsCash);
    const opening = Number(session.openingBalance || 0);
    const expected = round2(opening + cashIn - cashOut);
    const saleCard = invoices.filter(i => i.method === 'card').reduce((s, i) => s + Number(i.salePaid || 0), 0) +
      services.filter(s => s.method === 'card').reduce((s, i) => s + Number(i.salePaid || 0), 0) +
      payments.filter(p => p.method === 'card').reduce((s, p) => s + Number(p.amount || 0), 0);
    const saleOnline = invoices.filter(i => i.method === 'online').reduce((s, i) => s + Number(i.salePaid || 0), 0) +
      services.filter(s => s.method === 'online').reduce((s, i) => s + Number(i.salePaid || 0), 0) +
      payments.filter(p => p.method === 'online').reduce((s, p) => s + Number(p.amount || 0), 0);
    const saleCheque = invoices.filter(i => i.method === 'cheque').reduce((s, i) => s + Number(i.salePaid || 0), 0) +
      services.filter(s => s.method === 'cheque').reduce((s, i) => s + Number(i.salePaid || 0), 0) +
      payments.filter(p => p.method === 'cheque').reduce((s, p) => s + Number(p.amount || 0), 0);
    return {
      opening: round2(opening), saleCash: round2(saleCash), serviceCash: round2(serviceCash),
      collectionsCash: round2(collectionsCash), cashIn, cashOut, expensesCash: round2(expensesCash),
      refundsCash: round2(refundsCash), expected,
      card: round2(saleCard), online: round2(saleOnline), cheque: round2(saleCheque),
      invoiceCount: invoices.length, serviceCount: services.length,
      payments: payments.filter(p => p.type === 'collection').length
    };
  }

  function sessionPartsBreakdown(cashierId, session) {
    const result = { rows: [], qty: 0, value: 0, saleQty: 0, serviceQty: 0, saleValue: 0, serviceValue: 0 };
    if (!session) return result;
    const covers = sessionCovers(session);
    const invoiceIds = new Set(state.invoices
      .filter(i => Number(i.cashierId) === Number(cashierId) && covers(i))
      .map(i => Number(i.id)));
    const serviceIds = new Set(state.services
      .filter(s => Number(s.cashierId) === Number(cashierId) && covers(s))
      .map(s => Number(s.id)));
    const rows = new Map();

    function add(line, source) {
      if (line.category === 'machine') return;
      const qty = Number(line.qty) || 0;
      if (qty <= 0) return;
      const key = line.itemId ? 'item-' + line.itemId : 'sku-' + String(line.sku || line.name).toLowerCase();
      let row = rows.get(key);
      if (!row) {
        row = { itemId: line.itemId || null, name: line.name || 'Part', sku: line.sku || '', saleQty: 0, serviceQty: 0, saleValue: 0, serviceValue: 0 };
        rows.set(key, row);
      }
      if (source === 'sale') {
        row.saleQty = roundQty(row.saleQty + qty);
        row.saleValue = round2(row.saleValue + Number(line.total || 0));
      } else {
        row.serviceQty = roundQty(row.serviceQty + qty);
        row.serviceValue = round2(row.serviceValue + Number(line.total || 0));
      }
    }

    state.invoiceItems.forEach(line => {
      if (invoiceIds.has(Number(line.invoiceId))) add(line, 'sale');
    });
    state.serviceParts.forEach(line => {
      if (serviceIds.has(Number(line.serviceId))) add(line, 'service');
    });

    result.rows = Array.from(rows.values()).map(row => Object.assign({}, row, {
      qty: roundQty(row.saleQty + row.serviceQty),
      value: round2(row.saleValue + row.serviceValue)
    })).sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
    result.qty = roundQty(result.rows.reduce((sum, row) => sum + row.qty, 0));
    result.value = round2(result.rows.reduce((sum, row) => sum + row.value, 0));
    result.saleQty = roundQty(result.rows.reduce((sum, row) => sum + row.saleQty, 0));
    result.serviceQty = roundQty(result.rows.reduce((sum, row) => sum + row.serviceQty, 0));
    result.saleValue = round2(result.rows.reduce((sum, row) => sum + row.saleValue, 0));
    result.serviceValue = round2(result.rows.reduce((sum, row) => sum + row.serviceValue, 0));
    return result;
  }

  async function closeSession(cashierId, input) {
    assertOwnDrawer(cashierId);
    const session = openSessionFor(cashierId);
    if (!session) fail('There is no open session for this cashier.');
    const counted = round2(U.toNum(input.countedBalance, 0));
    if (counted < 0) fail('Counted cash cannot be negative.');
    const summary = sessionSummary(cashierId, session);
    session.closedAt = nowStamp();
    session.expectedBalance = summary.expected;
    session.countedBalance = counted;
    session.closeNote = cleanString(input.note);
    await persist();
    return { session, summary, difference: round2(counted - summary.expected) };
  }

  function cashierSessions(from, to) {
    return U.sortBy(state.cashierSessions.filter(s => isInRange(s.openedAt, from, to)), s => s.openedAt, 'desc');
  }

  function cashierSummaryToday(cashierId) {
    const session = openSessionFor(cashierId);
    if (session) return { session, summary: sessionSummary(cashierId, session) };
    const fake = {
      openedAt: today() + ' 00:00:00',
      closedAt: null,
      openingBalance: 0
    };
    return { session: fake, summary: sessionSummary(cashierId, fake), open: false };
  }

  /* ---------------- settings / backup ---------------- */
  async function saveSettings(patch) {
    assertAdmin();
    Object.assign(state.settings, patch);
    await persist();
    return state.settings;
  }

  function stats() {
    return {
      invoices: state.invoices.length,
      services: state.services.length,
      items: state.items.length,
      customers: state.customers.length,
      payments: state.payments.length,
      expenses: state.expenses.length,
      returns: state.returns.length,
      cashiers: state.cashiers.length
    };
  }

  async function prepareBackup() {
    assertAdmin();
    state.settings.lastBackupAt = nowStamp();
    await persist();
    const payload = {
      app: 'wijaya-pattalaya-pos',
      version: SCHEMA_VERSION,
      shop: state.settings.shopName,
      exportedAt: nowStamp(),
      counts: stats(),
      data: state
    };
    return {
      json: JSON.stringify(payload, null, 2),
      filename: 'wijaya-pattalaya-backup-' + today() + '.json'
    };
  }

  async function importBackup(text) {
    assertAdmin();
    const parsed = U.safeParse(text, null);
    if (!parsed || typeof parsed !== 'object') fail('That file is not a valid backup.');
    if (parsed.app !== 'wijaya-pattalaya-pos') fail('This backup was not made by Wijaya Pattalaya POS.');
    if (!parsed.data || typeof parsed.data !== 'object') fail('The backup file is missing its data.');
    const required = ['settings', 'invoices', 'services', 'items', 'customers'];
    for (const key of required) {
      if (!parsed.data[key]) fail('The backup is missing required data: ' + key + '.');
    }
    if (!Array.isArray(parsed.data.invoices) || !Array.isArray(parsed.data.items)) fail('The backup data is not in the expected format.');
    const next = normalizeState(parsed.data);
    state = next;
    if (!next.cashiers.length) {
      next.cashiers.push({ id: nextId(), name: 'Main Counter', phone: '', active: true, createdAt: nowStamp() });
    }
    await persist();
    return stats();
  }

  /* ---------------- access / security ---------------- */
  function getAuth() { return state.auth; }
  async function saveAuth(next) {
    state.auth = Object.assign({ version: 1, admin: null, cashierLogins: {} }, next || {});
    await persist();
    return state.auth;
  }

  /* ---------------- reports ---------------- */
  function rangeInvoices(from, to) { return state.invoices.filter(i => isInRange(i.date, from, to)); }
  function rangeServices(from, to) { return state.services.filter(s => isInRange(s.date, from, to)); }
  function rangeExpenses(from, to) { return state.expenses.filter(e => isInRange(e.date, from, to)); }
  function rangeReturns(from, to) { return state.returns.filter(r => isInRange(r.date, from, to)); }
  function rangePayments(from, to) { return state.payments.filter(p => isInRange(p.date, from, to)); }

  function machineUnitsNetFromInvoices(invoices) {
    const ids = new Set(invoices.map(i => Number(i.id)));
    let units = 0;
    state.invoiceItems.forEach(l => {
      if (!ids.has(Number(l.invoiceId)) || l.category !== 'machine') return;
      units += Number(l.qty) - invoiceReturnedQty(l.id);
    });
    return roundQty(units);
  }

  function partsSoldOn(date) {
    const map = new Map();
    const add = (itemId, name, qty, revenue) => {
      const key = Number(itemId);
      if (!map.has(key)) map.set(key, { itemId: key, name, qty: 0, revenue: 0 });
      const entry = map.get(key);
      entry.qty = roundQty(entry.qty + Number(qty));
      entry.revenue = round2(entry.revenue + Number(revenue));
    };
    state.invoices.filter(i => i.date === date).forEach(inv => {
      invoiceLines(inv.id).filter(l => l.category === 'part').forEach(l => {
        const retQty = invoiceReturnedQty(l.id);
        add(l.itemId, l.name, Number(l.qty) - retQty, Number(l.total) - (retQty > 0 ? round2(retQty * Number(l.price)) : 0));
      });
    });
    state.services.filter(s => s.date === date).forEach(svc => {
      serviceLines(svc.id).forEach(l => add(l.itemId, l.name, l.qty, l.total));
    });
    return Array.from(map.values()).filter(e => e.qty > 0.0001).sort((a, b) => b.revenue - a.revenue);
  }

  function dashboard(activeCashierId) {
    const d = today();
    const monthStart = U.monthStartISO();
    const invoicesToday = state.invoices.filter(i => i.date === d);
    const servicesToday = state.services.filter(s => s.date === d);
    const returnsToday = state.returns.filter(r => r.date === d);
    const expensesToday = state.expenses.filter(e => e.date === d);
    const shopGross = round2(invoicesToday.reduce((s, i) => s + Number(i.total), 0));
    const shopReturns = round2(returnsToday.filter(r => r.refType === 'invoice').reduce((s, r) => s + Number(r.amount), 0));
    const serviceGross = round2(servicesToday.reduce((s, i) => s + Number(i.total), 0));
    const serviceReturns = round2(returnsToday.filter(r => r.refType === 'service').reduce((s, r) => s + Number(r.amount), 0));
    const netShop = round2(shopGross - shopReturns);
    const netService = round2(serviceGross - serviceReturns);
    const week = U.lastNDates(7, d).map(date => {
      const sales = state.invoices.filter(i => i.date === date).reduce((s, i) => s + Number(i.total), 0) -
        state.returns.filter(r => r.date === date && r.refType === 'invoice').reduce((s, r) => s + Number(r.amount), 0);
      const service = state.services.filter(i => i.date === date).reduce((s, i) => s + Number(i.total), 0) -
        state.returns.filter(r => r.date === date && r.refType === 'service').reduce((s, r) => s + Number(r.amount), 0);
      return {
        date, label: U.fmtDate(date, { mode: 'weekday' }),
        sales: round2(Math.max(0, sales)), service: round2(Math.max(0, service))
      };
    });
    const lowStock = lowStockItems();
    const cashier = activeCashierId ? cashierById(activeCashierId) : null;
    const openSessions = state.cashierSessions.filter(s => !s.closedAt);
    const drawer = openSessions.length ? (cashier && openSessionFor(cashier.id) ? { session: openSessionFor(cashier.id), summary: sessionSummary(cashier.id, openSessionFor(cashier.id)) } : { session: openSessions[0], summary: sessionSummary(openSessions[0].cashierId, openSessions[0]), cashier: cashierById(openSessions[0].cashierId) }) : null;
    const monthServices = state.services.filter(s => isInRange(s.date, monthStart, d));
    const techMap = new Map();
    monthServices.forEach(svc => {
      const key = cleanString(svc.technician).toLowerCase() || 'unassigned';
      if (!techMap.has(key)) techMap.set(key, { name: svc.technician, jobs: 0, total: 0 });
      const entry = techMap.get(key);
      entry.jobs += 1; entry.total += Number(svc.total);
    });
    const technicians = Array.from(techMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);
    return {
      date: d,
      totals: {
        revenue: round2(netShop + netService),
        netShop, netService, shopGross, shopReturns, serviceGross, serviceReturns,
        invoicesCount: invoicesToday.length, servicesCount: servicesToday.length,
        collected: round2(invoicesToday.reduce((s, i) => s + Number(i.salePaid), 0) +
          servicesToday.reduce((s, i) => s + Number(i.salePaid), 0) +
          state.payments.filter(p => p.date === d && (p.type === 'collection' || p.type === 'advance')).reduce((s, p) => s + Number(p.amount), 0)),
        expenses: round2(expensesToday.reduce((s, e) => s + Number(e.amount), 0)),
        partsSoldQty: roundQty(partsSoldOn(d).reduce((s, p) => s + p.qty, 0))
      },
      week,
      receivables: totalReceivables(),
      advances: totalAdvances(),
      lowStockCount: lowStock.length,
      lowStock: lowStock.slice(0, 5),
      machinesSoldMonth: machineUnitsNetFromInvoices(state.invoices.filter(i => isInRange(i.date, monthStart, d))),
      machinesSoldAll: machineUnitsNetFromInvoices(state.invoices),
      todayInvoices: U.sortBy(invoicesToday, i => i.createdAt || '', 'desc').slice(0, 6),
      todayServices: U.sortBy(servicesToday, s => s.createdAt || '', 'desc').slice(0, 6),
      todayParts: partsSoldOn(d).slice(0, 7),
      techniciansMonth: technicians,
      drawer,
      cashier,
      activeCashierName: cashier ? cashier.name : (state.cashiers[0] ? state.cashiers[0].name : '—')
    };
  }

  function machineSalesReport(from, to) {
    const rows = [];
    rangeInvoices(from, to).forEach(inv => {
      invoiceLines(inv.id).filter(l => l.category === 'machine').forEach(line => {
        const returnedQty = invoiceReturnedQty(line.id);
        rows.push({
          invoiceId: inv.id, invoiceNo: inv.no, date: inv.date, createdAt: inv.createdAt,
          customer: inv.customerName, itemId: line.itemId, name: line.name, sku: line.sku,
          qty: Number(line.qty), returnedQty,
          netQty: roundQty(Number(line.qty) - returnedQty),
          price: Number(line.price), total: Number(line.total), cost: round2(Number(line.cost) * Number(line.qty)),
          origin: (itemById(line.itemId) && itemById(line.itemId).origin) || '—',
          method: inv.method, status: invoiceStatus(inv)
        });
      });
    });
    rows.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    return {
      rows,
      unitsGross: roundQty(rows.reduce((s, r) => s + r.qty, 0)),
      unitsNet: roundQty(rows.reduce((s, r) => s + r.netQty, 0)),
      revenue: round2(rows.reduce((s, r) => s + r.total, 0)),
      cost: round2(rows.reduce((s, r) => s + r.cost, 0)),
      importUnits: roundQty(rows.filter(r => r.origin === 'Import').reduce((s, r) => s + r.netQty, 0)),
      localUnits: roundQty(rows.filter(r => r.origin === 'Local').reduce((s, r) => s + r.netQty, 0))
    };
  }

  function machineSoldAllForItem(itemId) {
    let units = 0;
    state.invoiceItems.forEach(l => {
      if (Number(l.itemId) === Number(itemId) && l.category === 'machine') units += Number(l.qty) - invoiceReturnedQty(l.id);
    });
    return roundQty(units);
  }

  function reportsSummary(from, to) {
    const invs = rangeInvoices(from, to);
    const svcs = rangeServices(from, to);
    const rets = rangeReturns(from, to);
    const exps = rangeExpenses(from, to);
    const invReturns = rets.filter(r => r.refType === 'invoice');
    const svcReturns = rets.filter(r => r.refType === 'service');
    const salesGross = round2(invs.reduce((s, i) => s + Number(i.total), 0));
    const salesReturns = round2(invReturns.reduce((s, r) => s + Number(r.amount), 0));
    const serviceGross = round2(svcs.reduce((s, i) => s + Number(i.total), 0));
    const serviceReturns = round2(svcReturns.reduce((s, r) => s + Number(r.amount), 0));
    const salesNet = round2(salesGross - salesReturns);
    const serviceNet = round2(serviceGross - serviceReturns);
    const discounts = round2(invs.reduce((s, i) => s + Number(i.discount), 0) + svcs.reduce((s, i) => s + Number(i.discount), 0));
    const invoiceIds = new Set(invs.map(i => Number(i.id)));
    const serviceIds = new Set(svcs.map(i => Number(i.id)));
    let partsCost = 0;
    state.invoiceItems.forEach(l => { if (invoiceIds.has(Number(l.invoiceId))) partsCost += Number(l.cost) * Number(l.qty); });
    state.serviceParts.forEach(l => { if (serviceIds.has(Number(l.serviceId))) partsCost += Number(l.cost) * Number(l.qty); });
    const returnIds = new Set(rets.map(r => Number(r.id)));
    let returnedCost = 0;
    state.returnItems.forEach(r => {
      if (returnIds.has(Number(r.returnId))) {
        const header = state.returns.find(x => Number(x.id) === Number(r.returnId));
        if (header && header.restock) returnedCost += Number(r.cost);
      }
    });
    partsCost = round2(partsCost - returnedCost);
    const expensesTotal = round2(exps.reduce((s, e) => s + Number(e.amount), 0));
    const grossProfit = round2(salesNet + serviceNet - partsCost);
    const netProfit = round2(grossProfit - expensesTotal);
    const expenseByCategory = EXPENSE_CATEGORIES.map(c => ({
      key: c.key, label: c.label, icon: c.icon,
      amount: round2(exps.filter(e => e.category === c.key).reduce((s, e) => s + Number(e.amount), 0))
    }));
    const receivedByMethod = { cash: 0, card: 0, online: 0, cheque: 0 };
    invs.forEach(i => { if (receivedByMethod[i.method] !== undefined) receivedByMethod[i.method] += Number(i.salePaid || 0); });
    svcs.forEach(i => { if (receivedByMethod[i.method] !== undefined) receivedByMethod[i.method] += Number(i.salePaid || 0); });
    rangePayments(from, to).forEach(p => {
      if ((p.type === 'collection' || p.type === 'advance') && receivedByMethod[p.method] !== undefined) {
        receivedByMethod[p.method] += Number(p.amount || 0);
      }
    });
    const retail = round2(invs.filter(i => i.type === 'retail').reduce((s, i) => s + Number(i.total), 0));
    const wholesale = round2(invs.filter(i => i.type === 'wholesale').reduce((s, i) => s + Number(i.total), 0));
    const creditSales = round2(
      invs.reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.returned || 0) - Number(i.salePaid || 0)), 0) +
      svcs.reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.returned || 0) - Number(i.salePaid || 0)), 0)
    );
    const collections = rangePayments(from, to).filter(p => p.type === 'collection')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const advancesReceived = rangePayments(from, to).filter(p => p.type === 'advance' && p.method !== 'credit')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const topMap = new Map();
    const addTop = (itemId, name, qty, revenue, source) => {
      const key = Number(itemId) || name;
      if (!topMap.has(key)) topMap.set(key, { itemId: key, name, qty: 0, revenue: 0, saleQty: 0, serviceQty: 0 });
      const e = topMap.get(key);
      e.qty += Number(qty);
      e.revenue += Number(revenue);
      if (source === 'service') e.serviceQty += Number(qty);
      else e.saleQty += Number(qty);
    };
    state.invoiceItems.forEach(l => {
      if (invoiceIds.has(Number(l.invoiceId)) && l.category === 'part') addTop(l.itemId, l.name, l.qty, l.total, 'sale');
    });
    state.serviceParts.forEach(l => {
      if (serviceIds.has(Number(l.serviceId))) addTop(l.itemId, l.name, l.qty, l.total, 'service');
    });
    state.returnItems.forEach(r => {
      if (!returnIds.has(Number(r.returnId))) return;
      const key = Number(r.itemId);
      if (topMap.has(key)) {
        const e = topMap.get(key);
        e.qty -= Number(r.qty);
        e.revenue -= Number(r.total);
        e.saleQty -= Number(r.qty);
      }
    });
    const allParts = Array.from(topMap.values()).filter(x => x.qty > 0.0001);
    const topParts = allParts.slice().sort((a, b) => b.revenue - a.revenue).slice(0, 8);
    const partRows = allParts.slice().sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
    return {
      from, to,
      salesGross, salesReturns, salesNet, serviceGross, serviceReturns, serviceNet,
      retail, wholesale, discounts,
      partsCost, expensesTotal, grossProfit, netProfit,
      invoiceCount: invs.length, serviceCount: svcs.length, returnsCount: rets.length,
      machineUnits: machineUnitsNetFromInvoices(invs),
      creditSales: round2(creditSales),
      collections: round2(collections),
      advancesReceived: round2(advancesReceived),
      receivables: totalReceivables(),
      advancesBalance: totalAdvances(),
      expenseByCategory,
      receivedByMethod,
      topParts,
      partRows,
      lowStockCount: lowStockItems().length
    };
  }

  function servicesByTechnician(from, to) {
    const svcs = rangeServices(from, to);
    const map = new Map();
    svcs.forEach(svc => {
      const raw = cleanString(svc.technician);
      const key = raw.toLowerCase() || 'unassigned';
      if (!map.has(key)) {
        map.set(key, {
          name: raw || 'Unassigned', jobs: 0, labour: 0, parts: 0, total: 0,
          paid: 0, due: 0, partsCost: 0, lastDate: svc.date
        });
      }
      const entry = map.get(key);
      entry.jobs += 1;
      entry.labour = round2(entry.labour + Number(svc.labor || 0));
      entry.parts = round2(entry.parts + Number(svc.partsTotal || 0));
      entry.total = round2(entry.total + Number(svc.total || 0));
      entry.paid = round2(entry.paid + Number(svc.paid || 0));
      entry.due = round2(entry.due + Number(svc.balance || 0));
      if (svc.date > entry.lastDate) entry.lastDate = svc.date;
      serviceLines(svc.id).forEach(p => { entry.partsCost = round2(entry.partsCost + Number(p.cost) * Number(p.qty)); });
    });
    const rows = Array.from(map.values()).sort((a, b) => b.total - a.total);
    return {
      rows,
      jobs: svcs.length,
      total: round2(rows.reduce((s, r) => s + r.total, 0)),
      paid: round2(rows.reduce((s, r) => s + r.paid, 0)),
      due: round2(rows.reduce((s, r) => s + r.due, 0)),
      partsCost: round2(rows.reduce((s, r) => s + r.partsCost, 0))
    };
  }

  function dayBook(date) {
    const invs = state.invoices.filter(i => i.date === date);
    const svcs = state.services.filter(s => s.date === date);
    const pays = state.payments.filter(p => p.date === date);
    const exps = state.expenses.filter(e => e.date === date);
    const rets = state.returns.filter(r => r.date === date);
    const opening = getOpening(date);
    const invoiceCash = round2(invs.filter(i => i.method === 'cash').reduce((s, i) => s + Number(i.salePaid || 0), 0));
    const invoiceBank = round2(invs.filter(i => ['card', 'online', 'cheque'].includes(i.method)).reduce((s, i) => s + Number(i.salePaid || 0), 0));
    const serviceCash = round2(svcs.filter(i => i.method === 'cash').reduce((s, i) => s + Number(i.salePaid || 0), 0));
    const serviceBank = round2(svcs.filter(i => ['card', 'online', 'cheque'].includes(i.method)).reduce((s, i) => s + Number(i.salePaid || 0), 0));
    const collectionsCash = round2(pays.filter(p => p.method === 'cash' && (p.type === 'collection' || p.type === 'advance')).reduce((s, p) => s + Number(p.amount || 0), 0));
    const collectionsBank = round2(pays.filter(p => ['card', 'online', 'cheque'].includes(p.method) && (p.type === 'collection' || p.type === 'advance')).reduce((s, p) => s + Number(p.amount || 0), 0));
    const expensesCash = round2(exps.filter(e => e.method === 'cash').reduce((s, e) => s + Number(e.amount || 0), 0));
    const expensesBank = round2(exps.filter(e => ['card', 'online', 'cheque'].includes(e.method)).reduce((s, e) => s + Number(e.amount || 0), 0));
    const refundsCash = round2(rets.filter(r => r.method === 'cash').reduce((s, r) => s + Number(r.refund || 0), 0));
    const refundsBank = round2(rets.filter(r => ['card', 'online'].includes(r.method)).reduce((s, r) => s + Number(r.refund || 0), 0));
    const cashIn = round2(invoiceCash + serviceCash + collectionsCash);
    const bankIn = round2(invoiceBank + serviceBank + collectionsBank);
    const cashOut = round2(expensesCash + refundsCash);
    const bankOut = round2(expensesBank + refundsBank);
    const closingCash = round2(Number(opening.cash || 0) + cashIn - cashOut);
    const closingBank = round2(Number(opening.bank || 0) + bankIn - bankOut);
    const creditSales = round2(
      invs.reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.returned || 0) - Number(i.salePaid || 0)), 0) +
      svcs.reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.returned || 0) - Number(i.salePaid || 0)), 0)
    );
    return {
      date, opening, cashIn, cashOut, closingCash, bankIn, bankOut, closingBank,
      invoiceCash, invoiceBank, serviceCash, serviceBank, collectionsCash, collectionsBank,
      expensesCash, expensesBank, refundsCash, refundsBank,
      creditSales,
      invoiceCount: invs.length, serviceCount: svcs.length,
      invoices: invs, services: svcs, expenses: exps, returns: rets, payments: pays
    };
  }

  function getOpening(date) {
    const found = state.openings.find(o => o.date === date);
    return found ? { cash: Number(found.cash) || 0, bank: Number(found.bank) || 0, note: found.note || '' } : { cash: 0, bank: 0, note: '' };
  }

  async function saveOpening(date, input) {
    assertAdmin();
    if (!date) fail('Choose a date for the opening balance.');
    const cash = round2(U.toNum(input.cash, 0));
    const bank = round2(U.toNum(input.bank, 0));
    if (cash < 0 || bank < 0) fail('Opening balances cannot be negative.');
    let record = state.openings.find(o => o.date === date);
    if (!record) {
      record = { id: nextId(), date, cash, bank, note: cleanString(input.note), updatedAt: nowStamp() };
      state.openings.push(record);
    } else {
      record.cash = cash; record.bank = bank; record.note = cleanString(input.note); record.updatedAt = nowStamp();
    }
    await persist();
    return record;
  }

  function returnReport(from, to) {
    const rows = U.sortBy(rangeReturns(from, to), r => r.createdAt || r.date, 'desc');
    return {
      rows,
      total: round2(rows.reduce((s, r) => s + Number(r.amount), 0)),
      refunded: round2(rows.reduce((s, r) => s + Number(r.refund), 0)),
      adjusted: round2(rows.reduce((s, r) => s + Number(r.applied), 0))
    };
  }

  function invoiceDetail(id) {
    const invoice = invoiceById(id);
    if (!invoice) return null;
    const lines = invoiceLines(id).map(l => Object.assign({}, l, { returnedQty: invoiceReturnedQty(l.id) }));
    const returns = state.returns.filter(r => r.refType === 'invoice' && Number(r.refId) === Number(id))
      .map(r => Object.assign({}, r, { items: state.returnItems.filter(ri => Number(ri.returnId) === Number(r.id)) }));
    const payments = state.payments.filter(p => (p.allocations || []).some(a => a.type === 'invoice' && Number(a.id) === Number(id)));
    const customer = invoice.customerId ? customerById(invoice.customerId) : null;
    const cashier = invoice.cashierId ? cashierById(invoice.cashierId) : null;
    return { invoice, lines, returns, payments, customer, cashier, status: invoiceStatus(invoice) };
  }

  function serviceDetail(id) {
    const service = serviceById(id);
    if (!service) return null;
    const parts = serviceLines(id);
    const returns = state.returns.filter(r => r.refType === 'service' && Number(r.refId) === Number(id));
    const payments = state.payments.filter(p => (p.allocations || []).some(a => a.type === 'service' && Number(a.id) === Number(id)));
    const customer = service.customerId ? customerById(service.customerId) : null;
    const cashier = service.cashierId ? cashierById(service.cashierId) : null;
    return { service, parts, returns, payments, customer, cashier, status: invoiceStatus(service) };
  }

  function customerStatement(id) {
    const customer = customerById(id);
    if (!customer) return null;
    const invoices = U.sortBy(state.invoices.filter(i => Number(i.customerId) === Number(id)), i => i.createdAt || i.date, 'desc')
      .map(i => Object.assign({}, i, { status: invoiceStatus(i) }));
    const services = U.sortBy(state.services.filter(s => Number(s.customerId) === Number(id)), s => s.createdAt || s.date, 'desc')
      .map(s => Object.assign({}, s, { status: invoiceStatus(s) }));
    const payments = U.sortBy(state.payments.filter(p => Number(p.customerId) === Number(id)), p => p.createdAt || p.date, 'desc');
    const returns = U.sortBy(state.returns.filter(r => Number(r.customerId) === Number(id)), r => r.createdAt || r.date, 'desc');
    return {
      customer, invoices, services, payments, returns,
      due: customerDue(id), advance: customerAdvance(id)
    };
  }

  function listStockMoves(query) {
    const q = cleanString(query && query.q).toLowerCase();
    let rows = U.sortBy(state.stockMoves, m => m.createdAt || m.date, 'desc');
    if (query && query.type) rows = rows.filter(m => m.type === query.type);
    if (q) {
      rows = rows.filter(m => {
        const item = itemById(m.itemId);
        return (item && (item.name.toLowerCase().includes(q) || String(item.sku).toLowerCase().includes(q))) ||
          String(m.refNo || '').toLowerCase().includes(q) ||
          String(m.supplier || '').toLowerCase().includes(q) ||
          String(m.note || '').toLowerCase().includes(q);
      });
    }
    return rows;
  }

  function findItemByScan(code) {
    const q = cleanString(code).toLowerCase();
    if (!q) return null;
    return activeItems().find(i => String(i.sku).toLowerCase() === q) ||
      activeItems().find(i => String(i.name).toLowerCase() === q) || null;
  }

  const API = {
    init,
    get data() { return state; },
    meta,
    constants: { PART_GROUPS, EXPENSE_CATEGORIES, PAYMENT_METHODS, COLLECT_METHODS, RETURN_METHODS, STATUS_LABELS, SUPPLIER_PAYMENT_STATUS, SCHEMA_VERSION },
    statusLabel(status) { return STATUS_LABELS[status] || U.titleCase(status || ''); },
    itemById, customerById, invoiceById, serviceById, cashierById,
    activeItems, activeCustomers, activeCashiers, lowStockItems,
    addItem, updateItem, archiveItem, receiveStock, setStock,
    addCustomer, updateCustomer, addAdvance, collectPayment, collectForInvoice, collectForService,
    customerDue, customerAdvance, customerLastActivity, totalReceivables, totalAdvances, customerStatement,
    createInvoice, createService,
    returnInvoice, returnService,
    invoiceLines, serviceLines, invoiceReturnedQty, invoiceStatus,
    addExpense, deleteExpense,
    jobCardById, addJobCard, setJobCardStatus, deleteJobCard,
    supplierById, activeSuppliers, addSupplier, updateSupplier, archiveSupplier, addSupplierBill, supplierBills,
    addSupplierPayment, setSupplierPaymentStatus, deleteSupplierPayment,
    supplierPaymentsList, supplierPaymentById, supplierAccount, supplierLedger,
    originReport,
    addQuotation, deleteQuotation,
    chequeReminders,
    addCashier, updateCashier, openSession, closeSession, openSessionFor, sessionSummary, sessionPartsBreakdown, cashierSessions, cashierSummaryToday,
    getAuth, saveAuth,
    saveSettings, stats, prepareBackup, importBackup,
    dashboard, reportsSummary, servicesByTechnician, machineSalesReport, machineSoldAllForItem,
    dayBook, getOpening, saveOpening, returnReport, partsSoldOn,
    invoiceDetail, serviceDetail,
    listStockMoves, findItemByScan,
    rangeInvoices, rangeServices, rangeExpenses, rangeReturns, rangePayments
  };
  WP.store = API;
})();
