import React, { useState, useEffect, useRef } from 'react';
import type { MotionTracker } from '../../utils/motion-tracker';
import type { VoiceSynthesizer } from '../../utils/voice-synthesizer';
import { CameraView } from './CameraView';

export interface TestResult {
  dx: string;
  sx: string;
  risultato: string;
}

interface InductorTestScreenProps {
  motion: MotionTracker;
  voice: VoiceSynthesizer;
  nome: string;
  onEsito: (esito: TestResult) => void;
  onHome: () => void;
}

type TestPhase = 'calib' | 'run' | 'wait';

const label = (result: string): string =>
  result === 'SI' ? 'Avanti' : result === 'NO' ? 'Indietro' : 'Non rilevato';

/**
 * Componente per il test dell'induttore con domande vocali
 */
export const InductorTestScreen: React.FC<InductorTestScreenProps> = ({
  motion,
  voice,
  nome,
  onEsito,
  onHome,
}) => {
  const [phase, setPhase] = useState<TestPhase>('calib');
  const [message, setMessage] = useState(
    'Premi "Avvia calibrazione" sul video: il test partirà da solo.'
  );
  const [results, setResults] = useState<{ dx: string; sx: string }>({ dx: '', sx: '' });
  const [finalResult, setFinalResult] = useState<TestResult | null>(null);
  
  const isAlive = useRef(true);

  // Cleanup al unmount
  useEffect(() => {
    return () => {
      isAlive.current = false;
      try {
        voice.cancel();
      } catch {}
      try {
        motion.stop();
        motion.onMove = null;
      } catch {}
    };
  }, []);

  // Esegue il test completo
  const runTest = async () => {
    try {
      setPhase('run');
      setMessage('Ascolta le istruzioni…');

      // Istruzioni iniziali
      await voice.speak(
        `${nome}, mettiti in piedi di fronte alla telecamera, braccia distese lungo il corpo, piedi larghezza delle spalle e occhi chiusi. Ti chiederò di muovere prima la mano destra e poi la sinistra e valuterò l'oscillazione del tuo corpo.`
      );

      if (!isAlive.current) return;

      // Test mano destra
      setMessage('Test mano DESTRA…');
      const rightResult = await voice.ask(
        `Adesso ${nome} sfrega il pollice della mano destra con le altre dita per qualche secondo, io rileverò l'oscillazione.`,
        motion
      );

      if (!isAlive.current) return;

      setResults({ dx: label(rightResult), sx: '' });
      await new Promise((r) => setTimeout(r, 1500));

      if (!isAlive.current) return;

      // Test mano sinistra
      setMessage('Test mano SINISTRA…');
      const leftResult = await voice.ask(
        `Bene, adesso fai la stessa cosa con la mano sinistra ed io rileverò l'oscillazione.`,
        motion
      );

      if (!isAlive.current) return;

      setResults({ dx: label(rightResult), sx: label(leftResult) });

      // Determina il risultato finale
      let outcome = '';
      if (rightResult === 'SI' && leftResult === 'NO') {
        outcome = 'Induttore DESTRO (Sindrome di Giulietta e Romeo: difficoltà a decidere).';
      } else if (rightResult === 'NO' && leftResult === 'SI') {
        outcome = 'Induttore SINISTRO (Sindrome di Dante e Beatrice: problema di sogno/conquista).';
      } else {
        outcome = 'Combinazione non chiara: ripeti il test.';
      }

      const testResult: TestResult = {
        dx: label(rightResult),
        sx: label(leftResult),
        risultato: outcome,
      };

      setFinalResult(testResult);
      setMessage(outcome);

      // Ferma il motion tracker
      try {
        motion.onMove = null;
        motion.stop();
      } catch {}

      // Salva nello storico
      try {
        const history = JSON.parse(localStorage.getItem('av2_hist') || '[]');
        history.unshift({ when: new Date().toLocaleString(), ...testResult });
        localStorage.setItem('av2_hist', JSON.stringify(history.slice(0, 20)));
      } catch {}

      setPhase('wait');
    } catch (error) {
      if (isAlive.current) {
        setMessage('Test interrotto.');
        setPhase('calib');
      }
    }
  };

  // Ripete il test
  const handleRepeat = () => {
    try {
      voice.cancel();
    } catch {}
    try {
      motion.stop();
      motion.onMove = null;
    } catch {}

    setResults({ dx: '', sx: '' });
    setFinalResult(null);
    setPhase('calib');
    setMessage('Premi "Avvia calibrazione" sul video.');
  };

  const handleCalibrated = () => {
    if (phase === 'calib') {
      runTest();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-serif font-black text-cyan-400">TEST INDUTTORE</h2>
        <button
          onClick={onHome}
          className="text-xs font-bold uppercase tracking-widest text-cyan-500"
        >
          ← Esci
        </button>
      </div>

      {/* Vista camera */}
      <CameraView
        motion={motion}
        sensitivity={75}
        flash={null}
        onCalibrated={handleCalibrated}
      />

      {/* Messaggio e risultati */}
      <div className="text-center p-6 rounded-2xl bg-gray-900/40 border border-gray-800 min-h-[90px] flex flex-col justify-center">
        <p className="text-lg text-gray-200">{message}</p>
        <div className="mt-3 flex justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
          <p>
            DX: <span className="text-cyan-400">{results.dx || '-'}</span>
          </p>
          <p>
            SX: <span className="text-cyan-400">{results.sx || '-'}</span>
          </p>
        </div>
      </div>

      {/* Controlli footer */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center gap-3 px-4 z-50">
        {phase !== 'calib' && (
          <button
            onClick={handleRepeat}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/10"
          >
            🔁 Ripeti
          </button>
        )}

        {phase === 'wait' && finalResult && (
          <button
            onClick={() => onEsito(finalResult)}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest"
          >
            Prosegui →
          </button>
        )}
      </div>
    </div>
  );
};
