// Dudestreet — kendi Wall Street'in.
// Veri kullanıcının kendi Google Sheet'inde, yapay zekâ (Future Dude) kullanıcının kendi Gemini anahtarıyla.
// Sunucu sadece piyasa fiyatlarını getirir; hiçbir kullanıcı verisi tutmaz.
import { CONFIG, S, gecmisBaslat, TABLOLAR, onbellekOku, onbellekYaz, onbellekSil, $, $$, esc, num, money, fmt, today, buAy, ymAdd, uid, isDemo, toast, sheet, modal, onayKutusu, guard, ikon, pick, lsGet, lsSet, yuzde, fiyatFmt, gizli, gosterKod, gosterSimge, paraKod, pb } from './core.js';
import * as G from './google.js';
import * as AI from './gemini.js';
import { runMigrations, pendingMigrations } from './schema.js';
import { LocalDB } from './localdb.js';
import { chrome, adimCubugu, baslik, madde } from './ui.js';
import { TEMALAR, aktifTema, temaUygula } from './tema.js';
import { malVarligi, hedefHesap, ayHesap, borclar, canliMi } from './hesap.js';
import { renderOzet, gecmisYaz } from './ozet.js';
import { renderGelirGider } from './gelirgider.js';
import { renderVarliklar, fiyatlariGetir, kisaSembol } from './varliklar.js';
import { renderBorclar } from './borclar.js';
import { renderHedef, hedefFormHTML, hedefFormBagla, hedefDuzenle } from './hedef.js';
import { renderDude, renderPersona, startSurvey } from './dude.js';
import { karakterler } from './ai.js';
import { otomatikYedek, yedekPenceresi, gunlukPenceresi, zorlaGuncelle } from './yedek.js';
import { notlarAc, notFlush } from './notlar.js';

const app = () => $('#app');
const ic = (k, s = 18) => ikon(k, 'currentColor', s);

// ---------- Açılış ----------
async function boot() {
  temaUygula(aktifTema());
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  $$('#sekmeler button, .ust-btn').forEach(b => b.onclick = () => b.dataset.view === 'notlar' ? notlarAc() : go(b.dataset.view));
  // Sunucu ayarı açılışı bekletmez: sadece Google girişi gerekiyorsa beklenir
  const ayarP = fetch('/api/ayar', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { if (j) { CONFIG.GOOGLE_CLIENT_ID = j.googleClientId || ''; S.sunucuSurum = j.surum || ''; } }).catch(() => { /* çevrimdışı */ });
  S.ayarP = ayarP;
  // Son bilinen fiyatlar: taze fiyat gelene kadar onlarla çizilir (zaman boş kalır, fiyat yine çekilir; geçmişe yazılmaz)
  try { const f = JSON.parse(localStorage.getItem('ds_fiyatOnbellek') || 'null'); if (f) { S.fiyat = { ...f.fiyat, zaman: null, hata: null }; S.kurlar = f.kurlar || {}; S.mbkayo = f.mbkayo || null; } } catch { /* yok say */ }
  ustAraclar();
  const r = G.handleRedirect();
  if (r.error && !['interaction_required', 'login_required', 'consent_required'].includes(r.error)) toast('Google girişi tamamlanmadı: ' + esc(r.error));
  if (isDemo()) { S.db = LocalDB.exists() ? new LocalDB() : await demoKur(); return baglandi(); }
  if (!G.getToken()) {
    await ayarP;
    if (CONFIG.GOOGLE_CLIENT_ID && G.shouldSilentRefresh() && !r.error) return G.login({ silent: true });
    return wizard('hosgeldin');
  }
  await guard(async () => {
    if (!G.userEmail()) await G.fetchEmail();
    const id = G.getSheetId();
    if (!id) return wizard('tablo');
    S.db = new G.SheetDB(id);
    await baglandi();
  });
}

// Tüm sekmeleri TEK istekte okur; tablo eskiyse (yeni sekmeler eklendiyse) önce sessizce günceller (sadece ekleme yapar, veri silmez)
const SEKMELER = ['Kayıtlar', 'Portföy', 'Hafıza', 'Gelir', 'Giderler', 'Bütçe', 'Onay', 'Kategori', 'Notlar', 'Borçlar', 'Borç hareketleri', 'Geçmiş'];
const OKUNAN = ['_meta', 'Ayarlar', 'Persona', ...SEKMELER];
function veriKoy({ meta, ayar, persona, tablolar }) {
  S.meta = meta; S.sema = Number(meta.sema || 0);
  SEKMELER.forEach(t => { S[TABLOLAR[t]] = tablolar[t] || []; });
  S.portfoy = S.portfoy.filter(p => num(p['Adet']) > 0);
  S.ayar = ayar; S.persona = persona; S._karakterler = null;
  try { S.persona.cevapObj = persona.cevaplar ? JSON.parse(persona.cevaplar) : null; } catch { S.persona.cevapObj = null; }
  if (!AI.getKey() && S.meta.gemini_key) AI.setKey(S.meta.gemini_key);
  if (!AI.getModel() && S.meta.gemini_model) AI.setModel(S.meta.gemini_model);
}
async function yukle() {
  const db = S.db;
  let ham = null;
  // Bu cihaz tablonun güncel olduğunu biliyorsa doğrudan tek istekte okunur; bilmiyorsa önce sürümüne bakılır (eski tabloda eksik sekme toplu okumayı bozar)
  const semaAnahtar = 'ds_sema_' + db.id, bilinen = Number(localStorage.getItem(semaAnahtar) || 0);
  if (!pendingMigrations(bilinen).length) { try { ham = await db.okuHepsi(OKUNAN); } catch (e) { if (e.name === 'AuthError') throw e; } }
  let meta = ham ? G.satirlardanKV(ham._meta) : await db.kv('_meta');
  if (pendingMigrations(Number(meta.sema || 0)).length) {
    const ilk = Number(meta.sema || 0) > 0;
    await runMigrations(db, Number(meta.sema || 0));
    ham = null;
    if (ilk) toast('🛠️ Tablon yeni özellikler için güncellendi (verilerine dokunulmadı)');
  }
  if (!ham) { ham = await db.okuHepsi(OKUNAN); meta = G.satirlardanKV(ham._meta); }
  const tablolar = {}; SEKMELER.forEach(t => { tablolar[t] = G.satirlardanTablo(ham[t]); });
  veriKoy({ meta, ayar: G.satirlardanKV(ham.Ayarlar), persona: G.satirlardanKV(ham.Persona), tablolar });
  try { localStorage.setItem(semaAnahtar, String(S.sema)); } catch { /* yok say */ }
  if (!S.ayar.baslangic) { await db.setKV('Ayarlar', { baslangic: today() }); S.ayar.baslangic = today(); }
  onbellekYaz();
}
S.yukle = yukle;

// Uygulamanın açılabilmesi için kurulum adımları tamam mı?
const kurulumTamam = () => (AI.getKey() || S.meta.gemini_atlandi === '1') && (S.ayar.hedef_ne || S.meta.hedef_atlandi === '1') && (karakterler().length || localStorage.getItem('ds_anket_sonra') === '1');
async function baglandi() {
  // Hız: son açılıştaki veriler bu cihazda durur; uygulama onlarla anında açılır, taze veri arkadan gelip sayfayı günceller
  const ob = isDemo() ? null : onbellekOku(S.db.id);
  let acik = false;
  if (ob) {
    try {
      veriKoy({ meta: ob.meta || {}, ayar: ob.ayar || {}, persona: ob.persona || {}, tablolar: Object.fromEntries(SEKMELER.map(t => [t, ob[TABLOLAR[t]] || []])) });
      if (kurulumTamam()) { go('ozet'); acik = true; }
    } catch { acik = false; }
  }
  if (!acik) app().innerHTML = '<div class="yukleniyor">Borsa açılıyor… 🔔</div>';
  S.tazeBekle = yukle();
  try { await S.tazeBekle; }
  catch (e) {
    if (!acik || e?.name === 'AuthError') return guard(async () => { throw e; });
    toast('⚠️ Güncel veriler alınamadı, son kaydedilenler gösteriliyor: ' + esc(e.message || e), 6000);
    return;
  } finally { S.tazeBekle = null; }
  if (acik) S.yenile();
  else {
    if (!AI.getKey() && S.meta.gemini_atlandi !== '1') return wizard('gemini');
    if (!S.ayar.hedef_ne && S.meta.hedef_atlandi !== '1') return wizard('hedef');
    if (!karakterler().length && localStorage.getItem('ds_anket_sonra') !== '1') return startSurvey();
    go('ozet');
  }
  setTimeout(otomatikYedek, 4000);
  S.ayarP?.then(() => { if (S.sunucuSurum && S.sunucuSurum !== CONFIG.APP_VERSION) setTimeout(() => toast(`⬆️ Yeni sürüm hazır (${esc(S.sunucuSurum)}). Ayarlar → Uygulamayı güncelle`, 7000), 1500); });
}

// ---------- Üst çubuk: bakiye gizle, para birimi ----------
const GOZ_ACIK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const GOZ_KAPALI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
function ustAraclar() {
  const g = $('#btnGizle'), p = $('#btnPara');
  const ciz = () => { g.innerHTML = gizli() ? GOZ_KAPALI : GOZ_ACIK; g.classList.toggle('on', gizli()); g.setAttribute('aria-label', gizli() ? 'Tutarları göster' : 'Tutarları gizle'); p.textContent = gosterSimge(); };
  g.onclick = () => { lsSet('ds_gizli', !gizli()); ciz(); S.yenile(); };
  p.onclick = () => {
    const ana = paraKod(), sira = [ana, ...['TRY', 'EUR', 'USD'].filter(k => k !== ana && S.kurlar[k] > 0)];
    if (sira.length < 2) return toast('Kurlar henüz gelmedi, birazdan tekrar dene');
    const yeni = sira[(sira.indexOf(gosterKod()) + 1) % sira.length];
    lsSet('ds_gosterPara', yeni); ciz(); S.yenile();
  };
  S.ustCiz = ciz; ciz();
}

// ---------- Gezinme ----------
const SAYFALAR = { ozet: renderOzet, gelirgider: renderGelirGider, varliklar: renderVarliklar, borclar: renderBorclar, hedef: renderHedef, dude: renderDude, persona: renderPersona, ayarlar: renderAyarlar };
function go(view) {
  if (!S.db) return;
  if (!SAYFALAR[view]) view = 'ozet';
  gecmisBaslat();
  const ayni = S.view === view;
  S.view = view;
  chrome('ana');
  SAYFALAR[view]();
  bantCiz();
  if (!ayni) window.scrollTo(0, 0);
  if (['ozet', 'varliklar', 'hedef'].includes(view) && !S.fiyat.zaman && !S.fiyatBekliyor) fiyatYenile();
}
S.go = go;
S.sayfaVar = v => !!SAYFALAR[v];
S.wizard = a => wizard(a);
S.yenile = () => { if (S.db && SAYFALAR[S.view] && !$$('.modal').length && !$('.notlar-ov')) { const y = scrollY; SAYFALAR[S.view](); bantCiz(); scrollTo(0, y); } else bantCiz(); };
S.yenidenBaglan = () => renderReconnect();
S.bant = () => bantCiz();

// ---------- Fiyatlar ----------
async function fiyatYenile(sessiz = true) {
  S.fiyatBekliyor = true;
  try { await fiyatlariGetir(sessiz); } finally { S.fiyatBekliyor = false; }
}
S.fiyatYenile = fiyatYenile;
S.fiyatGeldi = () => { S.yenile(); S.ustCiz?.(); gecmisYaz(); };
setInterval(() => { if (document.visibilityState === 'visible' && S.db && ['ozet', 'varliklar', 'hedef'].includes(S.view)) fiyatYenile(); }, 90_000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.db && S.fiyat.zaman && Date.now() - Date.parse(S.fiyat.zaman) > 60_000) fiyatYenile(); });

// ---------- Borsa bandı ----------
function bantCiz() {
  if (!S.db) return;
  const m = malVarligi(), h = hedefHesap(), ay = ayHesap(buAy()), renk = n => (n >= 0 ? 'artı' : 'eksi');
  const p = [];
  p.push(`<span>NET <b class="altin">${money(m.net, 0)}</b></span>`);
  if (m.gunluk) p.push(`<span>BUGÜN <b class="${renk(m.gunluk)}">${m.gunluk >= 0 ? '+' : '−'}${money(Math.abs(m.gunluk))}</b></span>`);
  if (ay.gelir || ay.gider) p.push(`<span>AY SONU <b class="${renk(ay.kalan)}">${ay.kalan >= 0 ? '+' : '−'}${money(Math.abs(ay.kalan), 0)}</b></span>`);
  if (h.var && h.hedef) p.push(`<span>HEDEF <b class="altin">%${fmt(h.ilerleme * 100, 1)}</b></span>`);
  m.v.filter(x => x.canli && x.p['Tür'] !== 'MBKAYO payı').slice(0, 12).forEach(x => p.push(`<span>${esc(kisaSembol(x.p))} <b class="${renk(x.gunluk)}">${fiyatFmt(x.fiyat)} ${yuzde(x.gunluk, 2)}</b></span>`));
  const mbk = m.v.find(x => x.p['Tür'] === 'MBKAYO payı' && x.canli); if (mbk) p.push(`<span>MBKAYO <b class="altin">${money(mbk.deger, 0)}</b></span>`);
  if (h.harcamaBuAy) p.push(`<span>KAÇAMAK <b class="eksi">▼ ${money(h.harcamaBuAy)}</b></span>`);
  borclar().filter(x => x.borc > 0 && x.kalanGun !== null && x.kalanGun <= 7).forEach(x => p.push(`<span>💳 ${esc(x.b['Ad'])} <b class="eksi">${x.kalanGun === 0 ? 'BUGÜN' : x.kalanGun + ' GÜN'}</b></span>`));
  const sinyal = !h.min ? (ay.kalan >= 0 ? ['TUT', 'altin'] : ['DİKKAT', 'eksi']) : h.buAy >= h.min ? ['GÜÇLÜ AL', 'artı'] : h.buAy > 0 ? ['TUT', 'altin'] : ['DİKKAT', 'eksi'];
  p.push(`<span>DUDE <b class="${sinyal[1]}">● ${sinyal[0]}</b></span>`);
  const html = p.join('');
  $('#bantIc').innerHTML = html + html;
}

// ---------- Kurulum sihirbazı ----------
async function wizard(adim) {
  S.view = 'sihirbaz';
  chrome('sihirbaz');
  window.scrollTo(0, 0);
  if (adim === 'hosgeldin') {
    app().innerHTML = `
      <div class="giris-logo">
        <div class="wordmark buyuk" role="img" aria-label="Dudestreet"></div>
        <div class="est">Est. 2026 · Dudes Exchange</div>
        <p>Kendi Wall Street’in. Tüm mal varlığın, gelir-giderin, borçların ve hedefin tek yerde; gelecekteki sen de yanında.</p>
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
    const hazir = !!CONFIG.GOOGLE_CLIENT_ID;
    app().innerHTML = `${adimCubugu('google', true)}
      ${baslik('Adım 1 · Hesap', 'Google hesabınla bağlan', 'Dudestreet verilerini senin Drive’ında, sana ait bir tabloda tutar.')}
      <div class="kart">
        <div class="satir">${ikon('goz', 'var(--acik)')}<b>Dudestreet neyi görebilir?</b></div>
        <div class="satir kucuk soluk2">${ikon('tik', 'var(--artı)', 18)}<span>Sadece kendi oluşturduğu "${CONFIG.TABLO_ADI}" dosyasını</span></div>
        <div class="satir kucuk soluk2">${ikon('tik', 'var(--artı)', 18)}<span>E-posta adresini (hangi hesapla girdiğini göstermek için)</span></div>
        <div class="satir kucuk soluk2">${ikon('carpi', 'var(--eksi)', 18)}<span>Drive’ındaki diğer dosyalarını göremez</span></div>
      </div>
      ${hazir ? '' : '<div class="uyari">Google girişi henüz kurulmadı. Şimdilik demo modunda deneyebilirsin.</div>'}
      <div class="doldur"></div>
      <button class="blok buyuk google-btn" id="gGiris" ${hazir ? '' : 'disabled'}><span class="g-harf">G</span>Google ile bağlan</button>
      ${hazir ? '' : '<button class="blok ikinci" id="demo">Demo modunda dene</button>'}
      <p class="ortala mini" style="margin:0">Bağlantıyı istediğin an Google hesap ayarlarından kaldırabilirsin.</p>`;
    $('#geri').onclick = () => wizard('hosgeldin');
    $('#gGiris').onclick = () => G.login();
    if ($('#demo')) $('#demo').onclick = demoBasla;
    return;
  }
  if (adim === 'tablo') {
    app().innerHTML = `${adimCubugu('tablo')}${baslik('Adım 2 · Tablo', 'Tablonu seç', 'Drive’ında Dudestreet tablon aranıyor…')}`;
    await guard(async () => {
      const files = await G.findAppSheets();
      app().innerHTML = `${adimCubugu('tablo')}
        ${baslik('Adım 2 · Tablo', files.length ? 'Tablonu seç' : 'Tablonu oluşturalım', files.length ? 'Daha önce kurmuşsun; kaldığın yerden devam et.' : 'Drive’ında senin için yeni bir tablo açalım. Bütün verin orada duracak.')}
        ${files.map((f, i) => `<button class="blok kart tablo-sec ${i === 0 ? 'vurgu' : ''}" data-kullan="${f.id}"><span class="kayit-ik">${ikon('tablo', 'var(--artı)')}</span><span class="bosluk"><b>${esc(f.name)}</b><div class="mini">Son değişiklik ${new Date(f.modifiedTime).toLocaleString('tr-TR')}</div></span></button>`).join('')}
        ${files.length ? '<div class="ayrac mini">ya da</div>' : ''}
        <button class="blok ${files.length ? 'ikinci' : 'buyuk'}" id="olustur">${files.length ? 'Yeni tablo oluştur' : 'Tablomu oluştur'}</button>
        <div class="doldur"></div>
        <div class="kart satir kucuk" style="align-items:flex-start">${ikon('kilit', 'var(--altin)', 20)}<span class="soluk2">Tablo senin. İstediğin zaman Google Sheets’te açıp bakabilir, indirebilir ya da silebilirsin.</span></div>`;
      $$('[data-kullan]').forEach(b => b.onclick = () => { G.setSheetId(b.dataset.kullan); S.db = new G.SheetDB(b.dataset.kullan); baglandi(); });
      $('#olustur').onclick = () => guard(async () => {
        const btn = $('#olustur'), eski = btn.textContent;
        btn.disabled = true; btn.textContent = 'Oluşturuluyor…';
        setTimeout(() => { if (btn.isConnected) { btn.disabled = false; btn.textContent = eski; } }, 30000);
        const db = await G.SheetDB.create(CONFIG.TABLO_ADI);
        await runMigrations(db, 0);
        await db.setKV('_meta', { uygulama: 'Dudestreet', olusturma: new Date().toISOString() });
        G.setSheetId(db.id);
        S.db = db;
        toast('✅ Tablon Drive’ında açıldı. Borsa senin 🔔');
        baglandi();
      });
    });
    return;
  }
  if (adim === 'gemini') {
    const kurulum = !S.persona?.prompt && !S.view?.startsWith?.('ayar');
    app().innerHTML = `${adimCubugu('gemini')}
      ${baslik('Adım 3 · Yapay zekâ', 'Gemini’yi bağla', 'Future Dude ve akıllı notlar kendi ücretsiz Gemini anahtarınla çalışır. Kotası da senin.')}
      <div class="kart">
        <div class="numara"><i>1</i><span>AI Studio’yu aç (Google hesabınla zaten girişlisin)</span></div>
        <div class="numara"><i>2</i><span><b>Create API key</b> düğmesine bas, anahtarı kopyala</span></div>
        <div class="numara"><i>3</i><span>Buraya yapıştır ve bağla</span></div>
        <a class="btn ikinci blok" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">${ic('dis', 18)}AI Studio’yu aç</a>
      </div>
      <div><label class="etiket" for="anahtar">Gemini API anahtarın</label>
      <input id="anahtar" type="password" placeholder="AIza…" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
      ${isDemo() ? '' : '<label class="onay"><input type="checkbox" id="tabloya" checked><span>Anahtarımı kendi tabloma da kaydet (yeni telefonda tekrar girmeyeyim)</span></label>'}
      <div class="doldur"></div>
      <button class="blok buyuk" id="baglan">Test et ve bağla</button>
      <button class="blok hayalet" id="gec">${kurulum ? 'Şimdilik geç' : 'Vazgeç'}</button>`;
    void kurulum;
    $('#baglan').onclick = () => geminiBagla($('#anahtar').value.trim(), $('#tabloya')?.checked ?? false);
    $('#anahtar').onkeydown = e => { if (e.key === 'Enter') $('#baglan').click(); };
    $('#gec').onclick = () => guard(async () => { if (!AI.getKey()) { await S.db.setKV('_meta', { gemini_atlandi: '1' }); S.meta.gemini_atlandi = '1'; } baglandi(); });
    return;
  }
  if (adim === 'hedef') {
    app().innerHTML = `${adimCubugu('hedef')}${hedefFormHTML(baslik('Adım 4 · Hedef', 'Neye biriktiriyorsun?', 'Aylık birikim hedefi koymak istersen buradan. Hepsini sonra Hedef sekmesinden değiştirebilirsin.'))}
      <div class="doldur"></div><button class="blok buyuk" id="hKaydet">Devam</button><button class="blok hayalet" id="hGec">Şimdilik hedef koymayacağım</button>`;
    const kaydet = hedefFormBagla(app(), { bitti: () => baglandi() });
    $('#hKaydet').onclick = () => guard(async () => { $('#hKaydet').disabled = true; try { await kaydet(); } finally { if ($('#hKaydet')) $('#hKaydet').disabled = false; } });
    $('#hGec').onclick = () => guard(async () => { await S.db.setKV('_meta', { hedef_atlandi: '1' }); S.meta.hedef_atlandi = '1'; baglandi(); });
  }
}

async function demoBasla() {
  localStorage.setItem('ds_demo', '1');
  S.db = LocalDB.exists() ? new LocalDB() : await demoKur();
  baglandi();
}

async function geminiBagla(key, toSheet) {
  if (!key) return toast('Önce anahtarı yapıştır');
  const btn = $('#baglan');
  if (btn) { btn.disabled = true; btn.textContent = 'Test ediliyor…'; }
  try {
    const model = await AI.testKey(key);
    AI.setKey(key); AI.setModel(model);
    await guard(() => S.db.setKV('_meta', toSheet ? { gemini_key: key, gemini_model: model, gemini_atlandi: '0' } : { gemini_key: '', gemini_model: model, gemini_atlandi: '0' }));
    S.meta.gemini_key = toSheet ? key : '';
    toast(`✅ Future Dude’un beyni bağlandı (${esc(model.replace('models/', ''))})`);
    baglandi();
  } catch (e) {
    toast('❌ Anahtar çalışmadı: ' + esc(e.message), 6000);
    if (btn) { btn.disabled = false; btn.textContent = 'Test et ve bağla'; }
  }
}

function renderReconnect() {
  chrome('sihirbaz');
  app().innerHTML = `<div class="doldur"></div><div class="ortala"><div class="wordmark orta" role="img" aria-label="Dudestreet"></div></div>
    ${baslik('Oturum', 'Borsa kısa bir mola verdi', 'Güvenlik için Google bağlantısı belli aralıklarla yenilenir. Verilerin yerinde, tek dokunuşla devam edersin.')}
    <div class="doldur"></div><button class="blok buyuk" id="tekrar">Tekrar bağlan</button>`;
  $('#tekrar').onclick = () => G.login();
}

// ---------- Ayarlar ----------
function renderAyarlar() {
  const tema = aktifTema(), keyInSheet = !!S.meta.gemini_key;
  app().innerHTML = `
    <div class="kart">
      <div class="satir"><h3 class="bosluk">${ic('palet')} Tema</h3></div>
      <div class="tema-izgara">${TEMALAR.map(t => `<button type="button" class="tema-sec ${t.id === tema ? 'on' : ''}" data-tema="${t.id}" aria-pressed="${t.id === tema}">
        <span class="tema-ornek" style="background:${t.renk[0]}"><i style="background:${t.renk[1]}"></i><i style="background:${t.renk[2]}"></i></span>
        <b>${esc(t.ad)}</b><span class="mini">${esc(t.alt)}</span></button>`).join('')}</div>
    </div>
    <div class="kart">
      <div class="satir"><h3 class="bosluk">🎯 Hedef</h3><button class="ikinci kucuk-btn" id="hDuz">${S.ayar.hedef_ne ? 'Düzenle' : 'Hedef koy'}</button></div>
      <p class="mini" style="margin:0">${S.ayar.hedef_ne ? `${esc(S.ayar.hedef_ne)}${num(S.ayar.hedef_tutar) ? ' · ' + money(num(S.ayar.hedef_tutar)) : ''}${num(S.ayar.aylik_min) ? ' · ayda en az ' + money(num(S.ayar.aylik_min)) : ''}` : 'Hedef koymadın.'} · Para birimi ${esc(S.ayar.para_birimi || '₺')}</p>
    </div>
    <div class="kart">
      <h3>🤖 Yapay zekâ</h3>
      ${AI.getKey() ? `<p class="mini">Gemini bağlı ✅ · ${esc((AI.getModel() || '').replace('models/', ''))} · anahtar …${esc(AI.getKey().slice(-4))}</p>
        ${isDemo() ? '' : `<label class="onay"><input type="checkbox" id="kis" ${keyInSheet ? 'checked' : ''}><span>Anahtarım kendi tablomda da saklansın</span></label>`}
        <div class="satir"><button class="ikinci bosluk" id="kisilik">🎭 Karakterler</button><button class="ikinci bosluk" id="degis">Anahtarı değiştir</button><button class="tehlike" id="kaldir">Kaldır</button></div>`
        : '<p class="mini">Gemini bağlı değil. Future Dude ve notlardaki akıllı ayırma için gerekli.</p><button class="blok" id="degis">🔑 Gemini’yi bağla</button>'}
    </div>
    <div class="kart">
      <h3>☁️ Verilerin</h3>
      ${isDemo() ? '<p class="mini">Demo modu: veriler sadece bu tarayıcıda. Gerçek kullanım için demodan çıkıp Google ile bağlan.</p>' : `
      <p class="mini">Hesap: <b>${esc(G.userEmail())}</b><br>Tüm verilerin kendi Drive’ındaki tabloda. Dudestreet hiçbir sunucuda veri tutmaz.</p>
      <a class="btn ikinci blok" href="${G.sheetUrl(S.db.id)}" target="_blank" rel="noopener">📄 Tablomu Google Sheets’te aç</a>
      ${S.meta.son_yedek ? `<p class="mini">Son yedek: ${new Date(S.meta.son_yedek_tarih).toLocaleString('tr-TR')}</p>` : ''}`}
      <button class="ikinci blok" id="yedekler">🛟 Yedekler ve geri yükleme</button>
      <button class="ikinci blok" id="gunlukAc">🧾 Değişiklik günlüğü</button>
    </div>
    <div class="kart">
      <h3>⬆️ Uygulama</h3>
      <p class="mini">Sürüm ${CONFIG.APP_VERSION} · tablo sürümü ${S.sema}${S.sunucuSurum && S.sunucuSurum !== CONFIG.APP_VERSION ? ` · <b class="altin">yeni sürüm hazır: ${esc(S.sunucuSurum)}</b>` : ''}</p>
      <button class="${S.sunucuSurum && S.sunucuSurum !== CONFIG.APP_VERSION ? '' : 'ikinci '}blok" id="guncelle">Uygulamayı güncelle</button>
      <p class="mini" style="margin:0">Telefonda eski sürüm takılı kaldıysa buna bas; verilerine dokunmaz.</p>
    </div>
    <div class="kart">
      <h3>📲 Telefona kur</h3>
      <p class="mini" style="margin:0">iPhone: Safari’de Paylaş → <b>Ana Ekrana Ekle</b>. Android: Chrome menüsü → <b>Uygulamayı yükle</b>. Uygulama gibi açılır.</p>
    </div>
    <button class="tehlike blok" id="cikis">${isDemo() ? 'Demodan çık (demo verileri silinir)' : 'Bu cihazda bağlantıyı kes'}</button>
    ${isDemo() ? '' : '<p class="mini ortala" style="margin:0">Bağlantıyı kesmek tablonu silmez; tekrar Google ile girince kaldığın yerden devam edersin.</p>'}`;
  $$('.tema-sec').forEach(b => b.onclick = () => { const t = temaUygula(b.dataset.tema); renderAyarlar(); });
  $('#hDuz').onclick = hedefDuzenle;
  if ($('#kisilik')) $('#kisilik').onclick = () => go('persona');
  $('#degis').onclick = () => wizard('gemini');
  if ($('#kaldir')) $('#kaldir').onclick = () => guard(async () => { AI.setKey(''); AI.setModel(''); await S.db.setKV('_meta', { gemini_key: '', gemini_atlandi: '1' }); S.meta.gemini_key = ''; S.meta.gemini_atlandi = '1'; toast('Anahtar kaldırıldı'); renderAyarlar(); });
  if ($('#kis')) $('#kis').onchange = e => guard(async () => { await S.db.setKV('_meta', { gemini_key: e.target.checked ? AI.getKey() : '' }); S.meta.gemini_key = e.target.checked ? AI.getKey() : ''; toast(e.target.checked ? 'Anahtar tablona kaydedildi' : 'Anahtar tablondan silindi (sadece bu cihazda)'); });
  $('#yedekler').onclick = yedekPenceresi;
  $('#gunlukAc').onclick = gunlukPenceresi;
  $('#guncelle').onclick = zorlaGuncelle;
  $('#cikis').onclick = () => {
    notFlush();
    if (isDemo()) { LocalDB.wipe(); localStorage.removeItem('ds_demo'); } else G.logout();
    onbellekSil();
    ['ds_gemini_key', 'ds_gemini_model', 'ds_anket_taslak', 'ds_anket_sonra', 'ds_plan', 'ds_notBekle', 'ds_sonNot', 'ds_katBekle', 'ds_gizli', 'ds_gosterPara', 'ds_demo_yedekler', 'ds_fiyatOnbellek'].forEach(k => localStorage.removeItem(k));
    Object.keys(localStorage).filter(k => k.startsWith('ds_sema_')).forEach(k => localStorage.removeItem(k));
    location.reload();
  };
}

// ---------- Demo verisi ----------
async function demoKur() {
  const db = await LocalDB.create();
  await runMigrations(db, 0);
  await db.setKV('_meta', { uygulama: 'Dudestreet', olusturma: new Date().toISOString() });
  const d = new Date(), bu = buAy(), ym = n => ymAdd(bu, n), gun = (n, g) => `${ym(n)}-${String(g).padStart(2, '0')}`;
  const bas = ym(-5);
  await db.setKV('Ayarlar', { hedef_ne: 'Ev', hedef_tur: 'ev', hedef_tutar: '2500000', aylik_min: '10000', para_birimi: '₺', hedef_tarih: `${d.getFullYear() + 3}-06`, aylik_gelir: '65000', baslangic: bas + '-01' });
  const kayit = [], gelir = [], gider = [], onay = [];
  for (let i = -5; i <= 0; i++) {
    gelir.push({ Kimlik: uid(), Tarih: gun(i, 1), Tutar: '65000', Not: 'Maaş' });
    kayit.push({ Kimlik: uid(), Tarih: gun(i, 2), 'Tür': 'Birikim', Tutar: String(i === -2 ? 6000 : 12000 + (i + 5) * 500), Kategori: 'Birikim', Not: 'Maaş günü' });
    if (i < 0) ['Kira', 'Elektrik', 'İnternet', 'Netflix'].forEach(k => onay.push({ Ay: ym(i), Kalem: k, Tarih: gun(i, 5) }));
    gider.push({ Kimlik: uid(), Tarih: gun(i, 9), Kalem: 'Market', Kategori: 'Yeme-içme', Tutar: String(6500 + (i % 2) * 900), Birikimden: '', Not: '', 'İkon': '🍽️' });
    if (i === -2) { const k = uid(); gider.push({ Kimlik: k, Tarih: gun(i, 19), Kalem: 'Festival bileti', Kategori: 'Eğlence', Tutar: '4500', Birikimden: 'evet', Not: '', 'İkon': '🎉' }); kayit.push({ Kimlik: uid(), Tarih: gun(i, 19), 'Tür': 'Harcama', Tutar: '4500', Kategori: 'Eğlence', Not: 'Festival bileti', 'Bağ': k }); }
    if (i === -1) gider.push({ Kimlik: uid(), Tarih: gun(i, 14), Kalem: 'Mont', Kategori: 'Alışveriş', Tutar: '3200', Birikimden: '', Not: '', 'İkon': '🛍️' });
  }
  onay.push({ Ay: bu, Kalem: 'Kira', Tarih: today() });
  await db.appendObjs('Gelir', gelir); await db.appendObjs('Giderler', gider); await db.appendObjs('Onay', onay);
  await db.appendObjs('Bütçe', [['Kira', 'Kira', 18000, ''], ['Elektrik', 'Fatura', 900, '💡'], ['İnternet', 'Fatura', 450, '🌐'], ['Netflix', 'Abonelik', 230, '📺']].map(([Kalem, Kategori, Tutar, ik]) => ({ Ay: bas, Kalem, Kategori, Tutar: String(Tutar), 'İkon': ik })));
  const t4 = gun(-4, 8);
  const pf = [
    { 'Tür': 'Hisse', Sembol: 'THYAO.IS', Ad: 'Türk Hava Yolları', Adet: '40', Maliyet: '290', Hedef: '' },
    { 'Tür': 'Kripto', Sembol: 'BTC', Ad: 'Bitcoin', Adet: '0.004', Maliyet: '2900000', Hedef: '' },
    { 'Tür': 'Altın (gram)', Sembol: 'ALTIN', Ad: 'Gram altın', Adet: '10', Maliyet: '5200', Hedef: 'evet' },
    { 'Tür': 'Nakit / Banka', Sembol: 'VADESİZ', Ad: 'Banka hesabı', Adet: '1', Maliyet: '42000', Hedef: '' },
    { 'Tür': 'Araba', Sembol: 'COROLLA', Ad: '2019 Corolla', Adet: '1', Maliyet: '1100000', 'Yıllık artış': '16', Hedef: '' },
  ];
  for (const p of pf) {
    await db.appendObj('Portföy', { Kimlik: uid(), ...p, Tarih: t4, Not: '' });
    kayit.push({ Kimlik: uid(), Tarih: t4, 'Tür': ['Hisse', 'Kripto', 'Altın (gram)'].includes(p['Tür']) ? 'Varlık alımı' : 'Varlık girişi', Tutar: String(num(p.Adet) * num(p.Maliyet)), Kategori: p.Sembol, Not: `${p.Ad} eklendi` });
  }
  kayit.push({ Kimlik: uid(), Tarih: gun(-5, 1), 'Tür': 'Birikim', Tutar: '120000', Kategori: 'Birikim', Not: 'Başlangıç birikimi' });
  await db.appendObjs('Kayıtlar', kayit);
  await db.appendObjs('Borçlar', [
    { Kimlik: uid(), 'Tür': 'Kredi kartı', Ad: 'Bonus', Banka: 'Garanti', Limit: '60000', Borç: '14250', Asgari: '5700', Kesim: String(Math.max(1, d.getDate() - 8)), 'Son ödeme': String(Math.min(28, d.getDate() + 2)), Not: '' },
    { Kimlik: uid(), 'Tür': 'Kredi kartı', Ad: 'Axess', Banka: 'Akbank', Limit: '35000', Borç: '3100', Asgari: '1240', Kesim: '20', 'Son ödeme': '30', Not: '' },
  ]);
  // 75 günlük örnek geçmiş (grafik için)
  const gecmis = []; let deger = 1290000, nakit = 150000;
  for (let i = 75; i >= 1; i--) {
    const t = new Date(d); t.setDate(t.getDate() - i); deger *= 1 + (Math.sin(i / 6) * 0.004 + 0.0012); if (i % 30 === 0) nakit += 12000;
    gecmis.push({ Tarih: t.toISOString().slice(0, 10), Nakit: String(Math.round(nakit)), 'Varlık': String(Math.round(deger)), 'Borç': '17350', Toplam: String(Math.round(deger + nakit - 17350)) });
  }
  await db.appendObjs('Geçmiş', gecmis);
  await db.appendObj('Notlar', { Kimlik: 'n' + uid(), Metin: 'Bu ayın planı\nMarket 1.500\nBayram hediyesi 2.000\nÖzel ders akşam 16:30', 'Güncelleme': new Date().toISOString(), Sabit: '' });
  return db;
}

boot();
