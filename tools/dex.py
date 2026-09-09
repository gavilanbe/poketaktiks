#!/usr/bin/env python3
"""Builds dex.js (Gen 1 roster) from Pokémon Showdown's pokedex.json.
Usage: curl -sL https://play.pokemonshowdown.com/data/pokedex.json > /tmp/pokedex.json && python3 tools/dex.py > dex.js
Icons come from assets/pokemonicons-sheet.png, indexed by dex number (12 per row, 40x30 each)."""
import json, sys
d = json.load(open('/tmp/pokedex.json'))
# Evolutions Showdown lists without a level (stones, trades, friendship) get a level here.
MANUAL = {'Pikachu':28,'Vulpix':30,'Growlithe':34,'Poliwhirl':36,'Kadabra':36,'Machoke':36,'Weepinbell':36,
  'Graveler':36,'Shellder':32,'Haunter':38,'Exeggcute':30,'Eevee':25,'Nidorina':32,'Nidorino':32,'Clefairy':30,
  'Jigglypuff':30,'Gloom':36,'Staryu':30,'Slowpoke':37,'Onix':40,'Scyther':40,'Porygon':40,'Seadra':45,'Chansey':40,
  'Magneton':50,'Rhydon':50,'Electabuzz':45,'Magmar':45,'Lickitung':45,'Tangela':45,'Aipom':30,'Golbat':40,
  'Piloswine':45,'Sneasel':45,'Murkrow':40,'Misdreavus':40,'Gligar':40,'Yanma':40,'Nosepass':40,'Roselia':35,
  'Dusclops':50,'Kirlia':30,'Snorunt':40,'Togetic':40,'Eevee':25,'Tangela':45,'Farfetch’d':40,'Farfetchd':40}
GEN1 = [v for v in d.values() if isinstance(v.get('num'), int) and 1 <= v['num'] <= 151 and not v.get('forme') and not v.get('baseSpecies')]
GEN1.sort(key=lambda v: v['num'])
byname = {v['name']: v for v in d.values()}
out = []
for v in GEN1:
    evos = []
    for e in v.get('evos', []):
        ev = byname.get(e)
        if not ev or ev['num'] > 151: continue
        lvl = ev.get('evoLevel') or MANUAL.get(v['name']) or 30
        evos.append([ev['num'], lvl])
    b = v['baseStats']
    out.append([v['num'], v['name'], v['types'], [b['hp'], b['atk'], b['def'], b['spa'], b['spd'], b['spe']], evos])
print("// dex.js — Gen 1 roster from Pokémon Showdown (num, name, types, [hp,atk,def,spa,spd,spe], evos [[num,level]])")
print("const DEX_RAW = [")
for o in out: print(json.dumps(o, ensure_ascii=False, separators=(',', ':')) + ",")
print("];")
