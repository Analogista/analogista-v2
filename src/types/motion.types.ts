/**
 * Tipi per il rilevamento del movimento corporeo
 */
export type Direction = 'forward' | 'backward';

/**
 * Configurazione del MotionTracker
 */
export interface MotionConfig {
  /** Sensibilità del rilevamento (0-100) */
  sensitivity: number;
  /** Fattore di smoothing per il filtro esponenziale */
  smoothingFactor?: number;
  /** Debounce tra eventi consecutivi (ms) */
  debounceMs?: number;
}

/**
 * Callback per gli eventi di movimento
 */
export type OnMoveCallback = (direction: Direction) => void;
