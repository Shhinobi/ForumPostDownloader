# Forum Posts Downloader
This Tampermonkey / Violentmonkey userscript allows downloading individual posts and entire pages from **SimpCity** and **SocialMediaGirls (`forums.socialmediagirls.com`)** XenForo forums.

## Supported Forums & Features
- **SimpCity** (`simpcity.cr`, `simpcity.is`, `simpcity.cz`, `simpcity.hk`, `simpcity.rs`, `simpcity.ax`, `simpcity.su`)
- **SocialMediaGirls** (`forums.socialmediagirls.com`, `socialmediagirls.com`)
  - Full XenForo 2.3 + ThemeHouse UI.X Dark compatibility
  - Native support for **ImagePond** (`imagepond.net` / `media.imagepond.net` / `images.socialmediagirls.com`) single images, embedded `[MEDIA=imagepond]` videos, archives, and multi-page albums
  - Automatic decoding of SMG `/goto/link-confirmation?url=` base64 outbound redirects
  - Live detection when unlocking `[HIDEREACT]` / `[HIDETHANKS]` posts via AJAX (no page refresh required)
  - Ignores UW Forum Comments System (`UW/FCS`) comment headers and handles `D#` discussion posts cleanly
  - Support for SMG attachments (`smgmedia.socialmediagirls.com`, `/attachments/`, `/data/video/`), PutMega, Pixhost (`.to`/`.cc`/`.st`), Erome, Bunkr, GoFile, Filester, Pixeldrain, Cyberdrop, Goonbox, Turbo, Coomer, Kemono, Redgifs, and more

## Installation
1. Install the Tampermonkey browser extension: [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en) [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) [Brave](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en)
2. **Important:** Under the Tampermonkey settings, set the **Config mode** to **Advanced** and enable the **Browser API** in **Download Mode (BETA)**.
3. Open [https://github.com/Shhinobi/ForumPostDownloader/raw/main/dist/build.user.js](https://github.com/Shhinobi/ForumPostDownloader/raw/main/dist/build.user.js) (or copy the contents of [dist/build.user.js](https://github.com/Shhinobi/ForumPostDownloader/blob/main/dist/build.user.js)).
4. Create a new Tampermonkey script and paste the contents you copied in step 3 (if Tampermonkey didn't prompt to install automatically).
5. Save the script (`Ctrl+S`).
6. Visit any thread on SimpCity or SocialMediaGirls to verify the script installation.

# Updates
The script automatically updates from GitHub (`Shhinobi/ForumPostDownloader`). If it doesn't, simply repeat steps 3-6 from the installation section (pasting into the existing script instead of creating a new one).
