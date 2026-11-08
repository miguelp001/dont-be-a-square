"""
Script to cleanly remove enclosed white studio background islands (e.g., between legs and guitar/arm gaps)
from Riff and Salty character sprites and attack frames, with anti-aliased alpha blending.
"""

import os
from PIL import Image
import numpy as np
from scipy.ndimage import label, gaussian_filter

CHAR_DIR = r"d:\projects\Don't be a square\assets\sprites\characters"

def clean_enclosed_white(img_path, check_regions, color_thresh=235):
    """
    Finds and clears enclosed white background components that match target spatial regions.
    check_regions is a list of dicts with:
      min_y, max_y, min_x, max_x, min_count
    """
    if not os.path.exists(img_path):
        print(f"File not found: {img_path}")
        return False

    img = Image.open(img_path).convert("RGBA")
    arr = np.array(img).copy()
    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3]

    # Mask for near-pure-white pixels
    white_mask = (alpha > 40) & np.all(rgb >= color_thresh, axis=2)
    labeled, num_features = label(white_mask)

    cleared_total_pixels = 0
    composite_mask = np.zeros_like(alpha, dtype=bool)

    for i in range(1, num_features + 1):
        comp = (labeled == i)
        count = np.sum(comp)
        ys, xs = np.where(comp)
        y_min, y_max = ys.min(), ys.max()
        x_min, x_max = xs.min(), xs.max()

        # Check if this component falls inside any of the specified target regions
        for reg in check_regions:
            if count >= reg.get("min_count", 300):
                if (y_min >= reg["min_y"] and y_max <= reg["max_y"] and
                    x_min >= reg["min_x"] and x_max <= reg["max_x"]):
                    composite_mask |= comp
                    cleared_total_pixels += count
                    print(f"  [{os.path.basename(img_path)}] Removing white island #{i}: {count} px at y=[{y_min}-{y_max}], x=[{x_min}-{x_max}]")
                    break

    if cleared_total_pixels == 0:
        print(f"  [{os.path.basename(img_path)}] No enclosed white regions found to clean.")
        return False

    # Smooth the mask boundary for a clean anti-aliased edge
    mask_float = composite_mask.astype(float)
    smoothed = gaussian_filter(mask_float, sigma=0.85)

    # Apply soft transparency
    new_alpha = arr[:, :, 3].astype(float)
    new_alpha = new_alpha * (1.0 - np.clip(smoothed * 1.35, 0, 1))
    arr[:, :, 3] = new_alpha.astype(np.uint8)

    # Save cleaned image
    cleaned_img = Image.fromarray(arr)
    cleaned_img.save(img_path, "PNG")
    print(f"  [{os.path.basename(img_path)}] Successfully cleaned and saved ({cleared_total_pixels} px transparent).")
    return True

def process_riff_and_salty():
    print("=" * 60)
    print("Cleaning enclosed white background for Riff and Salty...")
    print("=" * 60)

    # Riff targets:
    # 1. Between legs: y in [740, 930], x in [420, 630]
    # 2. Guitar arm gap: y in [600, 660], x in [270, 360]
    riff_regions = [
        {"min_y": 740, "max_y": 930, "min_x": 420, "max_x": 630, "min_count": 300},
        {"min_y": 600, "max_y": 670, "min_x": 270, "max_x": 370, "min_count": 200}
    ]

    # Salty targets:
    # 1. Between legs: y in [760, 940], x in [450, 620]
    salty_regions = [
        {"min_y": 760, "max_y": 940, "min_x": 450, "max_x": 620, "min_count": 300}
    ]

    # Clean Riff base portrait
    clean_enclosed_white(os.path.join(CHAR_DIR, "riff.png"), riff_regions)

    # Clean Riff attack frames
    for i in range(1, 7):
        frame_path = os.path.join(CHAR_DIR, f"riff_power_chord_frame_{i}.png")
        clean_enclosed_white(frame_path, riff_regions)

    # Clean Salty base portrait
    clean_enclosed_white(os.path.join(CHAR_DIR, "salty.png"), salty_regions)

    # Clean Salty attack frames
    for i in range(1, 7):
        frame_path = os.path.join(CHAR_DIR, f"salty_attack_frame_{i}.png")
        clean_enclosed_white(frame_path, salty_regions)

    print("\nRebuilding Riff and Salty GIF and PNG Spritesheets...")
    # Rebuild Riff GIF & Spritesheet
    riff_frames = [Image.open(os.path.join(CHAR_DIR, f"riff_power_chord_frame_{i}.png")).convert("RGBA") for i in range(1, 7)]
    riff_sheet = Image.new("RGBA", (512 * 6, 512), (0, 0, 0, 0))
    resized_riff = [f.resize((512, 512), Image.Resampling.LANCZOS) for f in riff_frames]
    for idx, f in enumerate(resized_riff):
        riff_sheet.paste(f, (idx * 512, 0))
    riff_sheet.save(os.path.join(CHAR_DIR, "riff_power_chord_spritesheet.png"))
    resized_riff[0].save(
        os.path.join(CHAR_DIR, "riff_power_chord.gif"),
        save_all=True,
        append_images=resized_riff[1:],
        duration=110,
        loop=0,
        disposal=2
    )

    # Rebuild Salty GIF & Spritesheet
    salty_frames = [Image.open(os.path.join(CHAR_DIR, f"salty_attack_frame_{i}.png")).convert("RGBA") for i in range(1, 7)]
    salty_sheet = Image.new("RGBA", (512 * 6, 512), (0, 0, 0, 0))
    resized_salty = [f.resize((512, 512), Image.Resampling.LANCZOS) for f in salty_frames]
    for idx, f in enumerate(resized_salty):
        salty_sheet.paste(f, (idx * 512, 0))
    salty_sheet.save(os.path.join(CHAR_DIR, "salty_attack_spritesheet.png"))
    resized_salty[0].save(
        os.path.join(CHAR_DIR, "salty_attack.gif"),
        save_all=True,
        append_images=resized_salty[1:],
        duration=110,
        loop=0,
        disposal=2
    )

    print("PNG and GIF rebuilt. Now running optimize_assets.py to refresh WebP spritesheets...")

if __name__ == "__main__":
    process_riff_and_salty()
