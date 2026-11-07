import os
from PIL import Image
import numpy as np

BRAIN_DIR = 'C:/Users/migue/.gemini/antigravity/brain/5861e637-bc99-43dd-b0e5-3c747446120e'
ASSETS_DIR = 'd:/projects/Don\'t be a square/assets/ui/parallax'
DIST_DIR = 'd:/projects/Don\'t be a square/dist/assets/ui/parallax'

os.makedirs(ASSETS_DIR, exist_ok=True)
os.makedirs(DIST_DIR, exist_ok=True)

# 1. Sky layer: Direct high quality conversion (no transparency needed)
sky_in = os.path.join(BRAIN_DIR, 'bg_parallax_sky_1794089823144.jpg')
sky_im = Image.open(sky_in).convert('RGB')
sky_out_1 = os.path.join(ASSETS_DIR, 'sky.png')
sky_out_2 = os.path.join(DIST_DIR, 'sky.png')
sky_im.save(sky_out_1, 'PNG', optimize=True)
sky_im.save(sky_out_2, 'PNG', optimize=True)
print(f"Saved sky: {sky_im.size} -> {sky_out_1}")

def process_chroma_layer(input_path, output_name, threshold_low=15.0, threshold_high=55.0):
    im = Image.open(input_path).convert('RGBA')
    arr = np.array(im, dtype=np.float32)
    r = arr[:, :, 0]
    g = arr[:, :, 1]
    b = arr[:, :, 2]

    # Difference between green and max of red/blue
    max_rb = np.maximum(r, b)
    greenness = g - max_rb

    # Smooth alpha feathering
    # greenness > threshold_high => alpha 0
    # greenness < threshold_low => alpha 1
    alpha = np.clip(1.0 - (greenness - threshold_low) / (threshold_high - threshold_low), 0.0, 1.0)

    # Despill green fringe around silhouettes: clamp green channel to max(red, blue) where greenness > 0
    spill = np.clip(greenness / 50.0, 0.0, 1.0)
    g_despilled = g * (1.0 - spill) + max_rb * spill
    arr[:, :, 1] = np.where(greenness > 0, g_despilled, g)
    arr[:, :, 3] = alpha * 255.0

    res = Image.fromarray(arr.astype(np.uint8))
    out1 = os.path.join(ASSETS_DIR, f"{output_name}.png")
    out2 = os.path.join(DIST_DIR, f"{output_name}.png")
    res.save(out1, 'PNG', optimize=True)
    res.save(out2, 'PNG', optimize=True)
    print(f"Processed {output_name}: {res.size} -> {out1}")

# 2. Far Hills
process_chroma_layer(
    os.path.join(BRAIN_DIR, 'bg_parallax_far_hills_1794089873033.jpg'),
    'far_hills',
    threshold_low=12.0,
    threshold_high=50.0
)

# 3. Mid Forest
process_chroma_layer(
    os.path.join(BRAIN_DIR, 'bg_parallax_mid_forest_1794089891410.jpg'),
    'mid_forest',
    threshold_low=12.0,
    threshold_high=50.0
)

# 4. Near Canopy
process_chroma_layer(
    os.path.join(BRAIN_DIR, 'bg_parallax_near_canopy_1794089908326.jpg'),
    'near_canopy',
    threshold_low=12.0,
    threshold_high=48.0
)

print("Parallax processing complete!")
