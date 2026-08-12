import type { VoiceInfo, OnVoiceStatusCallback, VoiceOptions, VoiceAnswer } from '../types/voice.types';
import type { MotionTracker } from './motion-tracker';
import type { Direction } from '../types/motion.types';

/**
 * Classe per la sintesi vocale con supporto per TTS nativo (Capacitor) e browser
 * Gestisce la coda di riproduzione, timeout di sicurezza e fallback tra motori
 */
export class VoiceSynthesizer {
  private synth = window.speechSynthesis;
  private epoch = 0;
  onStatus: OnVoiceStatusCallback | null = null;

  constructor() {
    try {
      // Pre-carica le voci disponibili
      this.synth.getVoices();
      this.synth.onvoiceschanged = () => this.synth.getVoices();
    } catch (error) {
      // Ignora errori se speech synthesis non è disponibile
    }
  }

  /**
   * Cancella tutti i messaggi vocali in coda
   */
  cancel(): void {
    this.epoch++;
    try {
      this.synth.cancel();
    } catch (error) {
      // Ignora errori durante la cancellazione
    }
  }

  /**
   * Emette un messaggio di stato
   */
  private emitStatus(kind: 'info' | 'error', text: string): void {
    this.onStatus?.({ kind, text });
  }

  /**
   * Tenta di usare il TTS nativo di Capacitor
   * @param text - Testo da sintetizzare
   * @param currentEpoch - Epoch corrente per validazione
   * @returns true se successo, false altrimenti
   */
  private async nativeSpeak(text: string, currentEpoch: number): Promise<boolean> {
    // Solo per ambienti Capacitor
    if (!(window as any).Capacitor) return false;

    try {
      // Dynamic import con gestione errore per build time
      const module = await (async () => {
        try {
          return await import('@capacitor-community/text-to-speech');
        } catch {
          return null;
        }
      })();
      
      if (!module) return false;
      if (currentEpoch !== this.epoch) return false;
      
      await Promise.race([
        module.TextToSpeech.speak({
          text,
          lang: 'it-IT',
          rate: 0.95,
          pitch: 1,
          volume: 1
        }),
        new Promise((_, rj) => setTimeout(() => rj(new Error('timeout voce nativa')), Math.max(20000, text.length * 200)))
        )
      ]);
      
      return true;
    } catch (error: any) {
      // Tenta di pulire eventuali stati pendenti
      try {
        const cleanupModule = await (async () => {
          try {
            return await import('@capacitor-community/text-to-speech');
          } catch {
            return null;
          }
        })();
        if (cleanupModule) cleanupModule.TextToSpeech.stop?.();
      } catch (cleanupError) {
        // Ignora errori di cleanup
      }
      
      if (currentEpoch === this.epoch) {
        this.emitStatus('error', `Voce nativa KO: ${String(error?.message || error)}`);
      }
      
      return false;
    }
  }

  /**
   * Sintetizza un testo usando TTS nativo o browser come fallback
   * @param text - Testo da sintetizzare
   */
  speak(text: string): Promise<void> {
    const currentEpoch = this.epoch;
    
    return new Promise((resolve) => {
      const execute = async () => {
        if (currentEpoch !== this.epoch) return resolve();
        
        this.emitStatus('info', 'Voce in corso…');
        
        // Tenta prima il TTS nativo (Capacitor)
        if (await this.nativeSpeak(text, currentEpoch)) {
          if (currentEpoch === this.epoch) {
            this.emitStatus('info', '');
          }
          return resolve();
        }
        
        // Fallback al TTS del browser
        if (currentEpoch !== this.epoch) return resolve();
        
        setTimeout(() => {
          if (currentEpoch !== this.epoch) return resolve();
          
          let settled = false;
          let spoke = false;
          let safetyTimeout: number | undefined;
          let kickTimeout: number | undefined;
          let retryTimeout: number | undefined;
          
          const done = () => {
            if (settled) return;
            settled = true;
            
            if (safetyTimeout) clearTimeout(safetyTimeout);
            if (kickTimeout) clearTimeout(kickTimeout);
            if (retryTimeout) clearTimeout(retryTimeout);
            
            if (!spoke && currentEpoch === this.epoch) {
              this.emitStatus('error', 'Sintesi di sistema muta: controlla volume multimediale e impostazioni TTS del dispositivo.');
            } else if (currentEpoch === this.epoch) {
              this.emitStatus('info', '');
            }
            
            resolve();
          };
          
          // Timeout di sicurezza basato sulla lunghezza del testo
          safetyTimeout = window.setTimeout(
            done, 
            Math.max(20000, text.length * 150)
          );
          
          // Kick iniziale per sbloccare eventuali stati paused
          kickTimeout = window.setTimeout(() => {
            try {
              this.synth.resume();
            } catch (error) {
              // Ignora errori
            }
          }, 250);
          
          const buildUtterance = () => {
            if (currentEpoch !== this.epoch) return;
            
            try {
              this.synth.cancel();
              this.synth.resume();
            } catch (error) {
              // Ignora errori
            }
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'it-IT';
            utterance.rate = 0.95;
            utterance.volume = 1;
            
            // Seleziona voce italiana preferita
            const voices = this.synth.getVoices();
            const italianVoice = voices.find(v => v.name.includes('Google italiano')) 
              || voices.find(v => v.lang.startsWith('it'));
            
            if (italianVoice) {
              utterance.voice = italianVoice;
            }
            
            utterance.onstart = () => {
              spoke = true;
            };
            
            utterance.onend = done;
            utterance.onerror = done;
            
            this.synth.speak(utterance);
          };
          
          buildUtterance();
          
          // Retry se non sta parlando dopo 1.2s
          retryTimeout = window.setTimeout(() => {
            if (!settled && !this.synth.speaking) {
              buildUtterance();
            }
          }, 1200);
        }, 100);
      };
      
      execute();
    });
  }

  /**
   * Pone una domanda e attende una risposta tramite movimento corporeo
   * @param question - Domanda da porre
   * @param motion - Istanza di MotionTracker per rilevare la risposta
   * @returns 'SI', 'NO' o 'NONE' (nessuna risposta)
   */
  async ask(question: string, motion: MotionTracker): Promise<VoiceAnswer> {
    const currentEpoch = this.epoch;
    
    await this.speak(question);
    
    if (currentEpoch !== this.epoch) return 'NONE';
    
    this.emitStatus('info', 'Attendo risposta: oscilla avanti (SI) o indietro (NO).');
    
    return new Promise((resolve) => {
      let finished = false;
      
      const finish = (result: VoiceAnswer) => {
        if (finished) return;
        finished = true;
        motion.onMove = null;
        
        if (timeout) clearTimeout(timeout);
        resolve(result);
      };
      
      // Timeout di 12 secondi per la risposta
      const timeout = window.setTimeout(async () => {
        motion.stop();
        await this.speak('Non ho rilevato nessun movimento.');
        finish('NONE');
      }, 12000);
      
      motion.onMove = async (direction: Direction) => {
        motion.stop();
        const result: VoiceAnswer = direction === 'forward' ? 'SI' : 'NO';
        
        await this.speak(
          result === 'SI' ? 'Ho rilevato un SI.' : 'Ho rilevato un NO.'
        );
        
        finish(result);
      };
      
      motion.start();
    });
  }
}
