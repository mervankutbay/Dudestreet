// Dudestreet — ayarlar
// GOOGLE_CLIENT_ID kodda yazılı değil: açılışta Cloudflare'deki GOOGLE_CLIENT_ID değişkeninden (/api/ayar) okunur.
export const CONFIG = {
  GOOGLE_CLIENT_ID: '',
  APP_NAME: 'Dudestreet',
  APP_VERSION: 'v5',
  // Uygulamanın beklediği tablo (şema) sürümü. Yeni migration ekleyince artır.
  SCHEMA_VERSION: 3,
  // Kullanıcının Drive'ında tabloyu tanımak için kullanılan etiket
  APP_PROPERTY: 'dudestreet',
  TABLO_ADI: 'Dudestreet Tablom',
};
