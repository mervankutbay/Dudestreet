// Dudestreet — Future Dude: kişilik anketi, kişilik ekranı, sohbet
import { S, $, $$, esc, num, money, fmt, today, buAy, ymAdi, toast, sheet, modal, guard, ikon, pick, isDemo, CONFIG, ekle, tazele, lsGet } from './core.js';
import { SECTIONS, buildPersona, polishInstruction, futureYear } from './persona.js';
import * as AI from './gemini.js';
import { chrome, adimCubugu, baslik } from './ui.js';
import { malVarligi, hedefHesap, ayHesap, borclar, varliklar } from './hesap.js';

const ic = (k, s = 18) => ikon(k, 'currentColor', s);
const app = () => $('#app');

// ---------- persona anketi ----------
const TASLAK = 'ds_anket_taslak';
const taslak = () => { try { return JSON.parse(localStorage.getItem(TASLAK) || '{}'); } catch { return {}; } };
const taslakKaydet = d => localStorage.setItem(TASLAK, JSON.stringify(d));

export function startSurvey(mevcuttan) {
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
  app().innerHTML = `
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
  if ($('#aSonra')) $('#aSonra').onclick = () => { topla(); if (ilk) localStorage.setItem('ds_anket_sonra', '1'); S.go(ilk ? 'ozet' : 'persona'); };
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
    await S.yukle();
    S.chat = [];
    if (ilk) return renderHazir();
    toast('🧬 Future Dude güncellendi');
    S.go('persona');
  });
}

export async function renderHazir() {
  S.view = 'hazir';
  chrome('sihirbaz');
  const a = S.persona.cevapObj || {};
  const c = hedefHesap();
  app().innerHTML = `
    <div class="ortala" style="padding-top:18px;display:flex;flex-direction:column;gap:12px;align-items:center">
      <div class="hazir-kure"><img src="img/logo.svg" alt="" width="64" height="51"></div>
      <span class="ust-etiket">Kurulum tamam</span>
      <h1>Future Dude hazır</h1>
      <p class="soluk" style="margin:0;max-width:310px">${futureYear(a)} yılındaki ${esc(a.ad || 'sen')}, anketteki cevaplarınla yaratıldı. Kişiliğini istediğin zaman düzenleyebilirsin.</p>
    </div>
    <div class="kart">
      <div class="satir"><span class="kayit-ik" style="background:rgba(var(--vurgu-rgb),.2);border-radius:50%">${ic('zaman', 18)}</span><b>${futureYear(a)}’den bir mesaj</b></div>
      <div class="msj model" id="ilkMesaj"><span class="yaziyor"><span></span><span></span><span></span></span></div>
    </div>
    <div class="kart">
      <div class="satir kucuk"><span class="soluk">Hedef</span><span class="bosluk"></span><b>${esc(S.ayar.hedef_ne || '-')} · ${c.hedef ? money(c.hedef) : '-'}</b></div>
      <div class="satir kucuk"><span class="soluk">Aylık en az</span><span class="bosluk"></span><b>${c.min ? money(c.min) : '-'}</b></div>
      <div class="satir kucuk"><span class="soluk">Veri</span><span class="bosluk"></span><b>${isDemo() ? 'Bu tarayıcı (demo)' : `${CONFIG.TABLO_ADI} · Drive`}</b></div>
    </div>
    <div class="doldur"></div>
    <button class="blok buyuk" id="borsaAc">Borsayı aç 🔔</button>`;
  $('#borsaAc').onclick = () => S.go('ozet');
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
export function renderPersona() {
  S.view = 'persona';
  chrome('ana');
  const p = S.persona;
  if (!p.prompt) {
    app().innerHTML = `<div class="kart"><h2>🧬 Future Dude’u yarat</h2><p class="soluk">Kısa bir anketle senin gibi konuşan, hedefini bilen, gerektiğinde seni hesaba çeken 10 yıl sonraki hâlini yarat.</p><button class="blok buyuk" id="basla">Ankete başla</button></div>`;
    $('#basla').onclick = () => startSurvey(false);
    return;
  }
  const a = p.cevapObj || {};
  app().innerHTML = `
    <button class="ikinci" id="sohbeteDon" style="align-self:flex-start">${ic('geri', 18)} Sohbete dön</button>
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
      ${S.hafiza.length ? `<ul class="liste">${S.hafiza.map(h => `<li><span class="bosluk">${esc(h['Not'])}<div class="mini">${esc(h['Tarih'])}</div></span><button class="ikon-btn" data-sil="${h._row}" aria-label="Sil">${ic('cop', 16)}</button></li>`).join('')}</ul>` : '<p class="mini">Henüz not yok.</p>'}
      <div class="satir"><input id="hNot" placeholder="ör. Mart’ta araba taksiti bitiyor" class="bosluk" aria-label="Yeni not"><button id="hEkle">Ekle</button></div>
    </div>`;
  $('#sohbeteDon').onclick = () => S.go('dude');
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
export function systemPrompt() {
  const m = malVarligi(), h = hedefHesap(), ym = buAy(), ay = ayHesap(ym);
  const persona = S.persona.prompt || 'Sen "Future Dude"sın: kullanıcının 10 yıl sonraki hâli. "Dudestreet" adlı kişisel finans uygulamasının içinden onunla konuşursun; samimi, esprili ve hedeflerine sadıksın. Rakam uydurmazsın.';
  const simdi = new Date().toLocaleString('tr-TR', { dateStyle: 'full', timeStyle: 'short' });
  const dg = S.persona.cevapObj?.dogum && S.persona.cevapObj.dogum.slice(5) === today().slice(5) ? '\nBUGÜN ONUN DOĞUM GÜNÜ! İlk mesajında içtenlikle kutla.\n' : '';
  const hafiza = S.hafiza.length ? S.hafiza.slice(-40).map(x => `- ${x['Not']}`).join('\n') : '(henüz bir şey yok)';
  const pf = m.v.map(x => `${x.p['Ad'] || x.p['Sembol']} (${x.p['Tür']}): değer ${money(x.deger)}${x.alis ? `, alış ${money(x.alis)}, fark ${money(x.kar)} (%${fmt(x.karYuzde, 1)})` : ''}${x.tahmini ? ' [tahmini değer]' : ''}${x.canli && x.gunluk ? `, bugün %${fmt(x.gunluk, 2)}` : ''}${x.hedefte ? ' [hedefe sayılıyor]' : ''}`).join('\n') || 'varlık eklenmemiş';
  const brc = borclar().map(x => `${x.b['Ad']} (${x.b['Tür']}): borç ${money(x.borc)}${x.limit ? `, limit ${money(x.limit)}` : ''}${x.asgari ? `, asgari/taksit ${money(x.asgari)}` : ''}${x.son ? `, son ödeme ${x.son}` : ''}`).join('\n') || 'borç yok';
  const aylikGG = []; for (let i = 0, a = ym; i < 4; i++) { const x = ayHesap(a); if (x.gelir || x.gider) aylikGG.push(`${a}: gelir ${money(x.gelir)}, gider ${money(x.gider)}, birikim ${money(x.yatirilan)}, ay sonu ${money(x.kalan)}`); const [y, mo] = a.split('-').map(Number); const d = new Date(y, mo - 2, 1); a = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  const ekGider = ay.giderler.map(g => `${g['Tarih']} ${g['Kalem']} [${g['Kategori']}] ${money(num(g['Tutar']))}${g['Birikimden'] === 'evet' ? ' (birikimden!)' : ''}`).join('\n') || 'yok';
  const temel = ay.temel.map(b => `${b.kalem} ${money(b.tutar)}`).join(', ') || 'girilmemiş';
  return `${persona}

Şu anki gerçek tarih (karşındaki kişi bu tarihte yaşıyor): ${simdi}
${dg}
HAFIZAN (onun hakkında bildiklerin; doğal kullan, liste gibi sıralama, uydurma):
${hafiza}

GÜNCEL VERİLER (onun kendi tablosundan; para birimi ${S.ayar.para_birimi || '₺'}):
TOPLAM MAL VARLIĞI: net ${money(m.net)} (varlıklar ${money(m.brut)} − borçlar ${money(m.borc)}); bugünkü değişim ${money(m.gunluk)}
HEDEF: ${S.ayar.hedef_ne || 'koymadı'}${h.hedef ? ` · hedef ${money(h.hedef)} · birikmiş ${money(h.toplam)} (%${(h.ilerleme * 100).toFixed(1)}) · kalan ${money(h.kalan)} · tahmini varış ${h.varis || '-'}` : ''}${h.min ? ` · aylık en az ${money(h.min)}, bu ay ${money(h.buAy)} (${h.durum})` : ''}${h.gereken !== null ? ` · hedef tarihe yetişmek için ayda ${money(h.gereken)} gerekiyor` : ''}
BU AY GELİR-GİDER (${ymAdi(ym)}): gelir ${money(ay.gelir)}, gider ${money(ay.gider)} (temel ${money(ay.sabit)} + ek ${money(ay.ekGelirden)}), birikime ${money(ay.yatirilan)}, ay sonu ${money(ay.kalan)}; beklenen maaş ${S.ayar.aylik_gelir ? money(num(S.ayar.aylik_gelir)) : 'girilmedi'}
TEMEL GİDERLER: ${temel}
BU AYIN EK GİDERLERİ:
${ekGider}
SON AYLAR:
${aylikGG.join('\n') || 'yok'}
VARLIKLAR:
${pf}
BORÇLAR:
${brc}`;
}

export function renderDude() {
  if (!AI.getKey()) {
    app().innerHTML = `<div class="kart"><h2>💬 Future Dude’un beyni yok</h2><p class="soluk">Konuşabilmesi için kendi Gemini anahtarını bağla. Ücretsiz, 1 dakika sürer.</p><button class="blok buyuk" id="g">🔑 Gemini’yi bağla</button></div>`;
    $('#g').onclick = () => S.wizard('gemini');
    return;
  }
  const a = S.persona.cevapObj || {};
  const kim = S.persona.prompt ? `${futureYear(a)}’deki ${esc(a.ad || 'sen')}` : 'Future Dude';
  const ONERI = ['Bu ay nasıl gidiyorum?', 'Hedefe ne zaman ulaşırım?', 'Portföyüm hakkında ne düşünüyorsun?', 'Bu hafta 2.000 harcasam olur mu?', 'Bana bir motivasyon ver'];
  app().innerHTML = `
    <div class="satir"><div class="bosluk"><span class="ust-etiket">Future Dude</span><div class="mini">${kim} ile konuşuyorsun</div></div>
      <button class="ikinci kucuk-btn" id="kisilik">🧬 Kişilik</button>${S.chat.some(m => m.role === 'user') ? '<button class="hayalet kucuk-btn" id="temizle">Yeni sohbet</button>' : ''}</div>
    ${S.persona.prompt ? '' : '<div class="uyari">Henüz kişilik yok; genel bir Future Dude ile konuşuyorsun. <a href="#" id="anketGit">Anketi doldur</a>, gerçekten sen gibi konuşsun.</div>'}
    <div class="sohbet" id="sohbet">${S.chat.map(m => `<div class="msj ${m.role}">${esc(m.text)}</div>`).join('') || `<div class="msj model">${esc(S.persona.prompt ? 'Söyle dude, ne var ne yok? Rakamların hepsi önümde 👀' : 'Selam! Ben gelecekteki sen. Anketi doldurursan tam senin gibi konuşurum 😎')}</div>`}</div>
    <div style="height:120px"></div>
    <div class="yazma"><div class="yazma-ic" style="flex-direction:column;align-items:stretch">
      ${S.chat.some(m => m.role === 'user') ? '' : `<div class="oneriler">${ONERI.map(o => `<button class="ikinci" data-oneri="${esc(o)}">${esc(o)}</button>`).join('')}</div>`}
      <div class="satir" style="align-items:flex-end"><textarea id="girdi" rows="1" placeholder="Future Dude’a yaz…" aria-label="Mesaj"></textarea><button id="gonder" aria-label="Gönder">${ic('gonder', 20)}</button></div>
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

