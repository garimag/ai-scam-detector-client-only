# AI Scam Detector - Client Only Version

This version removes the separate FastAPI/Python backend. OCR runs in the browser with `tesseract.js`, and scam scoring runs with JavaScript rules in `src/App.jsx`.

## Run locally

```bash
npm install
npm run dev
```

## Deploy on Vercel

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

## Deploy on Netlify

The included `netlify.toml` sets:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

## Note

This is easier to deploy, but it is not the same as the original Python ML backend. The original `model.pkl` scikit-learn model was replaced with browser-side rule scoring.
