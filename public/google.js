// Dudestreet — Google girişi (yönlendirme ile, iPhone PWA uyumlu) + Sheets/Drive yardımcıları.
// Sunucu yok: her istek tarayıcıdan doğrudan Google'a gider.
import { CONFIG } from './config.js';

const SCOPES = 'https://www.googleapis.com/auth/drive.file openid email';
const LS = { token: 'ds_token', state: 'ds_oauth_state', email: 'ds_email', sheet: 'ds_sheet_id', tried: 'ds_silent_tried' };

export class AuthError extends Error { constructor(m = 'Google oturumu gerekli') { super(m); this.name = 'AuthError'; } }

export function redirectUri() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

// --- Oturum ---
export function getToken() {
  try {
    const t = JSON.parse(localStorage.getItem(LS.token) || 'null');
    if (t && t.exp > Date.now() + 60_000) return t.access_token;
  } catch {}
  return null;
}
export function hadSession() { return !!localStorage.getItem(LS.email); }
export function userEmail() { return localStorage.getItem(LS.email) || ''; }
export function clearToken() { localStorage.removeItem(LS.token); }

export function login({ silent = false } = {}) {
  const state = crypto.randomUUID();
  localStorage.setItem(LS.state, state);
  if (silent) localStorage.setItem(LS.tried, String(Date.now()));
  const p = new URLSearchParams({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    state,
  });
  const hint = userEmail();
  if (hint) p.set('login_hint', hint);
  if (silent) p.set('prompt', 'none');
  location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + p.toString();
}

// Google'dan dönüşte adres çubuğundaki #access_token'ı al
export function handleRedirect() {
  if (!location.hash || location.hash.length < 2) return { handled: false };
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.has('access_token') && !h.has('error')) return { handled: false };
  history.replaceState(null, '', redirectUri());
  const expected = localStorage.getItem(LS.state);
  localStorage.removeItem(LS.state);
  if (h.get('error')) return { handled: true, error: h.get('error') };
  if (!expected || h.get('state') !== expected) return { handled: true, error: 'state_mismatch' };
  const granted = (h.get('scope') || '').split(' ');
  if (!granted.includes('https://www.googleapis.com/auth/drive.file')) return { handled: true, error: 'drive_izni_verilmedi' };
  localStorage.setItem(LS.token, JSON.stringify({
    access_token: h.get('access_token'),
    exp: Date.now() + Number(h.get('expires_in') || 3600) * 1000,
  }));
  localStorage.removeItem(LS.tried);
  return { handled: true, ok: true };
}

// Süresi dolmuşsa ve daha önce bağlanmışsa sessizce yenile (döngüye girmesin diye 2 dk'da bir)
export function shouldSilentRefresh() {
  if (getToken() || !hadSession()) return false;
  const last = Number(localStorage.getItem(LS.tried) || 0);
  return Date.now() - last > 120_000;
}

export function logout() {
  Object.values(LS).forEach(k => localStorage.removeItem(k));
}

// --- Genel istek ---
async function api(url, opts = {}) {
  const t = getToken();
  if (!t) throw new AuthError();
  const r = await fetch(url, {
    ...opts,
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (r.status === 401) { clearToken(); throw new AuthError(); }
  if (!r.ok) {
    let msg = r.status + ' ' + r.statusText;
    try { const j = await r.json(); msg = j.error?.message || msg; } catch {}
    throw new Error(msg);
  }
  return r.status === 204 ? null : r.json();
}

export async function fetchEmail() {
  const j = await api('https://www.googleapis.com/oauth2/v3/userinfo');
  if (j.email) localStorage.setItem(LS.email, j.email);
  return j.email;
}

// --- Drive ---
const DRIVE = 'https://www.googleapis.com/drive/v3/files';

export async function findAppSheets() {
  const q = `appProperties has { key='${CONFIG.APP_PROPERTY}' and value='main' } and trashed=false`;
  const j = await api(`${DRIVE}?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`);
  return j.files || [];
}

export async function tagFile(id, value, ek = {}) {
  return api(`${DRIVE}/${id}?fields=id`, { method: 'PATCH', body: JSON.stringify({ appProperties: { [CONFIG.APP_PROPERTY]: value, ...ek } }) });
}
export async function renameFile(id, name) {
  return api(`${DRIVE}/${id}?fields=id`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

// Kopya (yedek ya da geri yüklenen ana tablo)
export async function copyFile(id, name, tag = 'backup', ek = {}) {
  const j = await api(`${DRIVE}/${id}/copy?fields=id,name,createdTime`, { method: 'POST', body: JSON.stringify({ name }) });
  await tagFile(j.id, tag, ek);
  return j;
}
export async function listBackups() {
  const q = `appProperties has { key='${CONFIG.APP_PROPERTY}' and value='backup' } and trashed=false`;
  const j = await api(`${DRIVE}?q=${encodeURIComponent(q)}&orderBy=createdTime desc&pageSize=200&fields=files(id,name,createdTime,appProperties)`);
  return j.files || [];
}
export async function deleteFile(id) {
  return api(`${DRIVE}/${id}`, { method: 'DELETE' });
}

export function getSheetId() { return localStorage.getItem(LS.sheet); }
export function setSheetId(id) { id ? localStorage.setItem(LS.sheet, id) : localStorage.removeItem(LS.sheet); }
export const sheetUrl = id => `https://docs.google.com/spreadsheets/d/${id}/edit`;

// --- Sheets ---
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const q = s => `'${String(s).replace(/'/g, "''")}'`;

export function colLetter(n) { // 1 -> A
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// Ham satırlardan nesne listesi / anahtar-değer (Sheets ve demo aynı biçimi kullanır)
export function satirlardanTablo(rows) {
  if (!rows || !rows.length) return [];
  const head = rows[0];
  return rows.slice(1).map((r, i) => { const o = { _row: i + 2 }; head.forEach((h, c) => { o[h] = r[c] ?? ''; }); return o; });
}
export function satirlardanKV(rows) {
  const o = {};
  (rows || []).slice(1).forEach(r => { if (r[0]) o[r[0]] = r[1] ?? ''; });
  return o;
}
// append cevabındaki "updatedRange"den eklenen ilk satır numarası ('Gelir'!A5:D7 → 5)
export const eklenenSatir = res => { const m = String(res?.updates?.updatedRange || '').match(/![A-Z]+(\d+)/); return m ? Number(m[1]) : null; };

export class SheetDB {
  constructor(id) { this.id = id; }

  static async create(title) {
    const j = await api(SHEETS, {
      method: 'POST',
      body: JSON.stringify({
        properties: { title, locale: 'tr_TR' },
        sheets: [
          { properties: { title: 'Ayarlar', index: 0, gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: '_meta', hidden: true } },
        ], // ilk sayfa gizli olamaz
      }),
    });
    const db = new SheetDB(j.spreadsheetId);
    await db.write('_meta', 'A1:B1', [['Anahtar', 'Değer']]);
    await tagFile(j.spreadsheetId, 'main');
    return db;
  }

  async info() { return api(`${SHEETS}/${this.id}?fields=properties.title,sheets.properties(title,sheetId)`); }

  // Sekme listesi önbellekli (her silmede ayrıca okunmasın); sekme eklenince sıfırlanır
  async tabs() {
    if (!this._tabs) { const j = await this.info(); this._tabs = (j.sheets || []).map(s => s.properties); }
    return this._tabs;
  }

  // Birden çok sekmeyi TEK istekte okur: { sekme: satırlar }. Başlık önbelleği de dolar.
  async okuHepsi(sheets) {
    const url = `${SHEETS}/${this.id}/values:batchGet?` + sheets.map(s => 'ranges=' + encodeURIComponent(q(s))).join('&');
    const j = await api(url);
    const out = {};
    (j.valueRanges || []).forEach((vr, i) => { out[sheets[i]] = vr.values || []; });
    this._heads ||= {};
    sheets.forEach(s => { if (out[s]?.[0]) this._heads[s] = out[s][0]; });
    return out;
  }

  async read(sheet, range = '') {
    const j = await api(`${SHEETS}/${this.id}/values/${encodeURIComponent(q(sheet) + (range ? '!' + range : ''))}`);
    return j.values || [];
  }

  async write(sheet, range, values) {
    return api(`${SHEETS}/${this.id}/values/${encodeURIComponent(q(sheet) + '!' + range)}?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ values }),
    });
  }

  async append(sheet, rows) {
    return api(`${SHEETS}/${this.id}/values/${encodeURIComponent(q(sheet) + '!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST', body: JSON.stringify({ values: rows }),
    });
  }

  async batch(requests) {
    return api(`${SHEETS}/${this.id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
  }

  // Başlık satırına göre nesne listesi (sütun sırası önemli değil, ada göre okunur)
  async table(sheet) { return satirlardanTablo(await this.read(sheet)); }

  // Başlık satırı (önbellekli: her eklemede tekrar okunmasın)
  async head(sheet) {
    this._heads ||= {};
    if (!this._heads[sheet]) this._heads[sheet] = (await this.read(sheet, '1:1'))[0] || [];
    return this._heads[sheet];
  }

  // Başlıklara göre satır ekle (eksik sütunlar boş kalır)
  async appendObj(sheet, obj) {
    const head = await this.head(sheet);
    return this.append(sheet, [head.map(h => obj[h] ?? '')]);
  }
  async appendObjs(sheet, objs) {
    if (!objs.length) return;
    const head = await this.head(sheet);
    return this.append(sheet, objs.map(o => head.map(h => o[h] ?? '')));
  }

  // Bir satırı başlıklara göre yeniden yaz
  async writeObj(sheet, row, obj) {
    const head = await this.head(sheet);
    return this.write(sheet, `A${row}:${colLetter(head.length)}${row}`, [head.map(h => obj[h] ?? '')]);
  }

  // Birden çok satırı sil (aşağıdan yukarı, numaralar kaymasın)
  async deleteRows(sheet, rowNumbers) {
    if (!rowNumbers.length) return;
    const tab = (await this.tabs()).find(t => t.title === sheet);
    if (!tab) return;
    const sirali = [...new Set(rowNumbers)].sort((a, b) => b - a);
    return this.batch(sirali.map(r => ({ deleteDimension: { range: { sheetId: tab.sheetId, dimension: 'ROWS', startIndex: r - 1, endIndex: r } } })));
  }

  async deleteRow(sheet, rowNumber) {
    const tab = (await this.tabs()).find(t => t.title === sheet);
    if (!tab) return;
    return this.batch([{ deleteDimension: { range: { sheetId: tab.sheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber } } }]);
  }

  // --- Anahtar/değer sekmeleri (_meta, Ayarlar) ---
  async kv(sheet) { return satirlardanKV(await this.read(sheet, 'A:B')); }

  async setKV(sheet, values) {
    const rows = await this.read(sheet, 'A:B');
    const updates = [];
    const appends = [];
    for (const [k, v] of Object.entries(values)) {
      const i = rows.findIndex((r, idx) => idx > 0 && r[0] === k);
      if (i >= 0) updates.push({ range: `${q(sheet)}!B${i + 1}`, values: [[String(v)]] });
      else appends.push([k, String(v)]);
    }
    if (updates.length) {
      await api(`${SHEETS}/${this.id}/values:batchUpdate`, {
        method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: updates }),
      });
    }
    if (appends.length) await this.append(sheet, appends);
  }

  // --- Migration yardımcıları (tekrar çalıştırılsa da güvenli) ---
  async ensureSheet(title, headers) {
    const tabs = await this.tabs();
    if (!tabs.some(t => t.title === title)) {
      await this.batch([{ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } }]);
      this._tabs = null;
    }
    const head = (await this.read(title, '1:1'))[0] || [];
    const missing = headers.filter(h => !head.includes(h));
    if (missing.length) {
      const start = head.length + 1;
      await this.write(title, `${colLetter(start)}1:${colLetter(start + missing.length - 1)}1`, [missing]);
    }
    if (this._heads) delete this._heads[title];
  }

  async ensureColumn(title, header) { return this.ensureSheet(title, [header]); }
}
