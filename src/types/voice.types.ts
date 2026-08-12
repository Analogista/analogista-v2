/**
 * Tipi per la sintesi vocale e gestione status
 */
export type VoiceStatusKind = 'info' | 'error';

export interface VoiceInfo {
  kind: VoiceStatusKind;
  text: string;
}

/**
 * Callback per gli aggiornamenti di stato della voce
 */
export type OnVoiceStatusCallback = (info: VoiceInfo) => void;

/**
 * Opzioni per la sintesi vocale
 */
export interface VoiceOptions {
  /** Lingua (default: 'it-IT') */
  lang?: string;
  /** Velocità di riproduzione (0.5-2.0, default: 0.95) */
  rate?: number;
  /** Tono della voce (0-2, default: 1) */
  pitch?: number;
  /** Volume (0-1, default: 1) */
  volume?: number;
}

/**
 * Risultato della domanda vocale
 */
export type VoiceAnswer = 'SI' | 'NO' | 'NONE';
