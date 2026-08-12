import React from 'react';
import type { TestResult } from './InductorTestScreen';

interface ResultScreenProps {
  esito: TestResult;
  onHome: () => void;
}

/**
 * Componente per la visualizzazione del risultato finale
 */
export const ResultScreen: React.FC<ResultScreenProps> = ({ esito, onHome }) => {
  return (
    <div className="max-w-md mx-auto px-6 pb-16">
      <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-6 space-y-4 text-center">
        <h2 className="text-lg font-serif font-black text-cyan-400">ESITO TEST INDUTTORE</h2>
        
        <p className="text-sm text-gray-400">
          Mano destra:{' '}
          <span className="text-cyan-400 font-bold">{esito.dx}</span>
        </p>
        
        <p className="text-sm text-gray-400">
          Mano sinistra:{' '}
          <span className="text-cyan-400 font-bold">{esito.sx}</span>
        </p>
        
        <p className="text-base text-gray-100 font-semibold">{esito.risultato}</p>
        
        <p className="text-[10px] text-gray-500">
          Dati salvati solo su questo dispositivo.
        </p>
        
        <button
          onClick={onHome}
          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest"
        >
          Nuova sessione
        </button>
      </div>
    </div>
  );
};
