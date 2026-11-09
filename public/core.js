// Dudestreet — ortak çekirdek: durum, yardımcılar, tablo erişimi, pencereler
import { CONFIG } from './config.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const isDemo = () => localStorage.getItem('ds_demo') === '1';
export const lsGet = (k, d = null) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* geç */ } };

// Uygulama durumu (tek yerde)
export const S = {
  db: null, meta: {}, ayar: {}, sema: 0,
  kayitlar: [], portfoy: [], persona: {}, hafiza: [],
  gelir: [], giderler: [], butce: [], onay: [], kategori: [], notlar: [], borclar: [], borcHareket: [], gecmis: [],
  view: 'ozet', chat: [], surveyIdx: 0, busy: false,
  fiyat: { para: '', fiyatlar: {}, zaman: null, hata: null },
  kurlar: {}, mbkayo: null,
  ggAy: null, ggSeg: 'gelir',
  go: () => {}, yenile: () => {},
};

// ---------- sayı, para, tarih ----------
export const PARA_KODU = { '₺': 'TRY', '€': 'EUR', '$': 'USD', '£': 'GBP' };
export const pb = () => S.ayar.para_birimi || '₺';
export const paraKod = () => PARA_KODU[pb()] || 'TRY';
// Kayıtlı değerler (uygulamanın yazdığı "1500.5" ya da tablodan gelen "1.500,5")
export const num = v => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(/[₺€$£]/g, '');
  if (!s) return 0;
  const n = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  return Number(n) || 0;
};
// Kullanıcının yazdığı tutar: Türkçe yazım ("1.500.000", "1.500,50", "0,015", "1500")
export const girdi = v => {
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(/[₺€$£]/g, '');
  if (!s) return 0;
  let n = s;
  if (s.includes(',')) n = s.replace(/\./g, '').replace(',', '.');
  else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) n = s.replace(/\./g, '');
  return Number(n) || 0;
};
export const fmt = (n, k = 0) => (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: k, maximumFractionDigits: k });
// Görüntüleme: kayıtlar hep ana para biriminde (Ayarlar), ekranda ₺/€/$ arasında çevrilebilir ve gizlenebilir
const SIMGE = { TRY: '₺', EUR: '€', USD: '$', GBP: '£' };
export const gizli = () => lsGet('ds_gizli', false);
export const gosterKod = () => { const g = lsGet('ds_gosterPara', null); return g && g !== paraKod() && S.kurlar[g] > 0 ? g : paraKod(); };
export const gosterSimge = () => SIMGE[gosterKod()] || pb();
const cevirGoster = v => { const g = gosterKod(); return g === paraKod() ? v : v / S.kurlar[g]; };
export const money = (n, k) => {
  if (gizli()) return `•••• ${gosterSimge()}`;
  const v = cevirGoster(Number(n) || 0); const kk = k ?? (Math.abs(v) < 100 && v % 1 ? 2 : 0); return `${fmt(v, kk)} ${gosterSimge()}`;
};
// Ana para biriminde, gizlenmeden (giriş alanları ve yapay zekâ için)
export const moneyHam = (n, k) => { const v = Number(n) || 0; const kk = k ?? (Math.abs(v) < 100 && v % 1 ? 2 : 0); return `${fmt(v, kk)} ${pb()}`; };
export const kisaPara = v0 => { if (gizli()) return '••••'; const v = cevirGoster(v0); const a = Math.abs(v), s = v < 0 ? '−' : ''; return a >= 1e6 ? `${s}${fmt(a / 1e6, a >= 1e7 ? 1 : 2)} Mn` : a >= 1e4 ? `${s}${fmt(a / 1e3, 0)} B` : `${s}${fmt(a, 0)}`; };
export const fiyatFmt = n0 => { const n = cevirGoster(Number(n0) || 0), v = Math.abs(n); return fmt(n, v >= 1000 ? 0 : v >= 1 ? 2 : 4); };
export const yuzde = (n, k = 1) => `${n >= 0 ? '▲' : '▼'} %${fmt(Math.abs(n), k)}`;
export const isaretli = n => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const buAy = () => today().slice(0, 7);
export const ymOf = d => { const s = String(d || ''); return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : ''; };
export const ymAdd = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const ymAdi = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }); };
export const ayKisa = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'short' }); };
export const tarihFmt = d => { const t = new Date(String(d).slice(0, 10) + 'T12:00:00'); return isNaN(t) ? esc(d) : t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: t.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }); };
export const gunFark = (a, b) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 864e5);
export const trFold = s => String(s || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export const buyukIlk = s => s.charAt(0).toLocaleUpperCase('tr') + s.slice(1);
export const evet = v => ['evet', 'true', '1', 'yes'].includes(String(v ?? '').trim().toLowerCase());

// ---------- ikonlar ----------
export const IK = {
  kilit: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  tablo: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
  mesaj: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  goz: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  tik: '<path d="M5 12.8l4.4 4.4L19 7.4"/>',
  carpi: '<path d="M18 6L6 18M6 6l12 12"/>',
  dis: '<path d="M14 3h7v7"/><path d="M21 3l-9 9"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
  anahtar: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M17 6l3 3M15 8l2 2"/>',
  ev: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  araba: '<path d="M5 16l1.5-5h11L19 16"/><rect x="3" y="16" width="18" height="4" rx="1"/><circle cx="7.5" cy="20" r="1.5"/><circle cx="16.5" cy="20" r="1.5"/>',
  ucak: '<path d="M2 16l20-8-8 14-2-6z"/>',
  yuzuk: '<circle cx="12" cy="15" r="6"/><path d="M9 5l3-3 3 3-3 3z"/>',
  kitap: '<path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6"/>',
  hedef: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  zaman: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  geri: '<path d="M15 18l-6-6 6-6"/>',
  ileri: '<path d="M9 18l6-6-6-6"/>',
  gonder: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  arti: '<path d="M12 5v14M5 12h14"/>',
  cop: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l.9 12.5h9.2L17.5 7"/>',
  yenile: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  duzenle: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 7.5l3 3"/>',
  geriAl: '<path d="M9 5L4.5 9.5 9 14"/><path d="M4.5 9.5H15a5 5 0 0 1 0 10h-3"/>',
  nokta: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',
  sabit: '<path d="M9 4h6l-.8 5.2L17 13H7l2.8-3.8L9 4z"/><path d="M12 13v7"/>',
  kalem: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/>',
  ayar: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  kart: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
  alarm: '<circle cx="12" cy="13" r="7"/><path d="M12 10v3l2 1.5M5 4L2.5 6.5M19 4l2.5 2.5"/>',
  asagi: '<path d="M6 9l6 6 6-6"/>',
  grafik: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M7.5 14.5l3.5-4 3 2.5 4.5-6"/>',
  palet: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-7.8-9-7.8z"/><circle cx="7.5" cy="11.5" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15.5" cy="7.5" r="1"/>',
};
export const ikon = (ad, renk = 'currentColor', boy = 22) => `<svg width="${boy}" height="${boy}" viewBox="0 0 24 24" fill="none" stroke="${renk}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IK[ad] || ''}</svg>`;

// ---------- bildirim ve pencereler ----------
export function toast(msg, ms = 3400) {
  const t = $('#toast');
  t.innerHTML = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

// Alttan açılan pencere; üst üste açılabilir. Dönen eleman .remove() ile kapanır.
export function sheet(html, { genis = false } = {}) {
  const kok = document.createElement('div');
  kok.className = 'modal';
  kok.innerHTML = `<div class="modal-kart ${genis ? 'genis' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(kok);
  const kart = kok.firstElementChild;
  kok.addEventListener('click', e => { if (e.target === kok && !S.busy) kok.remove(); });
  kart.remove2 = () => kok.remove();
  const orj = kart.remove.bind(kart);
  kart.remove = () => { kok.remove(); orj(); };
  setTimeout(() => $('input:not([type=checkbox]):not([type=date]), button', kart)?.focus?.({ preventScroll: true }), 30);
  return kart;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !S.busy) { const m = $$('.modal').pop(); if (m) m.remove(); } });
export const kapatBtn = (id = 'kapat') => `<button class="ikon-btn" id="${id}" aria-label="Kapat">${ikon('carpi', 'currentColor', 18)}</button>`;
export function modal(html) { $$('.modal').forEach(m => m.remove()); return html ? sheet(html) : null; }

export function onayKutusu(baslik, metin, evetFn, { evetYazi = 'Evet', tehlike = false, hayirFn = null } = {}) {
  const el = sheet(`<h3>${esc(baslik)}</h3>${metin ? `<p class="soluk">${metin}</p>` : ''}
    <div class="satir"><button class="ikinci bosluk" id="okHayir">Vazgeç</button><button class="${tehlike ? 'tehlike' : ''} bosluk" id="okEvet">${esc(evetYazi)}</button></div>`);
  $('#okHayir', el).onclick = () => { el.remove(); hayirFn?.(); };
  $('#okEvet', el).onclick = () => { el.remove(); evetFn(); };
  return el;
}

export async function guard(fn) {
  try { return await fn(); }
  catch (e) {
    console.error(e);
    if (e && e.name === 'AuthError') { S.yenidenBaglan?.(); return; }
    toast('⚠️ ' + esc(e.message || e), 5000);
  }
}

// ---------- çipler ----------
export const chips = (ad, liste, sec) => `<div class="cipler" data-chips="${ad}">${liste.map(([k, etiket]) => `<button type="button" class="cip ${k === sec ? 'on' : ''}" data-k="${esc(k)}">${etiket}</button>`).join('')}</div>`;
export function chipBagla(kok) {
  $$('[data-chips]', kok).forEach(g => $$('.cip', g).forEach(c => { if (c.dataset.k === '__yeni') return; const o = c.onclick; c.onclick = e => { $$('.cip', g).forEach(x => x.classList.toggle('on', x === c)); g.dispatchEvent(new Event('change')); o?.call(c, e); }; }));
}
export const chipVal = (kok, ad) => $(`[data-chips="${ad}"] .cip.on`, kok)?.dataset.k;
export const tutarAlan = (id, ph = '0', val = '') => `<div class="alan-ek"><input id="${id}" inputmode="decimal" placeholder="${esc(ph)}" value="${esc(val)}" autocomplete="off"><span>${pb()}</span></div>`;
export const fmtIn = v => (num(v) ? String(Math.round(num(v) * 100) / 100).replace('.', ',') : '');

// ---------- tablo erişimi ----------
// Sekme adı → durum alanı
export const TABLOLAR = {
  'Kayıtlar': 'kayitlar', 'Portföy': 'portfoy', 'Hafıza': 'hafiza', 'Gelir': 'gelir', 'Giderler': 'giderler', 'Bütçe': 'butce',
  'Onay': 'onay', 'Kategori': 'kategori', 'Notlar': 'notlar', 'Borçlar': 'borclar', 'Borç hareketleri': 'borcHareket', 'Geçmiş': 'gecmis', 'Günlük': 'gunlukler',
};
export async function tazele(...sekmeler) {
  const l = await Promise.all(sekmeler.map(t => S.db.table(t)));
  sekmeler.forEach((t, i) => { S[TABLOLAR[t]] = l[i]; });
  if (sekmeler.includes('Portföy')) S.portfoy = S.portfoy.filter(p => num(p['Adet']) > 0);
}
// ---------- Değişiklik günlüğü (Günlük sekmesi): arka planda yazılır, işlemi bekletmez ----------
const GUNLUKSUZ = new Set(['Geçmiş', 'Notlar', 'Günlük']);
const ozetle = o => Object.entries(o || {}).filter(([k, v]) => !['Kimlik', '_row', 'İkon', 'Bağ'].includes(k) && v !== '' && v !== undefined).map(([k, v]) => `${k}: ${v}`).join(' · ').slice(0, 300);
let gunlukKuyruk = Promise.resolve();
export function gunluk(islem, sekme, ozet, eski = '') {
  if (!S.db || GUNLUKSUZ.has(sekme)) return;
  const satir = { Zaman: new Date().toISOString(), 'İşlem': islem, Sekme: sekme, 'Özet': String(ozet).slice(0, 300), Eski: String(eski).slice(0, 300) };
  gunlukKuyruk = gunlukKuyruk.then(() => S.db.appendObj('Günlük', satir)).catch(() => {});
}
export async function ekle(sekme, obj) { await S.db.appendObj(sekme, obj); gunluk('Eklendi', sekme, ozetle(obj)); await tazele(sekme); }
export async function ekleCok(sekme, objs) { await S.db.appendObjs(sekme, objs); objs.forEach(o => gunluk('Eklendi', sekme, ozetle(o))); await tazele(sekme); }
// Kimlik (ya da verilen alan) ile satırı bulur, güncel tablodan satır numarasını okur
async function satirBul(sekme, alan, deger) {
  const guncel = await S.db.table(sekme);
  return guncel.find(r => String(r[alan]) === String(deger));
}
export async function guncelle(sekme, kimlik, yeni, alan = 'Kimlik') {
  const r = await satirBul(sekme, alan, kimlik);
  if (!r) throw new Error('Kayıt tabloda bulunamadı, sayfayı yenile');
  const { _row, ...eski } = r;
  await S.db.writeObj(sekme, _row, { ...eski, ...yeni });
  const degisen = Object.fromEntries(Object.entries(yeni).filter(([k, v]) => String(eski[k] ?? '') !== String(v ?? '')));
  if (Object.keys(degisen).length) gunluk('Değişti', sekme, `${r['Ad'] || r['Kalem'] || r['Not'] || r['Kod'] || ''} → ${ozetle(degisen)}`, ozetle(Object.fromEntries(Object.keys(degisen).map(k => [k, eski[k]]))));
  await tazele(sekme);
}
export async function sil(sekme, kimlik, alan = 'Kimlik') {
  const r = await satirBul(sekme, alan, kimlik);
  if (r) { await S.db.deleteRow(sekme, r._row); gunluk('Silindi', sekme, ozetle(r), ozetle(r)); }
  await tazele(sekme);
}
export async function silHepsi(sekme, f) {
  const guncel = await S.db.table(sekme);
  const l = guncel.filter(f), satirlar = l.map(r => r._row);
  if (satirlar.length) { await S.db.deleteRows(sekme, satirlar); l.forEach(r => gunluk('Silindi', sekme, ozetle(r), ozetle(r))); }
  await tazele(sekme);
}

export { CONFIG };
