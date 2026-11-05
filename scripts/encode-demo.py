"""Encode the composed PNG sequence as a 24-second silent MP4."""
from pathlib import Path
import argparse
import subprocess
import imageio_ffmpeg

parser=argparse.ArgumentParser()
parser.add_argument('frames',type=Path)
parser.add_argument('output',type=Path)
args=parser.parse_args()
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y','-framerate','5','-i',str(args.frames/'frame-%03d.png'),'-c:v','libx264','-preset','medium','-crf','22','-r','25','-pix_fmt','yuv420p','-movflags','+faststart',str(args.output)],check=True)
print('Encoded 24-second silent MP4 demo')
