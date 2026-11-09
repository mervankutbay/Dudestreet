// Dudestreet — uygulamanın dışına çıkan işler: takvim hatırlatıcısı (tekrarlı), WhatsApp mesajı, aylık özet görseli
// Hiçbiri sunucuya bir şey göndermez: takvim dosyası/Google Takvim bağlantısı, WhatsApp bağlantısı ve telefonun paylaş menüsü kullanılır.
import { S, $, esc, num, money, uid, toast, sheet, ymAdi, buAy, evet, gizli } from './core.js';
import { ayHesap, hedefHesap, katAd, katAnahtar, temelOnayli } from './hesap.js';

const iki = n => String(n).padStart(2, '0');
const icsZaman = d => `${d.getUTCFullYear()}${iki(d.getUTCMonth() + 1)}${iki(d.getUTCDate())}T${iki(d.getUTCHours())}${iki(d.getUTCMinutes())}00Z`;
const escI = s => String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
export const TEKRARLAR = [['yok', 'Bir kez'], ['haftalik', 'Her hafta'], ['aylik', 'Her ay'], ['yillik', 'Her yıl']];

// Tekrar kuralı (RFC 5545). Ayın 29-31'i için: o ay yoksa ayın son günü
export function tekrarKurali(tekrar, tarih) {
  if (tekrar === 'haftalik') return 'FREQ=WEEKLY';
  if (tekrar === 'yillik') return 'FREQ=YEARLY';
  if (tekrar === 'aylik') { const g = tarih.getDate(); return g >= 29 ? `FREQ=MONTHLY;BYMONTHDAY=${Array.from({ length: g - 27 }, (_, i) => 28 + i).join(',')};BYSETPOS=-1` : `FREQ=MONTHLY;BYMONTHDAY=${g}`; }
  return '';
}
export function icsYap({ baslik, tarih, sure = 60, alarm = 15, not = '', tekrar = 'yok' }) {
  const bit = new Date(tarih.getTime() + sure * 60000), kural = tekrarKurali(tekrar, tarih);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dudestreet//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${uid()}@dudestreet`, `DTSTAMP:${icsZaman(new Date())}`, `DTSTART:${icsZaman(tarih)}`, `DTEND:${icsZaman(bit)}`, kural ? `RRULE:${kural}` : '', `SUMMARY:${escI(baslik)}`, not ? `DESCRIPTION:${escI(not)}` : '',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escI(baslik)}`, `TRIGGER:-PT${alarm}M`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}
export function googleTakvimLinki({ baslik, tarih, sure = 60, not = '', tekrar = 'yok' }) {
  const bit = new Date(tarih.getTime() + sure * 60000), kural = tekrarKurali(tekrar, tarih);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(baslik)}&dates=${icsZaman(tarih)}/${icsZaman(bit)}&details=${encodeURIComponent(not || 'Dudestreet')}${kural ? '&recur=' + encodeURIComponent('RRULE:' + kural) : ''}`;
}
function icsIndir(ics, ad) {
  if (/iP(hone|ad|od)/.test(navigator.userAgent)) { location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = (ad || 'etkinlik') + '.ics';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// Takvim penceresi: başlık, tarih, saat, tekrar, alarm → telefonun takvimi (.ics, alarmlı) ya da Google Takvim
export function takvimPenceresi({ baslik, tarih, tekrar = 'yok', alarm = 15, not = '', aciklama = '', sonra } = {}) {
  const d = tarih instanceof Date && !isNaN(tarih) ? tarih : new Date(Date.now() + 3600000);
  const el = sheet(`<h3>⏰ Takvime ekle</h3>${aciklama ? `<p class="mini">${aciklama}</p>` : ''}
    <label class="etiket" for="tkBaslik">Etkinlik</label><input id="tkBaslik" maxlength="80" value="${esc(baslik || '')}">
    <div class="iki"><div><label class="etiket" for="tkTarih">Tarih</label><input type="date" id="tkTarih" value="${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}"></div>
    <div><label class="etiket" for="tkSaat">Saat</label><input type="time" id="tkSaat" value="${iki(d.getHours())}:${iki(d.getMinutes())}"></div></div>
    <div class="iki"><div><label class="etiket" for="tkTekrar">Tekrar</label><select id="tkTekrar">${TEKRARLAR.map(([k, t]) => `<option value="${k}" ${k === tekrar ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div><label class="etiket" for="tkAlarm">Alarm</label><select id="tkAlarm">${[[0, 'Tam vaktinde'], [15, '15 dk önce'], [30, '30 dk önce'], [60, '1 saat önce'], [1440, '1 gün önce'], [2880, '2 gün önce']].map(([v, t]) => `<option value="${v}" ${v === alarm ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <button class="blok" id="tkIcs" style="margin-top:14px">📅 Telefonumun takvimine ekle</button>
    <button class="blok ikinci" id="tkGoogle">Google Takvim’de aç</button>
    <p class="mini">Telefon takvimi seçeneği alarmı da kurar; uygulama kapalıyken de çalar. Google Takvim’de bildirim, takviminin varsayılan ayarına göre gelir.</p>`);
  const oku = () => {
    const [y, mo, g] = $('#tkTarih', el).value.split('-').map(Number), [h, mi] = ($('#tkSaat', el).value || '09:00').split(':').map(Number);
    return { baslik: $('#tkBaslik', el).value.trim() || baslik || 'Hatırlatma', tarih: new Date(y, mo - 1, g, h, mi), alarm: Number($('#tkAlarm', el).value), tekrar: $('#tkTekrar', el).value, not };
  };
  $('#tkIcs', el).onclick = () => {
    const o = oku(); if (isNaN(o.tarih)) return toast('Tarih ve saati kontrol et');
    icsIndir(icsYap(o), String(o.baslik).toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/g, '-').slice(0, 40));
    sonra?.(o); el.remove(); toast('📅 Takvim dosyası açıldı; takvim uygulamanda “Ekle”ye bas.');
  };
  $('#tkGoogle', el).onclick = () => {
    const o = oku(); if (isNaN(o.tarih)) return toast('Tarih ve saati kontrol et');
    window.open(googleTakvimLinki(o), '_blank', 'noopener'); sonra?.(o); el.remove();
  };
  return el;
}

// Mesaj penceresi: metin düzenlenebilir → WhatsApp / telefonun paylaş menüsü / kopyala. Gönderen her zaman kullanıcı.
export function mesajPenceresi(metin, { baslik = '💬 Mesajın hazır', kime = '' } = {}) {
  const el = sheet(`<h3>${esc(baslik)}</h3>${kime ? `<p class="mini">Kime: ${esc(kime)}</p>` : ''}
    <textarea id="msMetin" rows="7" style="min-height:150px">${esc(metin)}</textarea>
    <button class="blok" id="msWa" style="margin-top:12px">WhatsApp’ta aç</button>
    <div class="satir">${navigator.share ? '<button class="ikinci bosluk" id="msPay">Paylaş…</button>' : ''}<button class="ikinci bosluk" id="msKop">Kopyala</button></div>
    <p class="mini">WhatsApp’ta kişiyi sen seçip gönderirsin; uygulama kimseye kendiliğinden mesaj atmaz.</p>`);
  const m = () => $('#msMetin', el).value.trim();
  $('#msWa', el).onclick = () => { window.open('https://wa.me/?text=' + encodeURIComponent(m()), '_blank', 'noopener'); };
  $('#msPay', el)?.addEventListener('click', () => navigator.share({ text: m() }).catch(() => {}));
  $('#msKop', el).onclick = async () => { try { await navigator.clipboard.writeText(m()); toast('📋 Kopyalandı'); } catch { $('#msMetin', el).select(); toast('Seçtim, kopyala de'); } };
  return el;
}

// ---------- Aylık özet ----------
export function ayOzeti(ym = buAy()) {
  const a = ayHesap(ym), kat = {};
  a.temel.filter(b => temelOnayli(ym, b.kalem)).forEach(b => { const k = katAnahtar(b.kategori); kat[k] = (kat[k] || 0) + b.tutar; });
  a.giderler.forEach(g => { const k = katAnahtar(g['Kategori']); kat[k] = (kat[k] || 0) + num(g['Tutar']); });
  const kategoriler = Object.entries(kat).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([k, v]) => ({ ad: katAd(k), tutar: v }));
  const h = hedefHesap();
  return { ym, ad: ymAdi(ym), gelir: a.gelir, gider: a.gider + a.ekBirikimden, birikim: a.yatirilan, kalan: a.kalan, kategoriler, hedef: h.hedef ? { ne: S.ayar.hedef_ne, yuzde: h.ilerleme * 100 } : null, birikimdenHarcama: a.ekBirikimden };
}
export function ozetMetni(ym = buAy()) {
  const o = ayOzeti(ym);
  return [`📊 ${o.ad} özetim (Dudestreet)`, '', `💼 Gelir: ${money(o.gelir)}`, `🧾 Gider: ${money(o.gider)}`, `💰 Birikime: ${money(o.birikim)}`, `📈 Ay sonu: ${o.kalan >= 0 ? '+' : '−'}${money(Math.abs(o.kalan))}`,
    o.kategoriler.length ? '\nEn çok harcadığım:\n' + o.kategoriler.slice(0, 3).map(k => `• ${k.ad}: ${money(k.tutar)}`).join('\n') : '',
    o.hedef ? `\n🎯 ${o.hedef.ne} hedefimde %${o.hedef.yuzde.toFixed(1).replace('.', ',')}` : ''].filter(x => x !== '').join('\n');
}

// Paylaşılabilir görsel (1080×1350, temanın renkleriyle). Tutarlar ekranda nasıl görünüyorsa öyle (gizliyse ••••)
export async function ozetGorseli(ym = buAy()) {
  const o = ayOzeti(ym), css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  try { await document.fonts.ready; } catch { /* yok say */ }
  const bg = v('--bg') || '#050a07', kart = v('--kart-bg') || '#0c1610', yazi = v('--yazi') || '#eef7f1', soluk = v('--soluk') || '#93a89b', vurgu = v('--vurgu') || '#19c37d', altin = v('--altin') || '#f5c542', arti = v('--artı') || '#4ee0a0', eksi = v('--eksi') || '#ff6b7d';
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const pg = x.createRadialGradient(W * 0.8, 0, 0, W * 0.8, 0, W); pg.addColorStop(0, `rgba(${v('--vurgu-rgb') || '25,195,125'}, .28)`); pg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = pg; x.fillRect(0, 0, W, H);
  const yuvarlak = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
  const F = (w, s, aile = 'Inter') => `${w} ${s}px ${aile}, system-ui, sans-serif`;
  // Logo (temanın yazı rengiyle boyanır)
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'img/wordmark.png'; });
    const lh = 120, lw = lh * img.width / img.height, t = document.createElement('canvas'); t.width = lw; t.height = lh;
    const tx = t.getContext('2d'); tx.drawImage(img, 0, 0, lw, lh); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = yazi; tx.fillRect(0, 0, lw, lh);
    x.drawImage(t, 80, 70);
  } catch { x.fillStyle = yazi; x.font = F(800, 64); x.fillText('Dudestreet', 80, 150); }
  x.fillStyle = vurgu; x.font = F(700, 34); x.fillText(o.ad.toLocaleUpperCase('tr') + ' ÖZETİ', 80, 260);
  // Ay sonu kartı
  yuvarlak(60, 300, W - 120, 260, 36); x.fillStyle = kart; x.fill();
  x.fillStyle = soluk; x.font = F(600, 32); x.fillText('Ay sonu', 110, 370);
  x.fillStyle = o.kalan >= 0 ? arti : eksi; x.font = F(700, 96, "'Space Grotesk'"); x.fillText(`${o.kalan >= 0 ? '+' : '−'}${money(Math.abs(o.kalan))}`, 106, 480);
  // Üçlü
  const uc = [['Gelir', o.gelir, yazi], ['Gider', o.gider, eksi], ['Birikim', o.birikim, altin]], gw = (W - 120 - 40) / 3;
  uc.forEach(([ad, t, renk], i) => { const X = 60 + i * (gw + 20); yuvarlak(X, 590, gw, 170, 30); x.fillStyle = kart; x.fill(); x.fillStyle = soluk; x.font = F(600, 28); x.fillText(ad, X + 34, 645); x.fillStyle = renk; x.font = F(700, money(t).length > 11 ? 38 : 46, "'Space Grotesk'"); x.fillText(money(t), X + 32, 715); });
  // Kategoriler
  let Y = 830; x.fillStyle = yazi; x.font = F(700, 36); x.fillText('En çok harcanan', 80, Y);
  const enb = Math.max(1, ...o.kategoriler.map(k => k.tutar)), renkler = ['--k1', '--k2', '--k3', '--k4', '--k5'].map(n => v(n) || vurgu);
  o.kategoriler.slice(0, 5).forEach((k, i) => {
    Y += 74; x.fillStyle = soluk; x.font = F(600, 30); x.fillText(k.ad, 80, Y);
    x.fillStyle = yazi; x.textAlign = 'right'; x.fillText(money(k.tutar), W - 80, Y); x.textAlign = 'left';
    yuvarlak(80, Y + 16, W - 160, 12, 6); x.fillStyle = 'rgba(255,255,255,.07)'; x.fill();
    yuvarlak(80, Y + 16, Math.max(12, (W - 160) * k.tutar / enb), 12, 6); x.fillStyle = renkler[i]; x.fill();
  });
  if (!o.kategoriler.length) { Y += 70; x.fillStyle = soluk; x.font = F(500, 30); x.fillText('Bu ay gider girilmemiş', 80, Y); }
  // Hedef
  if (o.hedef) {
    const hy = H - 170; x.fillStyle = soluk; x.font = F(600, 30); x.fillText(`🎯 ${o.hedef.ne}`, 80, hy);
    x.fillStyle = altin; x.textAlign = 'right'; x.fillText(`%${o.hedef.yuzde.toFixed(1).replace('.', ',')}`, W - 80, hy); x.textAlign = 'left';
    yuvarlak(80, hy + 24, W - 160, 18, 9); x.fillStyle = 'rgba(255,255,255,.08)'; x.fill();
    yuvarlak(80, hy + 24, Math.max(18, (W - 160) * Math.min(1, o.hedef.yuzde / 100)), 18, 9); x.fillStyle = altin; x.fill();
  }
  x.fillStyle = soluk; x.font = F(500, 24); x.fillText(`${location.host} · verilerim kendi Drive’ımda`, 80, H - 50);
  return new Promise(ok => c.toBlob(b => ok(b), 'image/png'));
}

// Özet paylaşma penceresi: görsel önizleme + metin; WhatsApp / paylaş / indir
export async function ozetPenceresi(ym = buAy(), metin = '') {
  const yazi = metin || ozetMetni(ym);
  const el = sheet(`<h3>📊 ${esc(ymAdi(ym))} özetin</h3>${gizli() ? '<p class="mini">Tutarlar gizli olduğu için görselde de •••• görünüyor. Göstermek için üstteki göz düğmesine bas.</p>' : ''}
    <div id="ozGorsel" class="oz-onizleme"><div class="yukleniyor" style="padding:30px 0">Görsel hazırlanıyor…</div></div>
    <div class="satir" style="margin-top:12px"><button class="bosluk" id="ozPay">Görseli paylaş</button><button class="ikinci bosluk" id="ozMetin">Metin olarak gönder</button></div>`, { genis: true });
  let blob = null;
  try { blob = await ozetGorseli(ym); } catch (e) { console.warn(e); }
  if (blob && $('#ozGorsel', el)) { const u = URL.createObjectURL(blob); $('#ozGorsel', el).innerHTML = `<img src="${u}" alt="${esc(ymAdi(ym))} özeti">`; }
  const dosya = blob && new File([blob], `dudestreet-${ym}.png`, { type: 'image/png' });
  $('#ozPay', el).onclick = async () => {
    if (!dosya) return toast('Görsel hazırlanamadı');
    if (navigator.canShare?.({ files: [dosya] })) { try { await navigator.share({ files: [dosya], text: yazi }); } catch { /* vazgeçti */ } return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(dosya); a.download = dosya.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('⬇️ Görsel indirildi; WhatsApp’tan ekleyip gönderebilirsin.');
  };
  $('#ozMetin', el).onclick = () => { el.remove(); mesajPenceresi(yazi, { baslik: '📊 Özet mesajın' }); };
  return el;
}
export { evet };
