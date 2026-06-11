# Utah Flight Website

This is a standalone editable website for `Utah Flight Volleyball Club`.

## Files You Will Edit Most Often

- `content.json`
  Change club name, text, colors, links, schedule items, program cards, and media file paths.
- `editor.html`
  Open the visual editor if you want to update the content through forms instead of editing JSON directly.
- `coaches.js`
  Add coach/staff names, roles, bios, team tags, and photo paths for the Coaches page.
- `assets/media/`
  Replace the logo, hero video, poster, and gallery images with your own files.
- `styles.css`
  Adjust layout or styling if you want a different visual direction later.

## Quick Start

1. Open this folder in a browser-friendly local server.
2. Replace files in `assets/media/` with your real logo, photos, and videos.
3. Update the matching file paths and text in `content.json`.

## Easiest Local Preview

From this folder run:

```bash
PORT=8001 node server.js
```

For a static-only preview, you can still run:

```bash
python3 -m http.server 8000
```

The recruiting MaxPreps import needs `node server.js` because it uses `/api/import-maxpreps`.

Then open:

`http://localhost:8001`

## Visual Editor

Open:

`http://localhost:8001/editor.html`

What it does:

- edits the site content through form fields
- lets you add and remove programs, gallery cards, timeline items, and other list content
- can connect to your `assets/media` folder and import images or video directly from the editor
- stores your draft in the browser while you work
- opens a draft preview before you publish
- lets you download a fresh `content.json` or save one directly in supported browsers

Recommended workflow:

1. Open `editor.html`.
2. Click `Connect Media Folder` and choose `utah-flight-site/assets/media`.
3. Use the `Import File` buttons for logo, hero poster, hero video, or gallery images.
4. Make your text changes.
5. Click `Open Draft Preview` to review them.
6. Click `Download content.json` or `Save To File`.
7. Replace the site's `content.json` with the new one if needed.

## Page Guide

- `index.html`
  Main Utah Flight site.
- `coaches.html`
  Public coaches and staff page. Edit entries in `coaches.js`.
- `recruiting.html`
  Public recruiting page with approved athlete profile cards.
- `recruiting-submit.html`
  Public one-athlete submission form. Submissions go to admin approval and can include an uploaded athlete photo plus highlight links.
- `admin.html`
  Focused admin login, submission list, and review/approval page.
- `recruiting-dashboard.html`
  Admin recruiting dashboard for review, edits, approval, and profile publishing.
- `recruiting-seed.json`
  Approved recruiting profiles that should ship with the site on a fresh deploy. Sam Davis is seeded here.

## Recruiting Login

The recruiting dashboard has a temporary file-backed login and approval flow.

Local default logins:

- Admin:
  `admin` / `flight-admin`
- Player or coach:
  `player` / `flight-player`

For Railway, set these environment variables before using it publicly:

```bash
ADMIN_USERNAME
ADMIN_PASSWORD
PLAYER_USERNAME
PLAYER_PASSWORD
```

Public submissions are saved as pending without a login. Admin approval publishes the profile.

## Google Login

Google login is supported through server-side OAuth. Create a Google Cloud OAuth client with application type `Web application`, then set these environment variables:

```bash
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
GOOGLE_ADMIN_EMAILS
```

Local redirect URI:

```text
http://localhost:8002/auth/google/callback
```

Production redirect URI:

```text
https://utahflight.com/auth/google/callback
```

`GOOGLE_ADMIN_EMAILS` is a comma-separated list of Google accounts that should become admins. Other Google accounts can submit player profiles as player/coach users.

## Media Swap Guide

- Logo:
  Replace `assets/media/utah-flight-facebook-logo.jpg` and keep the same filename, or change the `brand.logo` path in `content.json`.
- Hero video:
  Add an MP4 named `assets/media/hero-video.mp4`. If the file is missing, the poster image still carries the section.
- Hero poster:
  Replace `assets/media/hero-poster.svg` with a real team or action image.
- Gallery:
  Update the `gallery` array in `content.json` with your own file paths and captions.

## JSON Editing Tips

- Keep all text in double quotes.
- Put commas between items, but not after the last item in a list.
- If the page stops loading after an edit, there is usually a JSON formatting mistake to fix.
- Because the site now reads `content.json`, preview it through a local server instead of opening `index.html` directly as a file.

## References Used

- Public Utah Flight Facebook page for logo/name/description reference:
  `https://www.facebook.com/UtahFlightVolleyball/`
- Tstreet Volleyball for general visual inspiration only:
  `https://tstreetvolleyball.com/`

## Notes

- The default content is intentionally easy to rewrite and does not assume exact team details.
- This is a static website, so it is simple to host almost anywhere.
- If you want, this can be extended next with coaches, registration forms, tournament schedules, or a multi-page layout.
