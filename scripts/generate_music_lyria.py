import os
import sys
import base64
from pathlib import Path
from google import genai

# Check API key from env or argument
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key and len(sys.argv) > 1:
    api_key = sys.argv[1]

if not api_key:
    print("ERROR: GEMINI_API_KEY is not set.")
    print("Usage: python scripts/generate_music_lyria.py <API_KEY>")
    print("   or: set GEMINI_API_KEY=your_key && python scripts/generate_music_lyria.py")
    sys.exit(1)

client = genai.Client(api_key=api_key)

output_dir = Path(r"d:\projects\Don't be a square\assets\audio\bgm")
output_dir.mkdir(parents=True, exist_ok=True)

TRACKS = [
    {
        "id": "menu",
        "name": "Main Menu Theme",
        "filename": "menu.mp3",
        "prompt": "Upbeat cute anime chiptune, 128 BPM. Playful melody with bright synth leads, bouncy bassline, and cheerful drum loop. Whimsical and inviting, like a puzzle game menu. J-pop influenced with retro game boy sounds. Seamless loop-friendly, no vocals, instrumental 30s loop."
    },
    {
        "id": "char_select",
        "name": "Character Select Theme",
        "filename": "char_select.mp3",
        "prompt": "Sweet and girly anime pop chiptune, 126 BPM. Harp-like plucks, glittery synth arpeggios, gentle percussion with tambourine. Flirtatious and cute without being overly sugary. Friendly character showcase vibe. Instrumental, seamless loopable."
    },
    {
        "id": "battle_cpu",
        "name": "VS CPU Battle Theme",
        "filename": "battle_cpu.mp3",
        "prompt": "Energetic puzzle battle music, 134 BPM. Driving chiptune beat with syncopated drums, catchy hook melody, rising synth stabs. Competitive but cute, with building tension. Mix of 8-bit and modern anime game music. No lyrics, seamless loop-friendly."
    },
    {
        "id": "battle_player",
        "name": "VS Player Battle Theme",
        "filename": "battle_player.mp3",
        "prompt": "More intense competitive version, 138 BPM. Faster drums, funkier bassline, call-and-response melodies between different synths. Exciting head-to-head match feel with playful energy. Bright and colorful, still cute and whimsical. Instrumental loop."
    },
    {
        "id": "battle_online",
        "name": "Online Match Theme",
        "filename": "battle_online.mp3",
        "prompt": "High-energy esports-style cute chiptune, 140 BPM. Glitchy effects mixed with bubbly synths, complex drum patterns, electronic leads. Tension and excitement for ranked play. Anime tournament vibes. Fast-paced but not stressful, loopable."
    },
    {
        "id": "panic",
        "name": "Speed Up / Panic Theme",
        "filename": "panic.mp3",
        "prompt": "Urgent but playful puzzle music, 142 BPM. Accelerating feel, arpeggiated synths, frantic but cute percussion, rising pitch patterns. Creates pressure without being anxiety-inducing. Short seamless loop that builds excitement. Chiptune anime style."
    },
    {
        "id": "victory",
        "name": "Victory Theme",
        "filename": "victory.mp3",
        "prompt": "Triumphant cute j-pop chiptune, 130 BPM. Fanfare-like melody with bells, sparkly arpeggios, celebratory drums. Satisfying victory fanfare, short and sweet. Cheerful and rewarding."
    },
    {
        "id": "game_over",
        "name": "Game Over Theme",
        "filename": "game_over.mp3",
        "prompt": "Gentolic melancholic but playful chiptune, 110 BPM. Slower tempo with soft synth pads, muted drums, bittersweet melody. Not sad but wistful, like try again energy. Cute game over music with hope for next round. Short loop."
    }
]

print(f"Starting Lyria generation for {len(TRACKS)} game tracks...")

for i, track in enumerate(TRACKS, 1):
    dest_path = output_dir / track["filename"]
    print(f"\n[{i}/{len(TRACKS)}] Generating {track['name']} -> {track['filename']}...")
    try:
        interaction = client.interactions.create(
            model="lyria-3-clip-preview",
            input=track["prompt"]
        )
        audio = interaction.output_audio
        if audio and audio.data:
            audio_bytes = base64.b64decode(audio.data)
            with open(dest_path, "wb") as f:
                f.write(audio_bytes)
            print(f" Successfully saved {dest_path.name} ({len(audio_bytes)} bytes)")
        else:
            print(f" Warning: No audio returned in interaction for {track['name']}")
    except Exception as e:
        print(f" Error generating {track['name']}: {e}")

print("\nDone!")
