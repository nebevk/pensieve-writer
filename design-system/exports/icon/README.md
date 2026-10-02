# Pensieve icon — 1a "Rising"

## app/
Full app icon (rounded square with glow) per theme at 1024, 512, 256, 128, 64 px.
- macOS: build an .icns from the daylight set (iconutil or an Xcode asset catalog).
- Windows / Electron / Tauri: use pensieve-daylight-1024.png as the source; the build tooling generates .ico/.icns.
- Candlelit and Moonlit sets are for alternate app icons or marketing.

## web/
- favicon.ico (16, 32, 48), favicon.svg, favicon-16/32/48.png
- apple-touch-icon.png (180), icon-192.png, icon-512.png, site.webmanifest

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```

## svg/
Vector masters: pensieve-mark.svg (bird only, transparent) and the three app-icon squares.

Colours: terracotta #a94f2e, amber #e0975a, belly #f6d2a8, quill #2a2622 (light) / paper tone (dark themes).
