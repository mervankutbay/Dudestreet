// Dudestreet — ortak çekirdek: durum, yardımcılar, tablo erişimi, pencereler
import { CONFIG } from './config.js';
import { eklenenSatir } from './google.js';

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
  katmanKaydet(kok, () => kok.remove());
  const kart = kok.firstElementChild;
  kok.addEventListener('click', e => { if (e.target === kok && !S.busy) kok.remove(); });
  kart.remove2 = () => kok.remove();
  const orj = kart.remove.bind(kart);
  kart.remove = () => { kok.remove(); orj(); };
  setTimeout(() => $('input:not([type=checkbox]):not([type=date]), button', kart)?.focus?.({ preventScroll: true }), 30);
  return kart;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !S.busy) { const m = $$('.modal').pop(); if (m) m.remove(); } });

// ---------- Geri tuşu ve kaydırma (Nébula gibi) ----------
// Telefonun geri tuşu/hareketi: önce açık pencereyi kapatır, alt sayfadan (karakterler, anket) bir öncekine,
// diğer sekmelerden Özet'e döner; Özet'te 2 kez basınca uygulamadan çıkar. Geri dönülen sayfa kaldığı yerden açılır.
const ALT_SAYFA = new Set(['persona', 'anket', 'hazir']);
const GC = { aktif: false, yoksay: 0, yigin: [], son: null, kaydir: {}, geriSon: 0, geriden: false, kuyruk: [], zaman: 0 };
// Geçmiş işlemleri sırayla yürür: bir geri gidiş (history.back/go) bitmeden yeni kayıt eklenmez, yoksa geçmiş kayar ve uygulamadan çıkılır
function sira(fn) { GC.kuyruk.push(fn); isle(); }
function isle() {
  if (GC.yoksay > 0 && Date.now() - GC.zaman > 1500) GC.yoksay = 0;   // gelmeyen bir dönüş kuyruğu kilitlemesin
  while (GC.kuyruk.length && GC.yoksay === 0) GC.kuyruk.shift()();
  if (GC.kuyruk.length) setTimeout(isle, 60);
}
function geriGit(n) { sira(() => { GC.yoksay++; GC.zaman = Date.now(); history.go(-n); }); }
function it(tip) { sira(() => history.pushState({ ds: tip }, '')); }
export function katmanKaydet(el, kapat, icGeri = null) {
  if (!GC.aktif) return;
  el._gecmis = true; el._kapat = kapat; el._icGeri = icGeri;
  let itildi = false, iptal = false;
  sira(() => { if (iptal) return; history.pushState({ ds: 'katman' }, ''); itildi = true; });
  const asil = el.remove.bind(el);
  el.remove = () => {
    if (el._kapandi) return;
    el._kapandi = true; asil();
    if (!$$('.modal').length) document.body.classList.remove('modal-acik');
    if (!itildi) { iptal = true; return; }
    if (!el._geriIle) geriGit(1);
  };
  if (el.classList.contains('modal')) document.body.classList.add('modal-acik');
}
export function gecmisBaslat() {
  if (GC.aktif) return;
  GC.aktif = true; GC.son = null; GC.yigin = [];
  history.replaceState({ ds: 'kok' }, ''); history.pushState({ ds: 'uygulama' }, '');
  addEventListener('popstate', geriBasildi);
}
// Her sayfa çiziminde (chrome) çağrılır: ileri gidişleri geçmişe yazar
export function gorunumKaydet(v) {
  if (!GC.aktif || v === GC.son) return;
  if (GC.son) GC.kaydir[GC.son] = scrollY;
  S.icGeri = null;
  const once = GC.son; GC.son = v;
  if (GC.geriden || !once) return;
  const Y = GC.yigin;
  if (v === 'ozet') { if (Y.length) geriGit(Y.length); GC.yigin = []; return; }
  const i = Y.indexOf(v);
  if (i >= 0) { const n = Y.length - 1 - i; if (n) geriGit(n); Y.length = i + 1; return; }
  if (ALT_SAYFA.has(v) || !Y.length) { Y.push(v); it('sayfa'); return; }
  // sekmeden sekmeye: geçmişte tek basamak kalır (geri → Özet)
  if (Y.length > 1) geriGit(Y.length - 1);
  GC.yigin = [v];
}
function geriBasildi() {
  if (GC.yoksay > 0) { GC.yoksay--; isle(); return; }
  const acik = [...document.querySelectorAll('.modal, .notlar-ov')].filter(x => x._gecmis && !x._kapandi).pop();
  if (acik) {
    if (S.busy || (acik._icGeri && acik._icGeri())) { it('katman'); return; }   // kayıt sürüyorsa ya da pencere kendi içinde geri gittiyse açık kalır
    acik._geriIle = true; acik._kapat(); return;
  }
  if (S.icGeri && S.icGeri()) { it('ic'); return; }
  if (GC.yigin.length) {
    GC.yigin.pop();
    while (GC.yigin.length && !S.sayfaVar?.(GC.yigin[GC.yigin.length - 1])) GC.yigin.pop();
    const hedef = GC.yigin[GC.yigin.length - 1] || 'ozet', y = GC.kaydir[hedef] || 0;
    GC.geriden = true;
    try { S.go(hedef); } finally { GC.geriden = false; }
    requestAnimationFrame(() => scrollTo(0, y));
    return;
  }
  if (Date.now() - GC.geriSon < 2200) { GC.aktif = false; history.back(); return; }
  GC.geriSon = Date.now();
  toast(pick(['Çıkmak için bir kez daha geri bas 👋', 'Borsadan çıkıyor musun? Bir kez daha bas 👋']));
  it('uygulama');
}
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
  try { if (S.tazeBekle) await S.tazeBekle.catch(() => {}); return await fn(); }   // önbellekle açıldıysa yazmadan önce taze veri beklenir
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
  sekmeler.forEach((t, i) => tabloKoy(t, l[i]));
}
function tabloKoy(sekme, liste) {
  S[TABLOLAR[sekme]] = sekme === 'Portföy' ? liste.filter(p => num(p['Adet']) > 0) : liste;
  onbellekYaz();
}
// Hız: yazdıktan sonra tabloyu baştan okumak yerine eldeki listeyi günceller (Sheets'e giden istek sayısı yarıya iner)
async function yerelEkle(sekme, objs, cevap) {
  const ilk = eklenenSatir(cevap);
  if (!ilk || !TABLOLAR[sekme]) return tazele(sekme);
  const head = await S.db.head(sekme), simdiki = S[TABLOLAR[sekme]] || [];
  const yeni = objs.map((o, i) => { const r = { _row: ilk + i }; head.forEach(h => { r[h] = o[h] === undefined || o[h] === null ? '' : String(o[h]); }); return r; });
  tabloKoy(sekme, [...simdiki.filter(r => r._row < ilk), ...yeni]);
}

// ---------- Yerel önbellek: uygulama açılır açılmaz son verilerle çizilir, taze veri arkadan gelir (Nébula gibi) ----------
const ONBELLEK = 'ds_onbellek';
let onbellekZaman = null;
export function onbellekYaz() {
  if (!S.db || S.db.id === 'demo' || !S.ayar) return;
  clearTimeout(onbellekZaman);
  onbellekZaman = setTimeout(() => {
    try {
      const veri = { id: S.db.id, zaman: Date.now(), meta: S.meta, ayar: S.ayar, persona: S.persona };
      Object.values(TABLOLAR).forEach(a => { if (a !== 'gunlukler') veri[a] = S[a]; });
      localStorage.setItem(ONBELLEK, JSON.stringify(veri));
    } catch { /* yer yoksa önbelleksiz devam */ }
  }, 400);
}
export function onbellekOku(id) { try { const v = JSON.parse(localStorage.getItem(ONBELLEK) || 'null'); return v && v.id === id ? v : null; } catch { return null; } }
export const onbellekSil = () => localStorage.removeItem(ONBELLEK);
// ---------- Değişiklik günlüğü (Günlük sekmesi): arka planda yazılır, işlemi bekletmez ----------
const GUNLUKSUZ = new Set(['Geçmiş', 'Notlar', 'Günlük']);
const ozetle = o => Object.entries(o || {}).filter(([k, v]) => !['Kimlik', '_row', 'İkon', 'Bağ'].includes(k) && v !== '' && v !== undefined).map(([k, v]) => `${k}: ${v}`).join(' · ').slice(0, 300);
let gunlukKuyruk = Promise.resolve();
export function gunluk(islem, sekme, ozet, eski = '') {
  if (!S.db || GUNLUKSUZ.has(sekme)) return;
  const satir = { Zaman: new Date().toISOString(), 'İşlem': islem, Sekme: sekme, 'Özet': String(ozet).slice(0, 300), Eski: String(eski).slice(0, 300) };
  gunlukKuyruk = gunlukKuyruk.then(() => S.db.appendObj('Günlük', satir)).catch(() => {});
}
// ---------- Geri alma kaydı: izleme açıkken her yazma, nasıl geri alınacağıyla birlikte not edilir ----------
let izlenen = null;
const IZLENMEZ = new Set(['Geçmiş', 'Günlük']);
export function izlemeBasla() { izlenen = []; }
export function izlemeBitir() { const l = izlenen || []; izlenen = null; return l; }
export function geriKaydet(o) { if (izlenen && !IZLENMEZ.has(o.sekme)) izlenen.push(o); }
const temizSatir = r => { const { _row, ...o } = r; return o; };

export async function ekle(sekme, obj) { geriKaydet({ t: 'ekle', sekme, obj: { ...obj } }); const c = await S.db.appendObj(sekme, obj); gunluk('Eklendi', sekme, ozetle(obj)); await yerelEkle(sekme, [obj], c); }
export async function ekleCok(sekme, objs) { if (!objs.length) return; objs.forEach(o => geriKaydet({ t: 'ekle', sekme, obj: { ...o } })); const c = await S.db.appendObjs(sekme, objs); objs.forEach(o => gunluk('Eklendi', sekme, ozetle(o))); await yerelEkle(sekme, objs, c); }
// Kimlik (ya da verilen alan) ile satırı bulur, güncel tablodan satır numarasını okur
// Satır numarası güvenliği için tablo yazmadan hemen önce tazeden okunur; yazdıktan sonra tekrar okunmaz, bu liste güncellenir
async function satirBul(sekme, alan, deger) {
  const guncel = await S.db.table(sekme);
  return { guncel, r: guncel.find(r => String(r[alan]) === String(deger)) };
}
export async function guncelle(sekme, kimlik, yeni, alan = 'Kimlik') {
  const { guncel, r } = await satirBul(sekme, alan, kimlik);
  if (!r) throw new Error('Kayıt tabloda bulunamadı, sayfayı yenile');
  const { _row, ...eski } = r;
  geriKaydet({ t: 'guncelle', sekme, alan, kimlik, eski: Object.fromEntries(Object.keys(yeni).map(k => [k, eski[k] ?? ''])) });
  await S.db.writeObj(sekme, _row, { ...eski, ...yeni });
  const degisen = Object.fromEntries(Object.entries(yeni).filter(([k, v]) => String(eski[k] ?? '') !== String(v ?? '')));
  if (Object.keys(degisen).length) gunluk('Değişti', sekme, `${r['Ad'] || r['Kalem'] || r['Not'] || r['Kod'] || ''} → ${ozetle(degisen)}`, ozetle(Object.fromEntries(Object.keys(degisen).map(k => [k, eski[k]]))));
  const head = await S.db.head(sekme), son = { ...r }; Object.entries(yeni).forEach(([k, v]) => { if (head.includes(k)) son[k] = v === undefined || v === null ? '' : String(v); });
  tabloKoy(sekme, guncel.map(x => x === r ? son : x));
}
export async function sil(sekme, kimlik, alan = 'Kimlik') {
  const { guncel, r } = await satirBul(sekme, alan, kimlik);
  if (!r) return tabloKoy(sekme, guncel);
  geriKaydet({ t: 'sil', sekme, satir: temizSatir(r) });
  await S.db.deleteRow(sekme, r._row); gunluk('Silindi', sekme, ozetle(r), ozetle(r));
  tabloKoy(sekme, guncel.filter(x => x !== r).map(x => x._row > r._row ? { ...x, _row: x._row - 1 } : x));
}
export async function silHepsi(sekme, f) {
  const guncel = await S.db.table(sekme);
  const l = guncel.filter(f), satirlar = l.map(r => r._row);
  if (satirlar.length) { l.forEach(r => geriKaydet({ t: 'sil', sekme, satir: temizSatir(r) })); await S.db.deleteRows(sekme, satirlar); l.forEach(r => gunluk('Silindi', sekme, ozetle(r), ozetle(r))); }
  await tazele(sekme);
}

export { CONFIG };
