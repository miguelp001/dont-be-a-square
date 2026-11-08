"""
Asset Pipeline Optimizer for Don't Be a Square
Converts character sprites and attack animations into high-performance, compressed WebP format (256x256).
"""

import os
from PIL import Image

CHAR_DIR = r"d:\projects\Don't be a square\assets\sprites\characters"

CHARACTERS = [
    'riff', 'kiri', 'mizu', 'mocha', 'ember',
    'volt', 'salty', 'poppy', 'void_slime', 'nano_banana'
]

def optimize_all():
    total_original_bytes = 0
    total_optimized_bytes = 0

    print("Starting Asset Pipeline Optimization (WebP + 256x256 scaling)...")

    for char_id in CHARACTERS:
        print(f"\nProcessing {char_id}...")
        
        # 1. Base Portrait optimization
        base_png = os.path.join(CHAR_DIR, f"{char_id}.png")
        if os.path.exists(base_png):
            orig_sz = os.path.getsize(base_png)
            total_original_bytes += orig_sz
            
            img = Image.open(base_png).convert("RGBA")
            # Resize to max 384x384 for razor-sharp portraits
            img_thumb = img.resize((384, 384), Image.Resampling.LANCZOS)
            base_webp = os.path.join(CHAR_DIR, f"{char_id}.webp")
            img_thumb.save(base_webp, "WEBP", quality=88, method=6)
            new_sz = os.path.getsize(base_webp)
            total_optimized_bytes += new_sz
            print(f"  Base portrait: {orig_sz // 1024} KB -> {new_sz // 1024} KB ({100 - (new_sz * 100 // orig_sz)}% saved)")

        # 2. Attack Frames and Combined Spritesheet
        frames = []
        for i in range(1, 7):
            frame_png = os.path.join(CHAR_DIR, f"riff_power_chord_frame_{i}.png" if char_id == 'riff' else f"{char_id}_attack_frame_{i}.png")
            if os.path.exists(frame_png):
                orig_sz = os.path.getsize(frame_png)
                total_original_bytes += orig_sz
                
                f_img = Image.open(frame_png).convert("RGBA")
                # Downscale from 512/1024 to 256x256
                f_resized = f_img.resize((256, 256), Image.Resampling.LANCZOS)
                
                # Save individual webp frame for backward compatibility
                frame_webp = os.path.join(CHAR_DIR, f"riff_power_chord_frame_{i}.webp" if char_id == 'riff' else f"{char_id}_attack_frame_{i}.webp")
                f_resized.save(frame_webp, "WEBP", quality=88, method=6)
                new_sz = os.path.getsize(frame_webp)
                total_optimized_bytes += new_sz
                
                frames.append(f_resized)

        if len(frames) == 6:
            # Assemble single combined 1536x256 spritesheet
            sheet = Image.new("RGBA", (256 * 6, 256), (0, 0, 0, 0))
            for idx, f in enumerate(frames):
                sheet.paste(f, (idx * 256, 0))
            
            sheet_webp = os.path.join(CHAR_DIR, f"{char_id}_attack.webp")
            sheet.save(sheet_webp, "WEBP", quality=88, method=6)
            sheet_sz = os.path.getsize(sheet_webp)
            print(f"  Consolidated 6-frame spritesheet: {sheet_sz // 1024} KB")

    print("\n" + "=" * 50)
    print(f"Total Original Size : {total_original_bytes / (1024 * 1024):.2f} MB")
    print(f"Total Optimized Size: {total_optimized_bytes / (1024 * 1024):.2f} MB")
    savings_pct = (1.0 - (total_optimized_bytes / total_original_bytes)) * 100
    print(f"Overall Space Saved : {savings_pct:.1f}%")
    print("=" * 50)

if __name__ == '__main__':
    optimize_all()
