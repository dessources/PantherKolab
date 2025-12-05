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

    try {
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
    } catch (error) {
      console.error("Error playing sound:", error);
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

    // Then repeat every 2 seconds
    this.ringingInterval = setInterval(() => {
      this.playCallRinging();
    }, 2000);
  }

  /**
   * Stop repeating ring tone
   */
  stopRinging() {
    if (this.ringingInterval) {
      clearInterval(this.ringingInterval);
      this.ringingInterval = null;
    }
  }

  /**
   * Message sent - Short upward chirp
   */
  private playMessageSent() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      800,
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
   * Message received - Double gentle tone
   */
  private playMessageReceived() {
    if (!this.audioContext) return;

    // First tone
    const oscillator1 = this.audioContext.createOscillator();
    const gainNode1 = this.audioContext.createGain();

    oscillator1.connect(gainNode1);
    gainNode1.connect(this.audioContext.destination);

    oscillator1.type = "sine";
    oscillator1.frequency.setValueAtTime(520, this.audioContext.currentTime);

    gainNode1.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode1.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.1
    );

    oscillator1.start(this.audioContext.currentTime);
    oscillator1.stop(this.audioContext.currentTime + 0.1);

    // Second tone
    const oscillator2 = this.audioContext.createOscillator();
    const gainNode2 = this.audioContext.createGain();

    oscillator2.connect(gainNode2);
    gainNode2.connect(this.audioContext.destination);

    oscillator2.type = "sine";
    oscillator2.frequency.setValueAtTime(
      620,
      this.audioContext.currentTime + 0.1
    );

    gainNode2.gain.setValueAtTime(0.2, this.audioContext.currentTime + 0.1);
    gainNode2.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.2
    );

    oscillator2.start(this.audioContext.currentTime + 0.1);
    oscillator2.stop(this.audioContext.currentTime + 0.2);
  }

  /**
   * Call ringing - Repeating two-tone pattern
   */
  private playCallRinging() {
    if (!this.audioContext) return;

    const playRingTone = (startTime: number) => {
      if (!this.audioContext) return;

      // High tone
      const osc1 = this.audioContext.createOscillator();
      const gain1 = this.audioContext.createGain();

      osc1.connect(gain1);
      gain1.connect(this.audioContext.destination);

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(800, startTime);

      gain1.gain.setValueAtTime(0.3, startTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

      osc1.start(startTime);
      osc1.stop(startTime + 0.2);

      // Low tone
      const osc2 = this.audioContext.createOscillator();
      const gain2 = this.audioContext.createGain();

      osc2.connect(gain2);
      gain2.connect(this.audioContext.destination);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(600, startTime + 0.2);

      gain2.gain.setValueAtTime(0.3, startTime + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

      osc2.start(startTime + 0.2);
      osc2.stop(startTime + 0.4);
    };

    const currentTime = this.audioContext.currentTime;
    playRingTone(currentTime);
  }

  /**
   * Call ended - Descending tone
   */
  private playCallEnded() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      300,
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
   * Mic toggle - Short click
   */
  private playMicToggle() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.05
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.05);
  }

  /**
   * Camera toggle - Short click (slightly different pitch)
   */
  private playCameraToggle() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.05
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.05);
  }
}

// Export singleton instance
export const soundEffects = new SoundEffects();
