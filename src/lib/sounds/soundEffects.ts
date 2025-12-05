"use client";

/**
 * Sound Effects Utility
 * Centralized sound management using Web Audio API
 * Generates all sounds programmatically (no audio files needed)
 */

export type SoundType =
  | "message-sent"
  | "message-received"
  | "call-ringing"
  | "call-ended"
  | "mic-toggle"
  | "camera-toggle";

class SoundEffects {
  private audioContext: AudioContext | null = null;
  private enabled = true;
  private ringingInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.audioContext = new (window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext)();
    }
  }

  /**
   * Enable or disable all sound effects
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopRinging();
    }
  }

  /**
   * Play a sound effect
   */
  play(type: SoundType) {
    if (!this.enabled || !this.audioContext) return;

    switch (type) {
      case "message-sent":
        this.playMessageSent();
        break;
      case "message-received":
        this.playMessageReceived();
        break;
      case "call-ringing":
        this.startRinging();
        break;
      case "call-ended":
        this.stopRinging();
        this.playCallEnded();
        break;
      case "mic-toggle":
        this.playMicToggle();
        break;
      case "camera-toggle":
        this.playCameraToggle();
        break;
    }
  }

  /**
   * Start continuous ringing (for incoming calls)
   */
  startRinging() {
    if (!this.enabled || !this.audioContext) return;

    // Stop any existing ringing
    this.stopRinging();

    // Play immediately
    this.playCallRinging();

    // Repeat every 2 seconds
    this.ringingInterval = setInterval(() => {
      this.playCallRinging();
    }, 2000);
  }

  /**
   * Stop continuous ringing
   */
  stopRinging() {
    if (this.ringingInterval) {
      clearInterval(this.ringingInterval);
      this.ringingInterval = null;
    }
  }

  /**
   * Message sent sound - upward chirp
   */
  private playMessageSent() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      900,
      this.audioContext.currentTime + 0.1
    );

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.1
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  /**
   * Message received sound - downward chirp
   */
  private playMessageReceived() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(900, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      600,
      this.audioContext.currentTime + 0.1
    );

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.1
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  /**
   * Call ringing sound - two-tone ring
   */
  private playCallRinging() {
    if (!this.audioContext) return;

    const oscillator1 = this.audioContext.createOscillator();
    const oscillator2 = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Two-tone ring
    oscillator1.frequency.value = 480;
    oscillator2.frequency.value = 620;

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime + 0.4);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.8
    );

    oscillator1.start(this.audioContext.currentTime);
    oscillator1.stop(this.audioContext.currentTime + 0.4);

    oscillator2.start(this.audioContext.currentTime + 0.4);
    oscillator2.stop(this.audioContext.currentTime + 0.8);
  }

  /**
   * Call ended sound - descending tones
   */
  private playCallEnded() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      400,
      this.audioContext.currentTime + 0.3
    );

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.3
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }

  /**
   * Mic toggle sound - single beep
   */
  private playMicToggle() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = 800;

    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.05
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.05);
  }

  /**
   * Camera toggle sound - double beep
   */
  private playCameraToggle() {
    if (!this.audioContext) return;

    const oscillator1 = this.audioContext.createOscillator();
    const oscillator2 = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator1.frequency.value = 1000;
    oscillator2.frequency.value = 1000;

    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.13
    );

    oscillator1.start(this.audioContext.currentTime);
    oscillator1.stop(this.audioContext.currentTime + 0.05);

    oscillator2.start(this.audioContext.currentTime + 0.08);
    oscillator2.stop(this.audioContext.currentTime + 0.13);
  }
}

// Singleton instance
export const soundEffects = new SoundEffects();
