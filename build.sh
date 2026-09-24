#!/bin/sh
# Concatenates the source files into a single index.html (no build tools needed).
cd "$(dirname "$0")"
FILES="core.js i18n.js lang/es.js lang/es-data.js lang/es-story.js font.js dex.js data.js animmeta.js art.js scenery.js model.js captain.js battle.js menus.js duel.js attackfx.js campaign.js war.js territory.js scenes.js menukit.js cofx.js title.js route.js journey.js modes.js main.js"
# a syntax error in any module stops the build with its file and line (when node is around)
if command -v node >/dev/null 2>&1; then for f in $FILES; do node --check "$f" || exit 1; done; fi
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
<meta name="description" content="Advance Wars rules with Gen I Pokémon: free Kanto from Team Rocket, earn funds from Poké Centers, deploy your PC Box, catch recruits, command with Gym Leaders. Campaign, Skirmish, Battle Tower, Safari Zone and Versus. Pixel art, keyboard, mouse and touch.">
<style>
html,body{margin:0;height:100%;background:#0e0c10;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;overscroll-behavior:none}
body{display:flex;align-items:center;justify-content:center}
canvas{image-rendering:pixelated;image-rendering:crisp-edges;cursor:pointer;display:block}
</style>
</head>
<body><canvas id="c"></canvas>
<script>
H
cat $FILES
cat <<'H'
</script>
</body>
</html>
H
} > index.html
echo "index.html: $(wc -c < index.html) bytes"
