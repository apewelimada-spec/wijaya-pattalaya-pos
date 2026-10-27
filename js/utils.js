(function () {
  'use strict';
  const WP = window.WP = window.WP || {};

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function isoDate(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function stamp(d) {
    d = d || new Date();
    return isoDate(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function nowStamp() { return stamp(new Date()); }

  function parseLocalDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const s = String(value);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return new Date(s);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  }

  function fmtDate(value, opts) {
    const d = parseLocalDate(value);
    if (!d || isNaN(d.getTime())) return '—';
    const mode = (opts && opts.mode) || 'medium';
    if (mode === 'short') return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
    if (mode === 'numeric') return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
    if (mode === 'long') return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    if (mode === 'weekday') return DAYS[d.getDay()].slice(0, 3);
    return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
  }

  function fmtTime(value) {
    const d = parseLocalDate(value);
    if (!d || isNaN(d.getTime())) return '';
    let h = d.getHours();
    const m = pad(d.getMinutes());
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + ap;
  }

  function fmtDateTime(value) {
    if (!value) return '—';
    return fmtDate(value, { mode: 'short' }) + ', ' + fmtTime(value);
  }

  function todayISO() { return isoDate(new Date()); }

  function addDays(iso, days) {
    const d = parseLocalDate(iso);
    d.setDate(d.getDate() + days);
    return isoDate(d);
  }

  function monthStartISO(d) {
    d = d ? parseLocalDate(d) : new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-01';
  }

  function monthKey(iso) {
    const s = String(iso || '');
    return s.slice(0, 7);
  }

  function monthLabel(key) {
    if (!key) return '';
    const parts = String(key).split('-');
    const mi = Number(parts[1]) - 1;
    return (MONTHS[mi] || '') + ' ' + (parts[0] || '');
  }

  function daysBetween(startIso, endIso) {
    const a = parseLocalDate(startIso); const b = parseLocalDate(endIso);
    if (!a || !b) return 0;
    return Math.round((b - a) / 86400000);
  }

  function lastNDates(n, endIso) {
    const arr = [];
    const end = endIso || todayISO();
    for (let i = n - 1; i >= 0; i--) arr.push(addDays(end, -i));
    return arr;
  }

  function round2(n) {
    const num = Number(n);
    if (!isFinite(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  function toNum(v, fallback) {
    if (v === null || v === undefined || v === '') return fallback === undefined ? 0 : fallback;
    const n = Number(String(v).replace(/,/g, '').trim());
    return isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
  }

  function fmtNumber(n, digits) {
    const num = Number(n) || 0;
    return num.toLocaleString('en-US', {
      minimumFractionDigits: digits === undefined ? 2 : digits,
      maximumFractionDigits: digits === undefined ? 2 : digits
    });
  }

  function fmtQty(n) {
    const num = Number(n) || 0;
    return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
  }

  function symbol() {
    const s = WP.store && WP.store.data && WP.store.data.settings;
    return (s && s.currency) || 'Rs.';
  }

  function money(n, opts) {
    const digits = opts && opts.digits !== undefined ? opts.digits : 2;
    return symbol() + ' ' + fmtNumber(n, digits);
  }

  function moneyShort(n) {
    const num = Number(n) || 0;
    const digits = Number.isInteger(num) ? 0 : 2;
    return symbol() + ' ' + fmtNumber(num, digits);
  }

  function moneyParts(n) {
    return { symbol: symbol(), amount: fmtNumber(n, 2) };
  }

  function pct(part, total) {
    if (!total) return 0;
    return Math.max(0, Math.min(100, (Number(part) / Number(total)) * 100));
  }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function attr(value) { return esc(value); }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function titleCase(s) {
    return String(s || '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function groupBy(arr, fn) {
    const out = {};
    (arr || []).forEach(item => {
      const key = fn(item);
      if (!out[key]) out[key] = [];
      out[key].push(item);
    });
    return out;
  }

  function sumBy(arr, fn) {
    return (arr || []).reduce((sum, item) => sum + (Number(fn(item)) || 0), 0);
  }

  function sortBy(arr, fn, dir) {
    const d = dir === 'desc' ? -1 : 1;
    return (arr || []).slice().sort((a, b) => {
      const va = fn(a); const vb = fn(b);
      if (va < vb) return -1 * d;
      if (va > vb) return 1 * d;
      return 0;
    });
  }

  function unique(arr) { return Array.from(new Set(arr)); }

  function uidSuffix() { return Math.random().toString(36).slice(2, 8); }

  function debounce(fn, wait) {
    let t;
    return function () {
      const args = arguments; const ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), wait || 200);
    };
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function safeParse(text, fallback) {
    try { return JSON.parse(text); } catch (e) { return fallback; }
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, Number(n) || 0)); }

  function periodLabel(from, to) {
    if (!from && !to) return 'All time';
    if (from === to) return fmtDate(from, { mode: 'medium' });
    return fmtDate(from, { mode: 'short' }) + ' – ' + fmtDate(to, { mode: 'short' });
  }

  function csvEscape(v) {
    const s = String(v === null || v === undefined ? '' : v);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function toCSV(rows) {
    return rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
  }

  function totalsForMethod(method) {
    const labels = {
      cash: 'Cash', card: 'Card', online: 'Online transfer', credit: 'Credit',
      cheque: 'Cheque', advance: 'Advance', none: 'Unpaid'
    };
    return labels[method] || titleCase(method || '');
  }

  function expiryWarning(dateIso, days) {
    if (!dateIso) return false;
    return daysBetween(dateIso, todayISO()) > (days || 7);
  }

  WP.utils = {
    pad, isoDate, stamp, nowStamp, todayISO, addDays, monthStartISO, monthKey, monthLabel,
    daysBetween, lastNDates, parseLocalDate, fmtDate, fmtTime, fmtDateTime,
    round2, toNum, fmtNumber, fmtQty, money, moneyShort, moneyParts, symbol, pct,
    esc, attr, initials, titleCase, groupBy, sumBy, sortBy, unique, uidSuffix, debounce,
    downloadFile, readFileAsText, safeParse, clamp, periodLabel, toCSV,
    methodLabel: totalsForMethod, expiryWarning, months: MONTHS, monthsShort: MONTHS_SHORT, days: DAYS
  };
})();
