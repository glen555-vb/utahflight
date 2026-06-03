# Utah Flight Website

This is a standalone editable website for `Utah Flight Volleyball Club`.

## Files You Will Edit Most Often

- `content.json`
  Change club name, text, colors, links, schedule items, program cards, and media file paths.
- `editor.html`
  Open the visual editor if you want to update the content through forms instead of editing JSON directly.
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
./serve.sh
```

Or run:

```bash
python3 -m http.server 8000
```

Then open:

`http://localhost:8000`

## Visual Editor

Open:

`http://localhost:8000/editor.html`

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
