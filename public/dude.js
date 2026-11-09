// Dudestreet — yapay zekâ karakterleri: oluşturma (kendin, tanıdığın biri, ünlü, serbest), karakter ve hafıza ekranı, sohbet
import { S, $, $$, esc, num, money, moneyHam, fmt, today, toast, sheet, guard, ikon, pick, isDemo, CONFIG, ekle, tazele, lsGet, lsSet, onayKutusu, kapatBtn, uid } from './core.js';
import { SECTIONS, TANIDIK_SECTIONS, UNLU_SECTIONS, OZEL_SECTIONS, buildPersona, buildTanidik, buildOzel, unluIstek, polishInstruction, futureYear } from './persona.js';
import * as AI from './gemini.js';
import { chrome, adimCubugu, baslik } from './ui.js';
import { hedefHesap } from './hesap.js';
import { karakterler, aktifKarakter, karakterleriYaz, sohbetOku, sohbetYaz, sistemTalimati, islemAyikla, islemOzet, islemUygula, hafizaGuncelle } from './ai.js';

const ic = (k, s = 18) => ikon(k, 'currentColor', s);
const app = () => $('#app');
const IKONLAR = ['😎', '🧔', '👨‍🦳', '👩‍🦳', '👩', '👨', '🧑‍💼', '👵', '👴', '🦁', '🐺', '🦉', '🤖', '🧙', '🏴‍☠️', '🎩', '👑', '🐂', '💼', '🌟', '🔥', '🧠', '🎭', '🫡'];
const TIPLER = [
  { tip: 'ben', ikon: '🔮', ad: 'Gelecekteki ben', alt: '10 yıl sonraki hâlin; senin gibi konuşur', bolumler: () => BEN_SECTIONS },
  { tip: 'tanidik', ikon: '🫶', ad: 'Tanıdığım biri', alt: 'Baban, annen, kardeşin, bir arkadaşın…', bolumler: () => TANIDIK_SECTIONS },
  { tip: 'unlu', ikon: '⭐', ad: 'Ünlü biri', alt: 'Adını yaz, tarzından esinlenen karakter', bolumler: () => UNLU_SECTIONS },
  { tip: 'ozel', ikon: '🎭', ad: 'Kendi karakterim', alt: 'Hayal ettiğini serbestçe anlat', bolumler: () => OZEL_SECTIONS },
];
const BEN_SECTIONS = SECTIONS.map((s, i) => i === 0 ? { ...s, sorular: [{ id: 'karakter_ad', tip: 'text', soru: 'Karakterin adı ne olsun?', ornek: 'Future Dude, 2036 Deniz', varsayilan: 'Future Dude', zorunlu: true }, ...s.sorular] } : s);

// ---------- Karakter oluşturma ----------
const TASLAK = 'ds_anket_taslak';
const taslak = () => lsGet(TASLAK, {}) || {};
const taslakKaydet = d => lsSet(TASLAK, d);

// Kurulumda ya da "Yeni karakter"de: önce tür seçilir
export function startSurvey() { karakterTipiSec(true); }
export function karakterTipiSec(kurulum = !karakterler().length) {
  S.view = 'anket'; chrome('sihirbaz');
  S.icGeri = null;
  app().innerHTML = `${kurulum ? adimCubugu('persona') : ''}
    ${baslik(kurulum ? 'Adım 5 · Yapay zekâ' : 'Yeni karakter', 'Kiminle konuşmak istersin?', 'Uygulamanın içindeki yapay zekâ, seçtiğin karakter gibi konuşur; paranı, borçlarını, hedefini bilir ve senin için kayıt da yapar. İstediğin kadar karakter yaratıp aralarında geçiş yapabilirsin.')}
    <div class="tip-izgara">${TIPLER.map(t => `<button type="button" class="tip-sec" data-tip="${t.tip}"><span class="tip-ik">${t.ikon}</span><b>${t.ad}</b><span class="mini">${t.alt}</span></button>`).join('')}</div>
    <div class="doldur"></div>
    <button class="blok hayalet" id="tGec">${kurulum ? 'Sonra yaparım' : 'Vazgeç'}</button>`;
  $$('[data-tip]').forEach(b => b.onclick = () => { localStorage.removeItem(TASLAK); S.anket = { tip: b.dataset.tip, idx: 0, kurulum, duzenle: null }; renderSurvey(); });
  $('#tGec').onclick = () => { if (kurulum) localStorage.setItem('ds_anket_sonra', '1'); S.go(kurulum ? 'ozet' : 'persona'); };
}
// Var olan karakteri anketten düzenle
export function karakterAnketiDuzenle(k) {
  taslakKaydet(k.cevaplar || {});
  S.anket = { tip: k.tip, idx: 0, kurulum: false, duzenle: k.id };
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
    case 'multi': { const arr = [].concat(a[q.id] || []); input = `<div class="cipler" data-multi="${q.id}">${q.secenekler.map(o => `<button type="button" class="cip ${/\p{Extended_Pictographic}/u.test(o) && o.length <= 4 ? 'emoji' : ''} ${arr.includes(o) ? 'on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`; break; }
    case 'slider': input = `<input id="q_${q.id}" data-q="${q.id}" type="range" min="${q.min}" max="${q.max}" value="${esc(v || q.varsayilan)}"><div class="aralik-uclar"><span>${q.uclar[0]}</span><b id="sv_${q.id}">${esc(v || q.varsayilan)}</b><span>${q.uclar[1]}</span></div>`; break;
  }
  const forAttr = ['choice', 'multi'].includes(q.tip) ? '' : `for="q_${q.id}"`;
  return `<div><label class="etiket" ${forAttr}>${esc(q.soru)}${q.zorunlu ? ' <span class="gerekli">*</span>' : ''}</label>${input}${q.not ? `<div class="ipucu">${esc(q.not)}</div>` : ''}</div>`;
}

function renderSurvey() {
  S.view = 'anket'; chrome('sihirbaz');
  const A = S.anket, T = TIPLER.find(t => t.tip === A.tip), B = T.bolumler(), sec = B[A.idx], a = taslak(), son = A.idx === B.length - 1;
  app().innerHTML = `
    ${A.kurulum ? adimCubugu('persona') : ''}
    ${baslik(`${T.ikon} ${T.ad}${B.length > 1 ? ` · ${A.idx + 1}/${B.length}` : ''}`, `${sec.ikon} ${esc(sec.baslik)}`, esc(sec.aciklama))}
    ${B.length > 1 ? `<div class="kart bolumler">${B.map((s, i) => `<div class="bolum ${i < A.idx ? 'bitti' : i === A.idx ? 'simdi' : ''}"><i>${i < A.idx ? '✓' : i + 1}</i>${esc(s.baslik)}</div>`).join('')}</div>` : ''}
    <div class="kart" style="padding-top:4px">${sec.sorular.map(q => soruHtml(q, a)).join('')}</div>
    ${A.idx === 0 ? '<p class="mini ortala" style="margin:0">Ne kadar detaylı anlatırsan karakter o kadar gerçekçi konuşur. Cevapların sadece kendi tablonda durur.</p>' : ''}
    <div class="satir">
      <button class="ikinci" id="aGeri">${A.idx > 0 ? 'Geri' : 'Vazgeç'}</button>
      <button class="bosluk buyuk" id="aIleri">${son ? '✨ Karakteri yarat' : 'İleri'}</button>
    </div>`;
  window.scrollTo(0, 0);
  const topla = () => {
    const d = taslak();
    $$('[data-q]').forEach(el => { d[el.dataset.q] = el.value; });
    $$('[data-choice]').forEach(el => { const on = $('.cip.on', el); d[el.dataset.choice] = on ? on.dataset.v : (d[el.dataset.choice] ?? ''); });
    $$('[data-multi]').forEach(el => { d[el.dataset.multi] = $$('.cip.on', el).map(x => x.dataset.v); });
    sec.sorular.forEach(q => { if ((q.tip === 'choice' || q.tip === 'text') && !d[q.id] && q.varsayilan) d[q.id] = q.varsayilan; });
    taslakKaydet(d); return d;
  };
  $$('[data-choice] .cip').forEach(b => (b.onclick = () => { $$('.cip', b.parentElement).forEach(x => x.classList.toggle('on', x === b)); topla(); }));
  $$('[data-multi] .cip').forEach(b => (b.onclick = () => { b.classList.toggle('on'); topla(); }));
  $$('input[type=range]').forEach(r => (r.oninput = () => { $('#sv_' + r.dataset.q).textContent = r.value; }));
  $$('[data-q]').forEach(el => (el.onchange = topla));
  $('#aGeri').onclick = () => { topla(); if (A.idx > 0) { A.idx--; renderSurvey(); } else if (A.duzenle) S.go('persona'); else karakterTipiSec(A.kurulum); };
  S.icGeri = () => { if (A.idx === 0 && A.duzenle) return false; $('#aGeri').click(); return true; };   // telefonun geri tuşu anketin bir önceki adımına döner
  $('#aIleri').onclick = () => {
    const d = topla();
    const eksik = sec.sorular.filter(q => q.zorunlu && !String(d[q.id] || '').trim());
    if (eksik.length) return toast('Şunu doldur: ' + esc(eksik[0].soru));
    if (!son) { A.idx++; renderSurvey(); return; }
    anketBitir(d);
  };
}

async function anketBitir(a) {
  const A = S.anket;
  await guard(async () => {
    const btn = $('#aIleri'); btn.disabled = true; btn.textContent = A.tip === 'unlu' ? 'Karakter yazılıyor…' : 'Yaratılıyor…';
    try {
      let prompt;
      if (A.tip === 'ben') prompt = buildPersona({ ...a, ...S.ayar });
      else if (A.tip === 'tanidik') prompt = buildTanidik(a);
      else if (A.tip === 'ozel') prompt = buildOzel(a);
      else {
        if (!AI.getKey()) throw new Error('Ünlü karakter için önce Gemini’yi bağla (Ayarlar)');
        prompt = (await AI.uret({ contents: [{ role: 'user', parts: [{ text: unluIstek(a) }] }], tur: 'sohbet', sicaklik: 0.7, sure: 45000 })).text;
      }
      const l = karakterler().slice(), eski = A.duzenle ? l.find(k => k.id === A.duzenle) : null;
      const ad = String(a.karakter_ad || (A.tip === 'ben' ? 'Future Dude' : 'Karakter')).trim();
      const k = { id: eski?.id || 'k' + uid(), ad, ikon: eski?.ikon || { ben: '😎', tanidik: '🫶', unlu: '⭐', ozel: '🎭' }[A.tip], tip: A.tip, cevaplar: a, prompt, kaynak: 'anket' };
      if (eski) l[l.indexOf(eski)] = k; else l.push(k);
      await karakterleriYaz(l, k.id);
      localStorage.removeItem(TASLAK); localStorage.removeItem('ds_anket_sonra');
      S.chat = sohbetOku(k);
      if (A.kurulum) return renderHazir();
      toast(eski ? `🎭 ${esc(k.ad)} güncellendi` : `✨ ${esc(k.ad)} hazır!`);
      S.go(eski ? 'persona' : 'dude');
    } finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = '✨ Karakteri yarat'; } }
  });
}

export async function renderHazir() {
  S.view = 'hazir'; chrome('sihirbaz');
  const k = aktifKarakter(), c = hedefHesap();
  app().innerHTML = `
    <div class="ortala" style="padding-top:18px;display:flex;flex-direction:column;gap:12px;align-items:center">
      <div class="hazir-kure"><span style="font-size:52px">${esc(k.ikon)}</span></div>
      <span class="ust-etiket">Kurulum tamam</span>
      <h1>${esc(k.ad)} hazır</h1>
      <p class="soluk" style="margin:0;max-width:320px">Anketteki cevaplarınla yaratıldı. Kişiliğini istediğin zaman değiştirebilir, yeni karakterler ekleyebilirsin.</p>
    </div>
    <div class="kart">
      <div class="satir"><span class="kayit-ik" style="border-radius:50%">${esc(k.ikon)}</span><b>${esc(k.ad)}’dan bir mesaj</b></div>
      <div class="msj model" id="ilkMesaj"><span class="yaziyor"><span></span><span></span><span></span></span></div>
    </div>
    <div class="kart">
      <div class="satir kucuk"><span class="soluk">Hedef</span><span class="bosluk"></span><b>${esc(S.ayar.hedef_ne || '-')} · ${c.hedef ? money(c.hedef) : '-'}</b></div>
      <div class="satir kucuk"><span class="soluk">Veri</span><span class="bosluk"></span><b>${isDemo() ? 'Bu tarayıcı (demo)' : `${CONFIG.TABLO_ADI} · Drive`}</b></div>
    </div>
    <div class="doldur"></div>
    <button class="blok buyuk" id="borsaAc">Borsayı aç 🔔</button>`;
  $('#borsaAc').onclick = () => S.go('ozet');
  const a = k.cevaplar || {};
  let mesaj = `Selam ${a.hitap ? a.hitap.split(',')[0].trim() : a.ad || 'dude'}! Ben ${k.ad}. Paranı, borçlarını, hedefini birlikte takip edeceğiz; bir şey kaydetmemi istersen söylemen yeter 👀`;
  if (AI.getKey()) {
    try {
      mesaj = islemAyikla(await AI.chat({ system: sistemTalimati(k), history: [{ role: 'user', text: '(Uygulamayı yeni kurdum ve seni ilk kez açıyorum. Kendini kendi tarzınla tanıt ve beni karşıla; kısa tut.)' }] })).text;
      S.chat = [{ role: 'model', text: mesaj }]; sohbetYaz(k, S.chat);
    } catch (e) { console.warn(e); }
  }
  if ($('#ilkMesaj')) $('#ilkMesaj').textContent = mesaj;
}

// ---------- Karakterler ve hafıza ----------
export function renderPersona() {
  S.view = 'persona'; chrome('ana');
  const l = karakterler(), k = aktifKarakter();
  app().innerHTML = `
    <button class="ikinci" id="sohbeteDon" style="align-self:flex-start">${ic('geri', 18)} Sohbete dön</button>
    <div class="kart">
      <div class="satir"><h3 class="bosluk">🎭 Karakterlerin</h3><button class="kucuk-btn" id="kYeni">${ic('arti', 14)} Yeni</button></div>
      ${l.length ? `<ul class="liste">${l.map(x => `<li><span class="kayit-ik karakter-ik">${esc(x.ikon)}</span><span class="bosluk"><b>${esc(x.ad)}</b><div class="mini">${esc(TIPLER.find(t => t.tip === x.tip)?.ad || '')}${x.id === k?.id ? ' · <b class="vurgu">şu an konuşuyorsun</b>' : ''}</div></span>${x.id === k?.id ? '' : `<button class="ikinci kucuk-btn" data-sec="${x.id}">Seç</button>`}</li>`).join('')}</ul>` : '<p class="mini">Henüz karakter yok.</p>'}
    </div>
    ${k ? `<div class="kart">
      <div class="satir"><button class="emo-btn" id="kIkon" aria-label="Simge">${esc(k.ikon)}</button><input id="kAd" class="bosluk" value="${esc(k.ad)}" maxlength="40" aria-label="Karakterin adı"></div>
      <p class="mini">Aşağıdaki metin karakterin “kim olduğunu” belirler. Doğrudan düzenleyebilir, anketten yeniden üretebilir ya da Gemini’ye cilalatabilirsin.${k.kaynak === 'gemini' ? ' (Gemini ile cilalandı)' : k.kaynak === 'elle' ? ' (Elle düzenlendi)' : ''}</p>
      <textarea id="prompt" class="kod" aria-label="Kişilik metni">${esc(k.prompt)}</textarea>
      <div class="satir" style="flex-wrap:wrap">
        <button class="ikinci kucuk-btn" id="anketDuz">✏️ Anketi düzenle</button>
        ${AI.getKey() ? '<button class="ikinci kucuk-btn" id="cila">✨ Gemini ile cilala</button>' : ''}
        <span class="bosluk"></span>
        <button class="kucuk-btn" id="kaydet">Kaydet</button>
      </div>
      <button class="blok hayalet" id="kSil">${ic('cop', 16)} Bu karakteri sil</button>
    </div>` : ''}
    <div class="kart">
      <h3>🧠 Hafıza</h3>
      <p class="mini">Yapay zekânın seni hatırladıkları; bütün karakterler ortak kullanır. Sohbetten kendiliğinden not alır. 🔒 senin yazdıkların: yapay zekâ onlara dokunamaz, sadece sen silersin.</p>
      ${S.hafiza.length ? `<ul class="liste">${S.hafiza.map(h => `<li><span class="bosluk">${h['Kaynak'] === 'Kullanıcı' ? '🔒 ' : '🤖 '}${esc(h['Not'])}<div class="mini">${esc(h['Tarih'])}</div></span><button class="ikon-btn" data-hsil="${h._row}" aria-label="Sil">${ic('cop', 15)}</button></li>`).join('')}</ul>` : '<p class="mini">Henüz not yok.</p>'}
      <div class="satir"><input id="hNot" placeholder="ör. Mart’ta araba taksiti bitiyor" class="bosluk" aria-label="Yeni not"><button id="hEkle">Ekle</button></div>
    </div>`;
  $('#sohbeteDon').onclick = () => S.go('dude');
  $('#kYeni').onclick = () => karakterTipiSec(false);
  $$('[data-sec]').forEach(b => b.onclick = () => guard(async () => { await karakterleriYaz(karakterler(), b.dataset.sec); S.chat = sohbetOku(aktifKarakter()); S.go('dude'); }));
  if (k) {
    $('#kIkon').onclick = () => { const s = sheet(`<h3>Simge seç</h3><div class="emo-izgara">${IKONLAR.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>`); $$('[data-e]', s).forEach(x => x.onclick = () => { s.remove(); kaydet({ ikon: x.dataset.e }); }); };
    $('#kaydet').onclick = () => kaydet({ ad: $('#kAd').value.trim() || k.ad, prompt: $('#prompt').value, kaynak: $('#prompt').value !== k.prompt ? 'elle' : k.kaynak });
    $('#anketDuz').onclick = () => karakterAnketiDuzenle(k);
    if ($('#cila')) $('#cila').onclick = cilala;
    $('#kSil').onclick = () => onayKutusu(`${k.ad} silinsin mi?`, 'Bu karakterle sohbet geçmişi de silinir. Hafıza ortak olduğu için durur.', () => guard(async () => { const l2 = karakterler().filter(x => x.id !== k.id); localStorage.removeItem('ds_sohbet_' + k.id); await karakterleriYaz(l2, l2[0]?.id || ''); S.chat = sohbetOku(aktifKarakter()); toast('Silindi'); renderPersona(); }), { evetYazi: 'Sil', tehlike: true });
  }
  $('#hNot').onkeydown = e => { if (e.key === 'Enter') $('#hEkle').click(); };
  $('#hEkle').onclick = () => guard(async () => { const t = $('#hNot').value.trim(); if (!t) return; await ekle('Hafıza', { Tarih: today(), Not: t, Kaynak: 'Kullanıcı' }); renderPersona(); });
  $$('[data-hsil]').forEach(b => b.onclick = () => guard(async () => { await S.db.deleteRow('Hafıza', Number(b.dataset.hsil)); await tazele('Hafıza'); renderPersona(); }));

  async function kaydet(yeni) {
    await guard(async () => {
      const l = karakterler().map(x => x.id === k.id ? { ...x, ...yeni } : x);
      await karakterleriYaz(l, k.id); toast('✅ Kaydedildi'); renderPersona();
    });
  }
  async function cilala() {
    const btn = $('#cila'); btn.disabled = true; btn.textContent = '✨ Cilalanıyor…';
    try {
      const out = await AI.chat({ system: 'Sen deneyimli bir prompt yazarısın. Türkçe yazarsın.', history: [{ role: 'user', text: polishInstruction(k.cevaplar || {}, $('#prompt').value) }] });
      const s = sheet(`<h3>✨ Cilalanmış kişilik</h3><p class="mini">Beğenirsen kabul et; beğenmezsen eskisi kalır.</p><textarea id="cilali" class="kod">${esc(out)}</textarea><div class="satir"><button class="ikinci bosluk" id="hayir">Vazgeç</button><button class="bosluk" id="evet">Kabul et</button></div>`, { genis: true });
      $('#hayir', s).onclick = () => s.remove();
      $('#evet', s).onclick = () => { const t = $('#cilali', s).value; s.remove(); kaydet({ prompt: t, kaynak: 'gemini' }); };
    } catch (e) { toast('⚠️ ' + esc(e.message)); }
    finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = '✨ Gemini ile cilala'; } }
  }
}

// ---------- Sohbet ----------
function mesajHTML(m, i) {
  if (m.role === 'user') return `<div class="msj user">${esc(m.text)}</div>`;
  let h = `<div class="msj model ${m.hata ? 'hata' : ''}">${esc(m.text)}${m.kaynaklar?.length ? `<div class="kaynaklar">${m.kaynaklar.map(k => `<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.baslik)}</a>`).join('')}</div>` : ''}</div>`;
  if (m.islemler?.length) {
    const durum = m.islemDurum;
    h += `<div class="islem-kart ${m.islemler.some(o => islemOzet(o).kirmizi) ? 'kirmizi' : ''}">
      ${m.islemler.map(o => { const z = islemOzet(o); return `<div class="islem-satir"><span class="islem-ik">${z.ik}</span><span class="bosluk"><b>${esc(z.ad)}</b><div class="mini">${esc(z.detay)}</div></span></div>`; }).join('')}
      ${durum === 'ok' ? '<div class="islem-durum artı">✓ İşlendi</div>' : durum === 'iptal' ? '<div class="islem-durum">Vazgeçildi</div>' : durum === 'hata' ? `<div class="islem-durum eksi">⚠️ ${esc(m.islemHata || 'İşlenemedi')}</div>` : durum === 'isleniyor' ? '<div class="islem-durum">İşleniyor…</div>'
        : `<div class="satir"><button class="ikinci kucuk-btn bosluk" data-islem="${i}" data-k="iptal">Vazgeç</button><button class="kucuk-btn bosluk" data-islem="${i}" data-k="ok">Onayla${m.islemler.length > 1 ? ` (${m.islemler.length})` : ''}</button></div>`}
    </div>`;
  }
  return h;
}
const modelYazi = () => { const m = (AI.getModel() || '').replace('models/', ''), n = AI.sayac(); return `${m || 'gemini'} · bugün ${n} mesaj${n >= AI.GUNLUK_ANA ? ' (hafif modele geçildi)' : ` · ilk ${AI.GUNLUK_ANA} mesaj ana model`}`; };

export function renderDude() {
  if (!AI.getKey()) {
    app().innerHTML = `<div class="kart"><h2>💬 Yapay zekânın beyni yok</h2><p class="soluk">Konuşabilmesi ve senin için kayıt yapabilmesi için kendi Gemini anahtarını bağla. Ücretsiz, 1 dakika sürer.</p><button class="blok buyuk" id="g">🔑 Gemini’yi bağla</button></div>`;
    $('#g').onclick = () => S.wizard('gemini');
    return;
  }
  const k = aktifKarakter();
  if (!k) {
    app().innerHTML = `<div class="kart ortala"><div style="font-size:44px">🎭</div><h2>Bir karakter yarat</h2><p class="soluk">Kendin, baban, bir arkadaşın ya da sevdiğin bir ünlü… Seçtiğin karakter gibi konuşur, paranı bilir, senin için kayıt yapar.</p><button class="blok buyuk" id="kYarat">Karakter yarat</button></div>`;
    $('#kYarat').onclick = () => karakterTipiSec(false);
    return;
  }
  if (S.chatKimin !== k.id) { S.chat = sohbetOku(k); S.chatKimin = k.id; }
  const ONERI = ['Bu ay nasıl gidiyorum?', 'Toplam servetim ne kadar?', 'Kart borçlarımı özetle', 'Hedefe ne zaman ulaşırım?', 'Maaş yattı', 'Bana bir tasarruf planı yap'];
  app().innerHTML = `
    <div class="satir sohbet-ust">
      <button class="karakter-btn bosluk" id="kDegis"><span class="karakter-ik">${esc(k.ikon)}</span><span class="bosluk"><b>${esc(k.ad)}</b><span class="mini">${karakterler().length > 1 ? 'karakter değiştir ⌄' : 'kişilik ve hafıza ⌄'}</span></span></button>
      ${S.chat.some(m => m.role === 'user') ? '<button class="hayalet kucuk-btn" id="temizle">Yeni sohbet</button>' : ''}
    </div>
    <div class="sohbet" id="sohbet">${S.chat.map(mesajHTML).join('') || `<div class="msj model">${esc(`Söyle bakalım ${k.cevaplar?.hitap ? k.cevaplar.hitap.split(',')[0].trim() : ''}, ne var ne yok? Rakamların hepsi önümde 👀`)}</div>`}</div>
    <div class="mini ortala" id="modelBilgi">${esc(modelYazi())}</div>
    <div style="height:130px"></div>
    <div class="yazma"><div class="yazma-ic" style="flex-direction:column;align-items:stretch">
      ${S.chat.some(m => m.role === 'user') ? '' : `<div class="oneriler">${ONERI.map(o => `<button class="ikinci" data-oneri="${esc(o)}">${esc(o)}</button>`).join('')}</div>`}
      <div class="satir" style="align-items:flex-end"><textarea id="girdi" rows="1" placeholder="${esc(k.ad)}’a yaz…" aria-label="Mesaj"></textarea><button id="gonder" aria-label="Gönder">${ic('gonder', 20)}</button></div>
    </div></div>`;
  $('#kDegis').onclick = karakterMenu;
  if ($('#temizle')) $('#temizle').onclick = () => { S.chat = []; sohbetYaz(k, []); renderDude(); };
  const girdi = $('#girdi');
  girdi.oninput = () => { girdi.style.height = 'auto'; girdi.style.height = Math.min(140, girdi.scrollHeight) + 'px'; };
  girdi.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); gonder(); } };
  $('#gonder').onclick = gonder;
  $$('[data-oneri]').forEach(b => (b.onclick = () => { girdi.value = b.dataset.oneri; gonder(); }));
  islemBagla();
  window.scrollTo(0, document.body.scrollHeight);

  function cizMesajlar() { $('#sohbet').innerHTML = S.chat.map(mesajHTML).join(''); islemBagla(); }
  function islemBagla() {
    $$('[data-islem]').forEach(b => b.onclick = async () => {
      const i = Number(b.dataset.islem), m = S.chat[i]; if (!m || m.islemDurum) return;
      if (b.dataset.k === 'iptal') { m.islemDurum = 'iptal'; sohbetYaz(k, S.chat); cizMesajlar(); return; }
      m.islemDurum = 'isleniyor'; cizMesajlar();
      try { for (const o of m.islemler) await islemUygula(o); m.islemDurum = 'ok'; toast(pick(['✅ İşlendi', '✅ Tamamdır, kaydettim', '🔔 Borsaya işlendi'])); S.bant?.(); }
      catch (e) { m.islemDurum = 'hata'; m.islemHata = e.message; }
      sohbetYaz(k, S.chat); cizMesajlar();
    });
  }
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
      // Onaylanan/vazgeçilen işlemler yapay zekâya not olarak iletilir (aynı şeyi tekrar önermesin)
      const gecmis = S.chat.slice(-30).map(m => ({ role: m.role, text: m.text + (m.islemler?.length ? (m.islemDurum === 'ok' ? '\n(Kullanıcı bu işlemleri onayladı, uygulamaya işlendi.)' : m.islemDurum === 'iptal' ? '\n(Kullanıcı bu işlemlerden vazgeçti.)' : '\n(İşlemler onay bekliyor.)') : '') }));
      const r = await AI.sohbet({ system: sistemTalimati(k), history: gecmis });
      const { text: cevap, islemler } = islemAyikla(r.text);
      const msg = { role: 'model', text: cevap || '👍' };
      if (islemler.length) msg.islemler = islemler;
      if (r.kaynaklar?.length) msg.kaynaklar = r.kaynaklar;
      S.chat.push(msg);
      sohbetYaz(k, S.chat);
      hafizaGuncelle(k, S.chat, cevap);
    } catch (e) {
      S.chat.pop();
      $('#yaziyor').outerHTML = `<div class="msj model hata">⚠️ ${esc(e.message || 'Bağlantı koptu')}</div>`;
      girdi.value = text;
      S.busy = false; return;
    } finally { S.busy = false; }
    cizMesajlar();
    if ($('#modelBilgi')) $('#modelBilgi').textContent = modelYazi();
    window.scrollTo(0, document.body.scrollHeight);
  }
}

function karakterMenu() {
  const l = karakterler(), k = aktifKarakter();
  const s = sheet(`<div class="satir"><h3 class="bosluk">Kiminle konuşalım?</h3>${kapatBtn()}</div>
    <ul class="liste">${l.map(x => `<li class="tikla" data-k="${x.id}"><span class="kayit-ik karakter-ik">${esc(x.ikon)}</span><span class="bosluk"><b>${esc(x.ad)}</b><div class="mini">${esc(TIPLER.find(t => t.tip === x.tip)?.ad || '')}</div></span>${x.id === k.id ? `<span class="vurgu">${ic('tik', 18)}</span>` : ''}</li>`).join('')}</ul>
    <div class="satir"><button class="ikinci bosluk" id="mYeni">${ic('arti', 16)} Yeni karakter</button><button class="ikinci bosluk" id="mKisilik">🧬 Kişilik ve hafıza</button></div>`);
  $('#kapat', s).onclick = () => s.remove();
  $$('[data-k]', s).forEach(li => li.onclick = () => guard(async () => { s.remove(); if (li.dataset.k === k.id) return; await karakterleriYaz(karakterler(), li.dataset.k); S.chatKimin = null; renderDude(); }));
  $('#mYeni', s).onclick = () => { s.remove(); karakterTipiSec(false); };
  $('#mKisilik', s).onclick = () => { s.remove(); S.go('persona'); };
}
export { futureYear, fmt, moneyHam, num };
