# Shah on Google Play

Shah is already an installable web app, so it goes on Google Play as a Trusted Web Activity: a small Android app
that opens shah-trajneri.pages.dev full screen with no browser bar. The app's code stays the website; every deploy
updates the Play app too.

Everything on the website side is ready:

- the manifest: id, name, icons including the maskable one, standalone display, portrait orientation, categories,
  and long-press shortcuts to Luaj, today's puzzle and Mësime;
- offline support (the service worker);
- a privacy page at https://shah-trajneri.pages.dev/privatesia/ (the store requires one);
- the store pictures in `docs/play-store/`.

What needs you is below.

## 1. A Google Play developer account (you)

- Sign up at https://play.google.com/console: $25, paid once, plus identity verification.
- A new personal account must run a closed test before it can publish: Google asks for 12 testers for 14 days. Check
  the current rule in the console.

## 2. The Android package (you, about 10 minutes)

1. Open https://www.pwabuilder.com and enter `https://shah-trajneri.pages.dev`.
2. Choose **Package for stores > Android > Google Play** and fill in:
   - **Package ID:** for example `dev.pages.shah_trajneri`. It can never change later, so pick it once.
   - **App name:** `Shah: trajner shahu`. **Short name:** `Shah`.
   - **Display:** standalone. **Status bar colour:** `#070908`.
   - **Signing key:** let PWABuilder create a new one.
3. Download the zip. It holds:
   - the `.aab` to upload;
   - the signing key and its passwords. Keep these safe: without them there are no updates;
   - an `assetlinks.json`.

## 3. Prove the site and the app belong together (me, after step 2)

Send me the `assetlinks.json` from the zip. If you use Play App Signing (the default), also send the SHA-256 shown
in Play Console > Test and release > App integrity.

I will put them in `public/.well-known/assetlinks.json` and deploy. Until this file is live, the app shows a browser
bar at the top.

## 4. The store listing (you paste, the texts are below)

- **Privacy policy URL:** https://shah-trajneri.pages.dev/privatesia/
- **Category:** Education (or Games > Board).
- **Content rating:** answer the questionnaire. There is no violence or user-made content, apart from the names
  typed in a challenge. There are no purchases and no ads.
- **Data safety:** the developer collects no data by default. Optional, and only when the person turns it on:
  - online games: the moves, deleted after a day;
  - challenges: the name typed and the score, deleted after two weeks;
  - sync: an encrypted copy the server cannot read;
  - reminders: the browser's push address.

  Data is encrypted in transit; nothing is shared with third parties.

### Short description (80 characters at most)

Mëso shah në shqip: luaj kundër motorit dhe trajneri të thotë pse.

### Full description

Shah është një trajner shahu në shqip, falas, pa llogari dhe pa reklama.

Luaj kundër nëntë kundërshtarëve, nga Lea që sapo ka mësuar si lëvizin figurat, deri te Stockfish. Pas çdo
lëvizjeje trajneri të thotë nëse ishte e mirë, dhe pse, me fjalë të thjeshta. Gabimet e tua kthehen si ushtrime
derisa t’i mësosh.

- 20 mësime të shkurtra, nga rregullat dhe rokada deri te piruni, mati me dy lëvizje dhe fundloja
- Mbi 1.600 ushtrime nga baza e hapur e Lichess, ushtrimi i ditës dhe një garë 3 minutëshe
- Sfida me shokët: dhjetë ushtrime të njëjta për të gjithë, me tabelë rezultatesh
- Analizo çdo lojë, edhe lojërat e tua nga chess.com ose Lichess
- Luaj me një shok në të njëjtin telefon, ose online
- Tabelë prej druri në 3D, në katër dhoma
- Progresi, niveli yt dhe medaljet, të ruajtura në telefonin tënd

Motori punon brenda telefonit dhe loja punon edhe pa internet.

## 5. Updates

None needed for the website itself: a deploy changes the Play app too. A new `.aab` is only needed to change the
icon, the name or the package settings.
