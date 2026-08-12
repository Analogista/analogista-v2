import type { Motion, Direction } from './motion';
export type VoiceInfo = { kind: 'info' | 'error'; text: string };
export class Voice {
  onStatus: ((i: VoiceInfo) => void) | null = null;
  private synth = window.speechSynthesis;
  private epoch = 0;
  constructor() {
    try { this.synth.getVoices(); this.synth.onvoiceschanged = () => this.synth.getVoices(); } catch (e) { }
  }
  cancel() { this.epoch++; try { this.synth.cancel(); } catch (e) { } }
  private info(kind: 'info' | 'error', text: string) { this.onStatus?.({ kind, text }); }
  private async nativeSpeak(text: string, my: number): Promise<boolean> {
    if (!(window as any).Capacitor) return false;
    try {
      const mod: any = await import('@capacitor-community/text-to-speech');
      if (my !== this.epoch) return false;
      await Promise.race([
        mod.TextToSpeech.speak({ text, lang: 'it-IT', rate: 0.95, pitch: 1, volume: 1 }),
        new Promise((_, rj) => setTimeout(() => rj(new Error('timeout voce nativa')), Math.max(20000, text.length * 200)))
      ]);
      return true;
    } catch (e: any) {
      try { const m: any = await import('@capacitor-community/text-to-speech'); m.TextToSpeech.stop?.(); } catch (e2) { }
      if (my === this.epoch) this.info('error', 'Voce nativa KO: ' + String(e?.message || e));
      return false;
    }
  }
  speak(text: string): Promise<void> {
    const my = this.epoch;
    return new Promise((resolve) => {
      const execute = async () => {
        if (my !== this.epoch) return resolve();
        this.info('info', 'Voce in corso…');
        if (await this.nativeSpeak(text, my)) {
          if (my === this.epoch) this.info('info', '');
          return resolve();
        }
        if (my !== this.epoch) return resolve();
        setTimeout(() => {
          if (my !== this.epoch) return resolve();
          let settled = false;
          let spoke = false;
          let safety: number | undefined, kick: number | undefined, retry: number | undefined;
          const done = () => {
            if (settled) return;
            settled = true;
            if (safety) clearTimeout(safety);
            if (kick) clearTimeout(kick);
            if (retry) clearTimeout(retry);
            if (!spoke && my === this.epoch) this.info('error', 'Sintesi di sistema muta: controlla volume multimediale e impostazioni TTS del dispositivo.');
            else if (my === this.epoch) this.info('info', '');
            resolve();
          };
          safety = window.setTimeout(done, Math.max(20000, text.length * 150));
          kick = window.setTimeout(() => { try { this.synth.resume(); } catch (e) { } }, 250);
          const build = () => {
            if (my !== this.epoch) return;
            try { this.synth.cancel(); this.synth.resume(); } catch (e) { }
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'it-IT';
            u.rate = 0.95;
            u.volume = 1;
            const voices = this.synth.getVoices();
            const v = voices.find(x => x.name.includes('Google italiano')) || voices.find(x => x.lang.startsWith('it'));
            if (v) u.voice = v;
            u.onstart = () => { spoke = true; };
            u.onend = done;
            u.onerror = done;
            this.synth.speak(u);
          };
          build();
          retry = window.setTimeout(() => { if (!settled && !this.synth.speaking) build(); }, 1200);
        }, 100);
      };
      execute();
    });
  }
  async ask(question: string, motion: Motion): Promise<'SI' | 'NO' | 'NONE'> {
    const my = this.epoch;
    await this.speak(question);
    if (my !== this.epoch) return 'NONE';
    this.info('info', 'Attendo risposta: oscilla avanti (SI) o indietro (NO).');
    return new Promise((resolve) => {
      let finished = false;
      const finish = (r: 'SI' | 'NO' | 'NONE') => {
        if (finished) return;
        finished = true;
        motion.onMove = null;
        if (to) clearTimeout(to);
        resolve(r);
      };
      const to = window.setTimeout(async () => {
        motion.stop();
        await this.speak('Non ho rilevato nessun movimento.');
        finish('NONE');
      }, 12000);
      motion.onMove = async (d: Direction) => {
        motion.stop();
        const r = d === 'forward' ? 'SI' : 'NO';
        await this.speak(r === 'SI' ? 'Ho rilevato un SI.' : 'Ho rilevato un NO.');
        finish(r);
      };
      motion.start();
    });
  }
}
