"""
Character Garbage Attack Animation Pipeline & Transparency Processor
Processes 6-frame character animations and removes white backgrounds via boundary flood-fill.
"""

import os
import sys
from PIL import Image
import numpy as np
from collections import deque

CHARACTERS_DIR = r"d:\projects\Don't be a square\assets\sprites\characters"
BRAIN_DIR = r"C:\Users\migue\.gemini\antigravity\brain\5861e637-bc99-43dd-b0e5-3c747446120e"

CHARACTERS = {
    "kiri": {
        "name": "Kiri",
        "action": "Wrench Slam & Gear Strike",
        "frames": 6,
        "prefix": "kiri_attack_frame_"
    },
    "mizu": {
        "name": "Mizu",
        "action": "Katana Water Slash & Tidal Wave Cut",
        "frames": 6,
        "prefix": "mizu_attack_frame_"
    },
    "mocha": {
        "name": "Mocha",
        "action": "Cauldron Potion Explosion & Bubbly Brew Toss",
        "frames": 6,
        "prefix": "mocha_attack_frame_"
    },
    "ember": {
        "name": "Ember",
        "action": "Flaming Fan Whirl & Fire Vortex Strike",
        "frames": 6,
        "prefix": "ember_attack_frame_"
    },
    "volt": {
        "name": "Volt",
        "action": "Lightning Zap & Tesla Supercharge",
        "frames": 6,
        "prefix": "volt_attack_frame_"
    },
    "salty": {
        "name": "Salty",
        "action": "Cutlass Slash & Cannon Blast",
        "frames": 6,
        "prefix": "salty_attack_frame_"
    },
    "poppy": {
        "name": "Poppy",
        "action": "Idol Heart Sparkle Blast",
        "frames": 6,
        "prefix": "poppy_attack_frame_"
    }
}

def make_transparent(img, threshold=238):
    """Cleanly converts outer white background to alpha 0 while preserving internal white fur/highlights."""
    img = img.convert("RGBA")
    w, h = img.size
    arr = np.array(img)
    visited = np.zeros((h, w), dtype=bool)
    is_white = np.all(arr[:, :, :3] >= threshold, axis=2)

    q = deque()
    for x in range(w):
        if is_white[0, x]: q.append((0, x)); visited[0, x] = True
        if is_white[h-1, x]: q.append((h-1, x)); visited[h-1, x] = True
    for y in range(h):
        if is_white[y, 0]: q.append((y, 0)); visited[y, 0] = True
        if is_white[y, w-1]: q.append((y, w-1)); visited[y, w-1] = True

    while q:
        cy, cx = q.popleft()
        for dy, dx in ((-1,0), (1,0), (0,-1), (0,1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_white[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    arr[visited, 3] = 0
    return Image.fromarray(arr)

def assemble_spritesheet_and_gif(char_id, frame_paths, out_dir):
    """Combines individual frames into a horizontal spritesheet and animated GIF."""
    frames = [Image.open(p).convert("RGBA") for p in frame_paths if os.path.exists(p)]
    if not frames:
        return
    
    # Resize frames uniformly if needed
    target_size = (512, 512)
    resized_frames = [f.resize(target_size, Image.Resampling.LANCZOS) for f in frames]

    # Horizontal spritesheet
    total_w = target_size[0] * len(resized_frames)
    total_h = target_size[1]
    sheet = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))
    for i, frame in enumerate(resized_frames):
        sheet.paste(frame, (i * target_size[0], 0))

    sheet_path = os.path.join(out_dir, f"{char_id}_attack_spritesheet.png")
    sheet.save(sheet_path, "PNG")
    print(f"Saved spritesheet: {sheet_path}")

    # Animated GIF
    gif_path = os.path.join(out_dir, f"{char_id}_attack.gif")
    resized_frames[0].save(
        gif_path,
        save_all=True,
        append_images=resized_frames[1:],
        duration=150,
        loop=0,
        disposal=2
    )
    print(f"Saved animated GIF: {gif_path}")

if __name__ == "__main__":
    print("Character animation pipeline utility ready.")
