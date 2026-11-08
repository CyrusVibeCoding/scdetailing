# SC Detailing

Mobile detailing website with a live Gemini AI receptionist and private booking requests through Supabase. See AI-SETUP.md for the current backend, request review, and verification.

See SETUP.md for deployment, secrets, Telegram retries, staff recovery, and verification. Serve locally with python -m http.server 4180 (allowed by the backend). No build required. The booking form is request.html. Staff text customers manually; appointment availability must be checked by our team.

## Beam input

Hero input uses React 19.3.1 and border-beam 1.4.1. Run npm ci then npm run build after editing src/beam-input.jsx. Generated assets/beam-input.js and its license file are committed for static GitHub Pages hosting; no build step is needed to serve the supplied files. Animation turns off with reduced motion and pauses while the page is hidden.

## Porsche section

The lower page now uses a scroll-driven Porsche scene, numbered service rows, and a text-led booking section. Serve over HTTP using the command above. ES modules, the import map, and GLB files require an HTTP server.

`porsche.js` uses the vendored Three.js files in `vendor/`. The scene loads near the viewport, fades the roadside as the car moves closer, and stops rendering while idle, offscreen, or in a hidden tab. Reduced motion uses a still composition and a shorter section. A local poster remains available if WebGL or model loading fails.

The existing red Porsche asset is approximately 13.4 MB. Credits and license are in `assets/porsche/ATTRIBUTION.md` and the site footer.
