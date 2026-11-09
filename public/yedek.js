// Dudestreet — yedek (elle + günlük otomatik), yedekten geri yükleme, değişiklik günlüğü, uygulama güncelleme
import { S, $, $$, esc, today, toast, sheet, onayKutusu, guard, isDemo, lsGet, lsSet, kapatBtn, pick, CONFIG } from './core.js';
import * as G from './google.js';

const GUN = 864e5;
const tarihSaat = iso => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const TUR_AD = { gunluk: 'Günlük', elle: 'Elle', 'geri-oncesi': 'Geri yükleme öncesi' };

// ---------- Demo: yedekler bu tarayıcıda ----------
const DEMO_LS = 'ds_demo_yedekler', DEMO_DB = 'ds_demo_db';
const demoListe = () => lsGet(DEMO_LS, []);
function demoYedekAl(tur) {
  const l = demoListe();
  l.unshift({ id: 'd' + Date.now(), name: `Dudestreet Yedek – ${today()} (${TUR_AD[tur]})`, createdTime: new Date().toISOString(), appProperties: { yedekTur: tur }, veri: localStorage.getItem(DEMO_DB) });
  lsSet(DEMO_LS, l.slice(0, 10));
  return l[0];
}

// ---------- Yedek al ----------
export async function yedekAl(tur = 'elle') {
  if (isDemo()) return demoYedekAl(tur);
  const mevcut = await G.listBackups().catch(() => []);
  const ay = today().slice(0, 7);
  // Ayın ilk yedeği kalıcıdır (otomatik silinmez); elle ve geri yükleme öncesi alınanlar da kalıcıdır
  const kalici = tur !== 'gunluk' || !mevcut.some(f => String(f.createdTime).slice(0, 7) === ay);
  const y = await G.copyFile(S.db.id, `Dudestreet Yedek – ${today()} (${TUR_AD[tur]})`, 'backup', { yedekTur: tur, kalici: kalici ? '1' : '0', kaynak: S.db.id });
  await S.db.setKV('_meta', { son_yedek: y.id, son_yedek_tarih: new Date().toISOString() });
  S.meta.son_yedek = y.id; S.meta.son_yedek_tarih = new Date().toISOString();
  return y;
}

// Uygulama o gün ilk açıldığında günlük yedek; 30 günden eski günlük yedekler silinir (kalıcılar hariç)
export async function otomatikYedek() {
  if (!S.db || isDemo()) return;
  if (lsGet('ds_otomatikYedek', true) === false) return;
  const son = S.meta.son_otomatik_yedek || '';
  if (son === today()) return;
  try {
    await yedekAl('gunluk');
    await S.db.setKV('_meta', { son_otomatik_yedek: today() }); S.meta.son_otomatik_yedek = today();
    const l = await G.listBackups();
    const eski = l.filter(f => f.appProperties?.yedekTur === 'gunluk' && f.appProperties?.kalici !== '1' && Date.now() - Date.parse(f.createdTime) > 30 * GUN && (!f.appProperties?.kaynak || f.appProperties.kaynak === S.db.id));
    for (const f of eski) await G.deleteFile(f.id).catch(() => {});
  } catch (e) { console.warn('otomatik yedek alınamadı', e); }
}

// ---------- Yedek penceresi ----------
export async function yedekPenceresi() {
  const el = sheet(`<div class="satir"><h3 class="bosluk">🛟 Yedekler</h3>${kapatBtn()}</div>
    <p class="mini">Yedek, Drive’ında tablonun ayrı bir kopyası olarak durur. Uygulamayı açtığın her gün bir yedek alınır, 30 gün saklanır; her ayın ilk yedeği, elle aldıkların ve geri yükleme öncesi yedekler hiç silinmez.</p>
    <label class="onay"><input type="checkbox" id="yOto" ${lsGet('ds_otomatikYedek', true) !== false ? 'checked' : ''}><span>Günlük otomatik yedek</span></label>
    <button class="blok" id="yAl">Şimdi yedek al</button>
    <div class="ust-etiket" style="margin-top:16px">Yedekten geri yükle</div>
    <div id="yListe" class="mini">Yedekler yükleniyor…</div>`, { genis: true });
  $('#kapat', el).onclick = () => el.remove();
  $('#yOto', el).onchange = e => { lsSet('ds_otomatikYedek', e.target.checked); };
  const ciz = async () => {
    let l = [];
    try { l = isDemo() ? demoListe() : await G.listBackups(); } catch (e) { $('#yListe', el).textContent = 'Yedekler alınamadı: ' + e.message; return; }
    if (!isDemo()) l = l.filter(f => !f.appProperties?.kaynak || f.appProperties.kaynak === S.db.id || true);
    $('#yListe', el).innerHTML = l.length ? `<ul class="liste">${l.slice(0, 40).map(f => `<li><span class="kayit-ik">${f.appProperties?.yedekTur === 'gunluk' ? '🗓️' : f.appProperties?.yedekTur === 'geri-oncesi' ? '↩️' : '🛟'}</span><span class="bosluk"><b>${esc(tarihSaat(f.createdTime))}</b><div class="mini">${esc(TUR_AD[f.appProperties?.yedekTur] || 'Yedek')}${f.appProperties?.kalici === '1' && f.appProperties?.yedekTur === 'gunluk' ? ' · ayın ilk yedeği, kalıcı' : ''}${isDemo() ? '' : ` · <a href="${G.sheetUrl(f.id)}" target="_blank" rel="noopener">aç</a>`}</div></span><button class="ikinci kucuk-btn" data-geri="${esc(f.id)}">Geri yükle</button></li>`).join('')}</ul>` : 'Henüz yedek yok.';
    $$('[data-geri]', el).forEach(b => b.onclick = () => { const f = l.find(x => x.id === b.dataset.geri); if (f) geriYukle(f, el); });
  };
  $('#yAl', el).onclick = () => guard(async () => { $('#yAl', el).disabled = true; try { await yedekAl('elle'); toast(pick(['🛟 Yedek alındı, Drive’da güvende', '🔒 Yedeklendi, içim rahat'])); await ciz(); } finally { $('#yAl', el).disabled = false; } });
  ciz();
}

function geriYukle(f, pencere) {
  onayKutusu(`${tarihSaat(f.createdTime)} hâline dönülsün mü?`, 'Önce şu anki hâlin ayrıca yedeklenir (geri yükleme öncesi yedeği), sonra bu yedek ana tablon olur. Bu yedekten sonra yaptığın değişiklikler ana tabloda görünmez ama öncesi yedeğinde durur.', () => guard(async () => {
    S.busy = true; toast('↩️ Geri yükleniyor…', 15000);
    try {
      if (isDemo()) { demoYedekAl('geri-oncesi'); localStorage.setItem(DEMO_DB, f.veri); }
      else {
        await yedekAl('geri-oncesi');
        const yeni = await G.copyFile(f.id, CONFIG.TABLO_ADI, 'main');
        await G.tagFile(S.db.id, 'eski-ana');
        await G.renameFile(S.db.id, `${CONFIG.TABLO_ADI} (eski · ${today()})`).catch(() => {});
        G.setSheetId(yeni.id);
      }
    } finally { S.busy = false; }
    pencere?.remove();
    toast('✅ Yedekten geri yüklendi');
    setTimeout(() => location.reload(), 600);
  }), { evetYazi: 'Evet, geri yükle', tehlike: true });
}

// ---------- Değişiklik günlüğü ----------
export async function gunlukPenceresi() {
  const el = sheet(`<div class="satir"><h3 class="bosluk">🧾 Değişiklik günlüğü</h3>${kapatBtn()}</div>
    <p class="mini">Eklenen, değiştirilen ve silinen kayıtlar (en yeni üstte). Silinen/değişen kaydın eski hâli de yazılır; yanlışlıkla bir şey silindiyse buradan görüp geri ekleyebilirsin.</p>
    <div id="gIc" class="mini">Yükleniyor…</div>`, { genis: true });
  $('#kapat', el).onclick = () => el.remove();
  try {
    const l = (await S.db.table('Günlük')).slice().reverse().slice(0, 150);
    const ik = { Eklendi: '➕', 'Değişti': '✏️', Silindi: '🗑️' };
    $('#gIc', el).innerHTML = l.length ? `<ul class="liste">${l.map(r => `<li style="align-items:flex-start"><span class="kayit-ik">${ik[r['İşlem']] || '•'}</span><span class="bosluk"><div class="satir"><b class="bosluk">${esc(r['İşlem'])} · ${esc(r['Sekme'])}</b><span class="mini">${esc(tarihSaat(r['Zaman']))}</span></div><div class="kucuk soluk2">${esc(r['Özet'])}</div>${r['Eski'] && r['İşlem'] === 'Değişti' ? `<div class="mini">Eski hâli: ${esc(r['Eski'])}</div>` : ''}</span></li>`).join('')}</ul>` : 'Henüz kayıt yok. Bundan sonraki değişiklikler burada görünür.';
  } catch (e) { $('#gIc', el).textContent = 'Günlük alınamadı: ' + e.message; }
}

// ---------- Uygulamayı güncelle ----------
export async function zorlaGuncelle() {
  toast('⬇️ Yeni sürüm indiriliyor…', 10000);
  try {
    const rs = (await navigator.serviceWorker?.getRegistrations?.()) || []; await Promise.all(rs.map(r => r.unregister()));
    const ks = (await caches?.keys?.()) || []; await Promise.all(ks.map(k => caches.delete(k)));
  } catch { /* yine de yenile */ }
  location.replace('/?r=' + Date.now());
}
