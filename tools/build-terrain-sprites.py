"""Import the COMPLETE ImageGen tile sheet; no procedural motif composition."""
from pathlib import Path
from PIL import Image
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/terrain'
SOURCE = OUT / 'source/imagegen-tall-grass-v2-original.png'
PALETTE = ['2b6a32', '3f8a3c', '54a646', '74c45c', '9ad878']
RGB = [tuple(bytes.fromhex(c)) for c in PALETTE]
STATES = ['idle', 'rustle', 'occupied', 'recover']
source = Image.open(SOURCE).convert('RGB')
sheet = Image.new('RGBA', (128,128))
front = Image.new('RGBA', sheet.size)
frames = []

for row, state in enumerate(STATES):
    for col in range(4):
        # Each complete ImageGen cell maps to one engine cell, in the same order.
        box = tuple(round(v) for v in (col*source.width/4, row*source.height/4,
                                      (col+1)*source.width/4, (row+1)*source.height/4))
        cell = source.crop(box).resize((32,32), Image.Resampling.NEAREST)
        for y in range(32):
            for x in range(32):
                pixel = cell.getpixel((x,y))
                color = min(RGB, key=lambda c:sum(w*(a-b)**2 for a,b,w in zip(pixel,c,(.30,.59,.11))))
                sheet.putpixel((col*32+x,row*32+y), (*color,255))
                # An occlusion mask of the existing painted leaves, not additional artwork.
                if y>=25 and color!=RGB[2]:
                    front.putpixel((col*32+x,row*32+y),(*color,255))
        frames.append({'state':state,'frame':col,'x':col*32,'y':row*32,'w':32,'h':32,
                       'sourceRect':list(box)})

sheet.save(OUT/'imagegen-tall-grass-v2.png',optimize=True)
front.save(OUT/'imagegen-tall-grass-front-v2.png',optimize=True)
metadata = {'generator':'ImageGen (built-in)', 'source':str(SOURCE.relative_to(OUT)),
            'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'sourceSize':list(source.size),
            'processing':['crop each original cell','nearest-neighbor resize to 32x32','map to game palette without dithering'],
            'tileSize':32,'columns':4,'rows':4,'states':STATES,'image':'imagegen-tall-grass-v2.png',
            'foreground':'imagegen-tall-grass-front-v2.png','palette':['#'+c for c in PALETTE],'frames':frames}
(OUT/'imagegen-tall-grass-v2.json').write_text(json.dumps(metadata,indent=2)+'\n')
assert sheet.getchannel('A').getextrema()==(255,255)
assert {value for _,value in front.getchannel('A').getcolors()}=={0,255}
assert len(sheet.getcolors())<=len(PALETTE)
print('Imported 16 complete ImageGen terrain tiles; exact 32x32 frames; '+str(len(sheet.getcolors()))+' colors.')
