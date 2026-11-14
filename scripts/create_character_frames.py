"""
Generate high-quality custom themed puzzle board frames for all 10 character backgrounds in Don't Be a Square.
Geometry: 720x1130 total size, with exact transparent inner window (x: 60..660, y: 70..1070) for 6x10 panel grid.
Saved as PNG and WebP into assets/ui/frames/
"""

import os
import math
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageOps
import numpy as np

DEST_DIR = r"d:\projects\Don't be a square\assets\ui\frames"
os.makedirs(DEST_DIR, exist_ok=True)

BASE_FRAME_PATH = r"d:\projects\Don't be a square\assets\ui\board_wood_frame_v2.png"
base_img = Image.open(BASE_FRAME_PATH).convert("RGBA")
W, H = base_img.size # 720, 1130
base_arr = np.array(base_img)
base_alpha = base_arr[:, :, 3]

# The precise inner grid window
IX0, IY0, IX1, IY1 = 60, 70, 660, 1070
inner_mask = np.zeros((H, W), dtype=bool)
inner_mask[IY0:IY1, IX0:IX1] = True

# Border mask where the frame lives
border_mask = (base_alpha > 0) & (~inner_mask)

# 1. KIRI - Process the generated AI Steampunk Mechanic frame
def create_kiri_frame():
    ai_kiri_path = r"C:\Users\migue\.gemini\antigravity\brain\49d0fa4a-ab33-4ff3-a4f2-68e93fc714aa\kiri_mechanic_puzzle_border_1794679457814.jpg"
    if os.path.exists(ai_kiri_path):
        raw = Image.open(ai_kiri_path).convert("RGBA")
        raw_resized = raw.resize((W, H), Image.Resampling.LANCZOS)
        arr = np.array(raw_resized)
        # Completely clear the inner 600x1000 window
        arr[IY0:IY1, IX0:IX1, 3] = 0
        
        # Soft bevel transition on window edge
        return Image.fromarray(arr)
    return None

# Procedural material / shader generators for thematic frames
def create_themed_frame(char_id, config):
    """
    config contains:
      - base_tint: (r, g, b) multiplier for the 3D carved wood relief
      - border_color: (r, g, b) inner/outer stroke accent
      - inner_glow: (r, g, b) inner edge neon/glow
      - corner_accent: (r, g, b) corner stud / gem color
      - style: special styling ('hazard', 'neon_rock', 'bamboo', 'celestial', 'cyber', 'shrine', 'alchemy', 'pirate', 'idol')
    """
    arr = base_arr.copy().astype(np.float32)
    gray = (0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2])
    
    # Normalize relief
    relief = gray / 255.0
    
    # Base colorized material
    tr, tg, tb = config['base_tint']
    out_rgb = np.zeros((H, W, 3), dtype=np.float32)
    out_rgb[:, :, 0] = relief * tr
    out_rgb[:, :, 1] = relief * tg
    out_rgb[:, :, 2] = relief * tb
    
    # Outer & inner edge borders
    result = Image.fromarray(np.clip(out_rgb, 0, 255).astype(np.uint8)).convert("RGBA")
    draw = ImageDraw.Draw(result)
    
    style = config.get('style', 'classic')
    
    if style == 'hazard': # Volt
        # Yellow and black diagonal caution stripes on top header and bottom footer
        stripe_w = 20
        # Top banner
        for i in range(-W, W * 2, stripe_w * 2):
            draw.polygon([(i, 0), (i + stripe_w, 0), (i + stripe_w - 70, 70), (i - 70, 70)], fill=(255, 220, 0, 200))
        # Bottom footer
        for i in range(-W, W * 2, stripe_w * 2):
            draw.polygon([(i, 1070), (i + stripe_w, 1070), (i + stripe_w - 60, 1130), (i - 60, 1130)], fill=(255, 220, 0, 200))
            
    elif style == 'neon_rock': # Riff
        # Double neon lines along inner and outer borders
        nr, ng, nb = config['inner_glow']
        draw.rectangle([IX0 - 4, IY0 - 4, IX1 + 4, IY1 + 4], outline=(nr, ng, nb, 230), width=4)
        draw.rectangle([10, 10, W - 10, H - 10], outline=(0, 242, 254, 200), width=3)
        
    elif style == 'cyber': # Nano Banana
        # High tech circuit lines and voxel dots
        cy_r, cy_g, cy_b = config['inner_glow']
        draw.rectangle([IX0 - 3, IY0 - 3, IX1 + 3, IY1 + 3], outline=(cy_r, cy_g, cy_b, 240), width=3)
        # Tech corners
        for cx, cy in [(IX0, IY0), (IX1, IY0), (IX0, IY1), (IX1, IY1)]:
            draw.rectangle([cx - 14, cy - 14, cx + 14, cy + 14], fill=(254, 202, 87, 240), outline=(0, 210, 211, 255), width=2)
            
    elif style == 'bamboo': # Mizu
        # Bamboo segmentation notches along vertical pillars
        for y in range(IY0 + 80, IY1, 120):
            draw.line([(0, y), (IX0, y)], fill=(46, 213, 115, 220), width=4)
            draw.line([(0, y + 2), (IX0, y + 2)], fill=(20, 100, 50, 180), width=2)
            draw.line([(IX1, y), (W, y)], fill=(46, 213, 115, 220), width=4)
            draw.line([(IX1, y + 2), (W, y + 2)], fill=(20, 100, 50, 180), width=2)
            
    elif style == 'shrine': # Ember
        # Gold leaf inner border and flame crests
        draw.rectangle([IX0 - 5, IY0 - 5, IX1 + 5, IY1 + 5], outline=(254, 202, 87, 240), width=4)
        draw.rectangle([IX0 - 2, IY0 - 2, IX1 + 2, IY1 + 2], outline=(255, 71, 87, 220), width=2)
        
    elif style == 'celestial': # Void Slime
        # Astral cosmic glowing boundary
        cr, cg, cb = config['inner_glow']
        draw.rectangle([IX0 - 5, IY0 - 5, IX1 + 5, IY1 + 5], outline=(cr, cg, cb, 230), width=5)
        # Corner cosmic stars
        for cx, cy in [(IX0, IY0), (IX1, IY0), (IX0, IY1), (IX1, IY1)]:
            draw.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=(217, 128, 250, 240), outline=(255, 255, 255, 255), width=2)
            
    elif style == 'idol': # Poppy
        # Kawaii pink and gold ribbon border with heart studs
        draw.rectangle([IX0 - 4, IY0 - 4, IX1 + 4, IY1 + 4], outline=(255, 159, 243, 240), width=4)
        draw.rectangle([12, 12, W - 12, H - 12], outline=(254, 202, 87, 200), width=2)
        for cx, cy in [(IX0, IY0), (IX1, IY0), (IX0, IY1), (IX1, IY1)]:
            draw.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=(255, 105, 180, 255), outline=(255, 255, 255, 255), width=2)
            
    elif style == 'pirate': # Salty
        # Weathered brass porthole rivets along the border
        draw.rectangle([IX0 - 4, IY0 - 4, IX1 + 4, IY1 + 4], outline=(254, 202, 87, 220), width=3)
        for y in range(IY0 + 40, IY1, 60):
            draw.ellipse([IX0 - 35, y - 5, IX0 - 25, y + 5], fill=(254, 202, 87, 240), outline=(100, 70, 20, 255))
            draw.ellipse([IX1 + 25, y - 5, IX1 + 35, y + 5], fill=(254, 202, 87, 240), outline=(100, 70, 20, 255))

    elif style == 'alchemy': # Mocha
        # Ancient enchanted gold runes
        draw.rectangle([IX0 - 4, IY0 - 4, IX1 + 4, IY1 + 4], outline=(254, 202, 87, 230), width=4)
        draw.rectangle([IX0 - 8, IY0 - 8, IX1 + 8, IY1 + 8], outline=(165, 94, 234, 200), width=2)
        for cx, cy in [(IX0, IY0), (IX1, IY0), (IX0, IY1), (IX1, IY1)]:
            draw.rectangle([cx - 15, cy - 15, cx + 15, cy + 15], fill=(165, 94, 234, 250), outline=(254, 202, 87, 255), width=2)

    # Standard corner studs
    ca_r, ca_g, ca_b = config.get('corner_accent', (255, 255, 255))
    corner_r = 10
    for cx, cy in [(IX0, IY0), (IX1, IY0), (IX0, IY1), (IX1, IY1)]:
        draw.ellipse([cx - corner_r, cy - corner_r, cx + corner_r, cy + corner_r], fill=(ca_r, ca_g, ca_b, 240))

    # Apply base frame alpha mask
    final_arr = np.array(result)
    final_arr[:, :, 3] = base_alpha
    # Ensure inner 600x1000 is 100% transparent
    final_arr[IY0:IY1, IX0:IX1, 3] = 0
    
    return Image.fromarray(final_arr)

# Frame configurations for all 10 characters
FRAME_CONFIGS = {
    'mizu': {
        'base_tint': (100, 190, 160),     # Bamboo jade & water teal
        'inner_glow': (84, 160, 255),     # Aqua ripple glow
        'corner_accent': (255, 159, 243), # Sakura blossom pink
        'style': 'bamboo'
    },
    'riff': {
        'base_tint': (40, 42, 54),        # Black leatherette rock amp
        'inner_glow': (255, 105, 180),    # Neon magenta glow
        'corner_accent': (0, 242, 254),   # Electric cyan
        'style': 'neon_rock'
    },
    'mocha': {
        'base_tint': (110, 70, 140),      # Mystical arcane enchanted oak
        'inner_glow': (165, 94, 234),     # Arcane purple potion glow
        'corner_accent': (254, 202, 87),  # Glowing gold star rune
        'style': 'alchemy'
    },
    'ember': {
        'base_tint': (180, 50, 40),       # Traditional Japanese vermilion lacquer
        'inner_glow': (255, 107, 107),    # Blazing lantern glow
        'corner_accent': (254, 202, 87),  # Festival gold leaf
        'style': 'shrine'
    },
    'volt': {
        'base_tint': (70, 80, 95),        # Industrial machinery dark steel
        'inner_glow': (0, 210, 211),      # Plasma cyan electrical glow
        'corner_accent': (255, 250, 101), # High-voltage yellow
        'style': 'hazard'
    },
    'salty': {
        'base_tint': (120, 95, 75),       # Weathered pirate ship driftwood
        'inner_glow': (72, 219, 251),     # Tropical sea spray cyan
        'corner_accent': (254, 202, 87),  # Doubloon gold rivet
        'style': 'pirate'
    },
    'poppy': {
        'base_tint': (230, 140, 180),     # Sweet kawaii pastel pink idol stage
        'inner_glow': (255, 159, 243),    # Pastel sparkle glow
        'corner_accent': (254, 202, 87),  # Golden idol star
        'style': 'idol'
    },
    'void_slime': {
        'base_tint': (60, 30, 90),        # Deep cosmic obsidian stone
        'inner_glow': (142, 68, 173),     # Swirling purple nebula glow
        'corner_accent': (217, 128, 250), # Glowing celestial crystal
        'style': 'celestial'
    },
    'nano_banana': {
        'base_tint': (30, 45, 55),        # Cyberpunk dark terminal alloy
        'inner_glow': (0, 210, 211),      # Matrix cyan digital trace
        'corner_accent': (241, 196, 15),  # Nano banana neon gold
        'style': 'cyber'
    }
}

print("Generating custom character grid frames...")

# 1. Kiri (using generated AI Steampunk border)
kiri_frame = create_kiri_frame()
if kiri_frame is None:
    kiri_frame = create_themed_frame('kiri', {
        'base_tint': (170, 115, 60),
        'inner_glow': (243, 156, 18),
        'corner_accent': (230, 126, 34),
        'style': 'classic'
    })
kiri_png = os.path.join(DEST_DIR, "board_frame_kiri.png")
kiri_webp = os.path.join(DEST_DIR, "board_frame_kiri.webp")
kiri_frame.save(kiri_png, "PNG")
kiri_frame.save(kiri_webp, "WEBP", quality=90)
print("Saved frame: kiri")

# 2-10. All remaining characters
for char_id, conf in FRAME_CONFIGS.items():
    frame = create_themed_frame(char_id, conf)
    f_png = os.path.join(DEST_DIR, f"board_frame_{char_id}.png")
    f_webp = os.path.join(DEST_DIR, f"board_frame_{char_id}.webp")
    frame.save(f_png, "PNG")
    frame.save(f_webp, "WEBP", quality=90)
    print(f"Saved frame: {char_id}")

print("\nAll 10 custom character grid frames successfully generated and saved!")
