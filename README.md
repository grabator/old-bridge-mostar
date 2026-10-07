# Mostar: filmska stranica grada

Stranica koja se "vrti kao film" dok skrolate: Stari most, skakač sa mosta, Neretva, stara čaršija, mjesta za obići i plan dana.

Obični HTML, CSS i JavaScript. Bez instalacije i bez build koraka. Sve ilustracije su nacrtane u kodu (SVG), a fontovi su u repou, pa stranica ne zavisi od tuđih servera.

## Pokretanje

```bash
node serve.mjs
```
Otvori **http://localhost:8080** (drugi port: `node serve.mjs 3000`). Jezik u linku: `?lang=bs`, `?lang=de`, `?lang=en`.

## Fajlovi

| Fajl | Šta je |
|---|---|
| `index.html` | Raspored stranice |
| `css/style.css` | Izgled, boje na vrhu fajla |
| `js/i18n.js` | Svi tekstovi (EN, BS, DE) |
| `js/scene.js` | Ilustracije: nebo, planine, grad, most, stijene, rijeka, ikonice |
| `js/app.js` | Animacija skrola, kartice mjesta, jezici |
| `assets/fonts/` | Fraunces i DM Sans (OFL licenca, besplatni) |

## Kako radi animacija

Dio `#film` je dugačak, a scena unutra je "zalijepljena" za ekran. Pomak skrola (0 do 3800 px) pokreće slojeve:

1. **0 do 600:** naslov "Mostar" odlazi gore, uvodni tekst nestaje.
2. **400 do 1100:** kamera ulazi u kanjon: stijene se razmiču, most raste.
3. **1060 do 1560:** skakač skače sa mosta u Neretvu (pljusak).
4. **1500 do 2700:** most odlazi gore, otvara se Neretva izbliza.
5. **2400 do 3500:** stari grad i tekst o čaršiji.
6. **3400 do 3900:** kartice sa mjestima uđu sa desne strane (listanje u krug, strelice, prevlačenje prstom, tastatura).

Vrijednosti su u `js/app.js` (funkcija `frame`). Transformacije se pišu direktno na slojeve, da skrol bude gladak i na slabijim mobitelima.

## Objava (Cloudflare)

Workers & Pages → Create → Import a repository → `old-bridge-mostar`. Build command prazno. `_headers` podešava keširanje.

## Prave fotografije umjesto ilustracija

U `index.html` svaki sloj ima `data-art="..."`. Ako želite fotografije, umjesto crteža se u sloj može staviti `<img>` sa slikom (PNG sa providnom pozadinom za stijene i most). Koristite samo slike za koje imate pravo korištenja.
