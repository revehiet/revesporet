# Revesporet

A static Norwegian portfolio for Leif Viljar, with a responsive landing page,
3D project galleries, social films, an about section and contact links.

## Design

Manrope with Georgia italic accents; ivory, charcoal and the original orange.
Main buttons use a slowly animated orange-to-blue gradient. Directional and
playback icons are inline SVGs to avoid emoji rendering on iPhones. The tab icon matches
the new r/arrow logo, with SVG and PNG versions. The header links
to HJEM, 3D PROSJEKTER and INNHOLDSPRODUKSJON. Button fills, arrows and media
previews animate on hover, with reduced-motion support. The dark mode toggle
retains the original `nightMode` preference and defaults to light mode for new visitors.

## Files

- `index.html`: content, navigation and the shared media dialog.
- `assets/styles.css`: responsive layout, themes and animations.
- `assets/site.js`: navigation, themes, galleries and video lifecycle.
- `assets/images/previews/`: smaller WebP previews; full images remain available in the viewer.
- `assets/images/posters/`: stills extracted from the actual videos.
- `assets/vendor/`: pinned hls.js 1.7.2 and its license.

## Media

All 15 films, including the six social reels, use the existing `index.m3u8`
playlists and `.ts` segments. The landing showreel autoplays muted and loops,
with text overlays and a play/pause button revealed on hover or keyboard focus
(always accessible on touch screens). The 3D project cards with animation files
preview their first film on hover or keyboard focus, retaining their cover image
until the first video frame is ready, then fading into playback. Touch users can
use the preview button. Social reels autoplay silently while visible in their
original 9:16 frame; clicking opens the full player with sound and controls.

Inline previews pause and suspend buffering out of view or while the media
dialog is open. Inactive card players release their buffers after eight seconds.
Reduced-motion visitors can start previews explicitly. Browsers with native
HLS use it directly; other supported browsers use the locally bundled
[hls.js](https://github.com/video-dev/hls.js/tree/v1.7.2). Original WebM/MP4 files
provide a fallback. Closing the viewer or changing media stops and releases the player.

Serve the site over HTTP rather than opening `index.html` as a local file. Keep
each playlist together with its segments. An HTTP host should serve `.m3u8` as
`application/vnd.apple.mpegurl` and `.ts` as `video/mp2t`.

The site needs no build step and remains compatible with static hosting.
Manrope loads from Google Fonts, with a sans-serif fallback.

## Verification

Verified in headless Microsoft Edge: all 15 streams through both native HLS and
hls.js/MediaSource, network-error fallback, on-demand gallery loading,
player cleanup, saved dark mode, mobile navigation, keyboard gallery navigation
and focus restoration. Layout checked at 320, 390, 768, 1024, 1440 and 1920 pixels.
No JavaScript errors or missing local assets were found.

The updated branding uses orange-to-blue button animation and SVG/PNG favicons.
Inline previews support native HLS and hls.js, pause/resume, offscreen pausing,
dialog handoff and reduced-motion behavior. Mobile reels use one column at phone
widths; portrait dialogs fit the dynamic viewport and device safe areas.
Muted `playsinline` playback follows [WebKit's iOS video policies](https://webkit.org/blog/6784/new-video-policies-for-ios/).

The current preview flow was verified in Edge with native HLS and the forced
hls.js path: all three project previews, all six silent reels, delayed-loading
fade, hover exit, full-player handoff, touch preview buttons, portrait dialog,
SVG icons, dark mode and 320–1440px layouts. Reduced-motion manual controls were
checked separately. Touch testing used phone emulation, not a physical iPhone.
