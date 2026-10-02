"""Owner-supplied rose lace pattern -> seamless coverage map for the 3D lace.

  python tools/make_lace.py <pattern image>
Writes img/lace/rose-coverage.png (1024², grayscale: 0 = open, 255 = lace).
Tiled with THREE.MirroredRepeatWrapping (seamless, no ghosting).
The grey background of the photo becomes the open net; whites become lace.
"""
import sys
import numpy as np
from PIL import Image

src = sys.argv[1]
im = Image.open(src).convert('L')
S = min(im.size)
a = np.asarray(im.crop((0, 0, S, S))).astype(np.float32)

# no cross-fade (it ghosts the motifs): the viewer tiles this with
# MirroredRepeatWrapping, which is seamless without doubling the roses
t = a

# coverage: background grey (~115-130) -> 0, lace white (~215+) -> 1
cov = np.clip((t - 138.0) / (212.0 - 138.0), 0, 1)
out = Image.fromarray((cov * 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)
out.save('img/lace/rose-coverage.png', optimize=True)
c = np.asarray(out).astype(float)
print('saved', out.size, 'mean coverage', round(c.mean() / 255, 3),
      'LR seam', round(np.abs(c[:, 0] - c[:, -1]).mean(), 1), 'neighbour', round(np.abs(c[:, 0] - c[:, 1]).mean(), 1))
