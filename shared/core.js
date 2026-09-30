(function (root) {
  'use strict';
  const STORE = 'san-lorenzo';
  const LEGACY_PROJECT = 'olfltcygpakierjzrhcr';
  function validateConfig(config) {
    const url = new URL(config.supabaseUrl);
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Configura un URL Supabase HTTPS valido.');
    if (url.hostname === LEGACY_PROJECT + '.supabase.co') throw new Error('Usa un nuovo progetto Supabase: La Malfa deve restare invariata.');
    if (config.storeId !== STORE) throw new Error('Punto vendita non valido.');
    const key = config.publishableKey || '';
    if (key.startsWith('sb_secret_')) throw new Error('Nel browser è consentita solo la chiave pubblica.');
    if (!key.startsWith('sb_publishable_')) {
      try { const part = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); if (JSON.parse(atob(part)).role !== 'anon') throw new Error(); }
      catch { throw new Error('Inserisci una chiave pubblicabile o anon.'); }
    }
    return url.origin;
  }
  function days(expiry, now = new Date()) {
    if (!expiry) return null;
    const [y, m, d] = expiry.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  }
  function normalize(value) {
    const p = { ean: String(value.ean || '').trim(), name: String(value.name || '').trim(), supplier: String(value.supplier || '').trim(), expiry: value.noExpiry ? null : (value.expiry || null), noExpiry: !!value.noExpiry, signaled: !value.noExpiry && !!value.signaled, managed: !value.noExpiry && !!value.managed, absent: !!value.absent, note: String(value.note || '').trim(), version: Number(value.version || 0) };
    if (!/^\d{5,14}$/.test(p.ean) || !p.name || p.name.length > 240 || !p.supplier || p.supplier.length > 240 || p.note.length > 280) throw new Error('Controlla EAN, nome, fornitore e note.');
    if (p.expiry) {
      const date = new Date(p.expiry + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.expiry) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== p.expiry) throw new Error('Data di scadenza non valida.');
    }
    if ((p.signaled || p.managed) && !p.expiry) throw new Error('Inserisci una scadenza prima di segnalare o gestire il prodotto.');
    if (p.managed) p.signaled = true;
    return p;
  }
  function toPayload(p) { p = normalize(p); return {ean:p.ean,name:p.name,supplier:p.supplier,expiry:p.expiry,no_expiry:p.noExpiry,signaled:p.signaled,managed:p.managed,absent:p.absent,note:p.note}; }
  function fromRow(r) { return {ean:r.ean,name:r.name,supplier:r.supplier,expiry:r.expiry,noExpiry:r.no_expiry,signaled:r.signaled,managed:r.managed,absent:r.absent,note:r.note,version:Number(r.version),updatedBy:r.updated_by_name,updatedAt:r.updated_at}; }
  function merge(catalog, rows, pending, accessories = []) {
    const accessorySet = new Set(accessories);
    const map = new Map(catalog.map(p => [p.ean,{...p,expiry:null,signaled:false,managed:false,noExpiry:accessorySet.has(p.ean),absent:false,note:'',version:0}]));
    rows.forEach(r => map.set(r.ean, fromRow(r)));
    pending.forEach(op => map.set(op.product.ean, {...op.product}));
    return [...map.values()];
  }
  function enqueue(pending, product, id) {
    const previous = pending.find(op => op.product.ean === product.ean);
    return [...pending.filter(op => op.product.ean !== product.ean), {id,product:normalize(product),expectedVersion:previous ? previous.expectedVersion : Number(product.version || 0)}];
  }
  function acknowledge(pending, id) { return pending.filter(op => op.id !== id); }
  function matches(p, filter, query, supplier) {
    const n = days(p.expiry);
    if (supplier && p.supplier !== supplier) return false;
    if (query && !(p.ean+' '+p.name+' '+p.supplier).toLocaleLowerCase('it').includes(query.toLocaleLowerCase('it'))) return false;
    if (filter !== 'absent' && p.absent) return false;
    switch(filter) {
      case 'all': return true;
      case 'no-date': return !p.noExpiry && !p.expiry;
      case 'expired': return !p.noExpiry && !p.managed && n !== null && n <= 0;
      case 'urgent': return !p.noExpiry && !p.managed && n !== null && n > 0 && n <= 7;
      case 'attention': return !p.noExpiry && !p.managed && n !== null && n > 0 && n <= 30;
      case 'monitor': return !p.noExpiry && !p.managed && n !== null && n > 0 && n <= 120;
      case 'unsignaled': return !p.noExpiry && !p.signaled && n !== null && n <= 120;
      case 'signaled': return p.signaled && !p.managed;
      case 'managed': return p.managed;
      case 'no-expiry': return p.noExpiry;
      case 'absent': return p.absent;
      default: return false;
    }
  }
  function csvCell(value) {
    let s = String(value ?? '');
    if (/^[=+@\-\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g,'""') + '"';
  }
  const api = {STORE,validateConfig,days,normalize,toPayload,fromRow,merge,enqueue,acknowledge,matches,csvCell};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PetStoreCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
