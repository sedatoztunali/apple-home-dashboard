# TODO

Bu dosya, geliştirme sırasında takip edeceğimiz işleri içerir. Her maddeye benzersiz bir kod atanır, oluşturulma/tamamlanma tarihleri ve bağımlılıklar belirtilir.

## Aktif İşler

## Tamamlananlar

- [x] T-002 — Home Wallpaper kaldırma seçeneği
  - Oluşturulma: 2025-10-30
  - Tamamlanma: 2025-10-30
  - Bağımlılıklar: —
  - Mevcut: "Home Settings" içinde duvar kâğıdı olarak bir resim seçilebiliyor
  - Hedef: Arka plan resmini tamamen kaldır (theme varsayılan arka planına dön) seçeneği eklenebilmeli
  - Kapsam:
    - Home Settings UI'ına "Remove wallpaper" / "Clear background" seçeneği eklenmesi
    - `BackgroundManager`'a `removeWallpaper()` metodu eklenmesi
    - Theme varsayılan arka planı: `https://raw.githubusercontent.com/Stormrage-DJ/ha_theme_star_wars_light/main/assets/star_wars_light_bg.png`
    - Theme background CSS: `top center / auto no-repeat url(...) fixed`
    - Arka plan temizlendiğinde theme background'unun uygulanması
    - `CustomizationManager` üzerinde theme durumunun kalıcı saklanması
    - Uygulandığında anında görünümün güncellenmesi ve reload sonrası kalıcılık
  - Kabul Kriterleri:
    - Kullanıcı ayardan arka planı kaldırdığında theme varsayılan arka planı uygulanır
    - Theme background CSS özellikleri doğru uygulanır (position: top center, size: auto, no-repeat, fixed)
    - Ayar kalıcıdır, yeniden yüklemede korunur
    - Build ve lint temiz

## Tamamlananlar

- [x] T-004 — Tam rebranding: Smart Home
  - Oluşturulma: 2025-10-30
  - Tamamlanma: 2025-10-30
  - Bağımlılıklar: —
  - Kapsam:
    - Strategy tipi: `custom:smart-home-strategy` (kayıt ve README örnekleri güncellendi)
    - Görünüm tipi: `custom:smart-home-view`, custom element: `smart-home-view`
    - HACS adı ve dosya adı: `Smart Home Dashboard Strategy`, `smart-home-dashboard.js`
    - Webpack çıktı adı ve paket `main`: `smart-home-dashboard.js`
    - README kaynak URL’leri ve yönergeler Smart Home olarak güncellendi
  - Kabul Kriterleri:
    - Kullanıcıya görünen ad/etiket ve kaynak adları “Smart Home” olarak geçiyor
    - HACS kaydı ve dosya adı tutarlı: `smart-home-dashboard.js`
    - Strategy tipi/yaml örnekleri `custom:smart-home-strategy`
    - Build ve lint temiz

- [x] T-001 — Görünüm adı değişikliği
  - Oluşturulma: 2025-10-30
  - Tamamlanma: 2025-10-30
  - Bağımlılıklar: —
  - Mevcut: `custom:apple-home-view`
  - Hedef: `custom:smart-home-view`
  - Kapsam:
    - Strategy konfigürasyon üretiminde kart tipinin `custom:smart-home-view` olarak kullanılması
    - Web component kayıt adının güncellenmesi (custom element tanımı)
    - İlgili import/usage noktalarının uyarlanması
    - Eski ad tamamen kaldırıldı; herhangi bir alias/geriye uyumluluk yok
  - Kabul Kriterleri:
    - Strategy ile oluşturulan tüm sayfalar `custom:smart-home-view` ile render ediliyor
    - Kod tabanında `custom:apple-home-view` referansı kalmadı
    - Konsolda hata yok, build ve lint temiz

- [x] T-003 — Türkçe ve Hollandaca çeviriler
  - Oluşturulma: 2025-10-30
  - Tamamlanma: 2025-10-30
  - Bağımlılıklar: —
  - Mevcut: `src/translations` altında dil dosyaları mevcut
  - Hedef: Türkçe (`tr.json`) eklenmesi ve Hollandaca (`nl.json`) içeriğinin gözden geçirilmesi/güncellenmesi
  - Kapsam:
    - `tr.json` dosyasının oluşturulması (tüm anahtarlar için çeviri)
    - `nl.json` eksik/yanlış kalemlerin tamamlanması
    - `LocalizationService` ile bütünleşik çalıştığının doğrulanması
  - Kabul Kriterleri:
    - Dil `tr` seçildiğinde tüm etiketler Türkçe görüntülenir
    - Dil `nl` seçildiğinde eksik etiket kalmaz
    - Build ve lint temiz
