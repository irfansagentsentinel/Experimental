"""Swap names in the site's screenshots for obvious placeholders before they go in the video.

The screenshots come from www.reefsentinel.com and show guest names and a hotel name. They may
be demo data, but the video is made to be shared, so every name becomes "Guest N" or "Your hotel".
Usage: python3 placeholders.py <folder of PNGs converted from the site's .avif files> <out folder>
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

src, out = Path(sys.argv[1]), Path(sys.argv[2])
INTER = '/usr/share/fonts/opentype/inter/Inter-{}.otf'
font = lambda w, s: ImageFont.truetype(INTER.format(w), s)


def bar(d, box, colour, label, size=10):
    x0, y0, x1, y1 = box
    d.rounded_rectangle((x0, y0, x1 - 1, y1 - 1), radius=3, fill=colour)
    f = font('Bold', size)
    d.text((x0 + 6, (y0 + y1) / 2), label, fill='white', font=f, anchor='lm')


def cover(d, box, bg, label, colour, weight='Regular', size=11):
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=bg)
    d.text((x0, (y0 + y1) / 2), label, fill=colour, font=font(weight, size), anchor='lm')


def header(d, im):  # "Konkan Bay Residency" under "Hotel" in the top bar
    bg = im.getpixel((1345, 44))
    cover(d, (1222, 34, 1340, 50), bg, 'Your hotel', (110, 110, 120), size=11)


BLUE, GREEN = (56, 189, 248), (34, 197, 94)

im = Image.open(src / 'h-02-room-chart.png').convert('RGB'); d = ImageDraw.Draw(im)
header(d, im)
for box, c, label in [((750, 247, 962, 272), BLUE, 'Guest 1'), ((965, 247, 1105, 272), GREEN, 'Guest 2'),
                      ((605, 556, 817, 581), BLUE, 'Guest 3'), ((822, 711, 1033, 729), GREEN, 'Guest 4'),
                      ((1253, 711, 1339, 729), GREEN, 'Guest 5')]:
    bar(d, box, c, label)
d.rectangle((1325, 247, 1339, 272), fill=GREEN)
im.save(out / 'room-chart.png')

for name in ('h-01-availability-grid-pending', 'h-01-availability-grid'):
    im = Image.open(src / f'{name}.png').convert('RGB'); d = ImageDraw.Draw(im)
    header(d, im)
    im.save(out / (name[5:] + '.png'))

im = Image.open(src / 'h-03-front-desk-checkin.png').convert('RGB'); d = ImageDraw.Draw(im)
header(d, im)
ink = min((im.getpixel((x, y)) for x in range(278, 330) for y in range(184, 198)), key=sum)  # text colour of the row
cover(d, (430, 183, 600, 200), im.getpixel((600, 175)), 'Guest 4', ink)
im.save(out / 'checkin.png')

im = Image.open(src / 'h-04-guest-folio.png').convert('RGB')
im = im.crop((265, 242, 1121, 633)); d = ImageDraw.Draw(im)   # the folio dialog only
cover(d, (22, 16, 145, 36), (255, 255, 255), 'Guest 1', (17, 17, 17), weight='Bold', size=13)
im.save(out / 'folio.png')
print('wrote', sorted(p.name for p in out.glob('*.png')))

# Crops used by the composition (pixel boxes in the original 1400px screenshots).
for name, box, dst in [('room-chart.png', (266, 97, 1356, 746), 'crop-roomchart.png'),
                       ('availability-grid-pending.png', (740, 97, 1356, 470), 'crop-avail-pending.png'),
                       ('availability-grid.png', (740, 97, 1356, 470), 'crop-avail-saved.png'),
                       ('checkin.png', (420, 140, 945, 500), 'crop-checkin.png')]:
    Image.open(out / name).crop(box).save(out / dst)
print('cropped')
