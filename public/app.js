// Dudestreet — kendi Wall Street'in.
// Veri kullanıcının kendi Google Sheet'inde, yapay zekâ (Future Dude) kullanıcının kendi Gemini anahtarıyla.
// Sunucu sadece piyasa fiyatlarını getirir; hiçbir kullanıcı verisi tutmaz.
import { CONFIG } from './config.js';
import * as G from './google.js';
import * as AI from './gemini.js';
import { pendingMigrations, runMigrations } from './schema.js';
import { SECTIONS, buildPersona, polishInstruction, futureYear } from './persona.js';
import { LocalDB } from './localdb.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isDemo = () => localStorage.getItem('ds_demo') === '1';
const configured = () => !!CONFIG.GOOGLE_CLIENT_ID;
const pick = a => a[Math.floor(Math.random() * a.length)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const S = {
  db: null, meta: {}, ayar: {}, kayitlar: [], portfoy: [], persona: {}, hafiza: [], sema: 0,
  view: 'borsa', chat: [], surveyIdx: 0, busy: false,
  fiyat: { para: '', fiyatlar: {}, zaman: null, hata: null },
};

// ---------- yardımcılar ----------
function toast(msg, ms = 3400) {
  const t = $('#toast');
  t.innerHTML = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}
function modal(html) {
  $('#modalKart').innerHTML = html;
  $('#modal').classList.toggle('hidden', !html);
  if (html) $('#modalKart input, #modalKart button')?.focus?.({ preventScroll: true });
}
const pb = () => S.ayar.para_birimi || '₺';
const PARA_KODU = { '₺': 'TRY', '€': 'EUR', '$': 'USD', '£': 'GBP' };
const num = v => { const s = String(v ?? '').trim().replace(/\s/g, ''); if (!s) return 0; const n = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s; return Number(n) || 0; };
const fmt = (n, k = 0) => (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: k, maximumFractionDigits: k });
const money = (n, k) => { const v = Number(n) || 0; const kk = k ?? (Math.abs(v) < 100 && v % 1 ? 2 : 0); return `${fmt(v, kk)} ${pb()}`; };
const fiyatFmt = n => { const v = Math.abs(Number(n) || 0); return fmt(n, v >= 1000 ? 0 : v >= 1 ? 2 : 4); };
const yuzde = (n, k = 1) => `${n >= 0 ? '▲' : '▼'} %${fmt(Math.abs(n), k)}`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const monthKey = d => String(d).slice(0, 7);
const ayAdi = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'short' }); };
const tarihFmt = d => { const t = new Date(d + 'T12:00:00'); return isNaN(t) ? esc(d) : t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: t.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }); };

const IK = {
  kilit: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  tablo: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
  mesaj: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  goz: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  tik: '<path d="M20 6L9 17l-5-5"/>',
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
  gonder: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  arti: '<path d="M12 5v14M5 12h14"/>',
  cop: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  yenile: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
};
const ikon = (ad, renk = '#9ff0c0', boy = 22) => `<svg width="${boy}" height="${boy}" viewBox="0 0 24 24" fill="none" stroke="${renk}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IK[ad]}</svg>`;

function chrome(mod) { // mod: 'sihirbaz' | 'ana'
  const ana = mod === 'ana';
  $('#sekmeler').classList.toggle('hidden', !ana);
  $('#ust').classList.toggle('hidden', !ana);
  $('#bant').classList.toggle('hidden', !ana);
  app.classList.toggle('sihirbaz', !ana);
  $$('#sekmeler button').forEach(b => b.classList.toggle('on', b.dataset.view === S.view || (S.view === 'persona' && b.dataset.view === 'dude')));
  $('#ustDurum').textContent = isDemo() ? 'Demo modu' : (G.userEmail() || '');
}

async function guard(fn) {
  try { return await fn(); }
  catch (e) {
    console.error(e);
    if (e instanceof G.AuthError) { renderReconnect(); return; }
    toast('⚠️ ' + esc(e.message || e), 5000);
  }
}

// ---------- açılış ----------
async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  $$('#sekmeler button').forEach(b => (b.onclick = () => go(b.dataset.view)));
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !S.busy) modal(''); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !S.busy && !$('#modal').classList.contains('hidden')) modal(''); });

  try {
    const r = await fetch('/api/ayar', { cache: 'no-store' });
    if (r.ok) CONFIG.GOOGLE_CLIENT_ID = (await r.json()).googleClientId || '';
  } catch { /* çevrimdışı */ }

  const r = G.handleRedirect();
  if (r.error && !['interaction_required', 'login_required', 'consent_required'].includes(r.error)) toast('Google girişi tamamlanmadı: ' + esc(r.error));

  if (isDemo()) {
    S.db = LocalDB.exists() ? new LocalDB() : await createDemo();
    return afterConnect();
  }
  if (!G.getToken()) {
    if (configured() && G.shouldSilentRefresh() && !r.error) return G.login({ silent: true });
    return wizard('hosgeldin');
  }
  await guard(async () => {
    if (!G.userEmail()) await G.fetchEmail();
    const id = G.getSheetId();
    if (!id) return wizard('tablo');
    S.db = new G.SheetDB(id);
    await afterConnect();
  });
}

async function createDemo() {
  const db = await LocalDB.create();
  await runMigrations(db, 0);
  await db.setKV('_meta', { uygulama: 'Dudestreet', olusturma: new Date().toISOString() });
  // Örnek veriler: son 6 ay birikim, bir kaçamak, küçük bir portföy
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 5);
    const ym = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
    await db.appendObj('Kayıtlar', { Kimlik: uid(), Tarih: `${ym}-05`, 'Tür': 'Birikim', Tutar: String(i === 2 ? 6000 : 12000 + i * 500), Kategori: 'Maaştan', Not: 'Maaş günü' });
    if (i === 2) await db.appendObj('Kayıtlar', { Kimlik: uid(), Tarih: `${ym}-19`, 'Tür': 'Harcama', Tutar: '4500', Kategori: 'Konser / eğlence', Not: 'Festival bileti 🙈' });
    if (i === 3) await db.appendObj('Kayıtlar', { Kimlik: uid(), Tarih: `${ym}-12`, 'Tür': 'Birikim', Tutar: '3000', Kategori: 'Ek gelir', Not: 'Freelance iş' });
  }
  const t4 = new Date(d.getFullYear(), d.getMonth() - 4, 8).toISOString().slice(0, 10);
  const pf = [
    { Tür: 'Hisse', Sembol: 'THYAO.IS', Ad: 'Türk Hava Yolları', Adet: '40', Maliyet: '290' },
    { Tür: 'Kripto', Sembol: 'BTC', Ad: 'Bitcoin', Adet: '0.004', Maliyet: '2900000' },
    { Tür: 'Altın (gram)', Sembol: 'ALTIN', Ad: 'Gram altın', Adet: '5', Maliyet: '2950' },
  ];
  for (const p of pf) {
    await db.appendObj('Portföy', { Kimlik: uid(), ...p, Tarih: t4, Not: '' });
    await db.appendObj('Kayıtlar', { Kimlik: uid(), Tarih: t4, 'Tür': 'Varlık alımı', Tutar: String(num(p.Adet) * num(p.Maliyet)), Kategori: p.Sembol, Not: `${p.Ad} alındı` });
  }
  await db.setKV('Ayarlar', { hedef_ne: 'Ev', hedef_tur: 'ev', hedef_tutar: '500000', aylik_min: '10000', para_birimi: '₺', hedef_tarih: `${d.getFullYear() + 3}-06` });
  return db;
}

async function loadAll() {
  const db = S.db;
  S.meta = await db.kv('_meta');
  S.sema = Number(S.meta.sema || 0);
  if (S.sema === 0) { await runMigrations(db, 0); S.meta = await db.kv('_meta'); S.sema = Number(S.meta.sema || 0); }
  const [ayar, kayit, portfoy, persona, hafiza] = await Promise.all([
    db.kv('Ayarlar'), db.table('Kayıtlar'), db.table('Portföy'), db.kv('Persona'), db.table('Hafıza'),
  ]);
  S.ayar = ayar; S.kayitlar = kayit; S.portfoy = portfoy.filter(p => num(p['Adet']) > 0); S.hafiza = hafiza;
  S.persona = persona;
  try { S.persona.cevapObj = persona.cevaplar ? JSON.parse(persona.cevaplar) : null; } catch { S.persona.cevapObj = null; }
  if (!AI.getKey() && S.meta.gemini_key) AI.setKey(S.meta.gemini_key);
  if (!AI.getModel() && S.meta.gemini_model) AI.setModel(S.meta.gemini_model);
}

async function afterConnect() {
  await guard(async () => {
    await loadAll();
    if (!AI.getKey() && S.meta.gemini_atlandi !== '1') return wizard('gemini');
    if (!S.ayar.hedef_ne) return wizard('hedef');
    if (!S.persona.prompt && localStorage.getItem('ds_anket_sonra') !== '1') return startSurvey();
    fiyatlariGetir();
    go('borsa');
  });
}

function go(view) {
  S.view = view;
  chrome('ana');
  ({ borsa: renderBorsa, portfoy: renderPortfoy, dude: renderDude, ayarlar: renderAyarlar, persona: renderPersona }[view] || renderBorsa)();
  bantCiz();
  window.scrollTo(0, 0);
}

// ---------- fiyatlar ----------
const fiyatAnahtar = p => `${p['Tür']}|${p['Sembol']}`;
const otomatik = p => !['Diğer', 'Nakit'].includes(p['Tür']);
async function fiyatlariGetir(sessiz = true) {
  const liste = S.portfoy.filter(otomatik).map(p => ({ tur: p['Tür'], sembol: p['Sembol'] }));
  if (!liste.length) return;
  try {
    const r = await fetch('/api/fiyatlar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ liste, para: PARA_KODU[pb()] || 'TRY' }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.hata || 'Fiyatlar alınamadı');
    S.fiyat = { ...j, hata: null };
  } catch (e) {
    S.fiyat.hata = e.message;
    if (!sessiz) toast('⚠️ ' + esc(e.message));
  }
  if (['borsa', 'portfoy'].includes(S.view) && $('#modal').classList.contains('hidden')) go(S.view);
  else bantCiz();
}
setInterval(() => { if (document.visibilityState === 'visible' && S.db && ['borsa', 'portfoy'].includes(S.view)) fiyatlariGetir(); }, 90_000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.db && S.fiyat.zaman && Date.now() - Date.parse(S.fiyat.zaman) > 60_000) fiyatlariGetir(); });

// ---------- hesaplar ----------
const SAYILAN = { 'Birikim': 1, 'Harcama': -1 };
const NAKIT = { 'Birikim': 1, 'Harcama': -1, 'Varlık alımı': -1, 'Varlık satışı': 1 };

function varliklar() {
  return S.portfoy.map(p => {
    const adet = num(p['Adet']), maliyet = num(p['Maliyet']);
    const f = S.fiyat.fiyatlar?.[fiyatAnahtar(p)];
    const canli = otomatik(p) && f && !f.hata && S.fiyat.para === (PARA_KODU[pb()] || 'TRY');
    const fiyat = canli ? f.fiyat : maliyet;
    const deger = adet * fiyat, alis = adet * maliyet;
    return { p, adet, maliyet, fiyat, canli, deger, alis, kar: deger - alis, karYuzde: alis ? (deger / alis - 1) * 100 : 0, gunluk: canli ? f.degisim : 0, gunlukTutar: canli ? adet * (f.fiyat - f.onceki) : 0, hata: otomatik(p) && f?.hata };
  });
}

function calc() {
  const k = S.kayitlar.map(r => ({ ...r, tutar: num(r['Tutar']), tur: r['Tür'], ay: monthKey(r['Tarih']) })).sort((a, b) => String(a['Tarih']).localeCompare(String(b['Tarih'])));
  const nakit = k.reduce((s, r) => s + (NAKIT[r.tur] || 0) * r.tutar, 0);
  const v = varliklar();
  const portfoy = v.reduce((s, x) => s + x.deger, 0);
  const portfoyAlis = v.reduce((s, x) => s + x.alis, 0);
  const gunluk = v.reduce((s, x) => s + x.gunlukTutar, 0);
  const toplam = nakit + portfoy;
  const aylar = {};
  k.forEach(r => { if (SAYILAN[r.tur]) aylar[r.ay] = (aylar[r.ay] || 0) + SAYILAN[r.tur] * r.tutar; });
  const buAyK = monthKey(today());
  const buAy = aylar[buAyK] || 0;
  const gecmis = Object.entries(aylar).filter(([a]) => a !== buAyK).sort().slice(-6);
  const ort = gecmis.length ? gecmis.reduce((s, [, x]) => s + x, 0) / gecmis.length : buAy;
  const hedef = num(S.ayar.hedef_tutar), min = num(S.ayar.aylik_min);
  const kalan = Math.max(0, hedef - toplam);
  const tempo = Math.max(ort, min || 0);
  const ayKaldi = hedef && kalan === 0 ? 0 : hedef && tempo > 0 ? Math.ceil(kalan / tempo) : null;
  let varis = null;
  if (ayKaldi !== null) { const d = new Date(); d.setMonth(d.getMonth() + ayKaldi); varis = ayKaldi === 0 ? 'Ulaştın! 🎉' : d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }); }
  let gereken = null;
  if (S.ayar.hedef_tarih && hedef) {
    const [y, m] = S.ayar.hedef_tarih.split('-').map(Number), d = new Date();
    const ay = Math.max(1, (y - d.getFullYear()) * 12 + (m - 1 - d.getMonth()));
    gereken = kalan / ay;
  }
  const durum = !min ? '-' : buAy >= min ? 'Hedefte' : 'Hedefin altında';
  const harcamaBuAy = k.filter(r => r.ay === buAyK && r.tur === 'Harcama').reduce((s, r) => s + r.tutar, 0);
  return { k, nakit, v, portfoy, portfoyAlis, gunluk, toplam, buAy, ort, hedef, min, kalan, ilerleme: hedef ? Math.min(1, Math.max(0, toplam / hedef)) : 0, varis, ayKaldi, gereken, durum, aylar, harcamaBuAy };
}

// ---------- borsa bandı ----------
function bantCiz() {
  if (!S.db) return;
  const c = calc();
  const parca = [];
  const renk = n => (n >= 0 ? 'artı' : 'eksi');
  parca.push(`<span>BU AY <b class="${renk(c.buAy)}">${c.buAy >= 0 ? '+' : ''}${money(c.buAy)}</b></span>`);
  if (c.hedef) parca.push(`<span>HEDEF <b class="altin">%${fmt(c.ilerleme * 100, 1)}</b></span>`);
  if (c.portfoy) parca.push(`<span>PORTFÖY <b class="${renk(c.gunluk)}">${yuzde(c.portfoy ? (c.gunluk / Math.max(1, c.portfoy - c.gunluk)) * 100 : 0, 2)}</b></span>`);
  c.v.filter(x => x.canli).forEach(x => parca.push(`<span>${esc(kisaSembol(x.p))} <b class="${renk(x.gunluk)}">${fiyatFmt(x.fiyat)} ${yuzde(x.gunluk, 2)}</b></span>`));
  if (c.harcamaBuAy) parca.push(`<span>KAÇAMAK <b class="eksi">▼ ${money(c.harcamaBuAy)}</b></span>`);
  const sinyal = !c.min ? ['TUT', 'altin'] : c.buAy >= c.min ? ['GÜÇLÜ AL', 'artı'] : c.buAy > 0 ? ['TUT', 'altin'] : ['DİKKAT', 'eksi'];
  parca.push(`<span>DUDE <b class="${sinyal[1]}">● ${sinyal[0]}</b></span>`);
  if (c.varis) parca.push(`<span>VARIŞ <b class="altin">${esc(c.varis)}</b></span>`);
  const html = parca.join('');
  $('#bantIc').innerHTML = html + html; // kesintisiz kayma için iki kez
}
const kisaSembol = p => (p['Tür'] === 'Altın (gram)' ? 'ALTIN' : p['Tür'] === 'Gümüş (gram)' ? 'GÜMÜŞ' : String(p['Sembol']).replace(/\.IS$/, '').replace(/-USD$/, '').toUpperCase());

// ---------- kurulum sihirbazı ----------
const ADIMLAR = { google: 1, tablo: 2, gemini: 3, hedef: 4, persona: 5 };
function adimCubugu(ad, geri) {
  const n = ADIMLAR[ad];
  return `<div class="adim">${geri ? `<button class="geri-btn" id="geri" aria-label="Geri">${ikon('geri', '#eef7f1', 20)}</button>` : '<div style="width:40px"></div>'}
    <div class="noktalar">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div><span class="sayac">${n}/5</span></div>`;
}
const baslik = (ust, h, alt) => `<div class="baslik-blok"><span class="ust-etiket">${ust}</span><h1>${h}</h1>${alt ? `<p>${alt}</p>` : ''}</div>`;
const madde = (ik, b, a) => `<div class="madde"><div class="ik">${ikon(ik)}</div><div><b>${b}</b><span>${a}</span></div></div>`;

async function wizard(adim) {
  S.view = 'sihirbaz';
  chrome('sihirbaz');
  window.scrollTo(0, 0);
  if (adim === 'hosgeldin') {
    app.innerHTML = `
      <div class="giris-logo">
        <img src="img/logo.svg" alt="" width="132" height="106">
        <div class="isim gotik">Dudestreet</div>
        <div class="est">Est. 2026 · Dudes Exchange</div>
        <p>Kendi Wall Street’in. Paranı takip et, hedefini büyüt; gelecekteki sen de yanında.</p>
      </div>
      <div class="kart maddeler">
        ${madde('kilit', 'Verin sende kalır', 'Her şey kendi Google Drive’ındaki tabloda durur. Biz hiçbir veri tutmayız.')}
        ${madde('anahtar', 'Yapay zekân senin anahtarınla', 'Gemini kendi hesabınla çalışır; mesajların doğrudan Google’a gider.')}
        ${madde('mesaj', 'Future Dude', 'Kısa bir anketle senin gibi konuşan 10 yıl sonraki halini yaratırsın; seni hedefine taşır.')}
      </div>
      <button class="blok buyuk" id="basla">Başlayalım</button>
      <button class="blok hayalet" id="demo">Google olmadan dene (demo)</button>`;
    $('#basla').onclick = () => wizard('google');
    $('#demo').onclick = demoBasla;
    return;
  }
  if (adim === 'google') {
    app.innerHTML = `${adimCubugu('google', true)}
      ${baslik('Adım 1 · Hesap', 'Google hesabınla bağlan', 'Dudestreet verilerini senin Drive’ında, sana ait bir tabloda tutar.')}
      <div class="kart">
        <div class="satir">${ikon('goz', '#3de0d8')}<b>Dudestreet neyi görebilir?</b></div>
        <div class="satir kucuk" style="color:var(--ikinci)">${ikon('tik', '#4ee0a0', 18)}<span>Sadece kendi oluşturduğu "${CONFIG.TABLO_ADI}" dosyasını</span></div>
        <div class="satir kucuk" style="color:var(--ikinci)">${ikon('tik', '#4ee0a0', 18)}<span>E-posta adresini (hangi hesapla girdiğini göstermek için)</span></div>
        <div class="satir kucuk" style="color:var(--ikinci)">${ikon('carpi', '#ff6b7d', 18)}<span>Drive’ındaki diğer dosyalarını göremez</span></div>
      </div>
      ${configured() ? '' : '<div class="uyari">Google girişi henüz kurulmadı (Cloudflare’de GOOGLE_CLIENT_ID yok). Şimdilik demo modunda deneyebilirsin.</div>'}
      <div class="doldur"></div>
      <button class="blok buyuk google-btn" id="gGiris" ${configured() ? '' : 'disabled'}><span style="width:26px;height:26px;border-radius:50%;border:2px solid #1f1f2e;display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk';font-size:14px">G</span>Google ile bağlan</button>
      ${configured() ? '' : '<button class="blok ikinci" id="demo">Demo modunda dene</button>'}
      <p class="ortala soluk kucuk" style="margin:0">Bağlantıyı istediğin an Google hesap ayarlarından kaldırabilirsin.</p>`;
    $('#geri').onclick = () => wizard('hosgeldin');
    $('#gGiris').onclick = () => G.login();
    if ($('#demo')) $('#demo').onclick = demoBasla;
    return;
  }
  if (adim === 'tablo') {
    app.innerHTML = `${adimCubugu('tablo')}${baslik('Adım 2 · Tablo', 'Tablonu seç', 'Drive’ında Dudestreet tablon aranıyor…')}`;
    await guard(async () => {
      const files = await G.findAppSheets();
      app.innerHTML = `${adimCubugu('tablo')}
        ${baslik('Adım 2 · Tablo', files.length ? 'Tablonu seç' : 'Tablonu oluşturalım', files.length ? 'Daha önce kurmuşsun; kaldığın yerden devam et.' : 'Drive’ında senin için yeni bir tablo açalım. Bütün verin orada duracak.')}
        ${files.map((f, i) => `<button class="blok kart ${i === 0 ? 'vurgu' : ''}" data-kullan="${f.id}" style="justify-content:flex-start;gap:14px;color:var(--yazi);font-weight:500;min-height:72px;text-align:left">
          <span class="kayit-ik" style="background:rgba(78,224,160,.14)">${ikon('tablo', '#4ee0a0')}</span>
          <span class="bosluk"><b>${esc(f.name)}</b><div class="mini">Son değişiklik ${new Date(f.modifiedTime).toLocaleString('tr-TR')}</div></span></button>`).join('')}
        ${files.length ? '<div class="satir soluk kucuk"><div class="bosluk" style="height:1px;background:rgba(255,255,255,.1)"></div>ya da<div class="bosluk" style="height:1px;background:rgba(255,255,255,.1)"></div></div>' : ''}
        <button class="blok ${files.length ? 'ikinci' : 'buyuk'}" id="olustur">${files.length ? 'Yeni tablo oluştur' : 'Tablomu oluştur'}</button>
        <div class="doldur"></div>
        <div class="kart satir kucuk" style="align-items:flex-start;color:var(--ikinci)">${ikon('kilit', '#f5c542', 20)}<span>Tablo senin. İstediğin zaman Google Sheets’te açıp bakabilir, indirebilir ya da silebilirsin.</span></div>`;
      $$('[data-kullan]').forEach(b => (b.onclick = () => { G.setSheetId(b.dataset.kullan); S.db = new G.SheetDB(b.dataset.kullan); afterConnect(); }));
      $('#olustur').onclick = () => guard(async () => {
        $('#olustur').disabled = true; $('#olustur').textContent = 'Oluşturuluyor…';
        const db = await G.SheetDB.create(CONFIG.TABLO_ADI);
        await runMigrations(db, 0);
        await db.setKV('_meta', { uygulama: 'Dudestreet', olusturma: new Date().toISOString() });
        G.setSheetId(db.id);
        S.db = db;
        toast('✅ Tablon Drive’ında açıldı. Borsa senin 🔔');
        afterConnect();
      });
    });
    return;
  }
  if (adim === 'gemini') {
    const ayardan = S.view === 'ayarlar-gemini';
    app.innerHTML = `${adimCubugu('gemini')}
      ${baslik('Adım 3 · Yapay zekâ', 'Gemini’yi bağla', 'Future Dude kendi ücretsiz Gemini anahtarınla çalışır. Kotası da senin.')}
      <div class="kart">
        <div class="numara"><i>1</i><span>AI Studio’yu aç (Google hesabınla zaten girişlisin)</span></div>
        <div class="numara"><i>2</i><span><b style="color:var(--yazi)">Create API key</b> düğmesine bas, anahtarı kopyala</span></div>
        <div class="numara"><i>3</i><span>Buraya yapıştır ve bağla</span></div>
        <a class="btn ikinci blok" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">${ikon('dis', '#eef7f1', 18)}AI Studio’yu aç</a>
      </div>
      <div><label class="etiket" for="anahtar" style="margin-top:0">Gemini API anahtarın</label>
      <input id="anahtar" type="password" placeholder="AIza…" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
      ${isDemo() ? '' : '<label class="onay"><input type="checkbox" id="tabloya" checked><span>Anahtarımı kendi tabloma da kaydet (yeni telefonda tekrar girmeyeyim)</span></label>'}
      <div class="doldur"></div>
      <button class="blok buyuk" id="baglan">Test et ve bağla</button>
      <button class="blok hayalet" id="gec">Şimdilik geç</button>`;
    const geriBtn = $('#geri'); if (geriBtn) geriBtn.remove();
    $('#baglan').onclick = () => connectGemini($('#anahtar').value.trim(), $('#tabloya')?.checked ?? false, () => afterConnect());
    $('#anahtar').onkeydown = e => { if (e.key === 'Enter') $('#baglan').click(); };
    $('#gec').onclick = () => guard(async () => { await S.db.setKV('_meta', { gemini_atlandi: '1' }); S.meta.gemini_atlandi = '1'; afterConnect(); });
    void ayardan;
    return;
  }
  if (adim === 'hedef') return renderHedef();
}

async function demoBasla() {
  localStorage.setItem('ds_demo', '1');
  S.db = LocalDB.exists() ? new LocalDB() : await createDemo();
  afterConnect();
}

async function connectGemini(key, toSheet, done) {
  if (!key) return toast('Önce anahtarı yapıştır');
  const btn = $('#baglan');
  if (btn) { btn.disabled = true; btn.textContent = 'Test ediliyor…'; }
  try {
    const model = await AI.testKey(key);
    AI.setKey(key); AI.setModel(model);
    await guard(() => S.db.setKV('_meta', toSheet
      ? { gemini_key: key, gemini_model: model, gemini_atlandi: '0' }
      : { gemini_key: '', gemini_model: model, gemini_atlandi: '0' }));
    S.meta.gemini_key = toSheet ? key : '';
    toast(`✅ Future Dude’un beyni bağlandı (${esc(model.replace('models/', ''))})`);
    done?.();
  } catch (e) {
    toast('❌ Anahtar çalışmadı: ' + esc(e.message), 6000);
    if (btn) { btn.disabled = false; btn.textContent = 'Test et ve bağla'; }
  }
}

function renderReconnect() {
  chrome('sihirbaz');
  app.innerHTML = `<div class="doldur"></div>
    <div class="ortala"><img src="img/logo.svg" alt="" width="90" height="72"></div>
    ${baslik('Oturum', 'Borsa kısa bir mola verdi', 'Güvenlik için Google bağlantısı belli aralıklarla yenilenir. Verilerin yerinde, tek dokunuşla devam edersin.')}
    <div class="doldur"></div>
    <button class="blok buyuk" id="tekrar">Tekrar bağlan</button>`;
  $('#tekrar').onclick = () => G.login();
}

// ---------- hedef ----------
const HEDEFLER = [['ev', 'Ev'], ['araba', 'Araba'], ['ucak', 'Seyahat'], ['yuzuk', 'Düğün'], ['kitap', 'Eğitim'], ['hedef', 'Başka']];
function renderHedef(ayarlardan = false) {
  S.view = ayarlardan ? 'ayarlar' : 'sihirbaz';
  if (!ayarlardan) chrome('sihirbaz');
  const a = S.ayar;
  let tur = a.hedef_tur || 'ev', para = a.para_birimi || '₺';
  const ozel = tur === 'hedef' ? a.hedef_ne || '' : '';
  const ic = `
    ${ayarlardan ? '<h2>🎯 Hedefin</h2>' : `${adimCubugu('hedef')}${baslik('Adım 4 · Hedef', 'Neye biriktiriyorsun?', 'Hepsini sonra Ayarlar’dan değiştirebilirsin.')}`}
    <div class="hedef-izgara" id="hTur">${HEDEFLER.map(([k, t]) => `<button type="button" data-k="${k}" class="${k === tur ? 'on' : ''}">${ikon(k, k === tur ? '#9ff0c0' : '#93a89b', 24)}${t}</button>`).join('')}</div>
    <div id="ozelKutu" class="${tur === 'hedef' ? '' : 'hidden'}"><label class="etiket" for="hOzel" style="margin-top:0">Hedefin ne?</label><input id="hOzel" value="${esc(ozel)}" placeholder="ör. Kendi işimi kurmak"></div>
    <div><span class="etiket" style="margin-top:0">Para birimi</span><div class="seg" id="hPara">${['₺', '€', '$', '£'].map(p => `<button type="button" data-p="${p}" class="${p === para ? 'on' : ''}">${p} ${{ '₺': 'TL', '€': 'Euro', '$': 'Dolar', '£': 'Sterlin' }[p]}</button>`).join('')}</div></div>
    <div><label class="etiket" for="hTutar" style="margin-top:0">Hedef tutar</label><div class="alan-ek"><input id="hTutar" inputmode="decimal" value="${esc(a.hedef_tutar || '')}" placeholder="ör. 1.500.000"><span class="pbe">${para}</span></div></div>
    <div class="iki">
      <div><label class="etiket" for="hMin" style="margin-top:0">Her ay en az</label><div class="alan-ek"><input id="hMin" inputmode="decimal" value="${esc(a.aylik_min || '')}" placeholder="ör. 10.000"><span class="pbe">${para}</span></div></div>
      <div><label class="etiket" for="hTarih" style="margin-top:0">Hedef tarih</label><input id="hTarih" type="month" value="${esc(a.hedef_tarih || '')}"></div>
    </div>
    ${ayarlardan ? '' : '<div class="doldur"></div>'}
    <button class="blok buyuk" id="hKaydet">${ayarlardan ? 'Kaydet' : 'Devam'}</button>`;
  if (ayarlardan) modal(ic); else app.innerHTML = ic;
  const kok = ayarlardan ? $('#modalKart') : app;
  $$('#hTur button', kok).forEach(b => (b.onclick = () => {
    tur = b.dataset.k;
    $$('#hTur button', kok).forEach(x => { const on = x === b; x.classList.toggle('on', on); x.querySelector('svg').setAttribute('stroke', on ? '#9ff0c0' : '#93a89b'); });
    $('#ozelKutu', kok).classList.toggle('hidden', tur !== 'hedef');
  }));
  $$('#hPara button', kok).forEach(b => (b.onclick = () => { para = b.dataset.p; $$('#hPara button', kok).forEach(x => x.classList.toggle('on', x === b)); $$('.pbe', kok).forEach(s => (s.textContent = para)); }));
  $('#hKaydet', kok).onclick = () => guard(async () => {
    const ne = tur === 'hedef' ? $('#hOzel', kok).value.trim() : HEDEFLER.find(h => h[0] === tur)[1];
    if (!ne) return toast('Hedefini bir kelimeyle yaz');
    const tutar = num($('#hTutar', kok).value);
    if (!tutar) return toast('Hedef tutarı gir (sonra değiştirebilirsin)');
    $('#hKaydet', kok).disabled = true;
    const paraDegisti = para !== (S.ayar.para_birimi || '₺');
    await S.db.setKV('Ayarlar', { hedef_ne: ne, hedef_tur: tur, hedef_tutar: String(tutar), aylik_min: String(num($('#hMin', kok).value) || ''), para_birimi: para, hedef_tarih: $('#hTarih', kok).value || '' });
    S.ayar = await S.db.kv('Ayarlar');
    if (S.persona.cevapObj && S.persona.kaynak === 'anket') { // persona hedefi de bilsin
      const prompt = buildPersona({ ...S.persona.cevapObj, ...S.ayar });
      await S.db.setKV('Persona', { prompt }); S.persona.prompt = prompt;
    }
    if (paraDegisti) S.fiyat = { para: '', fiyatlar: {}, zaman: null, hata: null };
    if (ayarlardan) { modal(''); toast('🎯 Hedef güncellendi'); go('ayarlar'); if (paraDegisti) fiyatlariGetir(); }
    else afterConnect();
  });
}

// ---------- Borsa (ana sayfa) ----------
function renderBorsa() {
  const c = calc();
  const ad = S.persona.cevapObj?.ad || '';
  const pending = pendingMigrations(S.sema).length;
  const selam = pick(['Piyasalar açık', 'Zil çaldı 🔔', 'Bugün de kazanıyoruz', 'Borsa seninle']);
  const aylar = Object.keys(c.aylar).sort();
  app.innerHTML = `
    ${pending ? `<div class="kart vurgu satir"><span style="font-size:22px">🛠️</span><div class="bosluk"><b>Yeni özellikler var</b><div class="mini">Tablonu güncellemen lazım; verilerine dokunulmaz.</div></div><button class="kucuk-btn" id="guncelle">Güncelle</button></div>` : ''}
    <div class="kart">
      <div class="selam">${esc(selam)}${ad ? `, ${esc(ad)}` : ''}</div>
      <div class="satir"><span class="ust-etiket">${esc(S.ayar.hedef_ne || 'Hedefin')}</span><span class="bosluk"></span>${c.hedef ? `<span class="mini">Hedef ${money(c.hedef)}</span>` : ''}</div>
      <div class="buyuk-rakam">${money(c.toplam)}</div>
      ${c.hedef ? `<div class="cubuk" role="progressbar" aria-valuenow="${Math.round(c.ilerleme * 100)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${(c.ilerleme * 100).toFixed(1)}%"></div></div>
      <div class="satir mini"><span>%${fmt(c.ilerleme * 100, 1)} tamam</span><span class="bosluk"></span><span>Kalan ${money(c.kalan)}</span></div>` : ''}
      ${c.portfoy ? `<div class="dagilim" title="Nakit / Portföy"><i style="width:${(Math.max(0, c.nakit) / Math.max(1, c.toplam) * 100).toFixed(1)}%;background:#19c37d"></i><i style="width:${(c.portfoy / Math.max(1, c.toplam) * 100).toFixed(1)}%;background:#f5c542"></i></div>
      <div class="satir mini"><span><b style="color:#19c37d">●</b> Nakit ${money(c.nakit)}</span><span class="bosluk"></span><span><b class="altin">●</b> Portföy ${money(c.portfoy)} <span class="${c.gunluk >= 0 ? 'artı' : 'eksi'}">${c.gunluk ? `(${c.gunluk >= 0 ? '+' : ''}${money(c.gunluk)} bugün)` : ''}</span></span></div>` : ''}
      <div class="istatistik">
        <div><span class="mini">Bu ay net</span><b class="${c.durum === 'Hedefte' ? 'artı' : c.durum === '-' ? '' : 'eksi'}">${c.buAy >= 0 ? '' : '−'}${money(Math.abs(c.buAy))}</b><span class="mini">${c.min ? (c.buAy >= c.min ? 'Hedefte ✅' : `${money(c.min - c.buAy)} daha`) : 'Aylık hedef yok'}</span></div>
        <div><span class="mini">Tahmini varış</span><b>${esc(c.varis || '–')}</b><span class="mini">${c.gereken !== null ? `Tarihe yetişmek için ayda ${money(c.gereken)}` : c.ort ? `Ortalama ayda ${money(c.ort)}` : 'Kayıt girdikçe hesaplanır'}</span></div>
      </div>
    </div>

    <div class="kart">
      <h3>Kayıt ekle</h3>
      <div class="seg" id="kTur"><button class="on" data-t="Birikim">💰 Birikim</button><button data-t="Harcama">💸 Birikimden harcama</button></div>
      <div class="iki"><div class="alan-ek"><input id="kTutar" inputmode="decimal" placeholder="Tutar" aria-label="Tutar"><span>${pb()}</span></div><input id="kTarih" type="date" value="${today()}" aria-label="Tarih"></div>
      <select id="kKat" aria-label="Kategori"></select>
      <input id="kNot" placeholder="Not (isteğe bağlı)" aria-label="Not">
      <button class="blok" id="kEkle">Ekle</button>
    </div>

    ${aylar.length ? `<div class="kart grafik"><div class="satir"><h3>Aylık net</h3><span class="bosluk"></span>${c.min ? `<span class="mini"><b class="altin">┄</b> en az ${money(c.min)}</span>` : ''}</div>${aylikGrafik(c)}</div>` : ''}

    <div class="kart">
      <div class="satir"><h3>Son kayıtlar</h3><span class="bosluk"></span>${c.k.length > 8 ? `<button class="hayalet kucuk-btn" id="tumu">Tümü (${c.k.length})</button>` : ''}</div>
      ${kayitListesi(c.k.slice(-8).reverse())}
    </div>`;

  const KATLAR = { Birikim: ['Maaştan', 'Ek gelir', 'Hediye', 'Prim / ikramiye', 'Diğer'], Harcama: ['Gezi', 'Alışveriş', 'Yeme-içme', 'Konser / eğlence', 'Teknoloji', 'Acil durum', 'Diğer'] };
  let tur = 'Birikim';
  const katCiz = () => { $('#kKat').innerHTML = `<option value="">Kategori (isteğe bağlı)</option>${KATLAR[tur].map(x => `<option>${x}</option>`).join('')}`; };
  katCiz();
  $$('#kTur button').forEach(b => (b.onclick = () => { tur = b.dataset.t; $$('#kTur button').forEach(x => x.classList.toggle('on', x === b)); katCiz(); }));
  if (pending) $('#guncelle').onclick = openUpdate;
  if ($('#tumu')) $('#tumu').onclick = () => modal(`<div class="satir"><h3>Tüm kayıtlar</h3><span class="bosluk"></span><button class="ikon-btn" id="kapat" aria-label="Kapat">${ikon('carpi', '#93a89b', 18)}</button></div>${kayitListesi(c.k.slice().reverse())}`) || bagla($('#modalKart'));
  bagla(app);
  $('#kTutar').onkeydown = e => { if (e.key === 'Enter') $('#kEkle').click(); };
  $('#kEkle').onclick = () => guard(async () => {
    const tutar = num($('#kTutar').value);
    if (tutar <= 0) return toast('Tutar gir');
    $('#kEkle').disabled = true;
    await S.db.appendObj('Kayıtlar', { Kimlik: uid(), Tarih: $('#kTarih').value || today(), 'Tür': tur, Tutar: String(tutar), Kategori: $('#kKat').value, Not: $('#kNot').value.trim() });
    S.kayitlar = await S.db.table('Kayıtlar');
    toast(tur === 'Harcama'
      ? pick(['😤 Kaydedildi… Future Dude bunu gördü.', '📉 Kaçamak borsaya işlendi. Future Dude not aldı.', '💸 Tamam, yazdım. Ama bu ay telafi ediyoruz, değil mi?'])
      : pick(['📈 Kaydedildi! Hisseler yükselişte.', '💰 Helal! Borsa yeşil yanıyor.', '🔔 Zil çaldı, birikim eklendi.']));
    renderBorsa(); bantCiz();
  });

  function bagla(kok) {
    if ($('#kapat', kok)) $('#kapat', kok).onclick = () => modal('');
    $$('[data-sil]', kok).forEach(b => (b.onclick = () => kayitSil(b.dataset.sil)));
  }
}

function kayitListesi(liste) {
  if (!liste.length) return '<p class="soluk kucuk" style="margin:0">Henüz kayıt yok. İlk birikimini ekle, borsa açılsın 🔔</p>';
  const IKON = { 'Birikim': '💰', 'Harcama': '💸', 'Varlık alımı': '🛒', 'Varlık satışı': '🏷️' };
  return `<ul class="liste">${liste.map(r => {
    const art = (NAKIT[r.tur] || 0) > 0;
    const sinif = r.tur === 'Birikim' ? 'artı' : r.tur === 'Harcama' ? 'eksi' : 'soluk';
    return `<li><span class="kayit-ik">${IKON[r.tur] || '•'}</span>
      <span class="bosluk"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r['Not'] || r['Kategori'] || r.tur)}</div><div class="mini">${tarihFmt(r['Tarih'])} · ${esc(r.tur)}${r['Kategori'] && r['Not'] ? ` · ${esc(r['Kategori'])}` : ''}</div></span>
      <span class="tutar ${sinif}">${art ? '+' : '−'}${money(r.tutar)}</span>
      <button class="ikon-btn" data-sil="${r._row}" aria-label="Kaydı sil">${ikon('cop', '#62786b', 16)}</button></li>`;
  }).join('')}</ul>`;
}

function kayitSil(row) {
  const r = S.kayitlar.find(x => String(x._row) === String(row));
  if (!r) return;
  modal(`<h3>Kaydı sil?</h3><p class="soluk">${esc(r['Tarih'])} · ${esc(r['Tür'])} · ${money(num(r['Tutar']))}${r['Not'] ? ` · ${esc(r['Not'])}` : ''}</p>
    <p class="mini">Tablondan da silinir.</p>
    <div class="satir"><button class="ikinci bosluk" id="vazgec">Vazgeç</button><button class="tehlike bosluk" id="evet">Sil</button></div>`);
  $('#vazgec').onclick = () => modal('');
  $('#evet').onclick = () => guard(async () => {
    S.busy = true; $('#evet').disabled = true;
    try {
      // Satır numarası değişmiş olabilir: kimlikle yeniden bul
      const guncel = await S.db.table('Kayıtlar');
      const hedef = r['Kimlik'] ? guncel.find(x => x['Kimlik'] === r['Kimlik']) : guncel.find(x => x._row === r._row);
      if (hedef) await S.db.deleteRow('Kayıtlar', hedef._row);
      S.kayitlar = await S.db.table('Kayıtlar');
    } finally { S.busy = false; }
    modal(''); toast('🗑️ Silindi'); go(S.view);
  });
}

function aylikGrafik(c) {
  const d = new Date();
  const aylar = [];
  for (let i = 5; i >= 0; i--) { const t = new Date(d.getFullYear(), d.getMonth() - i, 1); aylar.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`); }
  const deg = aylar.map(a => c.aylar[a] || 0);
  const W = 340, H = 150, ust = 14, alt = 24, sol = 6;
  const maks = Math.max(1, c.min, ...deg.map(Math.abs)), minDeg = Math.min(0, ...deg);
  const olcek = (H - ust - alt) / (maks - minDeg || 1);
  const sifir = ust + maks * olcek;
  const bw = (W - sol * 2) / aylar.length;
  const bars = aylar.map((a, i) => {
    const v = deg[i], h = Math.abs(v) * olcek, x = sol + i * bw + bw * 0.2, y = v >= 0 ? sifir - h : sifir;
    const renk = v < 0 ? '#ff6b7d' : c.min && v < c.min ? '#f5c542' : '#19c37d';
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${Math.max(1.5, h).toFixed(1)}" rx="5" fill="${renk}" opacity="${a === monthKey(today()) ? 1 : 0.85}"><title>${ayAdi(a)}: ${money(v)}</title></rect>
      <text x="${(x + bw * 0.3).toFixed(1)}" y="${H - 7}" text-anchor="middle" font-size="11" fill="#93a89b" font-family="Inter">${ayAdi(a)}</text>`;
  }).join('');
  const minCizgi = c.min ? `<line x1="${sol}" x2="${W - sol}" y1="${(sifir - c.min * olcek).toFixed(1)}" y2="${(sifir - c.min * olcek).toFixed(1)}" stroke="#f5c542" stroke-dasharray="4 4" stroke-width="1.2" opacity=".8"/>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Son 6 ayın net birikimi"><line x1="${sol}" x2="${W - sol}" y1="${sifir.toFixed(1)}" y2="${sifir.toFixed(1)}" stroke="rgba(255,255,255,.12)"/>${bars}${minCizgi}</svg>`;
}

// ---------- Portföy ----------
const TURLER = ['Hisse', 'Kripto', 'Fon / ETF', 'Altın (gram)', 'Gümüş (gram)', 'Döviz', 'Diğer'];
function renderPortfoy() {
  const c = calc();
  const kar = c.portfoy - c.portfoyAlis;
  const v = c.v.slice().sort((a, b) => b.deger - a.deger);
  const zaman = S.fiyat.zaman ? new Date(S.fiyat.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : null;
  app.innerHTML = `
    <div class="kart">
      <div class="satir"><span class="ust-etiket">Portföyün</span><span class="bosluk"></span>
        <button class="ikon-btn" id="yenile" aria-label="Fiyatları yenile" title="Fiyatları yenile">${ikon('yenile', '#93a89b', 18)}</button></div>
      <div class="buyuk-rakam">${money(c.portfoy)}</div>
      ${S.portfoy.length ? `<div class="satir kucuk"><span class="${kar >= 0 ? 'artı' : 'eksi'}">${kar >= 0 ? '+' : '−'}${money(Math.abs(kar))} (${yuzde(c.portfoyAlis ? (kar / c.portfoyAlis) * 100 : 0)}) toplam</span><span class="bosluk"></span>
        <span class="${c.gunluk >= 0 ? 'artı' : 'eksi'}">${c.gunluk >= 0 ? '+' : '−'}${money(Math.abs(c.gunluk))} bugün</span></div>` : ''}
      <div class="mini">${S.fiyat.hata ? `⚠️ Canlı fiyat alınamadı: ${esc(S.fiyat.hata)}` : zaman ? `Fiyatlar ${zaman} itibarıyla · ${pb()} cinsinden` : S.portfoy.length ? 'Fiyatlar yükleniyor…' : 'Hisse, kripto, altın… hepsini buraya ekle; fiyatlar canlı gelir.'}</div>
    </div>
    <button class="blok buyuk" id="varlikEkle">${ikon('arti', '#04140c', 20)}Varlık ekle</button>
    ${v.length ? `<div class="kart"><ul class="liste">${v.map(x => `
      <li data-varlik="${x.p._row}" style="cursor:pointer">
        <span class="varlik-ik">${esc(kisaSembol(x.p).slice(0, 5))}</span>
        <span class="bosluk"><b>${esc(x.p['Ad'] || x.p['Sembol'])}</b><div class="mini">${fmt(x.adet, x.adet % 1 ? 4 : 0)} × ${fiyatFmt(x.fiyat)} ${pb()} ${x.canli ? '' : `<span class="rozet">${x.hata ? 'fiyat yok' : otomatik(x.p) ? '…' : 'elle'}</span>`}</div></span>
        <span style="text-align:right"><div class="tutar">${money(x.deger)}</div><div class="mini ${x.kar >= 0 ? 'artı' : 'eksi'}">${x.canli ? `${yuzde(x.gunluk, 2)} bugün` : `${x.kar >= 0 ? '+' : '−'}${money(Math.abs(x.kar))}`}</div></span>
      </li>`).join('')}</ul></div>` : ''}
    <p class="mini ortala">Fiyatlar Yahoo Finance’tan gelir, birkaç dakika gecikmeli olabilir. Yatırım tavsiyesi değildir.</p>`;
  $('#yenile').onclick = () => { $('#yenile').disabled = true; fiyatlariGetir(false); };
  $('#varlikEkle').onclick = () => varlikModal();
  $$('[data-varlik]').forEach(li => (li.onclick = () => varlikDetay(li.dataset.varlik)));
  if (S.portfoy.length && !S.fiyat.zaman && !S.fiyat.hata) fiyatlariGetir();
}

function varlikModal() {
  let secim = null, tur = 'Hisse';
  modal(`<div class="satir"><h3>Varlık ekle</h3><span class="bosluk"></span><button class="ikon-btn" id="kapat" aria-label="Kapat">${ikon('carpi', '#93a89b', 18)}</button></div>
    <div class="cipler" id="vTur">${TURLER.map(t => `<button type="button" class="cip ${t === tur ? 'on' : ''}" data-t="${t}">${t}</button>`).join('')}</div>
    <div id="aramaKutu"><input id="vAra" placeholder="Ara: THYAO, Apple, Bitcoin…" autocomplete="off" aria-label="Varlık ara"><div class="arama-sonuc" id="vSonuc" style="margin-top:8px"></div></div>
    <div id="vForm" class="hidden">
      <div class="kart vurgu satir" id="vSecili"></div>
      <div id="elleAd" class="hidden"><label class="etiket" for="vAd">Adı</label><input id="vAd" placeholder="ör. Arsa, Mevduat, Saat koleksiyonu"></div>
      <div class="iki">
        <div><label class="etiket" for="vAdet">Adet / miktar</label><input id="vAdet" inputmode="decimal" placeholder="ör. 10"></div>
        <div><label class="etiket" for="vMaliyet" id="vMalEt">Birim alış fiyatı</label><div class="alan-ek"><input id="vMaliyet" inputmode="decimal" placeholder="0"><span>${pb()}</span></div></div>
      </div>
      <div class="ipucu" id="vIpucu"></div>
      <label class="etiket" for="vTarih">Alış tarihi</label><input id="vTarih" type="date" value="${today()}">
      <label class="onay"><input type="checkbox" id="vDus" checked><span>Parasını nakit birikimimden düş (birikimle aldıysan işaretli kalsın; kural ihlali sayılmaz)</span></label>
      <button class="blok buyuk" id="vKaydet" style="margin-top:14px">Portföye ekle</button>
    </div>`);
  $('#kapat').onclick = () => modal('');
  const formGoster = () => {
    $('#vForm').classList.remove('hidden');
    const elle = tur === 'Diğer', gram = tur.includes('gram');
    $('#elleAd').classList.toggle('hidden', !elle);
    $('#aramaKutu').classList.toggle('hidden', elle || gram || !!secim);
    $('#vSecili').classList.toggle('hidden', elle);
    $('#vMalEt').textContent = elle ? 'Birim değeri' : gram ? 'Gram alış fiyatı' : 'Birim alış fiyatı';
    $('#vAdet').placeholder = gram ? 'ör. 10 (gram)' : tur === 'Kripto' ? 'ör. 0,015' : 'ör. 10';
    $('#vIpucu').textContent = elle ? 'Otomatik fiyatı olmayan varlıklar için; değerini sonradan elle güncellersin.' : '';
    if (secim) {
      $('#vSecili').innerHTML = `<span class="varlik-ik">${esc(kisaSembol({ 'Tür': tur, 'Sembol': secim.sembol }).slice(0, 5))}</span><span class="bosluk"><b>${esc(secim.ad)}</b><div class="mini">${esc(secim.sembol)}${secim.borsa ? ' · ' + esc(secim.borsa) : ''}</div><div class="mini" id="vCanli">Güncel fiyat getiriliyor…</div></span>${gram ? '' : `<button class="ikon-btn" id="vDegis" aria-label="Değiştir">${ikon('carpi', '#93a89b', 16)}</button>`}`;
      if ($('#vDegis')) $('#vDegis').onclick = () => { secim = null; $('#vForm').classList.add('hidden'); $('#aramaKutu').classList.remove('hidden'); $('#vAra').focus(); };
      fetch('/api/fiyatlar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ liste: [{ tur, sembol: secim.sembol }], para: PARA_KODU[pb()] || 'TRY' }) })
        .then(r => r.json()).then(j => {
          const f = j.fiyatlar?.[`${tur}|${secim.sembol}`];
          if (!$('#vCanli')) return;
          if (!f || f.hata) { $('#vCanli').textContent = 'Canlı fiyat alınamadı; alış fiyatını sen gir.'; return; }
          $('#vCanli').innerHTML = `Şu an <b>${fiyatFmt(f.fiyat)} ${pb()}</b> <span class="${f.degisim >= 0 ? 'artı' : 'eksi'}">${yuzde(f.degisim, 2)}</span>`;
          if (!$('#vMaliyet').value) $('#vMaliyet').value = String(Number(f.fiyat.toPrecision(6))).replace('.', ',');
        }).catch(() => { if ($('#vCanli')) $('#vCanli').textContent = 'Canlı fiyat alınamadı; alış fiyatını sen gir.'; });
    }
  };
  const turSec = t => {
    tur = t; secim = null;
    $$('#vTur .cip').forEach(x => x.classList.toggle('on', x.dataset.t === t));
    $('#vSonuc').innerHTML = ''; $('#vAra').value = '';
    $('#vForm').classList.add('hidden');
    $('#aramaKutu').classList.remove('hidden');
    $('#vAra').placeholder = { Hisse: 'Ara: THYAO, Aselsan, Apple…', Kripto: 'Ara: Bitcoin, ETH, Solana…', 'Fon / ETF': 'Ara: S&P 500, QQQ, altın fonu…', 'Döviz': 'Ara: USD, EUR, GBP…' }[t] || 'Ara';
    if (t.includes('gram')) { secim = { sembol: t.startsWith('Altın') ? 'ALTIN' : 'GUMUS', ad: t.startsWith('Altın') ? 'Gram altın' : 'Gram gümüş' }; formGoster(); }
    else if (t === 'Diğer') formGoster();
    else if (t === 'Döviz') {
      $('#vSonuc').innerHTML = ['USD|Amerikan doları', 'EUR|Euro', 'GBP|İngiliz sterlini', 'CHF|İsviçre frangı'].map(x => { const [s, a] = x.split('|'); return `<button data-s="${s}" data-a="${a}"><b>${s}</b><span class="bosluk">${a}</span></button>`; }).join('');
      $$('#vSonuc button').forEach(b => (b.onclick = () => { secim = { sembol: b.dataset.s, ad: b.dataset.a }; formGoster(); }));
    } else $('#vAra').focus();
  };
  $$('#vTur .cip').forEach(b => (b.onclick = () => turSec(b.dataset.t)));
  let zam;
  $('#vAra').oninput = () => {
    clearTimeout(zam);
    const q = $('#vAra').value.trim();
    if (q.length < 2) { $('#vSonuc').innerHTML = ''; return; }
    zam = setTimeout(async () => {
      $('#vSonuc').innerHTML = '<div class="mini">Aranıyor…</div>';
      try {
        const sorgu = tur === 'Kripto' && !/usd|eur|try/i.test(q) ? q + ' usd' : q;
        const r = await fetch('/api/ara?q=' + encodeURIComponent(sorgu));
        const j = await r.json();
        if (!r.ok) throw new Error(j.hata || 'Arama yapılamadı');
        let s = j.sonuclar || [];
        if (tur === 'Kripto') s = s.filter(x => x.tur === 'Kripto');
        else if (tur === 'Fon / ETF') s = s.filter(x => x.tur === 'Fon / ETF');
        else if (tur === 'Hisse') s = s.filter(x => x.tur === 'Hisse');
        $('#vSonuc').innerHTML = s.length ? s.map((x, i) => `<button data-i="${i}"><b>${esc(x.sembol)}</b><span class="bosluk" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.ad)}</span><span class="mini">${esc(x.borsa)}</span></button>`).join('')
          : `<div class="mini">Bulunamadı. Borsa İstanbul hisseleri için sonuna .IS ekleyebilirsin (ör. THYAO.IS) ya da “Diğer” ile elle ekle.</div>`;
        $$('#vSonuc button').forEach(b => (b.onclick = () => { const x = s[b.dataset.i]; secim = { sembol: tur === 'Kripto' ? x.sembol.replace(/-USD$/, '') : x.sembol, ad: x.ad.replace(/ USD$/, ''), borsa: x.borsa }; formGoster(); }));
      } catch (e) { $('#vSonuc').innerHTML = `<div class="mini">⚠️ ${esc(e.message)}</div>`; }
    }, 350);
  };
  $('#vAra').focus();
  $('#vKaydet') && ($('#modalKart').onclick = e => {
    if (e.target.id !== 'vKaydet') return;
    guard(async () => {
      const adet = num($('#vAdet').value), maliyet = num($('#vMaliyet').value);
      const elle = tur === 'Diğer';
      const ad = elle ? $('#vAd').value.trim() : secim?.ad;
      if (!elle && !secim) return toast('Önce varlığı seç');
      if (elle && !ad) return toast('Bir ad yaz');
      if (adet <= 0) return toast('Adet gir');
      if (maliyet <= 0) return toast('Fiyat gir');
      S.busy = true; e.target.disabled = true;
      try {
        const tarih = $('#vTarih').value || today();
        const sembol = elle ? ad.toUpperCase().slice(0, 12) : secim.sembol;
        await S.db.appendObj('Portföy', { Kimlik: uid(), 'Tür': tur, Sembol: sembol, Ad: ad, Adet: String(adet), Maliyet: String(maliyet), Tarih: tarih, Not: '' });
        if ($('#vDus').checked) await S.db.appendObj('Kayıtlar', { Kimlik: uid(), Tarih: tarih, 'Tür': 'Varlık alımı', Tutar: String(adet * maliyet), Kategori: sembol, Not: `${ad} alındı` });
        await loadAll();
      } finally { S.busy = false; }
      modal('');
      toast(pick(['🛒 Portföye eklendi. Kurt gibi yatırımcı 🐺', '📈 Aldık! Hayırlı olsun dude.', '🔔 İşlem tamam, portföy büyüyor.']));
      go('portfoy'); fiyatlariGetir();
    });
  });
}

function varlikDetay(row) {
  const x = calc().v.find(y => String(y.p._row) === String(row));
  if (!x) return;
  const p = x.p, elle = !otomatik(p);
  modal(`<div class="satir"><span class="varlik-ik">${esc(kisaSembol(p).slice(0, 5))}</span><div class="bosluk"><h3>${esc(p['Ad'] || p['Sembol'])}</h3><div class="mini">${esc(p['Sembol'])} · ${esc(p['Tür'])}</div></div><button class="ikon-btn" id="kapat" aria-label="Kapat">${ikon('carpi', '#93a89b', 18)}</button></div>
    <div class="istatistik">
      <div><span class="mini">Değer</span><b>${money(x.deger)}</b><span class="mini">${fmt(x.adet, x.adet % 1 ? 4 : 0)} × ${fiyatFmt(x.fiyat)}</span></div>
      <div><span class="mini">Kâr / zarar</span><b class="${x.kar >= 0 ? 'artı' : 'eksi'}">${x.kar >= 0 ? '+' : '−'}${money(Math.abs(x.kar))}</b><span class="mini">${yuzde(x.karYuzde)} · maliyet ${fiyatFmt(x.maliyet)}</span></div>
    </div>
    ${elle ? `<label class="etiket" for="dDeger">Güncel birim değeri</label><div class="satir"><div class="alan-ek bosluk"><input id="dDeger" inputmode="decimal" value="${String(x.maliyet).replace('.', ',')}"><span>${pb()}</span></div><button id="dDegerKaydet">Kaydet</button></div>` : ''}
    <h3 style="margin-top:18px">Sat</h3>
    <div class="iki">
      <div><label class="etiket" for="dAdet">Adet</label><input id="dAdet" inputmode="decimal" value="${String(x.adet).replace('.', ',')}"></div>
      <div><label class="etiket" for="dFiyat">Birim satış fiyatı</label><div class="alan-ek"><input id="dFiyat" inputmode="decimal" value="${String(Number(x.fiyat.toPrecision(6))).replace('.', ',')}"><span>${pb()}</span></div></div>
    </div>
    <label class="onay"><input type="checkbox" id="dNakit" checked><span>Satış tutarını nakit birikimime ekle</span></label>
    <button class="blok" id="dSat" style="margin-top:12px">Sat</button>
    <button class="blok hayalet" id="dSil">Satış kaydı olmadan portföyden kaldır</button>`);
  $('#kapat').onclick = () => modal('');
  const satirYaz = async (yeni) => {
    const guncel = await S.db.table('Portföy');
    const h = guncel.find(y => (p['Kimlik'] && y['Kimlik'] === p['Kimlik']) || (!p['Kimlik'] && y._row === p._row));
    if (!h) throw new Error('Varlık tabloda bulunamadı, sayfayı yenile');
    if (yeni === null) return S.db.deleteRow('Portföy', h._row);
    const head = (await S.db.read('Portföy', '1:1'))[0] || [];
    const obj = { ...h, ...yeni };
    return S.db.write('Portföy', `A${h._row}:${G.colLetter(head.length)}${h._row}`, [head.map(k => obj[k] ?? '')]);
  };
  const islem = fn => guard(async () => { S.busy = true; $$('#modalKart button').forEach(b => (b.disabled = true)); try { await fn(); await loadAll(); } finally { S.busy = false; } modal(''); go('portfoy'); fiyatlariGetir(); });
  if ($('#dDegerKaydet')) $('#dDegerKaydet').onclick = () => islem(async () => { const d = num($('#dDeger').value); if (d <= 0) throw new Error('Değer gir'); await satirYaz({ Maliyet: String(d) }); toast('✅ Değer güncellendi'); });
  $('#dSat').onclick = () => {
    const adet = Math.min(num($('#dAdet').value), x.adet), fiyat = num($('#dFiyat').value);
    if (adet <= 0 || fiyat <= 0) return toast('Adet ve fiyat gir');
    islem(async () => {
      const kalan = x.adet - adet;
      await satirYaz(kalan > 1e-9 ? { Adet: String(Number(kalan.toPrecision(10))) } : null);
      if ($('#dNakit').checked) await S.db.appendObj('Kayıtlar', { Kimlik: uid(), Tarih: today(), 'Tür': 'Varlık satışı', Tutar: String(adet * fiyat), Kategori: p['Sembol'], Not: `${p['Ad'] || p['Sembol']} satıldı` });
      const kar = adet * (fiyat - x.maliyet);
      toast(kar >= 0 ? `💰 Satıldı! ${money(kar)} kârla çıktın, Wolf of Dudestreet 🐺` : `🏷️ Satıldı. ${money(-kar)} zarar… olur böyle şeyler dude.`, 5000);
    });
  };
  $('#dSil').onclick = () => islem(async () => { await satirYaz(null); toast('Portföyden kaldırıldı'); });
}

// ---------- güncelleme (migration) ----------
function openUpdate() {
  const list = pendingMigrations(S.sema);
  modal(`<h3>🛠️ Tablo güncellemesi</h3>
    <p class="soluk">Tablon sürüm ${S.sema}'de, uygulama sürüm ${CONFIG.SCHEMA_VERSION} bekliyor. Şunlar yapılacak:</p>
    ${list.map(m => `<div class="kart"><b>Sürüm ${m.to}: ${esc(m.title)}</b><ul class="mini" style="padding-left:18px;margin:6px 0 0">${m.changes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}
    <p class="kucuk artı">✅ Mevcut verilerine dokunulmaz, hiçbir şey silinmez.</p>
    ${isDemo() ? '' : '<label class="onay"><input type="checkbox" id="yedek" checked><span>Önce tablomun yedeğini al (Drive’ında kopya oluşturulur)</span></label>'}
    <div id="ilerleme" class="mini"></div>
    <div class="satir"><button class="ikinci bosluk" id="sonra">Sonra</button><button class="bosluk" id="uygula">Güncelle</button></div>`);
  $('#sonra').onclick = () => modal('');
  $('#uygula').onclick = () => guard(async () => {
    S.busy = true; $('#uygula').disabled = true; $('#sonra').disabled = true;
    let yedek = null;
    try {
      if (!isDemo() && $('#yedek').checked) {
        $('#ilerleme').textContent = 'Yedek alınıyor…';
        yedek = await G.copyFile(S.db.id, `Dudestreet Yedek – ${new Date().toLocaleDateString('tr-TR')} (sürüm ${S.sema})`);
        await S.db.setKV('_meta', { son_yedek: yedek.id, son_yedek_tarih: new Date().toISOString() });
      }
      await runMigrations(S.db, S.sema, m => { $('#ilerleme').textContent = `Sürüm ${m.to} uygulanıyor: ${m.title}…`; });
      await loadAll();
    } finally { S.busy = false; }
    modal('');
    toast(`✅ Tablon güncellendi (sürüm ${S.sema})${yedek ? ` · <a href="${G.sheetUrl(yedek.id)}" target="_blank" rel="noopener">yedek</a>` : ''}`, 5000);
    go(S.view);
  });
}

// ---------- persona anketi ----------
const TASLAK = 'ds_anket_taslak';
const taslak = () => { try { return JSON.parse(localStorage.getItem(TASLAK) || '{}'); } catch { return {}; } };
const taslakKaydet = d => localStorage.setItem(TASLAK, JSON.stringify(d));

function startSurvey(mevcuttan) {
  if (mevcuttan && S.persona.cevapObj) taslakKaydet(S.persona.cevapObj);
  S.surveyIdx = 0;
  renderSurvey();
}

function soruHtml(q, a) {
  const v = a[q.id] ?? q.varsayilan ?? '';
  const ph = q.ornek ? `placeholder="ör. ${esc(q.ornek)}"` : '';
  let input = '';
  switch (q.tip) {
    case 'text': input = `<input id="q_${q.id}" data-q="${q.id}" value="${esc(v)}" ${ph}>`; break;
    case 'number': input = `<input id="q_${q.id}" data-q="${q.id}" inputmode="decimal" value="${esc(v)}" ${ph}>`; break;
    case 'date': input = `<input id="q_${q.id}" data-q="${q.id}" type="date" value="${esc(v)}">`; break;
    case 'textarea': input = `<textarea id="q_${q.id}" data-q="${q.id}" rows="${q.satir || 3}" ${ph}>${esc(v)}</textarea>`; break;
    case 'choice': input = `<div class="cipler" data-choice="${q.id}">${q.secenekler.map(o => `<button type="button" class="cip ${String(v) === o ? 'on' : ''}" data-v="${esc(o)}">${esc(q.etiket ? q.etiket(o) : o)}</button>`).join('')}</div>`; break;
    case 'multi': {
      const arr = [].concat(a[q.id] || []);
      input = `<div class="cipler" data-multi="${q.id}">${q.secenekler.map(o => `<button type="button" class="cip ${q.id === 'emojiler' ? 'emoji' : ''} ${arr.includes(o) ? 'on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
      break;
    }
    case 'slider': input = `<input id="q_${q.id}" data-q="${q.id}" type="range" min="${q.min}" max="${q.max}" value="${esc(v || q.varsayilan)}"><div class="aralik-uclar"><span>${q.uclar[0]}</span><b id="sv_${q.id}">${esc(v || q.varsayilan)}</b><span>${q.uclar[1]}</span></div>`; break;
  }
  const forAttr = ['choice', 'multi'].includes(q.tip) ? '' : `for="q_${q.id}"`;
  return `<div><label class="etiket" ${forAttr}>${esc(q.soru)}${q.zorunlu ? ' <span class="gerekli">*</span>' : ''}</label>${input}${q.not ? `<div class="ipucu">${esc(q.not)}</div>` : ''}</div>`;
}

function renderSurvey() {
  S.view = 'anket';
  chrome('sihirbaz');
  const sec = SECTIONS[S.surveyIdx];
  const a = taslak();
  const son = S.surveyIdx === SECTIONS.length - 1;
  const ilk = !S.persona.prompt;
  app.innerHTML = `
    ${ilk ? adimCubugu('persona') : ''}
    ${baslik(`Future Dude · ${S.surveyIdx + 1}/${SECTIONS.length}`, `${sec.ikon} ${esc(sec.baslik)}`, esc(sec.aciklama))}
    <div class="kart bolumler">${SECTIONS.map((s, i) => `<div class="bolum ${i < S.surveyIdx ? 'bitti' : i === S.surveyIdx ? 'simdi' : ''}"><i>${i < S.surveyIdx ? '✓' : i + 1}</i>${esc(s.baslik)}</div>`).join('')}</div>
    <div class="kart" style="padding-top:4px">${sec.sorular.map(q => soruHtml(q, a)).join('')}</div>
    ${S.surveyIdx === 0 ? '<p class="mini ortala" style="margin:0">Ne kadar senin gibi cevaplarsan Future Dude o kadar sen gibi konuşur. Cevapların sadece kendi tablonda durur.</p>' : ''}
    <div class="satir">
      ${S.surveyIdx > 0 ? '<button class="ikinci" id="aGeri">Geri</button>' : `<button class="hayalet" id="aSonra">${ilk ? 'Sonra doldururum' : 'Vazgeç'}</button>`}
      <button class="bosluk buyuk" id="aIleri">${son ? '🧬 Future Dude’u yarat' : 'İleri'}</button>
    </div>`;
  window.scrollTo(0, 0);

  const topla = () => {
    const d = taslak();
    $$('[data-q]').forEach(el => { d[el.dataset.q] = el.value; });
    $$('[data-choice]').forEach(el => { const on = $('.cip.on', el); d[el.dataset.choice] = on ? on.dataset.v : (d[el.dataset.choice] ?? ''); });
    $$('[data-multi]').forEach(el => { d[el.dataset.multi] = $$('.cip.on', el).map(x => x.dataset.v); });
    SECTIONS[S.surveyIdx].sorular.forEach(q => { if (q.tip === 'choice' && !d[q.id] && q.varsayilan) d[q.id] = q.varsayilan; });
    taslakKaydet(d);
    return d;
  };
  $$('[data-choice] .cip').forEach(b => (b.onclick = () => { $$('.cip', b.parentElement).forEach(x => x.classList.toggle('on', x === b)); topla(); }));
  $$('[data-multi] .cip').forEach(b => (b.onclick = () => { b.classList.toggle('on'); topla(); }));
  $$('input[type=range]').forEach(r => (r.oninput = () => { $('#sv_' + r.dataset.q).textContent = r.value; }));
  $$('[data-q]').forEach(el => (el.onchange = topla));
  if ($('#aGeri')) $('#aGeri').onclick = () => { topla(); S.surveyIdx--; renderSurvey(); };
  if ($('#aSonra')) $('#aSonra').onclick = () => { topla(); if (ilk) { localStorage.setItem('ds_anket_sonra', '1'); fiyatlariGetir(); } go(ilk ? 'borsa' : 'persona'); };
  $('#aIleri').onclick = () => {
    const d = topla();
    const eksik = SECTIONS[S.surveyIdx].sorular.filter(q => q.zorunlu && !String(d[q.id] || '').trim());
    if (eksik.length) return toast('Şunu doldur: ' + esc(eksik[0].soru));
    if (!son) { S.surveyIdx++; renderSurvey(); return; }
    anketBitir(d, ilk);
  };
}

async function anketBitir(a, ilk) {
  await guard(async () => {
    $('#aIleri').disabled = true; $('#aIleri').textContent = 'Yaratılıyor…';
    const prompt = buildPersona({ ...a, ...S.ayar });
    await S.db.setKV('Persona', { cevaplar: JSON.stringify(a), prompt, guncelleme: new Date().toISOString(), kaynak: 'anket' });
    localStorage.removeItem(TASLAK);
    localStorage.removeItem('ds_anket_sonra');
    await loadAll();
    S.chat = [];
    if (ilk) return renderHazir();
    toast('🧬 Future Dude güncellendi');
    go('persona');
  });
}

async function renderHazir() {
  S.view = 'hazir';
  chrome('sihirbaz');
  const a = S.persona.cevapObj || {};
  const c = calc();
  app.innerHTML = `
    <div class="ortala" style="padding-top:18px;display:flex;flex-direction:column;gap:12px;align-items:center">
      <div class="hazir-kure"><img src="img/logo.svg" alt="" width="64" height="51"></div>
      <span class="ust-etiket">Kurulum tamam</span>
      <h1>Future Dude hazır</h1>
      <p class="soluk" style="margin:0;max-width:310px">${futureYear(a)} yılındaki ${esc(a.ad || 'sen')}, anketteki cevaplarınla yaratıldı. Kişiliğini istediğin zaman düzenleyebilirsin.</p>
    </div>
    <div class="kart">
      <div class="satir"><span class="kayit-ik" style="background:rgba(25,195,125,.2);border-radius:50%">${ikon('zaman', '#9ff0c0', 18)}</span><b>${futureYear(a)}’den bir mesaj</b></div>
      <div class="msj model" id="ilkMesaj"><span class="yaziyor"><span></span><span></span><span></span></span></div>
    </div>
    <div class="kart">
      <div class="satir kucuk"><span class="soluk">Hedef</span><span class="bosluk"></span><b>${esc(S.ayar.hedef_ne || '-')} · ${c.hedef ? money(c.hedef) : '-'}</b></div>
      <div class="satir kucuk"><span class="soluk">Aylık en az</span><span class="bosluk"></span><b>${c.min ? money(c.min) : '-'}</b></div>
      <div class="satir kucuk"><span class="soluk">Veri</span><span class="bosluk"></span><b>${isDemo() ? 'Bu tarayıcı (demo)' : `${CONFIG.TABLO_ADI} · Drive`}</b></div>
    </div>
    <div class="doldur"></div>
    <button class="blok buyuk" id="borsaAc">Borsayı aç 🔔</button>`;
  $('#borsaAc').onclick = () => { fiyatlariGetir(); go('borsa'); };
  let mesaj = `Selam ${a.hitap ? a.hitap.split(',')[0].trim() : a.ad || 'dude'}! Ben ${futureYear(a)}’den sen. ${S.ayar.hedef_ne ? `${S.ayar.hedef_ne} hedefi için buradayım` : 'Buradayım'}; her birikimini, her kaçamağını göreceğim 👀 Hadi başlayalım.`;
  if (AI.getKey()) {
    try {
      mesaj = await AI.chat({ key: AI.getKey(), model: AI.getModel(), system: systemPrompt(), history: [{ role: 'user', text: '(Uygulamayı yeni kurdum ve seni ilk kez açıyorum. Kendini tanıt ve beni karşıla; kısa tut.)' }] });
      S.chat = [{ role: 'model', text: mesaj }];
    } catch (e) { console.warn(e); }
  }
  if ($('#ilkMesaj')) $('#ilkMesaj').textContent = mesaj;
}

// ---------- Future Dude: persona ekranı ----------
function renderPersona() {
  S.view = 'persona';
  chrome('ana');
  const p = S.persona;
  if (!p.prompt) {
    app.innerHTML = `<div class="kart"><h2>🧬 Future Dude’u yarat</h2><p class="soluk">Kısa bir anketle senin gibi konuşan, hedefini bilen, gerektiğinde seni hesaba çeken 10 yıl sonraki hâlini yarat.</p><button class="blok buyuk" id="basla">Ankete başla</button></div>`;
    $('#basla').onclick = () => startSurvey(false);
    return;
  }
  const a = p.cevapObj || {};
  app.innerHTML = `
    <button class="ikinci" id="sohbeteDon" style="align-self:flex-start">${ikon('geri', '#eef7f1', 18)} Sohbete dön</button>
    <div class="kart">
      <div class="satir"><div class="bosluk"><span class="ust-etiket">Kişilik</span><h2>Future Dude · ${a.yil_sonra ? futureYear(a) : ''}</h2></div><button class="ikinci kucuk-btn" id="tekrar">✏️ Anketi düzenle</button></div>
      <p class="mini">Bu metin Future Dude’un kim olduğunu belirler. Doğrudan da düzenleyebilirsin.${p.kaynak === 'gemini' ? ' (Gemini ile cilalandı)' : p.kaynak === 'elle' ? ' (Elle düzenlendi)' : ''}</p>
      <textarea id="prompt" class="kod" aria-label="Kişilik metni">${esc(p.prompt)}</textarea>
      <div class="satir" style="flex-wrap:wrap">
        <button class="ikinci kucuk-btn" id="uret" title="Anket cevaplarından yeniden üret">↺ Cevaplardan üret</button>
        <span class="bosluk"></span>
        ${AI.getKey() ? '<button class="ikinci kucuk-btn" id="cila">✨ Gemini ile cilala</button>' : ''}
        <button class="kucuk-btn" id="kaydet">Kaydet</button>
      </div>
    </div>
    <div class="kart">
      <h3>🧠 Seni hatırlıyor</h3>
      <p class="mini">Future Dude’un bilmesini istediğin şeyler. Sohbette kullanılır.</p>
      ${S.hafiza.length ? `<ul class="liste">${S.hafiza.map(h => `<li><span class="bosluk">${esc(h['Not'])}<div class="mini">${esc(h['Tarih'])}</div></span><button class="ikon-btn" data-sil="${h._row}" aria-label="Sil">${ikon('cop', '#62786b', 16)}</button></li>`).join('')}</ul>` : '<p class="mini">Henüz not yok.</p>'}
      <div class="satir"><input id="hNot" placeholder="ör. Mart’ta araba taksiti bitiyor" class="bosluk" aria-label="Yeni not"><button id="hEkle">Ekle</button></div>
    </div>`;
  $('#sohbeteDon').onclick = () => go('dude');
  $('#tekrar').onclick = () => startSurvey(true);
  $('#kaydet').onclick = () => promptKaydet($('#prompt').value, 'elle');
  $('#uret').onclick = () => { if (p.cevapObj) $('#prompt').value = buildPersona({ ...p.cevapObj, ...S.ayar }); };
  if ($('#cila')) $('#cila').onclick = cilala;
  $('#hNot').onkeydown = e => { if (e.key === 'Enter') $('#hEkle').click(); };
  $('#hEkle').onclick = () => guard(async () => {
    const t = $('#hNot').value.trim();
    if (!t) return;
    await S.db.appendObj('Hafıza', { Tarih: today(), Not: t, Kaynak: 'Kullanıcı' });
    S.hafiza = await S.db.table('Hafıza');
    renderPersona();
  });
  $$('[data-sil]').forEach(b => (b.onclick = () => guard(async () => {
    await S.db.deleteRow('Hafıza', Number(b.dataset.sil));
    S.hafiza = await S.db.table('Hafıza');
    renderPersona();
  })));
}

async function promptKaydet(text, kaynak) {
  await guard(async () => {
    await S.db.setKV('Persona', { prompt: text, guncelleme: new Date().toISOString(), kaynak });
    S.persona.prompt = text; S.persona.kaynak = kaynak;
    S.chat = [];
    toast('✅ Future Dude güncellendi');
    renderPersona();
  });
}

async function cilala() {
  const btn = $('#cila');
  btn.disabled = true; btn.textContent = '✨ Cilalanıyor…';
  try {
    const out = await AI.chat({ key: AI.getKey(), model: AI.getModel(), system: 'Sen deneyimli bir prompt yazarısın. Türkçe yazarsın.', history: [{ role: 'user', text: polishInstruction(S.persona.cevapObj || {}, $('#prompt').value) }] });
    modal(`<h3>✨ Cilalanmış kişilik</h3><p class="mini">Beğenirsen kabul et; beğenmezsen eskisi kalır.</p>
      <textarea id="cilali" class="kod">${esc(out)}</textarea>
      <div class="satir"><button class="ikinci bosluk" id="hayir">Vazgeç</button><button class="bosluk" id="evet">Kabul et</button></div>`);
    $('#hayir').onclick = () => modal('');
    $('#evet').onclick = () => { const t = $('#cilali').value; modal(''); promptKaydet(t, 'gemini'); };
  } catch (e) { toast('⚠️ ' + esc(e.message)); }
  finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = '✨ Gemini ile cilala'; } }
}

// ---------- Future Dude: sohbet ----------
function systemPrompt() {
  const c = calc();
  const persona = S.persona.prompt || 'Sen "Future Dude"sın: kullanıcının 10 yıl sonraki hâli. "Dudestreet" adlı kişisel finans uygulamasının içinden onunla konuşursun; samimi, esprili ve hedeflerine sadıksın. Rakam uydurmazsın.';
  const simdi = new Date().toLocaleString('tr-TR', { dateStyle: 'full', timeStyle: 'short' });
  const dg = S.persona.cevapObj?.dogum && S.persona.cevapObj.dogum.slice(5) === today().slice(5) ? '\nBUGÜN ONUN DOĞUM GÜNÜ! İlk mesajında içtenlikle kutla.\n' : '';
  const hafiza = S.hafiza.length ? S.hafiza.slice(-40).map(h => `- ${h['Not']}`).join('\n') : '(henüz bir şey yok)';
  const son = c.k.slice(-15).map(r => `${r['Tarih']} ${r.tur} ${money(r.tutar)}${r['Kategori'] ? ' [' + r['Kategori'] + ']' : ''}${r['Not'] ? ' - ' + r['Not'] : ''}`).join('\n') || 'yok';
  const aylik = Object.entries(c.aylar).sort().slice(-6).map(([a, v]) => `${a}: net ${money(v)}`).join('\n') || 'yok';
  const pf = c.v.map(x => `${x.p['Ad'] || x.p['Sembol']} (${x.p['Tür']}, ${x.p['Sembol']}): ${fmt(x.adet, 4)} adet, değer ${money(x.deger)}, maliyet ${money(x.alis)}, kâr/zarar ${money(x.kar)} (%${fmt(x.karYuzde, 1)})${x.canli ? `, bugün %${fmt(x.gunluk, 2)}` : ''}`).join('\n') || 'portföy boş';
  return `${persona}

Şu anki gerçek tarih (karşındaki kişi bu tarihte yaşıyor): ${simdi}
${dg}
HAFIZAN (onun hakkında bildiklerin; doğal kullan, liste gibi sıralama, uydurma):
${hafiza}

GÜNCEL VERİLER (onun kendi tablosundan; para birimi ${pb()}):
Hedef: ${S.ayar.hedef_ne || '-'} · hedef tutar ${c.hedef ? money(c.hedef) : 'girilmedi'}${S.ayar.hedef_tarih ? ` · hedef tarih ${S.ayar.hedef_tarih}` : ''}
Toplam varlık: ${money(c.toplam)} (nakit birikim ${money(c.nakit)} + portföy ${money(c.portfoy)}) · ilerleme %${(c.ilerleme * 100).toFixed(1)} · kalan ${money(c.kalan)}
Aylık minimum: ${c.min ? money(c.min) : 'girilmedi'} · bu ay net ${money(c.buAy)} · durum: ${c.durum}${c.gereken !== null ? ` · hedef tarihe yetişmek için ayda ${money(c.gereken)} gerekiyor` : ''}
Ortalama aylık net: ${money(c.ort)} · tahmini varış: ${c.varis || '-'}
AYLIK GEÇMİŞ (birikim − birikimden harcama):
${aylik}
PORTFÖY:
${pf}
SON KAYITLAR:
${son}`;
}

function renderDude() {
  if (!AI.getKey()) {
    app.innerHTML = `<div class="kart"><h2>💬 Future Dude’un beyni yok</h2><p class="soluk">Konuşabilmesi için kendi Gemini anahtarını bağla. Ücretsiz, 1 dakika sürer.</p><button class="blok buyuk" id="g">🔑 Gemini’yi bağla</button></div>`;
    $('#g').onclick = () => wizard('gemini');
    return;
  }
  const a = S.persona.cevapObj || {};
  const kim = S.persona.prompt ? `${futureYear(a)}’deki ${esc(a.ad || 'sen')}` : 'Future Dude';
  const ONERI = ['Bu ay nasıl gidiyorum?', 'Hedefe ne zaman ulaşırım?', 'Portföyüm hakkında ne düşünüyorsun?', 'Bu hafta 2.000 harcasam olur mu?', 'Bana bir motivasyon ver'];
  app.innerHTML = `
    <div class="satir"><div class="bosluk"><span class="ust-etiket">Future Dude</span><div class="mini">${kim} ile konuşuyorsun</div></div>
      <button class="ikinci kucuk-btn" id="kisilik">🧬 Kişilik</button>${S.chat.some(m => m.role === 'user') ? '<button class="hayalet kucuk-btn" id="temizle">Yeni sohbet</button>' : ''}</div>
    ${S.persona.prompt ? '' : '<div class="uyari">Henüz kişilik yok; genel bir Future Dude ile konuşuyorsun. <a href="#" id="anketGit">Anketi doldur</a>, gerçekten sen gibi konuşsun.</div>'}
    <div class="sohbet" id="sohbet">${S.chat.map(m => `<div class="msj ${m.role}">${esc(m.text)}</div>`).join('') || `<div class="msj model">${esc(S.persona.prompt ? 'Söyle dude, ne var ne yok? Rakamların hepsi önümde 👀' : 'Selam! Ben gelecekteki sen. Anketi doldurursan tam senin gibi konuşurum 😎')}</div>`}</div>
    <div style="height:120px"></div>
    <div class="yazma"><div class="yazma-ic" style="flex-direction:column;align-items:stretch">
      ${S.chat.some(m => m.role === 'user') ? '' : `<div class="oneriler">${ONERI.map(o => `<button class="ikinci" data-oneri="${esc(o)}">${esc(o)}</button>`).join('')}</div>`}
      <div class="satir" style="align-items:flex-end"><textarea id="girdi" rows="1" placeholder="Future Dude’a yaz…" aria-label="Mesaj"></textarea><button id="gonder" aria-label="Gönder">${ikon('gonder', '#04140c', 20)}</button></div>
    </div></div>`;
  $('#kisilik').onclick = () => renderPersona();
  if ($('#temizle')) $('#temizle').onclick = () => { S.chat = []; renderDude(); };
  if ($('#anketGit')) $('#anketGit').onclick = e => { e.preventDefault(); startSurvey(false); };
  const girdi = $('#girdi');
  girdi.oninput = () => { girdi.style.height = 'auto'; girdi.style.height = Math.min(140, girdi.scrollHeight) + 'px'; };
  girdi.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); gonder(); } };
  $('#gonder').onclick = gonder;
  $$('[data-oneri]').forEach(b => (b.onclick = () => { girdi.value = b.dataset.oneri; gonder(); }));
  window.scrollTo(0, document.body.scrollHeight);

  async function gonder() {
    const text = girdi.value.trim();
    if (!text || S.busy) return;
    S.busy = true;
    girdi.value = ''; girdi.style.height = 'auto';
    $('.oneriler')?.remove();
    S.chat.push({ role: 'user', text });
    const kutu = $('#sohbet');
    kutu.insertAdjacentHTML('beforeend', `<div class="msj user">${esc(text)}</div><div class="msj model" id="yaziyor"><span class="yaziyor"><span></span><span></span><span></span></span></div>`);
    window.scrollTo(0, document.body.scrollHeight);
    try {
      const cevap = await AI.chat({ key: AI.getKey(), model: AI.getModel(), system: systemPrompt(), history: S.chat.slice(-30) });
      S.chat.push({ role: 'model', text: cevap });
      $('#yaziyor').outerHTML = `<div class="msj model">${esc(cevap)}</div>`;
    } catch (e) {
      S.chat.pop();
      const m = /quota|429|exhausted/i.test(e.message) ? 'Gemini kotan doldu galiba; biraz sonra tekrar dene.' : e.message;
      $('#yaziyor').outerHTML = `<div class="msj model hata">⚠️ ${esc(m)}</div>`;
    } finally {
      S.busy = false;
      window.scrollTo(0, document.body.scrollHeight);
    }
  }
}

// ---------- Ayarlar ----------
function renderAyarlar() {
  const pending = pendingMigrations(S.sema).length;
  const keyInSheet = !!S.meta.gemini_key;
  const c = calc();
  app.innerHTML = `
    <div class="kart">
      <div class="satir"><h3>🎯 Hedef</h3><span class="bosluk"></span><button class="ikinci kucuk-btn" id="hedefDuzenle">Düzenle</button></div>
      <div class="satir kucuk"><span class="soluk">Hedef</span><span class="bosluk"></span><b>${esc(S.ayar.hedef_ne || '-')}</b></div>
      <div class="satir kucuk"><span class="soluk">Tutar</span><span class="bosluk"></span><b>${c.hedef ? money(c.hedef) : '-'}</b></div>
      <div class="satir kucuk"><span class="soluk">Her ay en az</span><span class="bosluk"></span><b>${c.min ? money(c.min) : '-'}</b></div>
      <div class="satir kucuk"><span class="soluk">Hedef tarih</span><span class="bosluk"></span><b>${S.ayar.hedef_tarih ? new Date(S.ayar.hedef_tarih + '-01T12:00:00').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }) : '-'}</b></div>
    </div>
    <div class="kart">
      <h3>🤖 Future Dude</h3>
      ${AI.getKey() ? `<p class="mini" style="margin-top:6px">Gemini bağlı ✅ · ${esc((AI.getModel() || '').replace('models/', ''))} · anahtar …${esc(AI.getKey().slice(-4))}</p>
        ${isDemo() ? '' : `<label class="onay"><input type="checkbox" id="kis" ${keyInSheet ? 'checked' : ''}><span>Anahtarım kendi tablomda da saklansın</span></label>`}
        <div class="satir"><button class="ikinci bosluk" id="kisilik">🧬 Kişilik</button><button class="ikinci bosluk" id="degis">Anahtarı değiştir</button><button class="tehlike" id="kaldir">Kaldır</button></div>`
        : '<p class="mini">Gemini bağlı değil.</p><button class="blok" id="degis">🔑 Gemini’yi bağla</button>'}
    </div>
    <div class="kart">
      <h3>☁️ Verilerin</h3>
      ${isDemo() ? '<p class="mini">Demo modu: veriler sadece bu tarayıcıda. Gerçek kullanım için demodan çıkıp Google ile bağlan.</p>' : `
      <p class="mini">Hesap: <b>${esc(G.userEmail())}</b><br>Tüm verilerin kendi Drive’ındaki tabloda. Dudestreet hiçbir sunucuda veri tutmaz.</p>
      <a class="btn ikinci blok" href="${G.sheetUrl(S.db.id)}" target="_blank" rel="noopener">📄 Tablomu Google Sheets’te aç</a>
      <button class="ikinci blok" id="yedekAl">🗂️ Şimdi yedek al</button>
      ${S.meta.son_yedek ? `<p class="mini">Son yedek: <a href="${G.sheetUrl(S.meta.son_yedek)}" target="_blank" rel="noopener">${new Date(S.meta.son_yedek_tarih).toLocaleString('tr-TR')}</a></p>` : ''}`}
      <p class="mini">Tablo sürümü ${S.sema} · uygulama ${CONFIG.APP_VERSION}${pending ? ' · <b class="altin">güncelleme var</b>' : ''}</p>
      ${pending ? '<button class="blok" id="guncelle">Tabloyu güncelle</button>' : ''}
    </div>
    <div class="kart">
      <h3>📲 Telefona kur</h3>
      <p class="mini">iPhone: Safari’de Paylaş → <b>Ana Ekrana Ekle</b>. Android: Chrome menüsü → <b>Uygulamayı yükle</b>. Uygulama gibi açılır.</p>
    </div>
    <button class="tehlike blok" id="cikis">${isDemo() ? 'Demodan çık (demo verileri silinir)' : 'Bu cihazda bağlantıyı kes'}</button>
    <p class="mini ortala" style="margin:0">${isDemo() ? '' : 'Bağlantıyı kesmek tablonu silmez; tekrar Google ile girince kaldığın yerden devam edersin.'}</p>`;
  $('#hedefDuzenle').onclick = () => renderHedef(true);
  if ($('#kisilik')) $('#kisilik').onclick = () => renderPersona();
  $('#degis').onclick = () => wizard('gemini');
  if ($('#guncelle')) $('#guncelle').onclick = openUpdate;
  if ($('#kaldir')) $('#kaldir').onclick = () => guard(async () => { AI.setKey(''); AI.setModel(''); await S.db.setKV('_meta', { gemini_key: '', gemini_atlandi: '1' }); S.meta.gemini_key = ''; S.meta.gemini_atlandi = '1'; toast('Anahtar kaldırıldı'); renderAyarlar(); });
  if ($('#kis')) $('#kis').onchange = e => guard(async () => { await S.db.setKV('_meta', { gemini_key: e.target.checked ? AI.getKey() : '' }); S.meta.gemini_key = e.target.checked ? AI.getKey() : ''; toast(e.target.checked ? 'Anahtar tablona kaydedildi' : 'Anahtar tablondan silindi (sadece bu cihazda)'); });
  if ($('#yedekAl')) $('#yedekAl').onclick = () => guard(async () => {
    $('#yedekAl').disabled = true;
    const b = await G.copyFile(S.db.id, `Dudestreet Yedek – ${new Date().toLocaleString('tr-TR')}`);
    await S.db.setKV('_meta', { son_yedek: b.id, son_yedek_tarih: new Date().toISOString() });
    S.meta = await S.db.kv('_meta');
    toast('✅ Yedek Drive’ına kaydedildi');
    renderAyarlar();
  });
  $('#cikis').onclick = () => {
    if (isDemo()) { LocalDB.wipe(); localStorage.removeItem('ds_demo'); }
    else G.logout();
    ['ds_gemini_key', 'ds_gemini_model', TASLAK, 'ds_anket_sonra'].forEach(k => localStorage.removeItem(k));
    Object.assign(S, { db: null, chat: [], fiyat: { para: '', fiyatlar: {}, zaman: null, hata: null } });
    wizard('hosgeldin');
  };
}

boot();
