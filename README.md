# Dudestreet

Kendi Wall Street'in. Birikimini ve portföyünü takip eden kişisel finans PWA'sı; içinde **Future Dude** (10 yıl sonraki sen) adlı yapay zekâ var.

- **Veri tutmaz.** Her kullanıcının verisi kendi Google Drive'ındaki "Dudestreet Tablom" tablosunda durur. Uygulama Drive'da sadece kendi oluşturduğu dosyayı görebilir (`drive.file` izni).
- **Yapay zekâ kullanıcının kendi anahtarıyla.** Future Dude, kullanıcının kendi ücretsiz Gemini anahtarıyla, tarayıcıdan doğrudan Google'a bağlanır.
- **Sunucu sadece fiyat getirir.** Cloudflare Worker yalnızca Yahoo Finance'tan fiyat ve arama sonucu getirir; kullanıcı verisi oradan geçmez.
- **Demo modu:** Google'a bağlanmadan, örnek verilerle denenebilir (veriler sadece o tarayıcıda durur).

## Sekmeler
- **Özet:** toplam mal varlığı (varlıklar − borçlar), dağılım; "Bugün" satırına dokununca açılan grafik ("Yatırım hariç" anahtarlı)
- **Gelir-Gider:** Nébula'daki sistem: ay ay gelir, temel giderler (✓ onay, ay ay değişen bütçe), ek giderler, kendi kategoriler, harcama raporu
- **Varlıklar:** hisse, kripto, fon, altın/gümüş, döviz, nakit/banka, ev, arsa, araba, MBKAYO payı (yayınlanan MBKAYO tablosundan canlı toplam ÷ 6)
- **Borçlar:** kredi kartları (limit, borç, asgari, kesim ve son ödeme günü), krediler, kişilere borçlar
- **Hedef:** aylık birikim hedefi, birikim hesabı, hedefe bağlı varlıklar
- Üstte: **Notlar** (Listeye çevir → gelir-gidere aktarma; saat geçen satırlara takvim alarmı), **Future Dude**, **Ayarlar** (6 koyu tema)

## Değer artışı varsayımları
- Ev / arsa: TCMB Konut Fiyat Endeksi yıllık değişimi (Eylül 2026: %22,3)
- Araba: ikinci el otomobil fiyat endeksleri (2026 nominal ~%15-20, varsayılan %16)
Her varlıkta oran değiştirilebilir; değer, girilen tarihten bugüne bileşik olarak büyütülür.

## Yapı

```
public/            Site (PWA)
  app.js           Arayüz: kurulum, Borsa, Portföy, Future Dude, Ayarlar
  google.js        Google girişi + Sheets/Drive (tarayıcıdan doğrudan)
  gemini.js        Gemini (kullanıcının anahtarıyla)
  persona.js       Future Dude anketi ve kişilik metni
  schema.js        Tablo sekmeleri ve sürüm geçişleri
  localdb.js       Demo modu (tarayıcıda)
src/worker.js      /api/ayar, /api/fiyatlar, /api/ara, /api/mbkayo
wrangler.jsonc     Cloudflare ayarı
```

## Kurulum

### 1. Cloudflare
1. **Workers & Pages → Create → Import a repository** → `mervankutbay/dudestreet` seç.
2. Ayarları olduğu gibi bırak (deploy komutu `npx wrangler deploy`) → **Deploy**.
3. Adres: `https://dudestreet.<hesabın>.workers.dev`. Demo modu bu aşamada çalışır.

### 2. Google girişi (Client ID)
1. [console.cloud.google.com](https://console.cloud.google.com) → yeni proje: **Dudestreet**.
2. **APIs & Services → Library**: **Google Sheets API** ve **Google Drive API**'yi etkinleştir.
3. **OAuth consent screen** (Google Auth Platform): uygulama adı Dudestreet, **External**. **Data access**'e `.../auth/drive.file` iznini ekle. Test aşamasındayken **Audience → Test users**'a kullanacak kişilerin Gmail'lerini ekle (en fazla 100 kişi). Herkese açmak için **Publish app**.
4. **Clients → Create client** → **Web application**.
   - Authorized JavaScript origins: `https://dudestreet.<hesabın>.workers.dev`
   - Authorized redirect URIs: `https://dudestreet.<hesabın>.workers.dev/`
5. Çıkan **Client ID**'yi kopyala.
6. Cloudflare → dudestreet → **Settings → Variables and Secrets → Add** → Type: Text, Name: `GOOGLE_CLIENT_ID`, Value: kopyaladığın kimlik → **Deploy**.

`keep_vars: true` sayesinde bu değişken kod güncellemelerinde silinmez.

## Tablo sekmeleri
- **_meta** (gizli): tablo sürümü, isteğe bağlı Gemini anahtarı
- **Ayarlar:** hedef, hedef tutar, aylık en az, para birimi, hedef tarih
- **Kayıtlar:** Birikim, Harcama (birikimden çıkan para, kural ihlali), Varlık alımı, Varlık satışı
- **Portföy:** hisse, kripto, fon, altın/gümüş (gram), döviz, elle değerli varlıklar
- **Persona:** anket cevapları ve Future Dude kişilik metni
- **Hafıza:** Future Dude'un hatırlaması istenen notlar

Yeni sekme/sütun eklerken `schema.js`'e yeni bir adım ekle ve `config.js`'teki `SCHEMA_VERSION`'ı artır. Kullanıcı uygulamada "Güncelle"ye basınca (isterse önce yedek alınarak) tablosu güncellenir; veri silinmez.

## Fiyatlar
Yahoo Finance (2 dk önbellek). Borsa İstanbul hisseleri `.IS` ekiyle (ör. `THYAO.IS`), kripto `BTC`, `ETH`… (USD paritesinden çevrilir), altın/gümüş ons fiyatından grama çevrilir. Hepsi kullanıcının seçtiği para birimine çevrilir.
