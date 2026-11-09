// Dudestreet — notlardan çıkan "planlanan harcamalar" listesi (Nébula'daki gibi bu cihazda tutulur) ve onaylama
import { S, $, esc, num, money, gunluk, today, buAy, ymOf, uid, lsGet, lsSet, toast, sheet, onayKutusu, guard, ekle, sil, guncelle, tazele, pick, tutarAlan, fmtIn, chips, chipBagla, chipVal, girdi } from './core.js';
import { butceAy, butceGruplari, temelOnayli, onayKaydi, katIkon, varliklar, fiyatAnahtar } from './hesap.js';

const PLAN_LS = 'ds_plan';
let onbellek = null;
export const planOku = () => { if (onbellek) return onbellek; const l = lsGet(PLAN_LS, []); onbellek = Array.isArray(l) ? l : []; return onbellek; };
export const planYaz = l => { onbellek = l; lsSet(PLAN_LS, l); };
addEventListener('storage', e => { if (e.key === PLAN_LS) onbellek = null; });
export const planListe = nid => planOku().filter(p => p.durum === 'bekliyor' && (nid === undefined || p.notId === nid));
export const planEklenen = nid => planOku().filter(p => p.durum === 'eklendi' && (nid === undefined || p.notId === nid)).sort((x, y) => String(y.eklenme).localeCompare(String(x.eklenme)));

// Bir plan satırının onaylanınca ay sonuna etkisi
export function planTek(p, ym) {
  if (p.tur === 'satis') return 0;
  const tt = num(p.tutar);
  if (p.tur === 'temel') { const es = butceAy(ym).find(b => b.kalem === p.ad); if (es && temelOnayli(ym, p.ad)) return tt - es.tutar; }
  return tt;
}
export const planEtki = (ym, nid) => planListe(nid).reduce((t, p) => t + planTek(p, ym), 0);
// Onay bekleyen her şey: onaylanmamış temel giderler + notlardan gelen bekleyen plan satırları
export function bekleyenToplam(ym, temel) {
  const bu = ym === buAy(), pl = bu ? planListe() : [];
  const temelSiz = temel.filter(b => !temelOnayli(ym, b.kalem) && !pl.some(p => p.tur === 'temel' && p.ad === b.kalem)).reduce((t, b) => t + b.tutar, 0);
  return temelSiz + (bu ? planEtki(ym) : 0);
}

// ---------- Kayıt işlemleri (gelir-gider de bunları kullanır) ----------
export async function onayDegistir(ym, kalem, ekleMi) {
  const var_ = onayKaydi(ym, kalem);
  if (ekleMi && !var_) await ekle('Onay', { Ay: ym, Kalem: kalem, Tarih: today() });
  else if (!ekleMi && var_) { await S.db.deleteRow('Onay', var_._row); await tazele('Onay'); }
}
// Bir ayın temel gider listesini yazar (o ay ve sonrası için geçerli olur, önceki aylar değişmez)
export async function butceAyYaz(ym, items) {
  const guncel = await S.db.table('Bütçe');
  const silinecek = guncel.filter(r => ymOf(r['Ay']) === ym).map(r => r._row);
  if (silinecek.length) await S.db.deleteRows('Bütçe', silinecek);
  const temiz = items.filter(x => num(x.tutar) > 0);
  if (temiz.length) await S.db.appendObjs('Bütçe', temiz.map(x => ({ Ay: ym, Kalem: x.kalem, Kategori: x.kategori, Tutar: String(num(x.tutar)), 'İkon': x.ikon || '' })));
  else await S.db.appendObjs('Bütçe', [{ Ay: ym, Kalem: '-', Kategori: 'Diğer', Tutar: '0', 'İkon': '' }]);   // boş liste de "bu ay temel gider yok" demektir
  const eski = guncel.filter(r => ymOf(r['Ay']) === ym).map(r => `${r['Kalem']} ${r['Tutar']}`).join(', ');
  gunluk('Değişti', 'Bütçe', `${ym} temel giderler: ${temiz.map(x => `${x.kalem} ${num(x.tutar)}`).join(', ') || 'yok'}`, eski);
  await tazele('Bütçe');
}
export async function giderEkle({ tarih, kalem, kategori, tutar, birikimden, not = '', ikon = '' }) {
  const k = uid();
  await ekle('Giderler', { Kimlik: k, Tarih: tarih, Kalem: kalem, Kategori: kategori, Tutar: String(tutar), Birikimden: birikimden ? 'evet' : '', Not: not, 'İkon': ikon || katIkon(kategori) });
  if (birikimden) await ekle('Kayıtlar', { Kimlik: uid(), Tarih: tarih, 'Tür': 'Harcama', Tutar: String(tutar), Kategori: kategori, Not: kalem, 'Bağ': k });
  return k;
}
export async function giderSil(g) {
  await sil('Giderler', g['Kimlik']);
  if (evet2(g['Birikimden'])) { const h = S.kayitlar.find(r => r['Bağ'] === g['Kimlik']); if (h) await sil('Kayıtlar', h['Kimlik']); }
}
const evet2 = v => ['evet', 'true', '1'].includes(String(v || '').toLowerCase());
// Gider düzenlenince birikimden ödendiyse bağlı birikim çıkışı da aynı adı/kategoriyi taşır
export async function giderGuncelle(g, yeni) {
  await guncelle('Giderler', g['Kimlik'], yeni);
  if (evet2(g['Birikimden'])) {
    const h = S.kayitlar.find(r => r['Bağ'] === g['Kimlik']);
    if (h) await guncelle('Kayıtlar', h['Kimlik'], { ...(yeni.Kalem !== undefined ? { Not: yeni.Kalem } : {}), ...(yeni.Kategori !== undefined ? { Kategori: yeni.Kategori } : {}), ...(yeni.Tutar !== undefined ? { Tutar: yeni.Tutar } : {}) });
  }
}
// Birikim kaydı silinirken bir gidere bağlıysa gider de silinir (ikisi birlikte yaşar)
export async function kayitSil(kimlik) {
  const r = S.kayitlar.find(x => x['Kimlik'] === kimlik); if (!r) return;
  const g = r['Bağ'] && S.giderler.find(x => x['Kimlik'] === r['Bağ']);
  if (g) return giderSil(g);
  await sil('Kayıtlar', kimlik);
}
// Varlığı satış kaydı olmadan kaldır: bugünkü değeri "Varlık çıkışı" olarak yazılır (grafikte yatırım hariç çizgi zıplamasın)
export async function varlikKaldir(kimlik) {
  const x = varliklar().find(y => y.p['Kimlik'] === kimlik); if (!x) return;
  await sil('Portföy', kimlik);
  if (x.deger > 0) await ekle('Kayıtlar', { Kimlik: uid(), Tarih: today(), 'Tür': 'Varlık çıkışı', Tutar: String(Math.round(x.deger * 100) / 100), Kategori: x.p['Sembol'], Not: `${x.p['Ad'] || x.p['Sembol']} kaldırıldı` });
}
// Borcu hareket geçmişiyle birlikte sil
export async function borcSil(kimlik) {
  await sil('Borçlar', kimlik);
  const hs = await S.db.table('Borç hareketleri'), satirlar = hs.filter(h => h['Borç'] === kimlik).map(h => h._row);
  if (satirlar.length) { await S.db.deleteRows('Borç hareketleri', satirlar); gunluk('Silindi', 'Borç hareketleri', `${satirlar.length} hareket (silinen borçla birlikte)`); }
  await tazele('Borç hareketleri');
}

// ---------- Onaylama ----------
// Onaylanan satır hemen "Eklenen"e geçer; tabloya yazılamazsa bekleyenlere geri döner
function optimist(p, kayit, islem, bitti) {
  const isaretle = f => { planYaz(planOku().map(x => x.id === p.id ? { ...x, ...f } : x)); bitti?.(); };
  isaretle({ durum: 'eklendi', eklenme: new Date().toISOString(), kayit });
  guard(async () => {
    try { await islem(); bitti?.(); }
    catch (e) { isaretle({ durum: 'bekliyor', eklenme: '', kayit: null }); toast('Kaydedilemedi, satırı bekleyenlere geri koydum: ' + esc(e.message)); }
  });
}

export function planOnayla(p, bitti) {
  const ym = buAy(), bugun = today();
  if (p.tur === 'satis') return satisSheet(p, bitti);
  if (!(num(p.tutar) > 0)) { toast('Önce ✏️ ile tutar gir'); return; }
  if (p.tur === 'temel') return temelOnayla(p, ym, bitti);
  const kat = p.kategori || 'Diğer';
  optimist(p, { tur: 'ek', tarih: bugun }, async () => {
    const k = await giderEkle({ tarih: bugun, kalem: p.ad, kategori: kat, tutar: num(p.tutar), birikimden: false });
    planYaz(planOku().map(x => x.id === p.id ? { ...x, kayit: { ...x.kayit, gider: k } } : x));
  }, bitti);
}

async function temelOnayla(p, ym, bitti) {
  const items = butceAy(ym).map(b => ({ ...b }));
  const onceki = items.map(x => ({ ...x }));
  const es = items.find(b => b.kalem === p.ad), tutar = num(p.tutar);
  const onayGerek = !temelOnayli(ym, p.ad);
  if (es && Math.abs(es.tutar - tutar) < 0.005) return optimist(p, { tur: 'yok', ay: ym, onay: onayGerek }, () => onayGerek ? onayDegistir(ym, p.ad, true) : null, bitti);
  if (es) es.tutar = tutar; else items.push({ kalem: p.ad, kategori: 'Diğer', tutar, ikon: '🧾' });
  onayKutusu(es ? `${p.ad} bu ay ${money(tutar)} olsun mu?` : `${p.ad} temel giderlere eklensin mi?`,
    es ? `Bütçede ${money(onceki.find(b => b.kalem === p.ad).tutar)} yazıyor. Bu ay ve sonrası için temel gider tutarı güncellenecek.` : 'Bu ay ve sonrası için temel gider listene girecek.',
    () => optimist(p, { tur: 'temel', ay: ym, onceki, onay: onayGerek }, async () => { await butceAyYaz(ym, items); if (onayGerek) await onayDegistir(ym, p.ad, true); }, bitti), { evetYazi: 'Evet, güncelle' });
}

// Eklenen satırı geri al: gerçek kaydı tablodan kaldırır, satır bekleyenlere döner
export function planGeriAl(p, bitti) {
  const k = p.kayit || {}, orijinal = { ...p };
  planYaz(planOku().map(x => x.id === p.id ? { ...x, durum: 'bekliyor', eklenme: '', kayit: null } : x)); bitti?.();
  guard(async () => {
    try {
      if (k.tur === 'ek') { const g = S.giderler.find(x => x['Kimlik'] === k.gider); if (g) await giderSil(g); }
      else if (k.tur === 'temel' && k.onceki) { await butceAyYaz(k.ay, k.onceki); if (k.onay) await onayDegistir(k.ay, p.ad, false); }
      else if (k.tur === 'yok' && k.onay) await onayDegistir(k.ay, p.ad, false);
      else if (k.tur === 'satis') {
        if (!k.satis) throw new Error('bu satış eski sürümde kaydedildi; Varlıklar’dan düzelt');
        if (k.gider) { const g = S.giderler.find(x => x['Kimlik'] === k.gider); if (g) await giderSil(g); }
        await sil('Kayıtlar', k.satis);
        if (k.portfoy) { if (S.portfoy.some(x => x['Kimlik'] === k.portfoy['Kimlik'])) await guncelle('Portföy', k.portfoy['Kimlik'], { Adet: k.portfoy['Adet'] }); else await ekle('Portföy', k.portfoy); }
      }
      bitti?.();
    } catch (e) { planYaz(planOku().map(x => x.id === p.id ? orijinal : x)); bitti?.(); toast('Geri alınamadı: ' + esc(e.message)); }
  });
}

// Satış planı: hangi varlık, ne kadar, para nereye
function satisSheet(p, bitti) {
  const vl = varliklar().filter(x => x.adet > 0 && x.fiyat > 0);
  if (!vl.length) { toast('Satılacak varlık bulamadım'); return; }
  const secili = vl.find(x => x.p['Sembol'] === p.varlik) || vl[0];
  const el = sheet(`<h3>📈 Satışı onayla</h3><p class="mini">${esc(p.ad)}</p>
    <label class="etiket" for="psV">Hangi varlık?</label><select id="psV">${vl.map(x => `<option value="${esc(x.p['Kimlik'])}" ${x === secili ? 'selected' : ''}>${esc(x.p['Ad'] || x.p['Sembol'])} (${esc(x.p['Sembol'])})</option>`).join('')}</select>
    <label class="etiket" for="psT">Satılacak tutar</label>${tutarAlan('psT', '0', num(p.tutar) > 0 ? fmtIn(p.tutar) : '')}
    <div class="mini" id="psBilgi"></div>
    <label class="etiket">Para nereye?</label>${chips('psH', [['nakit', '🏦 Birikimde kalsın'], ['harca', '💸 Harcadım']], 'nakit')}
    <button class="blok" id="psGo" style="margin-top:14px">Satışı kaydet</button>`);
  chipBagla(el);
  const hesap = () => { const x = vl.find(y => y.p['Kimlik'] === $('#psV', el).value), t = girdi($('#psT', el).value); return { x, t, adet: Math.min(x.adet, Math.round(t / x.fiyat * 1e8) / 1e8) }; };
  const upd = () => { const h = hesap(); $('#psBilgi', el).textContent = `Elinde ${h.x.adet} adet, fiyat ${money(h.x.fiyat)} · satılacak ≈ ${h.adet} adet`; };
  $('#psV', el).onchange = upd; $('#psT', el).oninput = upd; upd();
  $('#psGo', el).onclick = () => {
    const h = hesap(), harca = chipVal(el, 'psH') === 'harca';
    if (!(h.t > 0) || !(h.adet > 0)) { toast('Tutarı gir'); return; }
    el.remove();
    optimist(p, { tur: 'satis', tarih: today() }, async () => {
      const kalan = h.x.adet - h.adet, x = h.x.p, { _row, ...once } = x;
      if (kalan > 1e-9) await guncelle('Portföy', x['Kimlik'], { Adet: String(Number(kalan.toPrecision(10))) }); else await sil('Portföy', x['Kimlik']);
      const sk = uid();
      await ekle('Kayıtlar', { Kimlik: sk, Tarih: today(), 'Tür': 'Varlık satışı', Tutar: String(h.t), Kategori: x['Sembol'], Not: `${x['Ad'] || x['Sembol']} satıldı` });
      // Satıp harcadıysa: Gelir-Gider'de "birikimden ödenen" gider olarak da görünür (bağlı birikim çıkışıyla birlikte)
      const gk = harca ? await giderEkle({ tarih: today(), kalem: p.ad, kategori: 'Diğer', tutar: h.t, birikimden: true }) : null;
      planYaz(planOku().map(y => y.id === p.id ? { ...y, kayit: { ...y.kayit, portfoy: once, satis: sk, gider: gk } } : y));
      toast(harca ? pick(['😤 Satıp harcadın, Future Dude not aldı.', '💸 Satış kaydedildi, bu ayın birikiminden düştü.']) : '🏦 Satış kaydedildi, para birikimde.');
    }, bitti);
  };
}
export { fiyatAnahtar, butceGruplari };
