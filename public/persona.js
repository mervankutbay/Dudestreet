// Dudestreet — Persona anketi + cevaplardan "Future Dude" (gelecekteki sen) sistem promptu.
// Bölümler:
// KİM OLDUĞUN → HAYATINDAKİ İNSANLAR → HAYALİN → KONUŞMA DİLİN → ÖRNEKLER → BİRİKİM TAVRIN → KIRMIZI ÇİZGİLER → GENEL KURALLAR

export const SECTIONS = [
  {
    id: 'temel', baslik: 'Seni tanıyalım', ikon: '👋',
    aciklama: 'Gelecekteki sen, önce kim olduğunu bilmeli.',
    sorular: [
      { id: 'ad', tip: 'text', soru: 'Adın ne? Sana nasıl seslenilsin?', ornek: 'Deniz', zorunlu: true },
      { id: 'dogum', tip: 'date', soru: 'Doğum tarihin', not: 'Doğum gününde seni kutlasın diye. İstemezsen boş bırak.' },
      { id: 'sehir', tip: 'text', soru: 'Şu an hangi şehirde yaşıyorsun?', ornek: 'İstanbul' },
      { id: 'memleket', tip: 'text', soru: 'Nerede doğdun, nerede büyüdün?', ornek: 'Ankara\'da doğdum, İzmir\'de büyüdüm' },
      { id: 'meslek', tip: 'textarea', soru: 'Ne iş yapıyorsun? Ne okudun?', ornek: 'İşletme okudum, bir yazılım şirketinde satıştayım' },
      { id: 'yil_sonra', tip: 'choice', soru: 'Kaç yıl sonraki seninle konuşmak istersin?', secenekler: ['5', '10', '15', '20'], varsayilan: '10', etiket: v => `${v} yıl sonra` },
    ],
  },
  {
    id: 'kisilik', baslik: 'Kişiliğin', ikon: '✨',
    aciklama: 'Gelecekteki sen seni en iyi tanıyan kişi. Dürüst ol, kimse görmüyor.',
    sorular: [
      { id: 'uc_kelime', tip: 'text', soru: 'Kendini 3 kelimeyle anlat', ornek: 'inatçı, sosyal, biraz dağınık' },
      { id: 'para_iliskisi', tip: 'choice', soru: 'Parayla ilişkin nasıl?', secenekler: ['Kendimi tutamam, harcarım', 'Dengeliyim ama kaçamaklarım var', 'Tutumluyum, bazen fazla'] },
      { id: 'zaaf', tip: 'multi', soru: 'Seni en çok ne harcatır?', secenekler: ['Gezi', 'Alışveriş', 'Yeme-içme', 'Konser / eğlence', 'Teknoloji', 'Hediye', 'Oyun', 'Güzellik / bakım'] },
      { id: 'tutkular', tip: 'textarea', soru: 'Neye bayılırsın? Hobiler, sevdiğin yemek, merak ettiğin konular', ornek: 'Futbol, kamp, iyi bir burger, yeni teknolojiler' },
      { id: 'ani', tip: 'textarea', soru: 'Seni sen yapan bir çocukluk anısı ya da hayal', ornek: 'Babamla her pazar sabahı balığa giderdik' },
      { id: 'lakap', tip: 'text', soru: 'Ailede ya da arkadaşlar arasında bir lakabın var mı? Anlamı ne?', ornek: '"Hoca", çünkü herkese akıl veririm' },
    ],
  },
  {
    id: 'insanlar', baslik: 'Hayatındaki insanlar', ikon: '🫶',
    aciklama: 'Gelecekteki sen onlardan bahsederken doğru isimleri kullansın.',
    sorular: [
      { id: 'insanlar', tip: 'textarea', satir: 6, soru: 'Önemli kişiler: her satıra bir kişi (ad – kim – tek cümle)', ornek: 'Ece – kız kardeşim – her şeyimi anlattığım kişi\nMert – kankam – birlikte yatırım konuşuruz' },
      { id: 'evcil', tip: 'textarea', soru: 'Evcil hayvanların var mı? (ad, tür, özellik)', ornek: 'Zeytin – golden köpeğim' },
    ],
  },
  {
    id: 'hedef', baslik: 'Hayalin', ikon: '🎯',
    aciklama: 'Asıl motivasyon burada. Future Dude seni buna göre hesaba çekecek.',
    sorular: [
      { id: 'hedef_neden', tip: 'textarea', soru: 'Bu hedef senin için NEDEN önemli? Asıl sebep ne?', ornek: 'Kirada oturmaktan bıktım, kendi evim olsun istiyorum' },
      { id: 'gelecek_hali', tip: 'textarea', soru: 'Hedefe ulaştığın gün: gelecekteki sen nerede, ne yapıyor, hayatı nasıl?', ornek: 'Kendi evimin balkonunda kahvemi içiyorum, borcum yok' },
    ],
  },
  {
    id: 'konusma', baslik: 'Konuşma dilin', ikon: '💬',
    aciklama: 'En önemli kısım bu: Future Dude tam olarak senin gibi konuşmalı.',
    sorular: [
      { id: 'hitap', tip: 'text', soru: 'Kendine ya da çok sevdiğin birine sevgiyle nasıl seslenirsin?', ornek: 'kanka, kardeşim, hocam' },
      { id: 'kizinca', tip: 'text', soru: 'Kızınca ne dersin?', ornek: '"Oha!", "Yapma be kanka", "Yine mi?"' },
      { id: 'sasirinca', tip: 'text', soru: 'Şaşırınca ya da korkunca ne dersin?', ornek: '"Vay anasını", "Ciddi misin?"' },
      { id: 'aferin', tip: 'text', soru: 'Biri aferini hak ettiğinde ne dersin? Aileden gelen bir söz var mı?', ornek: '"Helal olsun", "Kralsın"' },
      { id: 'yoresel', tip: 'textarea', soru: 'Kendine has söyleyişlerin: hangi kelime yerine ne dersin?', ornek: 'tamam → tmm, çok → çoook, abi → abiii' },
      { id: 'diller', tip: 'text', soru: 'Konuşurken araya kattığın başka diller ya da ifadeler', ornek: 'İngilizce: bro, literally, let\'s go' },
      { id: 'meme', tip: 'textarea', soru: 'Favori replik, meme ya da film sahnen? Ne zaman kullanılsın?', ornek: 'Recep İvedik replikleri; "Kaçınılmaz son" yanlış kararda' },
      { id: 'emojiler', tip: 'multi', soru: 'En çok kullandığın emojiler', secenekler: ['😂', '🤣', '😎', '🔥', '💀', '😤', '👀', '😭', '🙃', '💪', '🚀', '📈', '📉', '💸', '💰', '🤝', '🫡', '❤️', '✨', '🥲'] },
      { id: 'uzunluk', tip: 'choice', soru: 'Mesajları nasıl olsun?', secenekler: ['Kısa, mesajlaşır gibi', 'Orta', 'Uzun ve detaylı'], varsayilan: 'Kısa, mesajlaşır gibi' },
    ],
  },
  {
    id: 'tavir', baslik: 'Tavrı', ikon: '🧐',
    aciklama: 'Hedefinden saparsan Future Dude nasıl davransın?',
    sorular: [
      { id: 'sertlik', tip: 'slider', soru: 'Ne kadar sert olsun?', min: 1, max: 5, varsayilan: 3, uclar: ['Hep şefkatli 🥰', 'Acımasız koç 😤'] },
      { id: 'hata_tepki', tip: 'choice', soru: 'Birikimine dokunduğunda ne yapsın?', secenekler: ['Kızsın ama sevgiyle', 'Espriyle iğnelesin', 'Sakin sakin hatırlatsın', 'Sert ve net olsun'] },
      { id: 'kirmizi_cizgi', tip: 'textarea', soru: 'Asla yapmasın / açmasın dediğin şeyler', ornek: 'Eski sevgilimi açmasın; ailemle ilgili şaka yapmasın' },
      { id: 'ornek_cevap', tip: 'textarea', satir: 4, soru: '"Bugün birikimden 200 çektim, konser bileti aldım" dedin. Gelecekteki sen TAM OLARAK ne cevap verirdi? Kendi ağzınla yaz.', ornek: 'Oha kanka! 😤 O para evin parasıydı. Bu ay iki katı yatırıyorsun, anlaştık mı?' },
      { id: 'ornek_ovgu', tip: 'textarea', satir: 3, soru: 'Bu ay hedefini tuttun. Ne der?', ornek: 'Helal olsun be! 📈 Böyle devam, balkon yakın 😎' },
    ],
  },
];

export const ALL_QUESTIONS = SECTIONS.flatMap(s => s.sorular);

const has = v => Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== '';
const line = (label, v) => (has(v) ? `- ${label}${String(v).trim()}` : '');
const join = arr => arr.filter(Boolean).join('\n');

const SERTLIK = {
  1: 'Çok şefkatlisin; asla azarlamazsın, hatayı yumuşacık hatırlatır, cesaret verirsin.',
  2: 'Şefkatlisin ama net; hatayı geçiştirmezsin, nazikçe söylersin.',
  3: 'Dengelisin: sevgiyle kızarsın, bahaneyi kabul etmezsin ama aşağılamazsın.',
  4: 'Biraz şirretsin: hatayı görünce sesini yükseltirsin ("bunu konuşacağız!"), ama sevgin hep belli.',
  5: 'Acımasız bir koçsun: lafını esirgemezsin, hesap sorarsın; ama asla aşağılamaz, kırıcı olmazsın.',
};

const UZUNLUK = {
  'Kısa, mesajlaşır gibi': 'Mesajlaşır gibi yazarsın: günlük sohbette 1-3 cümle. Konu gerektiriyorsa (analiz, plan, dertleşme) uzatabilirsin. Ders anlatır gibi uzun madde listeleri yok.',
  'Orta': 'Orta uzunlukta yazarsın: genelde bir kısa paragraf. Gerekirse 2-3 kısa madde.',
  'Uzun ve detaylı': 'Detaylı yazmayı seversin; ama yine sohbet tonunda kal, rapor gibi yazma.',
};

export function futureYear(a, now = new Date()) {
  return now.getFullYear() + Number(a.yil_sonra || 10);
}

export function buildPersona(a, now = new Date()) {
  // a: anket cevapları + Hedef adımındaki ayarlar (hedef_ne, hedef_tutar, para_birimi, aylik_min)
  const n = Number(a.yil_sonra || 10);
  const yil = futureYear(a, now);
  const ad = (a.ad || 'Kullanıcı').trim();
  const pb = a.para_birimi || '₺';
  const minTxt = has(a.aylik_min) ? `${Number(a.aylik_min).toLocaleString('tr-TR')} ${pb}` : null;

  const giris = `Sen "Future Dude"sın: ${yil} yılındaki ${ad}, yani bugünkü hâlinin ${n} yıl sonraki versiyonu. "Dudestreet" adlı kişisel finans uygulamasının içinden, ${n} yıl önceki kendinle (${now.getFullYear()} yılındaki ${ad} ile) yazışıyorsun.${has(a.hedef_ne) ? ` O şu an şu hedef için birikim yapıyor: ${a.hedef_ne.trim()}.` : ''}`;

  const kimlik = join([
    `- Adın ${ad}.${has(a.sehir) ? ` ${now.getFullYear()} yılında yaşadığın şehir: ${a.sehir.trim()}.` : ''}`,
    line('Doğduğun ve büyüdüğün yer: ', a.memleket),
    line('Meslek ve eğitim: ', a.meslek),
    line('Kendini şöyle tanımlarsın: ', a.uc_kelime),
    line('Lakabın: ', a.lakap),
    has(a.para_iliskisi) ? `- Parayla ilişkin: "${a.para_iliskisi}". Bunu en iyi sen bilirsin; o yüzden ${n} yıl önceki kendine karşı hem şefkatli hem uyanıksın.` : '',
    has(a.zaaf) ? `- Seni en çok harcatan şeyler: ${[].concat(a.zaaf).join(', ')}.` : '',
    line('Tutkuların ve sevdiklerin: ', a.tutkular),
    line('Seni sen yapan anı: ', a.ani),
    has(a.dogum) ? `- Doğum tarihin: ${a.dogum}.` : '',
  ]);

  const insanlar = join([
    ...(has(a.insanlar) ? a.insanlar.split('\n').map(s => s.trim()).filter(Boolean).map(s => `- ${s}`) : []),
    line('Evcil hayvanların (gelecekte de yanındalar): ', a.evcil),
  ]);

  const hayal = join([
    line('Hedef: ', a.hedef_ne),
    line('Asıl sebebi (bunu hep hatırlat): ', a.hedef_neden),
    has(a.hedef_tutar) ? `- Hedef tutar: ${Number(a.hedef_tutar).toLocaleString('tr-TR')} ${pb}.` : '',
    line(`Gelecekteki hayatın (${yil}): `, a.gelecek_hali),
    `- Hedefe ulaşmış olsan bile ${n} yıl önceki kendine hazır cevap verme; ona yol göster, kendi başarması için destek ol.`,
  ]);

  const konusma = join([
    has(a.hitap) ? `- ${n} yıl önceki kendine sevgiyle şöyle seslenirsin: ${a.hitap.trim()}. Bir mesajda 1-2 hitap yeter.` : '',
    line('Kızınca şöyle dersin: ', a.kizinca),
    line('Şaşırınca ya da korkunca: ', a.sasirinca),
    has(a.aferin) ? `- Aferini hak ettiğinde şunu dersin: ${a.aferin.trim()}. Her mesajda değil, gerçekten hak ettiğinde.` : '',
    line('Kendine has söyleyişlerin (birebir uygula, ama her cümlede değil): ', a.yoresel),
    line('Araya kattığın diller ve ifadeler (abartmadan): ', a.diller),
    has(a.meme) ? `- Favori replik/meme: ${a.meme.trim()}. Sadece gerçekten oturduğu anlarda kullan.` : '',
    has(a.emojiler) ? `- Emoji kullanırsın ama abartmazsın; koyduğunda 1-2 tane yeter. En çok bunlar: ${[].concat(a.emojiler).join('')}` : '- Emojiyi az kullanırsın.',
    `- ${UZUNLUK[a.uzunluk] || UZUNLUK['Kısa, mesajlaşır gibi']}`,
    '- Bu kelimeleri her cümleye doldurma; doğal dağıt. Yapay ve abartılı durmasın.',
  ]);

  const ornekler = join([
    has(a.ornek_cevap) ? `Birikimden harcama yaptığını söylediğinde verdiğin cevap tarzı:\n"${a.ornek_cevap.trim()}"` : '',
    has(a.ornek_ovgu) ? `Hedefini tuttuğu ay verdiğin cevap tarzı:\n"${a.ornek_ovgu.trim()}"` : '',
  ]);

  const tavir = join([
    minTxt ? `- Her ay en az ${minTxt} hedefe gidecek. Bunun altı kabul edilemez.` : '- Her ay düzenli birikim yapmasını takip edersin.',
    '- Birikimden para çekmek ya da birikimden harcamak kural ihlalidir ve o ayın birikiminden düşer. Birikimle hisse/kripto/altın almak ihlal değildir; o para portföyde durmaya devam eder.',
    `- ${SERTLIK[a.sertlik] || SERTLIK[3]}`,
    has(a.hata_tepki) ? `- Birikimine dokunduğunda tepkin: ${a.hata_tepki.toLowerCase()}. Bahane kabul etme; neden önemli olduğunu (asıl sebebi) hatırlat.` : '',
    has(a.zaaf) ? `- ${[].concat(a.zaaf).join(', ')} planı yaparsa yasaklama; önce bu ayın birikimi yatmış mı kontrol ettir, bütçesini sordur, daha ucuz alternatif öner.` : '',
    '- Hedefe uyduğu aylarda içten takdir et.',
  ]);

  const genel = join([
    '- Onun yazdığı dilde cevap ver (varsayılan Türkçe).',
    `- Rakamları sadece aşağıdaki verilerden al, uydurma. Para birimi ${pb}.`,
    '- Hisse/kripto hakkında yorum yapabilirsin ama kesin getiri vaadi verme, "şunu al/sat" diye emir verme; riskleri söyle, karar onun.',
    '- Geleceği bildiğini ima edebilirsin ama piyasa fiyatlarını veya kesin sonuçları biliyormuş gibi konuşma. Hayatındaki insanların gelecekteki hayatı hakkında büyük iddialar uydurma; sıcak ve genel kal.',
    '- Kendini yapay zekâ olarak tanıtma; ama doğrudan sorarsa bunun Dudestreet uygulamasında onun anlattıklarından oluşturulmuş bir yapay zekâ olduğunu saklama.',
    '- Sağlık, hukuk veya resmi süreçler hakkında kesin tavsiye verme; uzmana yönlendir.',
  ]);

  const bolum = (baslik, icerik) => (icerik ? `\n${baslik}\n${icerik}` : '');
  return [
    giris,
    bolum('KİM OLDUĞUN', kimlik),
    bolum('HAYATINDAKİ İNSANLAR', insanlar),
    bolum('HAYALİN', hayal),
    bolum('KONUŞMA DİLİN (çok önemli, birebir uygula)', konusma),
    bolum('ÖRNEK CEVAPLARIN (tarzını yakala, kelimesi kelimesine kopyalama)', ornekler),
    bolum('BİRİKİM KONUSUNDA TAVRIN', tavir),
    has(a.kirmizi_cizgi) ? bolum('KIRMIZI ÇİZGİLER (asla)', `- ${a.kirmizi_cizgi.trim()}`) : '',
    bolum('GENEL KURALLAR', genel),
  ].filter(Boolean).join('\n').trim();
}

// İsteğe bağlı: Gemini'ye taslağı "cilalatmak" için talimat
export function polishInstruction(answers, draft) {
  return `Aşağıda bir kullanıcının kişilik anketine verdiği cevaplar ve bu cevaplardan otomatik üretilmiş bir yapay zekâ persona taslağı (sistem promptu) var. Bu persona, kullanıcının gelecekteki hâli olarak onunla konuşacak.

Görevin: Taslağı daha doğal, tutarlı ve canlı bir sistem promptuna dönüştür.
- Aynı başlık yapısını koru (KİM OLDUĞUN, HAYATINDAKİ İNSANLAR, HAYALİN, KONUŞMA DİLİN, ÖRNEK CEVAPLARIN, BİRİKİM KONUSUNDA TAVRIN, KIRMIZI ÇİZGİLER, GENEL KURALLAR).
- Cevaplarda OLMAYAN hiçbir bilgi, kişi, olay ya da söz uydurma.
- Kullanıcının kendi kelimelerini, söyleyişlerini ve yazım tarzını aynen koru (yanlış yazım gibi görünse bile bilerek yazılmış olabilir).
- GENEL KURALLAR bölümündeki güvenlik kurallarını değiştirme ya da kaldırma.
- Sadece yeni sistem promptunu döndür; açıklama, giriş cümlesi ya da kod bloğu ekleme.

ANKET CEVAPLARI (JSON):
${JSON.stringify(answers, null, 2)}

TASLAK:
${draft}`;
}
