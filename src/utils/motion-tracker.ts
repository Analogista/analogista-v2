import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { Direction, OnMoveCallback, MotionConfig } from '../types/motion.types';

const CDN_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const CDN_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const LOCAL_WASM = "mediapipe/wasm";
const LOCAL_MODEL = "mediapipe/pose_landmarker_lite.task";

/**
 * Classe per il rilevamento del movimento corporeo tramite MediaPipe Pose Landmarker
 * Rileva l'oscillazione del corpo in avanti o indietro basandosi sulla posizione
 * del naso rispetto alle spalle
 */
export class MotionTracker {
  private video: HTMLVideoElement | null = null;
  private landmarker: PoseLandmarker | null = null;
  private raf = 0;
  private running = false;
  private smoothed: number | null = null;
  private neutral = 0;
  private config: Required<MotionConfig>;
  private last: Direction | 'none' = 'none';
  private lastEmit = 0;
  
  onMove: OnMoveCallback | null = null;

  constructor(config?: Partial<MotionConfig>) {
    this.config = {
      sensitivity: config?.sensitivity ?? 0.015,
      smoothingFactor: config?.smoothingFactor ?? 0.8,
      debounceMs: config?.debounceMs ?? 600,
    };
  }

  /**
   * Inizializza il landmarker con il video fornito
   * @param video - Elemento video da analizzare
   */
  async init(video: HTMLVideoElement): Promise<void> {
    this.video = video;
    const packaged = !!(window as any).Capacitor || navigator.userAgent.toLowerCase().includes('electron');
    const wasm = packaged ? LOCAL_WASM : CDN_WASM;
    const model = packaged ? LOCAL_MODEL : CDN_MODEL;
    
    const vision = await FilesetResolver.forVisionTasks(wasm);
    this.landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: model, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1
    });
  }

  /**
   * Imposta la sensibilità del rilevamento
   * @param percent - Percentuale da 0 a 100
   */
  setSensitivity(percent: number): void {
    // Mappa 0-100 a 0.05-0.005 (inverso: più alto = più sensibile)
    this.config.sensitivity = 0.05 - (percent / 100) * 0.045;
  }

  /**
   * Calibra la posizione neutra corrente
   */
  calibrate(): void {
    if (this.smoothed !== null) {
      this.neutral = this.smoothed;
    }
  }

  /**
   * Avvia il rilevamento del movimento
   */
  start(): void {
    if (this.running || !this.landmarker) return;
    this.running = true;
    this.last = 'none';
    this.smoothed = null;
    this.loop();
  }

  /**
   * Ferma il rilevamento del movimento
   */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /**
   * Calcola la profondità basata sulla posizione del naso rispetto alle spalle
   * @param landmarks - Array di landmark della posa
   * @returns Valore di profondità normalizzato
   */
  private depth(landmarks: any[]): number {
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    
    if (!nose || !leftShoulder || !rightShoulder) return 0;
    
    const midX = (leftShoulder.x + rightShoulder.x) / 2;
    const midY = (leftShoulder.y + rightShoulder.y) / 2;
    const shoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
    const noseDistance = Math.hypot(nose.x - midX, nose.y - midY);
    
    // Peso maggiore alla larghezza delle spalle, minore alla distanza del naso
    return shoulderWidth * 0.7 + noseDistance * 0.3;
  }

  /**
   * Loop principale di rilevamento
   */
  private loop = (): void => {
    if (!this.running || !this.video || !this.landmarker) return;
    
    try {
      const result = this.landmarker.detectForVideo(this.video, performance.now());
      const landmarks = result.landmarks?.[0];
      
      if (landmarks) {
        const raw = this.depth(landmarks);
        
        // Applica smoothing esponenziale
        this.smoothed = this.smoothed === null 
          ? raw 
          : this.smoothed * this.config.smoothingFactor + raw * (1 - this.config.smoothingFactor);
        
        const offset = this.smoothed - this.neutral;
        
        // Determina la direzione del movimento
        const current: Direction | 'none' =
          offset > this.config.sensitivity ? 'forward' :
          offset < -this.config.sensitivity ? 'backward' :
          Math.abs(offset) < this.config.sensitivity * 0.4 ? 'none' : this.last;
        
        const now = Date.now();
        
        // Emetti evento solo se c'è un cambiamento e il debounce è scaduto
        if (current !== 'none' && current !== this.last && now - this.lastEmit > this.config.debounceMs) {
          this.lastEmit = now;
          this.onMove?.(current);
        }
        
        this.last = current;
      }
    } catch (error) {
      // Silenziosamente ignora errori durante il rilevamento
    }
    
    this.raf = requestAnimationFrame(this.loop);
  };
}
