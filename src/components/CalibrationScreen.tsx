import React, { useState, useEffect } from 'react';
import type { MotionTracker } from '../../utils/motion-tracker';
import type { VoiceSynthesizer } from '../../utils/voice-synthesizer';
import { CameraView } from './CameraView';

interface CalibrationScreenProps {
  motion: MotionTracker;
  voice: VoiceSynthesizer;
  onDone: () => void;
  onHome: () => void;
}

const CALIBRATION_GUIDE_TEXT = "Poggia lo smartphone o il pc di fronte a te e mettiti in piedi. È sufficiente che la telecamera inquadri il tuo busto, dalla vita alla testa. Questo test ci servirà per calibrare l'oscillazione del tuo corpo, in avanti o indietro. In alto trovi la barra per regolare la sensibilità. Quando premerai il pulsante di calibrazione ci sarà un conto alla rovescia da 5 a 0 che congelerà la posizione iniziale del tuo corpo. Buona continuazione.";

/**
 * Componente per la schermata di calibrazione
 */
export const CalibrationScreen: React.FC<CalibrationScreenProps> = ({
  motion,
  voice,
  onDone,
  onHome,
}) => {
  const [sensitivity, setSensitivity] = useState(75);
  const [calibrationDone, setCalibrationDone] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // Imposta handler per il movimento
  useEffect(() => {
    motion.onMove = (direction) => {
      setFlash(direction === 'forward' ? 'SI' : 'NO');
      setTimeout(() => setFlash(null), 1000);
    };

    return () => {
      motion.onMove = null;
    };
  }, [motion]);

  const handleVoiceGuide = () => {
    voice.speak(CALIBRATION_GUIDE_TEXT).catch(() => {});
  };

  const handleCalibrated = () => {
    setCalibrationDone(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-16 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-serif font-black text-cyan-400">CALIBRAZIONE</h2>
        <button
          onClick={onHome}
          className="text-xs font-bold uppercase tracking-widest text-cyan-500"
        >
          ← Esci
        </button>
      </div>

      {/* Slider sensibilità */}
      <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
        <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-gray-400">
          Sensibilità: {sensitivity}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={sensitivity}
          onChange={(e) => setSensitivity(parseInt(e.target.value))}
          className="w-full accent-cyan-400"
        />
      </div>

      {/* Vista camera */}
      <CameraView
        motion={motion}
        sensitivity={sensitivity}
        flash={flash}
        onVoiceGuide={handleVoiceGuide}
        onCalibrated={handleCalibrated}
      />

      {/* Bottone prosegui */}
      {calibrationDone && (
        <button
          onClick={onDone}
          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest"
        >
          Prosegui →
        </button>
      )}
    </div>
  );
};
