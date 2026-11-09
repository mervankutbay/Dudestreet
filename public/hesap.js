// Dudestreet — hesaplar: varlık değerleri, mal varlığı, gelir-gider ayı, bütçe, kategoriler
import { S, num, evet, today, buAy, ymOf, ymAdd, paraKod, gunFark, lsGet, lsSet } from './core.js';

// ---------- Varlık türleri ----------
// canli: fiyat sunucudan gelir · artis: elle girilen değere uygulanan varsayılan yıllık değer artışı (%)
// Ev/arsa: TCMB Konut Fiyat Endeksi yıllık değişimi (Eylül 2026: %22,3). Araba: ikinci el otomobil fiyat endeksleri (2026 ort. ~%15-20 nominal).
export const VARLIK_TURLERI = [
  { tur: 'Hisse', grup: 'Yatırım', canli: true, ikon: '📈' },
  { tur: 'Kripto', grup: 'Yatırım', canli: true, ikon: '🪙' },
  { tur: 'Fon / ETF', grup: 'Yatırım', canli: true, ikon: '🧺' },
  { tur: 'Altın (gram)', grup: 'Yatırım', canli: true, ikon: '🥇' },
  { tur: 'Gümüş (gram)', grup: 'Yatırım', canli: true, ikon: '🥈' },
  { tur: 'Döviz', grup: 'Yatırım', canli: true, ikon: '💵' },
  { tur: 'MBKAYO payı', grup: 'Yatırım', canli: true, ikon: '🐺' },
  { tur: 'Nakit / Banka', grup: 'Nakit', canli: false, artis: 0, ikon: '🏦' },
  { tur: 'Ev / Daire', grup: 'Gayrimenkul', canli: false, artis: 22.3, ikon: '🏠' },
  { tur: 'Arsa / Tarla', grup: 'Gayrimenkul', canli: false, artis: 22.3, ikon: '🌾' },
  { tur: 'Araba', grup: 'Araç', canli: false, artis: 16, ikon: '🚗' },
  { tur: 'Diğer', grup: 'Diğer', canli: false, artis: 0, ikon: '📦' },
];
export const turBilgi = t => VARLIK_TURLERI.find(x => x.tur === t) || VARLIK_TURLERI[VARLIK_TURLERI.length - 1];
export const canliMi = p => turBilgi(p['Tür']).canli;
export const ARTIS_KAYNAK = {
  'Ev / Daire': 'TCMB Konut Fiyat Endeksi, Eylül 2026 yıllık değişim',
  'Arsa / Tarla': 'TCMB Konut Fiyat Endeksi, Eylül 2026 yıllık değişim',
  'Araba': 'İkinci el otomobil fiyat endeksleri, 2026 yıllık ortalama',
};
export const GRUP_RENK = { 'Nakit': 'var(--g1)', 'Yatırım': 'var(--g2)', 'Gayrimenkul': 'var(--g3)', 'Araç': 'var(--g4)', 'Diğer': 'var(--g5)' };
export const fiyatAnahtar = p => `${p['Tür']}|${p['Sembol']}`;

// Elle değerli varlık: girilen değer × (1 + yıllık artış)^(geçen gün / 365)
export function buyumeli(deger, oran, tarih) {
  const gun = Math.max(0, gunFark(String(tarih || today()).slice(0, 10), today()));
  return deger * Math.pow(1 + (oran || 0) / 100, gun / 365);
}

export function varliklar() {
  const para = paraKod();
  return S.portfoy.map(p => {
    const b = turBilgi(p['Tür']), adet = num(p['Adet']), maliyet = num(p['Maliyet']);
    let fiyat = maliyet, canli = false, gunluk = 0, gunlukTutar = 0, hata = null, tahmini = false;
    const oran = p['Yıllık artış'] === '' || p['Yıllık artış'] === undefined ? (b.artis || 0) : num(p['Yıllık artış']);
    if (p['Tür'] === 'MBKAYO payı') {
      const m = S.mbkayo;
      if (m && !m.hata && m.para === para) { fiyat = m.kisiBasi; canli = true; }
      else hata = m?.hata || null;
    } else if (b.canli) {
      const f = S.fiyat.fiyatlar?.[fiyatAnahtar(p)];
      if (f && !f.hata && S.fiyat.para === para) { fiyat = f.fiyat; canli = true; gunluk = f.degisim; gunlukTutar = adet * (f.fiyat - f.onceki); }
      else hata = f?.hata || null;
    } else if (oran) {
      fiyat = buyumeli(maliyet, oran, p['Tarih']);
      tahmini = true;
      gunlukTutar = adet * fiyat * (Math.pow(1 + oran / 100, 1 / 365) - 1);
      gunluk = (Math.pow(1 + oran / 100, 1 / 365) - 1) * 100;
    }
    const deger = adet * fiyat, alis = adet * maliyet;
    return { p, b, grup: b.grup, adet, maliyet, fiyat, canli, tahmini, oran, deger, alis, kar: deger - alis, karYuzde: alis ? (deger / alis - 1) * 100 : 0, gunluk, gunlukTutar, hata, hedefte: evet(p['Hedef']) };
  });
}

// ---------- Birikim hesabı (Hedef sekmesi) ----------
// Birikim: hesaba giren · Harcama: birikimden çıkan (kural ihlali) · Varlık alımı/satışı: hesap ile portföy arasında geçiş
// Varlık girişi/çıkışı: nakit hareketi olmadan portföye eklenen/çıkan değer (grafikte "yatırım hariç" hesabı için)
export const NAKIT = { 'Birikim': 1, 'Harcama': -1, 'Varlık alımı': -1, 'Varlık satışı': 1 };
export const SAYILAN = { 'Birikim': 1, 'Harcama': -1 };
export const kayitlar = () => S.kayitlar.map(r => ({ ...r, tutar: num(r['Tutar']), tur: r['Tür'], ay: ymOf(r['Tarih']) })).sort((a, b) => String(a['Tarih']).localeCompare(String(b['Tarih'])));

export function birikimHesap() {
  const k = kayitlar();
  const nakit = k.reduce((s, r) => s + (NAKIT[r.tur] || 0) * r.tutar, 0);
  const aylar = {};
  k.forEach(r => { if (SAYILAN[r.tur]) aylar[r.ay] = (aylar[r.ay] || 0) + SAYILAN[r.tur] * r.tutar; });
  return { k, nakit, aylar };
}

export function hedefHesap() {
  const { k, nakit, aylar } = birikimHesap();
  const v = varliklar().filter(x => x.hedefte);
  const bagli = v.reduce((s, x) => s + x.deger, 0);
  const toplam = nakit + bagli;
  const buAyK = buAy(), buAyNet = aylar[buAyK] || 0;
  const gecmis = Object.entries(aylar).filter(([a]) => a !== buAyK).sort().slice(-6);
  const ort = gecmis.length ? gecmis.reduce((s, [, x]) => s + x, 0) / gecmis.length : buAyNet;
  const hedef = num(S.ayar.hedef_tutar), min = num(S.ayar.aylik_min);
  const kalan = Math.max(0, hedef - toplam);
  const tempo = Math.max(ort, min || 0);
  const ayKaldi = hedef && kalan === 0 ? 0 : hedef && tempo > 0 ? Math.ceil(kalan / tempo) : null;
  let varis = null;
  if (ayKaldi !== null) { const d = new Date(); d.setMonth(d.getMonth() + ayKaldi); varis = ayKaldi === 0 ? 'Ulaştın! 🎉' : d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }); }
  let gereken = null;
  if (S.ayar.hedef_tarih && hedef) {
    const [y, m] = S.ayar.hedef_tarih.split('-').map(Number), d = new Date();
    gereken = kalan / Math.max(1, (y - d.getFullYear()) * 12 + (m - 1 - d.getMonth()));
  }
  const durum = !min ? '-' : buAyNet >= min ? 'Hedefte' : 'Hedefin altında';
  const harcamaBuAy = k.filter(r => r.ay === buAyK && r.tur === 'Harcama').reduce((s, r) => s + r.tutar, 0);
  return { k, nakit, bagli, v, toplam, aylar, buAy: buAyNet, ort, hedef, min, kalan, ilerleme: hedef ? Math.min(1, Math.max(0, toplam / hedef)) : 0, varis, ayKaldi, gereken, durum, harcamaBuAy, var: !!S.ayar.hedef_ne };
}

// ---------- Borçlar ----------
export function borclar() {
  return S.borclar.map(b => {
    const borc = num(b['Borç']), limit = num(b['Limit']), asgari = num(b['Asgari']);
    const son = sonrakiGun(num(b['Son ödeme'])), kesim = sonrakiGun(num(b['Kesim']));
    return { b, borc, limit, asgari, kullanilabilir: limit ? Math.max(0, limit - borc) : null, doluluk: limit ? Math.min(1, borc / limit) : null, son, kesim, kalanGun: son ? gunFark(today(), son) : null };
  });
}
// Ayın N'inci günü: bugünden sonraki ilk tarih (ay kısa ise son güne çekilir)
export function sonrakiGun(n) {
  if (!(n >= 1 && n <= 31)) return null;
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  const gun = (yy, mm) => Math.min(n, new Date(yy, mm + 1, 0).getDate());
  const iso = t => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  let t = new Date(y, m, gun(y, m));
  if (iso(t) < today()) t = new Date(y, m + 1, gun(y, m + 1));
  return iso(t);
}

// ---------- Toplam mal varlığı ----------
export function malVarligi() {
  const { nakit } = birikimHesap();
  const v = varliklar();
  const gruplar = { 'Nakit': Math.max(0, nakit), 'Yatırım': 0, 'Gayrimenkul': 0, 'Araç': 0, 'Diğer': 0 };
  v.forEach(x => { gruplar[x.grup] = (gruplar[x.grup] || 0) + x.deger; });
  const varlik = v.reduce((s, x) => s + x.deger, 0);
  const brut = Math.max(0, nakit) + varlik;
  const borc = borclar().reduce((s, x) => s + x.borc, 0);
  const gunluk = v.reduce((s, x) => s + x.gunlukTutar, 0);
  return { nakit, v, varlik, brut, borc, net: brut - borc, gruplar, gunluk };
}

// ---------- Kategoriler (Nébula'daki gibi: sabit liste + kullanıcının kendi kategorileri) ----------
export const BUTCE_KAT = [['Kira', '🏠'], ['Fatura', '💡'], ['Abonelik', '📺'], ['Kredi / taksit', '💳'], ['Aile & destek', '💝'], ['Diğer', '📌']];
export const GIDER_KAT = [['Alışveriş', '🛍️'], ['Yeme-içme', '🍽️'], ['Ulaşım', '🚌'], ['Sağlık', '🩺'], ['Seyahat', '✈️'], ['Hediye', '🎁'], ['Ev', '🛋️'], ['Eğlence', '🎉'], ['Diğer', '💸']];
export const EMOJI_LISTE = ['🏠', '💡', '📺', '💳', '💝', '👨‍👩‍👧', '📌', '🎨', '📱', '🌐', '🚌', '🚗', '⛽', '🍽️', '🛒', '💊', '🏋️', '🎓', '✈️', '🎁', '🧾', '🎵', '📚', '☕', '🧴', '💇', '🛋️', '💼', '🐶', '🐱', '👶', '🎮', '⚽', '🍺', '🚬', '🏥', '🦷', '👗', '👟', '🔧', '🏦', '🎉', '🍔', '🍕', '🧹', '📦'];
export const KAT_KORUMALI = ['Diğer'];
const KAT_BEKLE_LS = 'ds_katBekle';
export const KAT_YOK = '__yok';
export const katKayit = kod => S.kategori.find(r => String(r['Kod']) === kod);
export const katSilindiMi = kod => { const r = katKayit(kod); return !!r && evet(r['Silindi']); };
export const katBekleyen = () => lsGet(KAT_BEKLE_LS, []);
export const katBekleYaz = l => lsSet(KAT_BEKLE_LS, l);
const katBilgi = kod => { const r = katKayit(kod); if (r) return { ad: r['Ad'], ikon: r['İkon'] }; return katBekleyen().find(r => r.kod === kod); };
export const katAnahtar = k => { k = k || 'Diğer'; return katSilindiMi(k) ? KAT_YOK : k; };
export function ozelKatlar() {
  const sabit = new Set([...BUTCE_KAT, ...GIDER_KAT].map(x => x[0])), out = [];
  const ekleK = (kod, ik) => { kod = String(kod || '').trim(); if (kod && !sabit.has(kod) && !katSilindiMi(kod) && !out.some(x => x[0] === kod)) out.push([kod, ik || '🏷️']); };
  S.kategori.forEach(r => ekleK(r['Kod'], r['İkon']));
  katBekleyen().forEach(r => ekleK(r.kod, r.ikon));
  [...S.butce, ...S.giderler].forEach(r => ekleK(r['Kategori'], r['İkon']));
  return out;
}
export const katAd = kod => (kod === KAT_YOK || katSilindiMi(kod)) ? 'Kategorisiz' : ((katBilgi(kod) || {}).ad || kod);
export const katIkon = kod => {
  if (kod === KAT_YOK || katSilindiMi(kod)) return '❗';
  const b = katBilgi(kod); if (b && b.ikon) return b.ikon;
  const f = [...BUTCE_KAT, ...GIDER_KAT, ...ozelKatlar()].find(x => x[0] === kod); return f ? f[1] : '📌';
};
export const kalemIkon = it => katSilindiMi(it['Kategori']) ? '❗' : ((katKayit(it['Kategori']) || {})['İkon'] || it['İkon'] || katIkon(it['Kategori']));
export const kalemSerbest = k => !BUTCE_KAT.some(x => x[0] === k) || k === 'Diğer';
export const birlesikKat = () => {
  const m = new Map(); [...BUTCE_KAT, ...GIDER_KAT].forEach(([k]) => { if (!katSilindiMi(k) && !m.has(k)) m.set(k, 1); });
  ozelKatlar().forEach(([k]) => m.set(k, 1)); m.delete('Diğer');
  return [...[...m.keys()].map(k => [k, katIkon(k)]), ['Diğer', katIkon('Diğer')]];
};

// ---------- Bütçe (temel giderler): her ay, kendi değişikliği yoksa önceki ayın listesiyle gelir ----------
export function butceGruplari() {
  const grup = {};
  S.butce.forEach(r => { const a = ymOf(r['Ay']); if (/^\d{4}-\d{2}$/.test(a)) (grup[a] = grup[a] || []).push(r); });
  return grup;
}
export function butceAy(ym) {
  const grup = butceGruplari(), aylar = Object.keys(grup).sort();
  if (!aylar.length) return [];
  const a = aylar.filter(x => x <= ym).pop();
  if (!a) return [];
  return grup[a].filter(r => num(r['Tutar']) > 0).map(r => ({ kalem: r['Kalem'], kategori: r['Kategori'], tutar: num(r['Tutar']), ikon: r['İkon'] || '' }));
}
export const butceIkon = b => katSilindiMi(b.kategori) ? '❗' : (b.ikon || katIkon(b.kategori));

// ---------- Temel gider onayı: ✓ ile onaylanınca ay sonundan düşer; uygulamaya başlanan aydan önceki aylar hep onaylı ----------
export const onayBasla = () => ymOf(S.ayar.baslangic) || buAy();
export const onayKaydi = (ym, kalem) => S.onay.find(r => ymOf(r['Ay']) === ym && String(r['Kalem']) === String(kalem));
export const temelOnayli = (ym, kalem) => ym < onayBasla() || !!onayKaydi(ym, kalem);

// ---------- Bir ayın gelir-gider hesabı (Nébula ile aynı) ----------
export function ayHesap(ym) {
  const ay = r => ymOf(r['Tarih']) === ym, top = (a, f = () => true) => a.filter(f).reduce((t, r) => t + num(r['Tutar']), 0);
  const gelirler = S.gelir.filter(ay), giderler = S.giderler.filter(ay);
  const birikimler = S.kayitlar.filter(r => ay(r) && r['Tür'] === 'Birikim'), harcamalar = S.kayitlar.filter(r => ay(r) && r['Tür'] === 'Harcama');
  const temel = butceAy(ym), temelOnayliListe = temel.filter(b => temelOnayli(ym, b.kalem));
  const gelir = top(gelirler), sabit = temelOnayliListe.reduce((t, b) => t + b.tutar, 0), sabitBekleyen = temel.reduce((t, b) => t + b.tutar, 0) - sabit;
  const ekGelirden = top(giderler, g => !evet(g['Birikimden'])), ekBirikimden = top(giderler, g => evet(g['Birikimden']));
  const yatirilan = top(birikimler), harcanan = top(harcamalar);
  const gider = sabit + ekGelirden;
  const kalan = gelir - gider - yatirilan;
  return { ym, gelirler, giderler, birikimler, gelir, temel, sabit, sabitBekleyen, ekGelirden, ekBirikimden, gider, yatirilan, harcanan, kalan };
}
export function ilkAy() {
  const b = onayBasla();
  return [b, ...[...S.gelir, ...S.giderler, ...S.kayitlar].map(r => ymOf(r['Tarih']))].filter(Boolean).sort()[0] || buAy();
}
export { ymAdd };
