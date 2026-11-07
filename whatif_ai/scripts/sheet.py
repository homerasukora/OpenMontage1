import sys, glob
from PIL import Image
pre, out = sys.argv[1], sys.argv[2]
fs = sorted(glob.glob(pre + '*.jpg'), key=lambda s: int(s[len(pre):-4]))
ims = [Image.open(f).resize((270, 480)) for f in fs]
cols = 6; rows = (len(ims) + cols - 1) // cols
W = Image.new('RGB', (270 * cols, 480 * rows))
for i, im in enumerate(ims): W.paste(im, (270 * (i % cols), 480 * (i // cols)))
W.save(out); print(fs)
