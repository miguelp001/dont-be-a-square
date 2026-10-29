import Phaser from 'phaser';
import { SoundFx } from './SoundFx';

export class Settings {
  private static STORAGE_KEY = 'dont_be_a_square_settings_v1';
  public static musicVolume: number = 0.6; // 0.0 to 1.0
  public static sfxVolume: number = 0.6;   // 0.0 to 1.0

  public static load(scene?: Phaser.Scene): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.musicVolume === 'number') {
          this.musicVolume = Math.max(0, Math.min(1, parsed.musicVolume));
        }
        if (typeof parsed.sfxVolume === 'number') {
          this.sfxVolume = Math.max(0, Math.min(1, parsed.sfxVolume));
        }
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage:', e);
    }
    this.apply(scene);
  }

  public static save(): void {
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          musicVolume: this.musicVolume,
          sfxVolume: this.sfxVolume
        })
      );
    } catch (e) {
      console.warn('Failed to save settings to localStorage:', e);
    }
  }

  public static apply(scene?: Phaser.Scene): void {
    // SoundFx scale (0.0 to 0.7 max procedural volume)
    SoundFx.volume = this.sfxVolume * 0.7;
    SoundFx.enabled = this.sfxVolume > 0.01;

    // Phaser global sound volume (controls BGM)
    if (scene && scene.sound) {
      scene.sound.volume = this.musicVolume;
    }
  }

  public static setMusicVolume(val: number, scene?: Phaser.Scene): void {
    this.musicVolume = Math.max(0, Math.min(1, Math.round(val * 10) / 10));
    this.save();
    this.apply(scene);
  }

  public static setSfxVolume(val: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, Math.round(val * 10) / 10));
    this.save();
    this.apply();
  }
}
