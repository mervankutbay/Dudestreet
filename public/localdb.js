// Demo modu: Google olmadan denemek için, SheetDB ile aynı arayüz; veriler bu tarayıcıda (localStorage) durur.
import { colLetter } from './google.js';

const KEY = 'ds_demo_db';

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }

function parseCell(ref) { // "C1" -> {col:3,row:1}
  const m = String(ref).match(/^([A-Z]+)(\d+)$/);
  if (!m) return { col: 1, row: 1 };
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: Number(m[2]) };
}

export class LocalDB {
  constructor() { this.id = 'demo'; this.s = load(); this.s.sheets ||= {}; }
  save() { localStorage.setItem(KEY, JSON.stringify(this.s)); }
  static async create() { localStorage.removeItem(KEY); const db = new LocalDB(); db.s.sheets._meta = [['Anahtar', 'Değer']]; db.save(); return db; }
  static exists() { return !!localStorage.getItem(KEY); }
  static wipe() { localStorage.removeItem(KEY); }

  async tabs() { return Object.keys(this.s.sheets).map((title, i) => ({ title, sheetId: i })); }
  async read(sheet, range = '') {
    const rows = this.s.sheets[sheet] || [];
    if (range === '1:1') return rows.length ? [rows[0]] : [];
    return rows.map(r => [...r]);
  }
  async write(sheet, range, values) {
    const rows = (this.s.sheets[sheet] ||= []);
    const start = parseCell(range.split(':')[0]);
    values.forEach((vals, i) => {
      const r = start.row - 1 + i;
      rows[r] ||= [];
      vals.forEach((v, j) => { rows[r][start.col - 1 + j] = v; });
    });
    this.save();
  }
  async append(sheet, newRows) { (this.s.sheets[sheet] ||= []).push(...newRows.map(r => r.map(String))); this.save(); }
  async table(sheet) {
    const rows = this.s.sheets[sheet] || [];
    if (!rows.length) return [];
    const head = rows[0];
    return rows.slice(1).map((r, i) => { const o = { _row: i + 2 }; head.forEach((h, c) => { o[h] = r[c] ?? ''; }); return o; });
  }
  async appendObj(sheet, obj) { const head = (this.s.sheets[sheet] || [[]])[0]; return this.append(sheet, [head.map(h => obj[h] ?? '')]); }
  async deleteRow(sheet, rowNumber) { (this.s.sheets[sheet] || []).splice(rowNumber - 1, 1); this.save(); }
  async deleteRows(sheet, rows) { [...new Set(rows)].sort((a, b) => b - a).forEach(r => (this.s.sheets[sheet] || []).splice(r - 1, 1)); this.save(); }
  async appendObjs(sheet, objs) { const head = (this.s.sheets[sheet] || [[]])[0]; return this.append(sheet, objs.map(o => head.map(h => o[h] ?? ''))); }
  async writeObj(sheet, row, obj) { const head = (this.s.sheets[sheet] || [[]])[0]; (this.s.sheets[sheet] ||= [])[row - 1] = head.map(h => String(obj[h] ?? '')); this.save(); }
  async head(sheet) { return (this.s.sheets[sheet] || [[]])[0]; }
  async kv(sheet) { const o = {}; (this.s.sheets[sheet] || []).slice(1).forEach(r => { if (r[0]) o[r[0]] = r[1] ?? ''; }); return o; }
  async setKV(sheet, values) {
    const rows = (this.s.sheets[sheet] ||= [['Anahtar', 'Değer']]);
    for (const [k, v] of Object.entries(values)) {
      const i = rows.findIndex((r, idx) => idx > 0 && r[0] === k);
      if (i >= 0) rows[i][1] = String(v); else rows.push([k, String(v)]);
    }
    this.save();
  }
  async ensureSheet(title, headers) {
    const rows = (this.s.sheets[title] ||= [[]]);
    const head = rows[0];
    headers.forEach(h => { if (!head.includes(h)) head.push(h); });
    this.save();
  }
  async ensureColumn(title, header) { return this.ensureSheet(title, [header]); }
}

export { colLetter };
