"""Compose captured client views into a labeled, shareable demo. Requires Pillow."""
from pathlib import Path
import argparse
import json
from PIL import Image, ImageDraw, ImageFont, ImageOps

parser=argparse.ArgumentParser()
parser.add_argument('captures',type=Path)
parser.add_argument('output',type=Path)
args=parser.parse_args()
args.output.mkdir(parents=True,exist_ok=True)
font_path=Path('C:/Windows/Fonts/segoeui.ttf')
font=ImageFont.truetype(str(font_path),23) if font_path.exists() else ImageFont.load_default()
small=ImageFont.truetype(str(font_path),17) if font_path.exists() else font
captions=json.loads((args.captures/'captions.json').read_text())
frames=[]
for i,caption in enumerate(captions):
    canvas=Image.new('RGB',(1280,720),'#101114')
    draw=ImageDraw.Draw(canvas)
    draw.text((24,12),'Jellyfin Subtitle Browser · Unofficial Windows alpha',font=font,fill='#f4f4f4')
    for name,x in [('player',20),('transcript',652)]:
        image=Image.open(args.captures/f'{name}-{i:03}.png').convert('RGB')
        image=ImageOps.contain(image,(608,586),Image.Resampling.LANCZOS)
        draw.rounded_rectangle((x,48,x+608,650),radius=8,fill='#1d2026',outline='#42454d')
        canvas.paste(image,(x+(608-image.width)//2,56+(586-image.height)//2))
    draw.text((24,663),caption,font=font,fill='#65d9e4')
    draw.text((24,696),'Real application UI · simulated playback and invented dialogue · no personal media',font=small,fill='#a6aab3')
    canvas.save(args.output/f'frame-{i:03}.png')
    frames.append(canvas)
frames[20].save(args.output/'screenshot.png')
preview=[image.resize((960,540),Image.Resampling.LANCZOS) for image in frames[::2]]
palette=preview[0].quantize(colors=64)
preview=[image.quantize(palette=palette,dither=Image.Dither.NONE) for image in preview]
preview[0].save(args.output/'demo.gif',save_all=True,append_images=preview[1:],duration=400,loop=0,optimize=True)
print('Rendered demo.gif and screenshot.png')
