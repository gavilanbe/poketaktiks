#!/bin/sh
# Concatenates the source files into a single index.html (no build tools needed).
cd "$(dirname "$0")"
{
cat <<'H'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#0e0c10">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>POKÉTAKTIKS — pixel tactics</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="icons/icon-180.png">
<meta name="apple-mobile-web-app-title" content="Poketaktiks">
<meta name="description" content="A Fire Emblem / Advance Wars style tactics game with Gen I Pokémon. Grid battles, type matchups, catching wild Pokémon, evolutions, eight chapters and random skirmishes. Pixel art, keyboard, mouse and touch.">
<style>
html,body{margin:0;height:100%;background:#0e0c10;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;overscroll-behavior:none}
body{display:flex;align-items:center;justify-content:center}
canvas{image-rendering:pixelated;image-rendering:crisp-edges;cursor:pointer;display:block}
</style>
</head>
<body><canvas id="c"></canvas>
<script>
H
cat core.js font.js dex.js data.js art.js model.js battle.js duel.js campaign.js scenes.js main.js
cat <<'H'
</script>
</body>
</html>
H
} > index.html
echo "index.html: $(wc -c < index.html) bytes"
