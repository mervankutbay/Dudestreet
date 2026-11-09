// Dudestreet — yapay zekâ çekirdeği: karakterler, sistem talimatı (tüm uygulama verisi), sohbetten işlemler (onaylı), arka plan hafızası
import { S, num, moneyHam as M, fmt, today, buAy, ymAdi, ymAdd, uid, lsGet, lsSet, evet, ekle, guncelle, sil, tazele, trFold, geriKaydet, esc } from './core.js';
import { malVarligi, hedefHesap, ayHesap, borclar, varliklar, butceAy, temelOnayli, birlesikKat, katAd, turBilgi, VARLIK_TURLERI, sonrakiGun } from './hesap.js';
import { giderEkle, giderSil, giderGuncelle, butceAyYaz, onayDegistir, planListe, kayitSil, varlikKaldir, borcSil } from './plan.js';
import { buildPersona } from './persona.js';
import * as AI from './gemini.js';

// ---------- Karakterler (Persona sekmesinde "karakterler" ve "aktif" anahtarlarında JSON) ----------
export function karakterler() {
  if (S._karakterler) return S._karakterler;
  let l = [];
  try { l = JSON.parse(S.persona.karakterler || '[]'); } catch { l = []; }
  if (!l.length && S.persona.prompt) l = [{ id: 'k1', ad: 'Future Dude', ikon: '😎', tip: 'ben', cevaplar: S.persona.cevapObj || null, prompt: S.persona.prompt, kaynak: S.persona.kaynak || 'anket' }];
  S._karakterler = l;
  return l;
}
export const aktifKarakter = () => { const l = karakterler(); return l.find(k => k.id === S.persona.aktif) || l[0] || null; };
// "Gelecekteki ben" karakterleri hedefi kişilik metninde de bilir: hedef değişince anketten üretilmişler yeniden üretilir
export async function benKarakterleriniGuncelle() {
  const l = karakterler(); let degisti = false;
  l.forEach(k => { if (k.tip === 'ben' && k.kaynak === 'anket' && k.cevaplar) { k.prompt = buildPersona({ ...k.cevaplar, ...S.ayar }); degisti = true; } });
  if (degisti) await karakterleriYaz(l);
}
export async function karakterleriYaz(l, aktif) {
  S._karakterler = l;
  const a = aktif ?? (l.find(k => k.id === S.persona.aktif) ? S.persona.aktif : l[0]?.id || '');
  const ak = l.find(k => k.id === a);
  await S.db.setKV('Persona', { karakterler: JSON.stringify(l), aktif: a || '', prompt: ak?.prompt || '', cevaplar: ak?.tip === 'ben' && ak.cevaplar ? JSON.stringify(ak.cevaplar) : '', kaynak: ak?.kaynak || '', guncelleme: new Date().toISOString() });
  S.persona.karakterler = JSON.stringify(l); S.persona.aktif = a; S.persona.prompt = ak?.prompt || '';
  S.persona.cevapObj = ak?.tip === 'ben' ? ak.cevaplar : null;
}
export const sohbetAnahtar = k => 'ds_sohbet_' + (k?.id || 'yok');
export const sohbetOku = k => lsGet(sohbetAnahtar(k), []);
export const sohbetYaz = (k, l) => lsSet(sohbetAnahtar(k), l.slice(-60));

// ---------- Sistem talimatı ----------
const ISLEM_KURALI = `UYGULAMADA İŞLEM YAPMA: Kullanıcı bir şeyin kaydedilmesini, değiştirilmesini ya da silinmesini isterse ya da uygulamaya henüz girilmemiş bir para hareketinden bahsederse (ör. "maaş yattı 65 bin", "markete 1.200 verdim", "Bonus kartına 5 bin ödedim", "arabamın değeri 1,3 milyon oldu", "kira 20 bin oldu", "şu gideri sil", "hedefimi 3 milyon yap"), cevabının EN SONUNA tek satır olarak şu etiketi ekle (başka hiçbir yerde kullanma):
[[ISLEM [{"tip":"...", ...}, ...]]]
Kullanılabilir işlemler (tutarlar ana para biriminde, sayı olarak; tarih "YYYY-AA-GG", yazılmadıysa bugün):
- {"tip":"gelir","tutar":S,"tarih":T,"not":"Maaş"}
- {"tip":"gider","tutar":S,"kalem":"Market","kategori":"KATEGORİ","tarih":T,"birikimden":false}  (o aya özel harcama; birikimden ödendiyse true)
- {"tip":"birikim","tutar":S,"not":"..."}  (hedef/birikim hesabına yatırma)
- {"tip":"birikim_cek","tutar":S,"not":"..."}  (birikimden çekme = kural ihlali)
- {"tip":"temel_gider","kalem":"Kira","tutar":S,"kategori":"Kira"}  (her ay tekrar eden gider; bu ay ve sonrası için ekler/günceller; tutar 0 ise kaldırır)
- {"tip":"temel_onay","kalem":"Kira"}  (bu ayın temel giderini ödendi olarak işaretler)
- {"tip":"varlik_ekle","tur":"TÜR","ad":"...","sembol":"THYAO.IS","adet":S,"deger":S,"artis":S,"birikimden":false}  (deger = birim alış fiyatı ya da elle değerli varlığın bugünkü değeri; artis = yıllık değer artışı %, sadece ev/arsa/araba/diğer için; parası birikim hesabından çıktıysa "birikimden":true, ör. "birikimden 10 gram altın aldım")
- {"tip":"varlik_deger","kimlik":"K","deger":S}  (elle değerli varlığın güncel değeri)
- {"tip":"varlik_sat","kimlik":"K","adet":S,"fiyat":S}
- {"tip":"borc_ekle","tur":"Kredi kartı|Kredi|Kişiye borç|Diğer","ad":"...","banka":"...","borc":S,"limit":S,"asgari":S,"son_odeme":GÜN,"kesim":GÜN}
- {"tip":"borc_ode","kimlik":"K","tutar":S}
- {"tip":"borc_harcama","kimlik":"K","tutar":S,"gider":true,"kalem":"Market","kategori":"KATEGORİ"}  (kredi kartına harcama ekler; "gider":true ise aynı harcama Gelir-Gider'e ek gider olarak da yazılır — kullanıcı "kartla ... aldım/ödedim" derse true yap)
- {"tip":"borc_duzenle","kimlik":"K","ad":"...","banka":"...","borc":S,"limit":S,"asgari":S,"son_odeme":GÜN,"kesim":GÜN}  (sadece değişen alanları yaz)
- {"tip":"not_ekle","metin":"..."}  (Notlar'a yeni not)
- {"tip":"hafiza","not":"..."}  (kullanıcı "bunu hatırla" derse)
- {"tip":"hedef","hedef_ne":"...","hedef_tutar":S,"aylik_min":S,"hedef_tarih":"YYYY-AA"}
- {"tip":"duzelt","sekme":"Gelir|Giderler|Kayıtlar","kimlik":"K","tutar":S,"ad":"...","kategori":"KATEGORİ","tarih":T}  (girilmiş bir kaydı düzeltir; sadece değişen alanları yaz. ad: gelirde not, giderde kalem, birikimde not)
- {"tip":"hedef_varlik","kimlik":"K","hedefte":true}  (varlığı hedefe say / false ise hedeften çıkar)
- {"tip":"sil","sekme":"Gelir|Giderler|Kayıtlar|Borçlar|Portföy","kimlik":"K"}
- {"tip":"geri_al"}  (kullanıcı "geri al", "az önceki yanlıştı" derse: son onaylanan işlem kartını geri alır)
- {"tip":"hatirlat","baslik":"...","tarih":"YYYY-AA-GG","saat":"SS:DD","tekrar":"yok|haftalik|aylik|yillik","alarm":DAKİKA}  (telefonun takvimine alarmlı hatırlatma; ör. "yarın 16:30 özel ders hatırlat", "kart son ödemesini her ay hatırlat" → kartın son ödeme gününde, aylık, alarm 1440. Saat yazılmadıysa 10:00)
- {"tip":"mesaj","kime":"...","metin":"..."}  (kullanıcı birine mesaj yazmanı isterse: metni sen yaz, WhatsApp'ta hazır açılır, gönderen kullanıcıdır. Kullanıcının ağzından, onun konuşma diliyle yaz; karakterin değil.)
- {"tip":"ozet_paylas","ay":"YYYY-AA","metin":"..."}  (ayın özetini paylaşmak isterse: görsel + senin yazdığın kısa paylaşım metni; metinde sadece aşağıdaki verilerdeki rakamlar)
Kurallar:
- "kimlik" alanlarını aşağıdaki listelerdeki [K:...] değerlerinden AYNEN al; uydurma. Bulamıyorsan sor.
- Varlık türleri: ${VARLIK_TURLERI.map(t => t.tur).join(', ')}. Borsa İstanbul hisseleri ".IS" ekiyle (THYAO.IS), kripto sadece kısa adla (BTC).
- Bir mesajda birden fazla işlem olabilir (dizi). Tutar ya da hedef belirsizse etiket koyma, önce sor.
- Etiketi sen işlemiyorsun: uygulama kullanıcıya bir kart gösterir, kullanıcı "Onayla" derse işlenir. Bu yüzden "kaydettim" deme; "aşağıdan onayla, işleyeyim" gibi söyle.
- Fiş, fatura ya da kart ekstresi fotoğrafı gelirse: okuyabildiğin her harcamayı ayrı "gider" ya da (kartla ödendiyse ve kart biliniyorsa) "borc_harcama" olarak listele; emin olmadığın satırı yazma, cevapta belirt. Tarihi fişteki tarih olsun.
- UYGULAMA HAKKINDA (birine tanıtırken kullan): Dudestreet ücretsiz bir kişisel finans uygulaması: tüm mal varlığı (hisse, kripto, altın, döviz, ev, araba), gelir-gider ve aylık bütçe, kredi kartı/borç takibi, birikim hedefi, akıllı notlar ve kullanıcının kendi yarattığı karakterle konuşan, kayıt yapan yapay zekâ. Veriler kullanıcının kendi Google Drive'ındaki tabloda durur, uygulama hiçbir veri tutmaz. Adres: ${location.origin}
- Uygulamanın nasıl kullanılacağını sorarsa anlat: alt sekmeler Özet, Gelir-Gider, Varlıklar, Borçlar, Hedef; üstte Notlar (✏️), sohbet (💬), Ayarlar (⚙️, tema, yedek, değişiklik günlüğü).`;

const KIMLIK_KURALI = `KİMLİĞİN: Sen kullanıcının kendi oluşturduğu bir karakterle konuşan bir yapay zekâsın; "Dudestreet" adlı kişisel finans uygulamasının içindesin. Karakterin konuşma tarzına sadık kal. Gerçek bir kişiden esinlenen bir karaktersen bile o kişinin kendisi olduğunu iddia etme; doğrudan sorulursa uygulamada kullanıcının yarattığı, ondan esinlenen bir karakter olduğunu söyle. Gerçek kişilere uydurma sözler, olaylar ya da özel bilgiler yükleme.
GENEL: Kullanıcının yazdığı dilde cevap ver (varsayılan Türkçe). Rakamları sadece aşağıdaki verilerden al, uydurma. Hisse/kripto hakkında yorum yapabilirsin ama kesin getiri vaadi verme, "şunu al/sat" diye emir verme; riskleri söyle, karar onun. Sağlık, hukuk ve vergi konularında kesin tavsiye verme, uzmana yönlendir. Gerektiğinde güncel bilgi için internette arayabilirsin.`;

export function veriOzeti() {
  const m = malVarligi(), h = hedefHesap(), ym = buAy(), ay = ayHesap(ym);
  const k = x => `[K:${x}]`;
  const pf = m.v.map(x => `${k(x.p['Kimlik'])} ${x.p['Ad'] || x.p['Sembol']} (${x.p['Tür']}${turBilgi(x.p['Tür']).canli && x.p['Tür'] !== 'MBKAYO payı' ? ', ' + x.p['Sembol'] : ''}): ${fmt(x.adet, 4)} adet, değer ${M(x.deger)}${x.alis ? `, alış ${M(x.alis)}, fark ${M(x.kar)} (%${fmt(x.karYuzde, 1)})` : ''}${x.tahmini ? ` [tahmini, yıllık %${fmt(x.oran, 1)}]` : ''}${x.canli && x.gunluk ? `, bugün %${fmt(x.gunluk, 2)}` : ''}${x.hedefte ? ' [hedefe sayılıyor]' : ''}`).join('\n') || 'yok';
  const brc = borclar().map(x => `${k(x.b['Kimlik'])} ${x.b['Ad']} (${x.b['Tür']}${x.b['Banka'] ? ', ' + x.b['Banka'] : ''}): borç ${M(x.borc)}${x.limit ? `, limit ${M(x.limit)}` : ''}${x.asgari ? `, asgari/taksit ${M(x.asgari)}` : ''}${x.son ? `, son ödeme ${x.son} (${x.kalanGun} gün)` : ''}`).join('\n') || 'yok';
  const temel = ay.temel.map(b => `${b.kalem} ${M(b.tutar)} [${b.kategori}]${temelOnayli(ym, b.kalem) ? ' ✓ödendi' : ' ⏳bekliyor'}`).join(', ') || 'girilmemiş';
  const giderler = S.giderler.slice(-15).map(g => `${k(g['Kimlik'])} ${g['Tarih']} ${g['Kalem']} [${g['Kategori']}] ${M(num(g['Tutar']))}${evet(g['Birikimden']) ? ' (birikimden)' : ''}`).join('\n') || 'yok';
  const gelirler = S.gelir.slice(-6).map(g => `${k(g['Kimlik'])} ${g['Tarih']} ${M(num(g['Tutar']))} ${g['Not'] || ''}`).join('\n') || 'yok';
  const kayit = S.kayitlar.filter(r => ['Birikim', 'Harcama'].includes(r['Tür'])).slice(-8).map(r => `${k(r['Kimlik'])} ${r['Tarih']} ${r['Tür']} ${M(num(r['Tutar']))} ${r['Not'] || ''}`).join('\n') || 'yok';
  const aylik = []; for (let i = 0, a = ym; i < 4; i++, a = ymAdd(a, -1)) { const x = ayHesap(a); if (x.gelir || x.gider) aylik.push(`${a}: gelir ${M(x.gelir)}, gider ${M(x.gider)}, birikim ${M(x.yatirilan)}, ay sonu ${M(x.kalan)}`); }
  const plan = planListe().map(p => `${p.ad} ${M(num(p.tutar))}`).join(', ');
  const notlar = S.notlar.slice(-5).map(n => String(n['Metin'] || '').split('\n')[0]).filter(Boolean).join(' · ');
  return `ANA PARA BİRİMİ: ${S.ayar.para_birimi || '₺'} · GİDER KATEGORİLERİ: ${birlesikKat().map(([c]) => katAd(c)).join(', ')}
TOPLAM MAL VARLIĞI: net ${M(m.net)} (varlıklar ${M(m.brut)} − borçlar ${M(m.borc)}); bugünkü değişim ${M(m.gunluk)}; birikim hesabı nakdi ${M(m.nakit)}
HEDEF: ${S.ayar.hedef_ne || 'koymadı'}${h.hedef ? ` · hedef ${M(h.hedef)} · birikmiş ${M(h.toplam)} (%${(h.ilerleme * 100).toFixed(1)}) · kalan ${M(h.kalan)} · tahmini varış ${h.varis || '-'}` : ''}${h.min ? ` · aylık en az ${M(h.min)}, bu ay ${M(h.buAy)} (${h.durum})` : ''}${h.gereken !== null ? ` · hedef tarihe (${S.ayar.hedef_tarih}) yetişmek için ayda ${M(h.gereken)}` : ''}
BU AY (${ymAdi(ym)}): gelir ${M(ay.gelir)}, gider ${M(ay.gider)} (temel ${M(ay.sabit)} + ek ${M(ay.ekGelirden)}), birikime ${M(ay.yatirilan)}, ay sonu ${M(ay.kalan)}; beklenen maaş ${S.ayar.aylik_gelir ? M(num(S.ayar.aylik_gelir)) : 'girilmedi'}${plan ? `; notlardan onay bekleyen: ${plan}` : ''}
TEMEL GİDERLER: ${temel}
SON AYLAR:
${aylik.join('\n') || 'yok'}
SON EK GİDERLER:
${giderler}
SON GELİRLER:
${gelirler}
BİRİKİM HESABI HAREKETLERİ:
${kayit}
VARLIKLAR:
${pf}
BORÇLAR:
${brc}${notlar ? `\nNOTLARININ BAŞLIKLARI: ${notlar}` : ''}`;
}

export function sistemTalimati(k = aktifKarakter()) {
  const simdi = new Date().toLocaleString('tr-TR', { dateStyle: 'full', timeStyle: 'short' });
  const kisilik = k?.prompt || 'Sen "Future Dude"sın: kullanıcının 10 yıl sonraki hâli. Samimi, esprili ve hedeflerine sadıksın.';
  const hafiza = S.hafiza.length ? S.hafiza.slice(-50).map(x => `- ${x['Not']}`).join('\n') : '(henüz bir şey yok)';
  return `${kisilik}

${KIMLIK_KURALI}

Şu anki gerçek tarih: ${simdi} (bugün ${today()})

HAFIZAN (kullanıcı hakkında bildiklerin; doğal kullan, liste gibi sıralama, uydurma):
${hafiza}

GÜNCEL VERİLER (kullanıcının kendi tablosundan):
${veriOzeti()}

${ISLEM_KURALI}`;
}

// ---------- İşlemler ----------
const TIPLER = {
  gelir: ['💼', 'Gelir'], gider: ['🧾', 'Ek gider'], birikim: ['💰', 'Birikime yatır'], birikim_cek: ['💸', 'Birikimden çek'], temel_gider: ['📋', 'Temel gider'], temel_onay: ['✅', 'Temel gider ödendi'],
  varlik_ekle: ['📈', 'Varlık ekle'], varlik_deger: ['✏️', 'Varlık değeri'], varlik_sat: ['🏷️', 'Varlık sat'], borc_ekle: ['💳', 'Borç / kart ekle'], borc_ode: ['✅', 'Borç ödemesi'], borc_harcama: ['💳', 'Karta harcama'],
  not_ekle: ['📝', 'Not'], hafiza: ['🧠', 'Hafızaya ekle'], hedef: ['🎯', 'Hedef'], sil: ['🗑️', 'Sil'],
  duzelt: ['✏️', 'Düzelt'], hedef_varlik: ['🎯', 'Hedefe say'], borc_duzenle: ['✏️', 'Kart / borç bilgisi'], geri_al: ['↩️', 'Geri al'],
  hatirlat: ['⏰', 'Takvime hatırlatma'], mesaj: ['💬', 'Mesaj'], ozet_paylas: ['📊', 'Ay özeti'],
};
// Veri yazmayan, pencere açan işlemler: kartta "Aç" ile istendiği kadar açılır
export const ARAC = new Set(['hatirlat', 'mesaj', 'ozet_paylas']);
const tarihIleri = t => /^\d{4}-\d{2}-\d{2}$/.test(t || '') ? t : today();
const katBul = (ad, yedek = 'Diğer') => birlesikKat().find(([k]) => trFold(katAd(k)) === trFold(ad))?.[0] || yedek;
const tarihOk = t => /^\d{4}-\d{2}-\d{2}$/.test(t || '') && t <= today() ? t : today();
const tutarOk = t => { const v = Math.round(num(t) * 100) / 100; return v > 0 && v < 1e12 ? v : 0; };
const bul = (tablo, kim) => tablo.find(r => r['Kimlik'] === String(kim || ''));

// Yapay zekânın önerdiği işlemi doğrular; geçersizse null
export function islemTemizle(x) {
  if (!x || !TIPLER[x.tip]) return null;
  const o = { tip: x.tip };
  switch (x.tip) {
    case 'gelir': o.tutar = tutarOk(x.tutar); o.tarih = tarihOk(x.tarih); o.not = String(x.not || 'Gelir').slice(0, 80); return o.tutar ? o : null;
    case 'gider': o.tutar = tutarOk(x.tutar); o.tarih = tarihOk(x.tarih); o.kalem = String(x.kalem || x.not || 'Harcama').slice(0, 60); o.kategori = birlesikKat().find(([k]) => trFold(katAd(k)) === trFold(x.kategori))?.[0] || 'Diğer'; o.birikimden = x.birikimden === true; return o.tutar ? o : null;
    case 'birikim': case 'birikim_cek': o.tutar = tutarOk(x.tutar); o.tarih = tarihOk(x.tarih); o.not = String(x.not || '').slice(0, 80); return o.tutar ? o : null;
    case 'temel_gider': o.kalem = String(x.kalem || '').trim().slice(0, 40); o.tutar = Math.max(0, Math.round(num(x.tutar) * 100) / 100); o.kategori = birlesikKat().find(([k]) => trFold(katAd(k)) === trFold(x.kategori))?.[0] || butceAy(buAy()).find(b => b.kalem === o.kalem)?.kategori || 'Diğer'; return o.kalem ? o : null;
    case 'temel_onay': o.kalem = butceAy(buAy()).find(b => trFold(b.kalem) === trFold(x.kalem))?.kalem; return o.kalem ? o : null;
    case 'varlik_ekle': {
      const t = VARLIK_TURLERI.find(v => trFold(v.tur) === trFold(x.tur)); if (!t) return null;
      o.tur = t.tur; o.ad = String(x.ad || x.sembol || t.tur).slice(0, 40); o.adet = tutarOk(x.adet) || 1; o.deger = tutarOk(x.deger);
      o.sembol = t.canli ? String(x.sembol || '').toUpperCase().replace(/-USD$/, '').slice(0, 20) : o.ad.toLocaleUpperCase('tr').slice(0, 14);
      if (t.tur.includes('gram')) o.sembol = t.tur.startsWith('Altın') ? 'ALTIN' : 'GUMUS';
      if (t.tur === 'MBKAYO payı') { o.sembol = 'MBKAYO'; o.ad = 'MBKAYO bireysel bakiye'; o.adet = 1; }
      if (t.canli && !o.sembol) return null;
      o.artis = t.canli ? '' : (x.artis !== undefined && x.artis !== null ? num(x.artis) : t.artis || 0);
      o.birikimden = x.birikimden === true && t.tur !== 'MBKAYO payı';
      return o.deger || t.tur === 'MBKAYO payı' ? o : null;
    }
    case 'varlik_deger': { const p = bul(S.portfoy, x.kimlik); if (!p || turBilgi(p['Tür']).canli) return null; o.kimlik = p['Kimlik']; o.ad = p['Ad']; o.deger = tutarOk(x.deger); return o.deger ? o : null; }
    case 'varlik_sat': { const v = varliklar().find(y => y.p['Kimlik'] === x.kimlik); if (!v || !v.b.canli) return null; o.kimlik = x.kimlik; o.ad = v.p['Ad']; o.adet = Math.min(v.adet, tutarOk(x.adet) || v.adet); o.fiyat = tutarOk(x.fiyat) || v.fiyat; return o; }
    case 'borc_ekle': o.tur = ['Kredi kartı', 'Kredi', 'Kişiye borç', 'Diğer'].includes(x.tur) ? x.tur : 'Kredi kartı'; o.ad = String(x.ad || '').slice(0, 40); o.banka = String(x.banka || '').slice(0, 40); o.borc = Math.max(0, num(x.borc)); o.limit = Math.max(0, num(x.limit)); o.asgari = Math.max(0, num(x.asgari)); o.son_odeme = Math.round(num(x.son_odeme)) || ''; o.kesim = Math.round(num(x.kesim)) || ''; return o.ad ? o : null;
    case 'borc_ode': case 'borc_harcama': {
      const b = bul(S.borclar, x.kimlik); if (!b) return null; o.kimlik = b['Kimlik']; o.ad = b['Ad']; o.tutar = tutarOk(x.tutar);
      if (x.tip === 'borc_harcama' && x.gider === true) { o.gider = true; o.kalem = String(x.kalem || x.not || 'Kart harcaması').slice(0, 60); o.kategori = katBul(x.kategori); }
      return o.tutar ? o : null;
    }
    case 'not_ekle': o.metin = String(x.metin || '').slice(0, 2000); return o.metin.trim() ? o : null;
    case 'hafiza': o.not = String(x.not || '').slice(0, 300); return o.not.trim() ? o : null;
    case 'hedef': ['hedef_ne', 'hedef_tutar', 'aylik_min', 'hedef_tarih'].forEach(k => { if (x[k] !== undefined && x[k] !== null && x[k] !== '') o[k] = String(x[k]); }); return Object.keys(o).length > 1 ? o : null;
    case 'duzelt': {
      const SEK = { Gelir: S.gelir, Giderler: S.giderler, 'Kayıtlar': S.kayitlar }, r = bul(SEK[x.sekme] || [], x.kimlik); if (!r) return null;
      if (x.sekme === 'Kayıtlar' && !['Birikim', 'Harcama'].includes(r['Tür'])) return null;
      o.sekme = x.sekme; o.kimlik = r['Kimlik']; o.eskiAd = r['Kalem'] || r['Not'] || r['Tür'] || ''; o.yeni = {};
      if (x.tutar !== undefined && x.tutar !== null && x.tutar !== '') { const t = tutarOk(x.tutar); if (t) o.yeni.tutar = t; }
      if (x.ad) o.yeni.ad = String(x.ad).slice(0, 60);
      if (x.tarih && /^\d{4}-\d{2}-\d{2}$/.test(x.tarih)) o.yeni.tarih = x.tarih;
      if (x.kategori && x.sekme === 'Giderler') o.yeni.kategori = katBul(x.kategori, r['Kategori']);
      o.eski = { tutar: num(r['Tutar']), ad: o.eskiAd, tarih: r['Tarih'], kategori: r['Kategori'] };
      return Object.keys(o.yeni).length ? o : null;
    }
    case 'hedef_varlik': { const p = bul(S.portfoy, x.kimlik); if (!p) return null; o.kimlik = p['Kimlik']; o.ad = p['Ad'] || p['Sembol']; o.hedefte = x.hedefte !== false; return o; }
    case 'borc_duzenle': {
      const b = bul(S.borclar, x.kimlik); if (!b) return null; o.kimlik = b['Kimlik']; o.ad0 = b['Ad']; o.yeni = {};
      if (x.ad) o.yeni.Ad = String(x.ad).slice(0, 40); if (x.banka !== undefined && x.banka !== null) o.yeni.Banka = String(x.banka).slice(0, 40);
      [['borc', 'Borç'], ['limit', 'Limit'], ['asgari', 'Asgari']].forEach(([k, s]) => { if (x[k] !== undefined && x[k] !== null && x[k] !== '') o.yeni[s] = String(Math.max(0, Math.round(num(x[k]) * 100) / 100)); });
      [['son_odeme', 'Son ödeme'], ['kesim', 'Kesim']].forEach(([k, s]) => { const g = Math.round(num(x[k])); if (g >= 1 && g <= 31) o.yeni[s] = String(g); });
      return Object.keys(o.yeni).length ? o : null;
    }
    case 'geri_al': return o;
    case 'hatirlat': {
      o.baslik = String(x.baslik || '').slice(0, 80); if (!o.baslik) return null;
      o.tarih = tarihIleri(x.tarih); o.saat = /^\d{1,2}:\d{2}$/.test(x.saat || '') ? x.saat : '10:00';
      o.tekrar = ['yok', 'haftalik', 'aylik', 'yillik'].includes(x.tekrar) ? x.tekrar : 'yok'; o.alarm = [0, 15, 30, 60, 1440, 2880].includes(Number(x.alarm)) ? Number(x.alarm) : 15;
      return o;
    }
    case 'mesaj': o.kime = String(x.kime || '').slice(0, 60); o.metin = String(x.metin || '').slice(0, 3000); return o.metin.trim() ? o : null;
    case 'ozet_paylas': o.ay = /^\d{4}-\d{2}$/.test(x.ay || '') ? x.ay : buAy(); o.metin = String(x.metin || '').slice(0, 2000); return o;
    case 'sil': { const SEK = { Gelir: S.gelir, Giderler: S.giderler, 'Kayıtlar': S.kayitlar, 'Borçlar': S.borclar, 'Portföy': S.portfoy }; const t = SEK[x.sekme]; const r = t && bul(t, x.kimlik); if (!r) return null; o.sekme = x.sekme; o.kimlik = r['Kimlik']; o.ad = r['Kalem'] || r['Ad'] || r['Not'] || r['Tür'] || ''; o.tutar = num(r['Tutar'] || r['Borç']); return o; }
  }
  return null;
}
export function islemOzet(o) {
  const [ik, ad] = TIPLER[o.tip];
  const d = {
    gelir: () => `${M(o.tutar)} · ${o.not} · ${o.tarih}`, gider: () => `${o.kalem} · ${M(o.tutar)} · ${katAd(o.kategori)}${o.birikimden ? ' · birikimden!' : ''} · ${o.tarih}`,
    birikim: () => `${M(o.tutar)}${o.not ? ' · ' + o.not : ''}`, birikim_cek: () => `${M(o.tutar)}${o.not ? ' · ' + o.not : ''}`,
    temel_gider: () => o.tutar ? `${o.kalem} · ayda ${M(o.tutar)} (bu ay ve sonrası)` : `${o.kalem} temel giderlerden kalkar`, temel_onay: () => o.kalem,
    varlik_ekle: () => `${o.ad} (${o.tur}) · ${o.tur === 'MBKAYO payı' ? 'canlı bakiye' : `${fmt(o.adet, 4)} × ${M(o.deger)}`}${o.artis ? ` · yıllık %${fmt(o.artis, 1)}` : ''}${o.birikimden ? ` · ${M(o.adet * o.deger)} birikimden` : ''}`,
    varlik_deger: () => `${o.ad} → ${M(o.deger)}`, varlik_sat: () => `${o.ad} · ${fmt(o.adet, 4)} adet × ${M(o.fiyat)}`,
    borc_ekle: () => `${o.ad} (${o.tur}) · borç ${M(o.borc)}${o.limit ? ' · limit ' + M(o.limit) : ''}${o.son_odeme ? ' · son ödeme ayın ' + o.son_odeme + "'i" : ''}`,
    borc_ode: () => `${o.ad} · ${M(o.tutar)}`, borc_harcama: () => `${o.ad} · ${M(o.tutar)}${o.gider ? ` · Gelir-Gider’e de: ${o.kalem} (${katAd(o.kategori)})` : ''}`,
    duzelt: () => `${o.eskiAd}: ${[o.yeni.tutar !== undefined && `${M(o.eski.tutar)} → ${M(o.yeni.tutar)}`, o.yeni.ad && `“${o.yeni.ad}”`, o.yeni.kategori && katAd(o.yeni.kategori), o.yeni.tarih && `${o.eski.tarih} → ${o.yeni.tarih}`].filter(Boolean).join(' · ')}`,
    hedef_varlik: () => `${o.ad} ${o.hedefte ? 'hedefe sayılsın' : 'hedeften çıkarılsın'}`,
    borc_duzenle: () => `${o.ad0}: ${Object.entries(o.yeni).map(([k, v]) => `${k} ${['Borç', 'Limit', 'Asgari'].includes(k) ? M(num(v)) : v}`).join(' · ')}`,
    geri_al: () => 'Son onayladığın işlemler geri alınır',
    hatirlat: () => `${o.baslik} · ${o.tarih.split('-').reverse().join('.')} ${o.saat}${o.tekrar !== 'yok' ? ' · ' + { haftalik: 'her hafta', aylik: 'her ay', yillik: 'her yıl' }[o.tekrar] : ''}`,
    mesaj: () => `${o.kime ? o.kime + ': ' : ''}${o.metin.replace(/\s+/g, ' ').slice(0, 90)}${o.metin.length > 90 ? '…' : ''}`,
    ozet_paylas: () => `${ymAdi(o.ay)} · görsel ve paylaşım metni`, not_ekle: () => o.metin.split('\n')[0].slice(0, 80), hafiza: () => o.not,
    hedef: () => [o.hedef_ne, o.hedef_tutar && M(num(o.hedef_tutar)), o.aylik_min && 'ayda ' + M(num(o.aylik_min)), o.hedef_tarih].filter(Boolean).join(' · '),
    sil: () => `${o.sekme}: ${o.ad}${o.tutar ? ' · ' + M(o.tutar) : ''}`,
  }[o.tip];
  return { ik, ad, detay: d(), kirmizi: o.tip === 'birikim_cek' || o.tip === 'sil' || o.tip === 'geri_al' || (o.tip === 'gider' && o.birikimden) || (o.tip === 'varlik_ekle' && o.birikimden) };
}

export async function islemUygula(o) {
  switch (o.tip) {
    case 'gelir': return ekle('Gelir', { Kimlik: uid(), Tarih: o.tarih, Tutar: String(o.tutar), Not: o.not });
    case 'gider': return giderEkle({ tarih: o.tarih, kalem: o.kalem, kategori: o.kategori, tutar: o.tutar, birikimden: o.birikimden });
    case 'birikim': return ekle('Kayıtlar', { Kimlik: uid(), Tarih: o.tarih, 'Tür': 'Birikim', Tutar: String(o.tutar), Kategori: 'Birikim', Not: o.not || 'sohbetten' });
    case 'birikim_cek': return ekle('Kayıtlar', { Kimlik: uid(), Tarih: o.tarih, 'Tür': 'Harcama', Tutar: String(o.tutar), Kategori: 'Birikimden çekiş', Not: o.not || 'sohbetten' });
    case 'temel_gider': {
      const ym = buAy(), l = butceAy(ym).map(b => ({ ...b })), es = l.find(b => trFold(b.kalem) === trFold(o.kalem));
      if (es) { if (o.tutar) es.tutar = o.tutar; else l.splice(l.indexOf(es), 1); } else if (o.tutar) l.push({ kalem: o.kalem, kategori: o.kategori, tutar: o.tutar, ikon: '' });
      return butceAyYaz(ym, l);
    }
    case 'temel_onay': return onayDegistir(buAy(), o.kalem, true);
    case 'varlik_ekle': {
      await ekle('Portföy', { Kimlik: uid(), 'Tür': o.tur, Sembol: o.sembol, Ad: o.ad, Adet: String(o.adet), Maliyet: String(o.deger || 0), Tarih: today(), Not: 'sohbetten', 'Yıllık artış': o.artis === '' ? '' : String(o.artis), Hedef: '' });
      return ekle('Kayıtlar', { Kimlik: uid(), Tarih: today(), 'Tür': o.birikimden ? 'Varlık alımı' : 'Varlık girişi', Tutar: String(o.adet * (o.deger || 0)), Kategori: o.sembol, Not: `${o.ad} eklendi` });
    }
    case 'varlik_deger': {
      const x = varliklar().find(y => y.p['Kimlik'] === o.kimlik), fark = o.deger - (x ? x.fiyat : o.deger);
      await guncelle('Portföy', o.kimlik, { Maliyet: String(o.deger), Tarih: today() });
      if (Math.abs(fark) > 0.5) await ekle('Kayıtlar', { Kimlik: uid(), Tarih: today(), 'Tür': fark > 0 ? 'Varlık girişi' : 'Varlık çıkışı', Tutar: String(Math.abs(fark)), Kategori: x?.p['Sembol'] || '', Not: `${o.ad} değeri güncellendi` });
      return;
    }
    case 'varlik_sat': {
      const x = varliklar().find(y => y.p['Kimlik'] === o.kimlik); if (!x) throw new Error('Varlık bulunamadı');
      const kalan = x.adet - o.adet;
      if (kalan > 1e-9) await guncelle('Portföy', o.kimlik, { Adet: String(Number(kalan.toPrecision(10))) }); else await sil('Portföy', o.kimlik);
      return ekle('Kayıtlar', { Kimlik: uid(), Tarih: today(), 'Tür': 'Varlık satışı', Tutar: String(o.adet * o.fiyat), Kategori: x.p['Sembol'], Not: `${o.ad} satıldı` });
    }
    case 'borc_ekle': return ekle('Borçlar', { Kimlik: uid(), 'Tür': o.tur, Ad: o.ad, Banka: o.banka, Borç: String(o.borc), Limit: o.limit ? String(o.limit) : '', Asgari: o.asgari ? String(o.asgari) : '', Kesim: String(o.kesim || ''), 'Son ödeme': String(o.son_odeme || ''), Not: '' });
    case 'borc_ode': case 'borc_harcama': {
      const b = bul(S.borclar, o.kimlik), borc = num(b['Borç']), ode = o.tip === 'borc_ode';
      await guncelle('Borçlar', o.kimlik, { 'Borç': String(Math.max(0, Math.round((borc + (ode ? -o.tutar : o.tutar)) * 100) / 100)), ...(ode && num(b['Asgari']) ? { Asgari: String(Math.max(0, num(b['Asgari']) - o.tutar)) } : {}) });
      await ekle('Borç hareketleri', { Kimlik: uid(), 'Borç': o.kimlik, Tarih: today(), 'Tür': ode ? 'Ödeme' : 'Harcama', Tutar: String(o.tutar), Not: o.gider ? o.kalem : 'sohbetten' });
      if (o.gider) await giderEkle({ tarih: today(), kalem: o.kalem, kategori: o.kategori, tutar: o.tutar, birikimden: false, not: `${o.ad} ile` });
      return;
    }
    case 'duzelt': {
      const y = o.yeni;
      if (o.sekme === 'Gelir') return guncelle('Gelir', o.kimlik, { ...(y.tutar !== undefined ? { Tutar: String(y.tutar) } : {}), ...(y.ad ? { Not: y.ad } : {}), ...(y.tarih ? { Tarih: y.tarih } : {}) });
      const gider = o.sekme === 'Giderler' ? bul(S.giderler, o.kimlik) : (() => { const r = bul(S.kayitlar, o.kimlik); return r?.['Bağ'] ? bul(S.giderler, r['Bağ']) : null; })();
      if (gider) return giderGuncelle(gider, { ...(y.tutar !== undefined ? { Tutar: String(y.tutar) } : {}), ...(y.ad ? { Kalem: y.ad } : {}), ...(y.kategori ? { Kategori: y.kategori } : {}), ...(y.tarih ? { Tarih: y.tarih } : {}) });
      return guncelle('Kayıtlar', o.kimlik, { ...(y.tutar !== undefined ? { Tutar: String(y.tutar) } : {}), ...(y.ad ? { Not: y.ad } : {}), ...(y.tarih ? { Tarih: y.tarih } : {}) });
    }
    case 'hedef_varlik': return guncelle('Portföy', o.kimlik, { Hedef: o.hedefte ? 'evet' : '' });
    case 'borc_duzenle': return guncelle('Borçlar', o.kimlik, o.yeni);
    case 'hatirlat': case 'mesaj': case 'ozet_paylas': return aracAc(o);
    case 'not_ekle': return ekle('Notlar', { Kimlik: 'n' + uid(), Metin: o.metin, 'Güncelleme': new Date().toISOString(), Sabit: '' });
    case 'hafiza': return ekle('Hafıza', { Tarih: today(), Not: o.not, Kaynak: 'Kullanıcı' });
    case 'hedef': { const y = {}; geriKaydet({ t: 'kv', sekme: 'Ayarlar', eski: Object.fromEntries(['hedef_ne', 'hedef_tutar', 'aylik_min', 'hedef_tarih'].filter(k => o[k] !== undefined).map(k => [k, S.ayar[k] || ''])) }); if (o.hedef_ne) y.hedef_ne = o.hedef_ne; if (o.hedef_tutar) y.hedef_tutar = String(num(o.hedef_tutar)); if (o.aylik_min) y.aylik_min = String(num(o.aylik_min)); if (o.hedef_tarih) y.hedef_tarih = o.hedef_tarih; await S.db.setKV('Ayarlar', y); S.ayar = await S.db.kv('Ayarlar'); return benKarakterleriniGuncelle(); }
    case 'sil':   // arayüzdeki silmeyle aynı: bağlı kayıtlar da birlikte gider
      if (o.sekme === 'Giderler') { const g = bul(S.giderler, o.kimlik); return g ? giderSil(g) : null; }
      if (o.sekme === 'Kayıtlar') return kayitSil(o.kimlik);
      if (o.sekme === 'Portföy') return varlikKaldir(o.kimlik);
      if (o.sekme === 'Borçlar') return borcSil(o.kimlik);
      return sil(o.sekme, o.kimlik);
  }
}

// Pencere açan işlemler (takvim, mesaj, özet)
export async function aracAc(o) {
  const P = await import('./paylas.js');
  if (o.tip === 'hatirlat') { const [y, m, g] = o.tarih.split('-').map(Number), [h, d] = o.saat.split(':').map(Number); return P.takvimPenceresi({ baslik: o.baslik, tarih: new Date(y, m - 1, g, h, d), tekrar: o.tekrar, alarm: o.alarm, not: 'Dudestreet hatırlatması' }); }
  if (o.tip === 'mesaj') return P.mesajPenceresi(o.metin, { kime: o.kime });
  if (o.tip === 'ozet_paylas') return P.ozetPenceresi(o.ay, o.metin);
}

// Cevaptaki [[ISLEM ...]] etiketini ayıklar
export function islemAyikla(text) {
  const m = String(text || '').match(/\[\[ISLEM\s*([\s\S]*?)\]\]\s*$/) || String(text || '').match(/\[\[ISLEM\s*([\s\S]*?)\]\]/);
  if (!m) return { text, islemler: [] };
  let l = [];
  try { const j = JSON.parse(m[1]); l = (Array.isArray(j) ? j : [j]).map(islemTemizle).filter(Boolean).slice(0, 25); } catch { l = []; }
  return { text: text.replace(m[0], '').trim(), islemler: l };
}

// ---------- Hafıza: her cevaptan sonra arka planda (hafif model) ----------
export async function hafizaGuncelle(k, sohbet, cevap) {
  try {
    const son = sohbet.slice(-4).map(m => `${m.role === 'user' ? 'Kullanıcı' : k?.ad || 'Karakter'}: ${m.text}`).join('\n');
    const notlar = S.hafiza.map((h, i) => `[${i}] ${h['Not']}${h['Kaynak'] === 'Kullanıcı' ? '  (KİLİTLİ: kullanıcı kendi yazdı)' : ''}`).join('\n') || '(henüz not yok)';
    const r = await AI.jsonSor({ prompt: `Sen "Dudestreet" kişisel finans uygulamasındaki yapay zekânın hafıza yöneticisisin. Kullanıcı, "${k?.ad || 'karakter'}" adlı karakterle sohbet ediyor.
Görevin: bu konuşmadan, gelecekteki sohbetlerde hatırlanmaya değer KALICI bilgileri kısa notlar halinde çıkarmak.
Not alınacaklar: kullanıcının planları, hedefleri, kararları, hayatındaki önemli olaylar, tercihleri, endişeleri, açıkça "bunu hatırla" dediği şeyler, kabul ettiği sözler/görevler.
Not ALINMAYACAKLAR: zaten uygulamada duran rakamlar (bakiye, gelir, gider, varlık, borç tutarları), geçici şeyler, selamlaşma, karakterin uydurduğu hikâyeler, kullanıcının söylemediği tahminler.
Kurallar:
- Her not tek kısa Türkçe cümle, en fazla 150 karakter, kullanıcı hakkında 3. tekil şahısla ("Aralık'ta araba almayı düşünüyor").
- Mevcut notlarda zaten olanı tekrar ekleme. Eskiyen notu "sil"e (sıra numarasıyla), güncel hâlini "ekle"ye koy.
- KİLİTLİ notları ASLA "sil"e koyma.
- Kaydedilecek bir şey yoksa ikisini de boş bırak. Çoğu konuşmada 0-2 not yeterli.

MEVCUT NOTLAR:
${notlar}

SON KONUŞMA:
${son}
${k?.ad || 'Karakter'}: ${cevap}

Sadece şu JSON'u döndür: {"ekle": ["..."], "sil": [sıra_numarası]}` });
    const ekleL = (Array.isArray(r.ekle) ? r.ekle : []).map(x => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, 4);
    const silL = (Array.isArray(r.sil) ? r.sil : []).map(Number).map(i => S.hafiza[i]).filter(h => h && h['Kaynak'] !== 'Kullanıcı');
    if (!ekleL.length && !silL.length) return false;
    if (silL.length) await S.db.deleteRows('Hafıza', silL.map(h => h._row));
    if (ekleL.length) await S.db.appendObjs('Hafıza', ekleL.map(n => ({ Tarih: today(), Not: n, Kaynak: 'Yapay zekâ' })));
    await tazele('Hafıza');
    return true;
  } catch (e) { console.warn('hafıza güncellenemedi', e); return false; }
}
export { sonrakiGun };
