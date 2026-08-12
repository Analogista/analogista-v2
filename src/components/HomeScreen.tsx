import React, { useState } from 'react';

interface HomeProps {
  nome: string;
  onStart: (nome: string) => void;
}

const NDA_TEXT = `ACCORDO DI RISERVATEZZA (NDA)
Lo strumento è fornito "così com'è" per finalità di intrattenimento e approfondimento personale. Non costituisce dispositivo medico né fornisce diagnosi. L'utilizzatore si impegna a non diffondere contenuti, esiti o metodologie. I dati restano sul dispositivo e sotto la responsabilità dell'operatore.`;

/**
 * Componente per la schermata iniziale con accettazione NDA
 */
export const HomeScreen: React.FC<HomeProps> = ({ nome, onStart }) => {
  const [nomeInput, setNomeInput] = useState(nome);
  const [ndaAccepted, setNdaAccepted] = useState(false);

  const handleStart = () => {
    const trimmedNome = nomeInput.trim();
    if (!trimmedNome || !ndaAccepted) return;

    localStorage.setItem('av2_nome', trimmedNome);
    localStorage.setItem('av2_nda', '1');
    onStart(trimmedNome);
  };

  return (
    <div className="max-w-md mx-auto px-6 pb-16">
      <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
        {/* Input nome */}
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">
          Nome del soggetto
        </label>
        <input
          value={nomeInput}
          onChange={(e) => setNomeInput(e.target.value)}
          placeholder="Es. Mario"
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-400"
        />

        {/* NDA */}
        <div className="text-xs text-gray-400 bg-black/30 rounded-lg p-4 h-36 overflow-y-auto">
          <p className="font-bold text-gray-200 mb-2">ACCORDO DI RISERVATEZZA (NDA)</p>
          <p>{NDA_TEXT}</p>
        </div>

        {/* Checkbox accettazione */}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={ndaAccepted}
            onChange={(e) => setNdaAccepted(e.target.checked)}
            className="mt-1"
          />
          Ho letto e accetto l'accordo di riservatezza.
        </label>

        {/* Bottone inizia */}
        <button
          disabled={!ndaAccepted || !nomeInput.trim()}
          onClick={handleStart}
          className="w-full bg-cyan-600 disabled:bg-gray-700 disabled:text-gray-400 hover:bg-cyan-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest"
        >
          Inizia
        </button>
      </div>
    </div>
  );
};
