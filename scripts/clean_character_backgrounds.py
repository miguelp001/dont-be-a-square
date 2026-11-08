"""
Script to cleanly remove enclosed white studio background islands and ground shadows
from Riff and Salty character sprites and attack frames, with anti-aliased alpha blending.
"""

import os
from PIL import Image
import numpy as np
from scipy.ndimage import gaussian_filter

CHAR_DIR = r"d:\projects\Don't be a square\assets\sprites\characters"

def clean_riff_image(img_path):
    if not os.path.exists(img_path):
        print(f"File not found: {img_path}")
        return False

    img = Image.open(img_path).convert("RGBA")
    arr = np.array(img).copy()

    # 1. Crotch gap: y in [735, 775], x in [580, 630]
    crotch = np.zeros(arr.shape[:2], dtype=bool)
    crotch[735:775, 580:630] = True
    c_mask = crotch & (arr[:,:,3] > 40) & (np.mean(arr[:,:,:3], axis=2) > 130)

    # 2. Guitar arm gap: y in [600, 670], x in [270, 370]
    guitar = np.zeros(arr.shape[:2], dtype=bool)
    guitar[600:670, 270:370] = True
    g_mask = guitar & (arr[:,:,3] > 40) & (np.mean(arr[:,:,:3], axis=2) > 130)

    # 3. Between legs and boots: y in [775, 960], x in [435, 615]
    mid = np.zeros(arr.shape[:2], dtype=bool)
    mid[775:960, 435:615] = True
    m_mask = mid & (arr[:,:,3] > 40) & (np.mean(arr[:,:,:3], axis=2) > 65)

    # 4. Floor around right boot: right boot ends at y=955. Anything at y >= 955 where x > 444 is floor.
    rboot_floor = np.zeros(arr.shape[:2], dtype=bool)
    rboot_floor[955:1024, 444:1024] = True
    rf_mask = rboot_floor & (arr[:,:,3] > 40)

    # 5. Floor to the left of left boot: left boot is at x >= 342. Anything at x < 342 at y >= 920 is floor.
    lboot_floor = np.zeros(arr.shape[:2], dtype=bool)
    lboot_floor[920:1024, 0:342] = True
    lf_mask = lboot_floor & (arr[:,:,3] > 40) & (np.mean(arr[:,:,:3], axis=2) > 70)

    # 6. Floor below left boot: left boot ends at y=982. Anything at y >= 982 across all x is floor.
    bottom_floor = np.zeros(arr.shape[:2], dtype=bool)
    bottom_floor[982:1024, :] = True
    bf_mask = bottom_floor & (arr[:,:,3] > 40)

    all_mask = c_mask | g_mask | m_mask | rf_mask | lf_mask | bf_mask
    cleared = np.sum(all_mask)
    if cleared == 0:
        print(f"  [{os.path.basename(img_path)}] No pixels cleared.")
        return False

    smoothed = gaussian_filter(all_mask.astype(float), sigma=0.85)
    new_alpha = arr[:,:,3].astype(float) * (1.0 - np.clip(smoothed * 1.35, 0, 1))
    arr[:,:,3] = new_alpha.astype(np.uint8)

    cleaned_img = Image.fromarray(arr)
    cleaned_img.save(img_path, "PNG")
    print(f"  [{os.path.basename(img_path)}] Successfully cleaned ({cleared} px transparent).")
    return True

def clean_salty_image(img_path):
    if not os.path.exists(img_path):
        print(f"File not found: {img_path}")
        return False

    img = Image.open(img_path).convert("RGBA")
    arr = np.array(img).copy()

    # 1. Left gap (arm/coat loop): y in [665, 785], x in [275, 385]
    lgap = np.zeros(arr.shape[:2], dtype=bool)
    lgap[665:785, 275:385] = True
    lg_mask = lgap & (arr[:,:,3] > 40) & (np.mean(arr[:,:,:3], axis=2) > 130)

    # 2. Between legs: y in [775, 930], x in [460, 610]
    mid_legs = np.zeros(arr.shape[:2], dtype=bool)
    mid_legs[775:930, 460:610] = True
    ml_mask = mid_legs & (arr[:,:,3] > 40) & (np.mean(arr[:,:,:3], axis=2) > 70)

    # 3. Block between boots: y in [925, 955], x in [465, 600]
    mid_boots = np.zeros(arr.shape[:2], dtype=bool)
    mid_boots[925:955, 465:600] = True
    mb_mask = mid_boots & (arr[:,:,3] > 40) & (np.mean(arr[:,:,:3], axis=2) > 65)

    # 4. Floor below boots: y >= 955 down to 1024
    floor = np.zeros(arr.shape[:2], dtype=bool)
    floor[955:1024, :] = True
    fl_mask = floor & (arr[:,:,3] > 40)

    all_mask = lg_mask | ml_mask | mb_mask | fl_mask
    cleared = np.sum(all_mask)
    if cleared == 0:
        print(f"  [{os.path.basename(img_path)}] No pixels cleared.")
        return False

    smoothed = gaussian_filter(all_mask.astype(float), sigma=0.85)
    new_alpha = arr[:,:,3].astype(float) * (1.0 - np.clip(smoothed * 1.35, 0, 1))
    arr[:,:,3] = new_alpha.astype(np.uint8)

    cleaned_img = Image.fromarray(arr)
    cleaned_img.save(img_path, "PNG")
    print(f"  [{os.path.basename(img_path)}] Successfully cleaned ({cleared} px transparent).")
    return True

def process_riff_and_salty():
    print("=" * 60)
    print("Cleaning studio background and ground shadows for Riff and Salty...")
    print("=" * 60)

    # Clean Riff base portrait
    clean_riff_image(os.path.join(CHAR_DIR, "riff.png"))

    # Clean Riff attack frames
    for i in range(1, 7):
        frame_path = os.path.join(CHAR_DIR, f"riff_power_chord_frame_{i}.png")
        clean_riff_image(frame_path)

    # Clean Salty base portrait
    clean_salty_image(os.path.join(CHAR_DIR, "salty.png"))

    # Clean Salty attack frames
    for i in range(1, 7):
        frame_path = os.path.join(CHAR_DIR, f"salty_attack_frame_{i}.png")
        clean_salty_image(frame_path)

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

    print("PNG and GIF rebuilt successfully.")

if __name__ == "__main__":
    process_riff_and_salty()
