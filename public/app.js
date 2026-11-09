// Dudestreet — kendi Wall Street'in.
// Veri kullanıcının kendi Google Sheet'inde, yapay zekâ (Future Dude) kullanıcının kendi Gemini anahtarıyla.
// Sunucu sadece piyasa fiyatlarını getirir; hiçbir kullanıcı verisi tutmaz.
import { CONFIG, S, $, $$, esc, num, money, fmt, today, buAy, ymAdd, uid, isDemo, toast, sheet, modal, onayKutusu, guard, ikon, pick, lsGet, lsSet, yuzde, fiyatFmt } from './core.js';
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
import { notlarAc, notFlush } from './notlar.js';

const app = () => $('#app');
const ic = (k, s = 18) => ikon(k, 'currentColor', s);

// ---------- Açılış ----------
async function boot() {
  temaUygula(aktifTema());
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  $$('#sekmeler button, .ust-btn').forEach(b => b.onclick = () => b.dataset.view === 'notlar' ? notlarAc() : go(b.dataset.view));
  try { const r = await fetch('/api/ayar', { cache: 'no-store' }); if (r.ok) CONFIG.GOOGLE_CLIENT_ID = (await r.json()).googleClientId || ''; } catch { /* çevrimdışı */ }
  const r = G.handleRedirect();
  if (r.error && !['interaction_required', 'login_required', 'consent_required'].includes(r.error)) toast('Google girişi tamamlanmadı: ' + esc(r.error));
  if (isDemo()) { S.db = LocalDB.exists() ? new LocalDB() : await demoKur(); return baglandi(); }
  if (!G.getToken()) {
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

// Tüm sekmeleri okur; tablo eskiyse (yeni sekmeler eklendiyse) önce sessizce günceller (sadece ekleme yapar, veri silmez)
async function yukle() {
  const db = S.db;
  S.meta = await db.kv('_meta');
  S.sema = Number(S.meta.sema || 0);
  if (pendingMigrations(S.sema).length) {
    const ilk = S.sema > 0;
    await runMigrations(db, S.sema);
    S.meta = await db.kv('_meta'); S.sema = Number(S.meta.sema || 0);
    if (ilk) toast('🛠️ Tablon yeni özellikler için güncellendi (verilerine dokunulmadı)');
  }
  const SEKMELER = ['Kayıtlar', 'Portföy', 'Hafıza', 'Gelir', 'Giderler', 'Bütçe', 'Onay', 'Kategori', 'Notlar', 'Borçlar', 'Borç hareketleri', 'Geçmiş'];
  const [ayar, persona, ...tablolar] = await Promise.all([db.kv('Ayarlar'), db.kv('Persona'), ...SEKMELER.map(t => db.table(t))]);
  const ALAN = { 'Kayıtlar': 'kayitlar', 'Portföy': 'portfoy', 'Hafıza': 'hafiza', 'Gelir': 'gelir', 'Giderler': 'giderler', 'Bütçe': 'butce', 'Onay': 'onay', 'Kategori': 'kategori', 'Notlar': 'notlar', 'Borçlar': 'borclar', 'Borç hareketleri': 'borcHareket', 'Geçmiş': 'gecmis' };
  SEKMELER.forEach((t, i) => { S[ALAN[t]] = tablolar[i]; });
  S.portfoy = S.portfoy.filter(p => num(p['Adet']) > 0);
  S.ayar = ayar;
  if (!S.ayar.baslangic) { await db.setKV('Ayarlar', { baslangic: today() }); S.ayar.baslangic = today(); }
  S.persona = persona;
  try { S.persona.cevapObj = persona.cevaplar ? JSON.parse(persona.cevaplar) : null; } catch { S.persona.cevapObj = null; }
  if (!AI.getKey() && S.meta.gemini_key) AI.setKey(S.meta.gemini_key);
  if (!AI.getModel() && S.meta.gemini_model) AI.setModel(S.meta.gemini_model);
}
S.yukle = yukle;

async function baglandi() {
  await guard(async () => {
    app().innerHTML = '<div class="yukleniyor">Borsa açılıyor… 🔔</div>';
    await yukle();
    if (!AI.getKey() && S.meta.gemini_atlandi !== '1') return wizard('gemini');
    if (!S.ayar.hedef_ne && S.meta.hedef_atlandi !== '1') return wizard('hedef');
    if (!S.persona.prompt && localStorage.getItem('ds_anket_sonra') !== '1') return startSurvey();
    go('ozet');
  });
}

// ---------- Gezinme ----------
const SAYFALAR = { ozet: renderOzet, gelirgider: renderGelirGider, varliklar: renderVarliklar, borclar: renderBorclar, hedef: renderHedef, dude: renderDude, persona: renderPersona, ayarlar: renderAyarlar };
function go(view) {
  if (!S.db) return;
  if (!SAYFALAR[view]) view = 'ozet';
  const ayni = S.view === view;
  S.view = view;
  chrome('ana');
  SAYFALAR[view]();
  bantCiz();
  if (!ayni) window.scrollTo(0, 0);
  if (['ozet', 'varliklar', 'hedef'].includes(view) && !S.fiyat.zaman && !S.fiyatBekliyor) fiyatYenile();
}
S.go = go;
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
S.fiyatGeldi = () => { S.yenile(); gecmisYaz(); };
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
        <img src="img/logo.svg" alt="" width="132" height="106">
        <div class="isim gotik">Dudestreet</div>
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
  app().innerHTML = `<div class="doldur"></div><div class="ortala"><img src="img/logo.svg" alt="" width="90" height="72"></div>
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
      <h3>🤖 Future Dude</h3>
      ${AI.getKey() ? `<p class="mini">Gemini bağlı ✅ · ${esc((AI.getModel() || '').replace('models/', ''))} · anahtar …${esc(AI.getKey().slice(-4))}</p>
        ${isDemo() ? '' : `<label class="onay"><input type="checkbox" id="kis" ${keyInSheet ? 'checked' : ''}><span>Anahtarım kendi tablomda da saklansın</span></label>`}
        <div class="satir"><button class="ikinci bosluk" id="kisilik">🧬 Kişilik</button><button class="ikinci bosluk" id="degis">Anahtarı değiştir</button><button class="tehlike" id="kaldir">Kaldır</button></div>`
        : '<p class="mini">Gemini bağlı değil. Future Dude ve notlardaki akıllı ayırma için gerekli.</p><button class="blok" id="degis">🔑 Gemini’yi bağla</button>'}
    </div>
    <div class="kart">
      <h3>☁️ Verilerin</h3>
      ${isDemo() ? '<p class="mini">Demo modu: veriler sadece bu tarayıcıda. Gerçek kullanım için demodan çıkıp Google ile bağlan.</p>' : `
      <p class="mini">Hesap: <b>${esc(G.userEmail())}</b><br>Tüm verilerin kendi Drive’ındaki tabloda. Dudestreet hiçbir sunucuda veri tutmaz.</p>
      <a class="btn ikinci blok" href="${G.sheetUrl(S.db.id)}" target="_blank" rel="noopener">📄 Tablomu Google Sheets’te aç</a>
      <button class="ikinci blok" id="yedekAl">🗂️ Şimdi yedek al</button>
      ${S.meta.son_yedek ? `<p class="mini">Son yedek: <a href="${G.sheetUrl(S.meta.son_yedek)}" target="_blank" rel="noopener">${new Date(S.meta.son_yedek_tarih).toLocaleString('tr-TR')}</a></p>` : ''}`}
      <p class="mini">Tablo sürümü ${S.sema} · uygulama ${CONFIG.APP_VERSION}</p>
    </div>
    <div class="kart">
      <h3>📲 Telefona kur</h3>
      <p class="mini" style="margin:0">iPhone: Safari’de Paylaş → <b>Ana Ekrana Ekle</b>. Android: Chrome menüsü → <b>Uygulamayı yükle</b>. Uygulama gibi açılır.</p>
    </div>
    <button class="tehlike blok" id="cikis">${isDemo() ? 'Demodan çık (demo verileri silinir)' : 'Bu cihazda bağlantıyı kes'}</button>
    ${isDemo() ? '' : '<p class="mini ortala" style="margin:0">Bağlantıyı kesmek tablonu silmez; tekrar Google ile girince kaldığın yerden devam edersin.</p>'}`;
  $$('.tema-sec').forEach(b => b.onclick = () => { const t = temaUygula(b.dataset.tema); renderAyarlar(); toast(`🎨 ${esc(t.ad)} teması`); });
  $('#hDuz').onclick = hedefDuzenle;
  if ($('#kisilik')) $('#kisilik').onclick = () => go('persona');
  $('#degis').onclick = () => wizard('gemini');
  if ($('#kaldir')) $('#kaldir').onclick = () => guard(async () => { AI.setKey(''); AI.setModel(''); await S.db.setKV('_meta', { gemini_key: '', gemini_atlandi: '1' }); S.meta.gemini_key = ''; S.meta.gemini_atlandi = '1'; toast('Anahtar kaldırıldı'); renderAyarlar(); });
  if ($('#kis')) $('#kis').onchange = e => guard(async () => { await S.db.setKV('_meta', { gemini_key: e.target.checked ? AI.getKey() : '' }); S.meta.gemini_key = e.target.checked ? AI.getKey() : ''; toast(e.target.checked ? 'Anahtar tablona kaydedildi' : 'Anahtar tablondan silindi (sadece bu cihazda)'); });
  if ($('#yedekAl')) $('#yedekAl').onclick = () => guard(async () => {
    $('#yedekAl').disabled = true;
    const b = await G.copyFile(S.db.id, `Dudestreet Yedek – ${new Date().toLocaleString('tr-TR')}`);
    await S.db.setKV('_meta', { son_yedek: b.id, son_yedek_tarih: new Date().toISOString() });
    S.meta = await S.db.kv('_meta');
    toast('✅ Yedek Drive’ına kaydedildi'); renderAyarlar();
  });
  $('#cikis').onclick = () => {
    notFlush();
    if (isDemo()) { LocalDB.wipe(); localStorage.removeItem('ds_demo'); } else G.logout();
    ['ds_gemini_key', 'ds_gemini_model', 'ds_anket_taslak', 'ds_anket_sonra', 'ds_plan', 'ds_notBekle', 'ds_sonNot', 'ds_katBekle'].forEach(k => localStorage.removeItem(k));
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
