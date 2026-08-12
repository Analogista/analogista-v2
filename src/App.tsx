import React, { useEffect, useRef, useState } from 'react';
import { Motion } from './motion';
import { Voice } from './voice';

type Tab = 'home' | 'risultati' | 'video' | 'storico' | 'contatti';
type TestId = null | 'calib' | 'induttore' | 'nome' | 'distonici' | 'sigilli' | 'timeline' | 'testimone' | 'giorno';
type Esito = { header: string; l1: string; v1: string; l2: string; v2: string; risultato: string };

const CALIB_TEXT = "Poggia lo smartphone o il pc di fronte a te e mettiti in piedi. È sufficiente che la telecamera inquadri il tuo busto, dalla vita alla testa. Questo test ci servirà per calibrare l'oscillazione del tuo corpo, in avanti o indietro. In alto trovi la barra per regolare la sensibilità. Quando premerai il pulsante di calibrazione ci sarà un conto alla rovescia da 5 a 0 che congelerà la posizione iniziale del tuo corpo. Buona continuazione.";

const label = (r: string) => (r === 'SI' ? 'Avanti' : r === 'NO' ? 'Indietro' : 'Non rilevato');

const TEST_LIST: { id: Exclude<TestId, null>; num: string; nome: string; gruppo: string; pronto: boolean }[] = [
  { id: 'calib', num: '4', nome: 'Calibrazione', gruppo: 'PREPARAZIONE', pronto: true },
  { id: 'induttore', num: '6', nome: 'Test Induttore', gruppo: 'STRUMENTI DI INDAGINE', pronto: true },
  { id: 'nome', num: '7', nome: 'Test Nome', gruppo: 'STRUMENTI DI INDAGINE', pronto: true },
  { id: 'distonici', num: '8', nome: 'Punti Distonici', gruppo: 'STRUMENTI DI INDAGINE', pronto: false },
  { id: 'sigilli', num: '9', nome: 'Sigilli-Vincoli', gruppo: 'STRUMENTI DI INDAGINE', pronto: false },
  { id: 'timeline', num: '10', nome: 'Time Line', gruppo: 'STRUMENTI DI INDAGINE', pronto: false },
  { id: 'testimone', num: '11', nome: 'Testimone Chiave', gruppo: 'STRUMENTI DI INDAGINE', pronto: false },
  { id: 'giorno', num: '12', nome: 'Quale giorno?', gruppo: 'STRUMENTI DI INDAGINE', pronto: false },
];

export default function App() {
  const [entered, setEntered] = useState(() => !!localStorage.getItem('av2_nome'));
  const [tab, setTab] = useState<Tab>('home');
  const [test, setTest] = useState<TestId>(null);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ kind: string; text: string } | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const voiceBusy = useRef(false);
  const motionRef = useRef<Motion | null>(null);
  const voiceRef = useRef<Voice | null>(null);
  if (!motionRef.current) motionRef.current = new Motion();
  if (!voiceRef.current) {
    voiceRef.current = new Voice();
    voiceRef.current.onStatus = (i) => setStatusMsg(i.text ? i : null);
  }
  const motion = motionRef.current!;
  const voice = voiceRef.current!;
  const nome = localStorage.getItem('av2_nome') || 'ospite';
  const genere = localStorage.getItem('av2_genere') || 'MASCHIO';

  const toggleVoice = (text: string) => {
    if (voiceBusy.current) { voice.cancel(); voiceBusy.current = false; setVoiceActive(false); return; }
    voiceBusy.current = true;
    setVoiceActive(true);
    voice.speak(text).finally(() => { voiceBusy.current = false; setVoiceActive(false); });
  };
  const goHome = () => {
    try { voice.cancel(); } catch (e) {}
    voiceBusy.current = false;
    setVoiceActive(false);
    try { motion.stop(); motion.onMove = null; } catch (e) {}
    setEsito(null);
    setTest(null);
    setTab('home');
  };

  if (!entered) return <Anagrafica onDone={() => setEntered(true)} />;

  return (
    <div className="min-h-screen font-sans bg-[#0a0a0c] text-white">
      {statusMsg && (
        <div className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center text-xs font-mono ${statusMsg.kind === 'error' ? 'bg-rose-950 text-rose-300' : 'bg-cyan-950 text-cyan-300'}`}>
          {statusMsg.text}
        </div>
      )}
      <header className="pt-6 pb-2 text-center">
        <h1 className="font-serif font-black text-2xl text-cyan-400">Analogista Virtuale</h1>
        <p className="text-[10px] uppercase tracking-widest text-gray-500">© 2026 Max Pisani - PACommunication</p>
      </header>
      <NavBar tab={tab} setTab={(t) => { setTab(t); setTest(null); setEsito(null); }} />
      <main className="pt-6 pb-16">
        {esito ? (
          <EsitoScreen esito={esito} onHome={goHome} />
        ) : test === 'calib' ? (
          <Calibrazione motion={motion} voice={voice} voiceActive={voiceActive} onVoiceGuide={() => toggleVoice(CALIB_TEXT)} onHome={() => setTest(null)} onDone={() => setTest(null)} />
        ) : test === 'induttore' ? (
          <TestInduttore motion={motion} voice={voice} nome={nome} onHome={() => setTest(null)} onEsito={(e) => setEsito(e)} />
        ) : test === 'nome' ? (
          <TestNome motion={motion} voice={voice} nome={nome} genere={genere} onHome={() => setTest(null)} onEsito={(e) => setEsito(e)} />
        ) : test ? (
          <PlaceholderTest nome={TEST_LIST.find((t) => t.id === test)?.nome || ''} onHome={() => setTest(null)} />
        ) : tab === 'home' ? (
          <HomeGrid onOpen={(id) => setTest(id)} />
        ) : tab === 'risultati' ? (
          <Risultati />
        ) : tab === 'storico' ? (
          <Storico />
        ) : tab === 'video' ? (
          <SimpleCard titolo="VIDEO CORSO" testo="Qui arriveranno i video del corso, come nella versione originale." />
        ) : (
          <SimpleCard titolo="CONTATTI" testo="PACommunication – Max Pisani. Area riservata operatore." />
        )}
      </main>
    </div>
  );
}

function Anagrafica({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(localStorage.getItem('av2_nome') || '');
  const [eta, setEta] = useState(localStorage.getItem('av2_eta') || '');
  const [genere, setGenere] = useState(localStorage.getItem('av2_genere') || 'MASCHIO');
  const [prob, setProb] = useState(localStorage.getItem('av2_problema') || '');
  const [nda, setNda] = useState(localStorage.getItem('av2_nda') === '1');
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-sans px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-serif font-black text-3xl text-cyan-400">CHI SEI?</h1>
          <p className="text-sm tracking-widest uppercase text-gray-400 font-bold">Identità analogica</p>
        </div>
        <div className="border-l-4 border-cyan-500 bg-cyan-950/30 p-4 text-sm text-gray-200">
          I tuoi dati sono necessari per la voce guida. Saranno processati <strong>solo localmente</strong> e cancellati alla chiusura.
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Nome</label>
            <input value={n} onChange={(e) => setN(e.target.value)} className="w-full bg-gray-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Età</label>
              <input type="number" value={eta} onChange={(e) => setEta(e.target.value)} className="w-full bg-gray-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-400" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Genere</label>
              <select value={genere} onChange={(e) => setGenere(e.target.value)} className="w-full bg-gray-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-400">
                <option>MASCHIO</option>
                <option>FEMMINA</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Problema che vuoi risolvere</label>
            <textarea value={prob} onChange={(e) => setProb(e.target.value)} placeholder="Qual è il tuo disagio attuale?" rows={4}
              className="w-full bg-gray-900/60 border border-cyan-500/60 rounded-xl px-4 py-3 outline-none focus:border-cyan-400" />
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={nda} onChange={(e) => setNda(e.target.checked)} className="mt-1" />
            Ho letto e accetto l'accordo di riservatezza (NDA): strumento fornito "così com'è" per intrattenimento e approfondimento personale; non è un dispositivo medico; i dati restano sul dispositivo.
          </label>
          <button disabled={!n.trim() || !nda} onClick={() => {
            localStorage.setItem('av2_nome', n.trim());
            localStorage.setItem('av2_eta', eta);
            localStorage.setItem('av2_genere', genere);
            localStorage.setItem('av2_problema', prob);
            localStorage.setItem('av2_nda', '1');
            onDone();
          }}
            className="w-full bg-cyan-600 disabled:bg-gray-700 disabled:text-gray-400 hover:bg-cyan-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest">
            Procedi →
          </button>
        </div>
      </div>
    </div>
  );
}

function NavBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'risultati', icon: '📊', label: 'Risultati' },
    { id: 'video', icon: '🎬', label: 'Video Corso' },
    { id: 'storico', icon: '📖', label: 'Storico' },
    { id: 'contatti', icon: '📞', label: 'Contatti' },
  ];
  return (
    <nav className="flex justify-center gap-1 border-b border-white/10">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => setTab(t.id)}
          className={`flex flex-col items-center px-4 py-2 text-[11px] font-bold uppercase tracking-widest border-b-2 ${tab === t.id ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
          <span className="text-base">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function HomeGrid({ onOpen }: { onOpen: (id: Exclude<TestId, null>) => void }) {
  const gruppi = ['PREPARAZIONE', 'STRUMENTI DI INDAGINE'];
  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-gray-900/40 border border-orange-400/20 rounded-2xl p-6">
        <h2 className="font-serif font-black text-xl text-orange-400">TEST SINGOLI</h2>
        <p className="text-xs text-orange-300/70 mb-4">Seleziona i test singolarmente</p>
        {gruppi.map((g) => (
          <div key={g} className="mb-4">
            <p className="text-center text-xs font-black tracking-widest text-orange-300 mb-2">{g}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {TEST_LIST.filter((t) => t.gruppo === g).map((t) => (
                <button key={t.id} onClick={() => onOpen(t.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm font-semibold ${t.pronto ? 'bg-gray-800/60 border-white/10 hover:border-cyan-400' : 'bg-gray-900/40 border-white/5 text-gray-500'}`}>
                  <span>{t.pronto ? '🎯' : '🔒'}</span>
                  {t.num}) {t.nome}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CameraView({ motion, sensitivity, onCalibrated, onVoiceGuide, voiceActive, flash }: {
  motion: Motion; sensitivity: number; onCalibrated?: () => void; onVoiceGuide?: () => void; voiceActive?: boolean; flash: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (cancelled || !videoRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        await motion.init(video);
        motion.setSensitivity(sensitivity);
        motion.start();
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setCamError('Permesso fotocamera negato o hardware non disponibile.');
      }
    })();
    return () => {
      cancelled = true;
      motion.stop();
      const v = videoRef.current;
      if (v && v.srcObject) (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    };
  }, [motion]);
  useEffect(() => { motion.setSensitivity(sensitivity); }, [sensitivity, motion]);
  const calibrate = () => {
    if (calibrating || !ready) return;
    setCalibrating(true);
    motion.stop();
    setCountdown(5);
    const t = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          setTimeout(() => { motion.start(); motion.calibrate(); setCalibrating(false); if (onCalibrated) onCalibrated(); }, 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  return (
    <div className="relative w-full max-w-3xl mx-auto h-[420px] sm:h-[520px] bg-black rounded-3xl overflow-hidden border border-white/10">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img src="/assets/sagoma.png" alt="Sagoma" className="h-[90%] w-auto object-contain opacity-40"
          onError={(e) => { e.currentTarget.style.display = 'none'; const f = document.getElementById('silhouette-fallback'); if (f) (f as HTMLElement).style.display = 'block'; }} />
        <svg id="silhouette-fallback" viewBox="0 0 200 300" className="h-[90%] opacity-30" style={{ display: 'none' }}>
          <path d="M100,50 C80,50 70,70 70,90 C70,110 80,130 100,130 C120,130 130,110 130,90 C130,70 120,50 100,50 M70,140 C40,140 20,180 20,220 L20,300 L180,300 L180,220 C180,180 160,140 130,140 L70,140" fill="none" stroke="white" strokeWidth="2" strokeDasharray="5,5" />
        </svg>
      </div>
      <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/70 border border-white/10 text-[10px] font-mono uppercase tracking-wider">
        {calibrating ? 'CALIBRAZIONE (' + countdown + 's)' : ready ? 'PRONTO' : camError ? 'ERRORE CAMERA' : 'ATTESA…'}
      </div>
      {flash && (
        <div className={`absolute top-4 right-4 px-6 py-2 rounded-2xl border-2 text-3xl font-black ${flash === 'SI' ? 'border-green-400 text-green-400' : 'border-rose-500 text-rose-500'}`}>{flash}</div>
      )}
      {calibrating && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="text-white text-[9rem] font-black">{countdown}</div>
        </div>
      )}
      {camError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/90 p-6 text-center text-rose-400 text-sm">{camError}</div>
      )}
      <div className="absolute bottom-4 inset-x-4 flex justify-center gap-3 flex-wrap">
        <button onClick={calibrate} disabled={!ready || calibrating}
          className="px-5 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest">
          {calibrating ? 'Calibrazione…' : '▶ Avvia calibrazione'}
        </button>
        {onVoiceGuide && (
          <button onClick={onVoiceGuide} disabled={!ready || calibrating}
            className={`px-5 py-2.5 disabled:opacity-30 border rounded-xl text-[10px] font-bold uppercase tracking-widest ${voiceActive ? 'bg-rose-600/90 hover:bg-rose-500 border-rose-400/40' : 'bg-indigo-600/90 hover:bg-indigo-500 border-indigo-400/40'}`}>
            {voiceActive ? '⏹ Ferma voce guida' : '🔊 Ascolta voce guida'}
          </button>
        )}
      </div>
    </div>
  );
}

function Calibrazione({ motion, voice, voiceActive, onVoiceGuide, onDone, onHome }: { motion: Motion; voice: Voice; voiceActive: boolean; onVoiceGuide: () => void; onDone: () => void; onHome: () => void }) {
  const [sens, setSens] = useState(75);
  const [done, setDone] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    motion.onMove = (d: any) => { setFlash(d === 'forward' ? 'SI' : 'NO'); setTimeout(() => setFlash(null), 1000); };
    return () => { motion.onMove = null; };
  }, [motion]);
  return (
    <div className="max-w-4xl mx-auto px-4 pb-16 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-serif font-black text-cyan-400">4) CALIBRAZIONE</h2>
        <button onClick={onHome} className="text-xs font-bold uppercase tracking-widest text-cyan-500">← Home</button>
      </div>
      <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
        <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-gray-400">Sensibilità: {sens}%</label>
        <input type="range" min={0} max={100} value={sens} onChange={(e) => setSens(parseInt(e.target.value))} className="w-full accent-cyan-400" />
      </div>
      <CameraView motion={motion} sensitivity={sens} flash={flash} voiceActive={voiceActive} onVoiceGuide={onVoiceGuide} onCalibrated={() => setDone(true)} />
      {done && (
        <button onClick={onDone} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest">Prosegui →</button>
      )}
    </div>
  );
}

function TestInduttore({ motion, voice, nome, onEsito, onHome }: { motion: Motion; voice: Voice; nome: string; onEsito: (e: Esito) => void; onHome: () => void }) {
  const [phase, setPhase] = useState<'calib' | 'run' | 'wait'>('calib');
  const [msg, setMsg] = useState('Premi "Avvia calibrazione" sul video: il test partirà da solo.');
  const [res, setRes] = useState<{ dx: string; sx: string }>({ dx: '', sx: '' });
  const [finalEsito, setFinalEsito] = useState<Esito | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; try { voice.cancel(); } catch (e) {} try { motion.stop(); motion.onMove = null; } catch (e) {} }, []);
  const run = async () => {
    try {
      setPhase('run');
      setMsg('Ascolta le istruzioni…');
      await voice.speak(nome + ", mettiti in piedi di fronte alla telecamera, braccia distese lungo il corpo, piedi larghezza delle spalle e occhi chiusi. Ti chiederò di muovere prima la mano destra e poi la sinistra e valuterò l'oscillazione del tuo corpo.");
      if (!alive.current) return;
      setMsg('Test mano DESTRA…');
      const dx = await voice.ask("Adesso " + nome + " sfrega il pollice della mano destra con le altre dita per qualche secondo, io rileverò l'oscillazione.", motion);
      if (!alive.current) return;
      setRes({ dx: label(dx), sx: '' });
      await new Promise((r) => setTimeout(r, 1500));
      if (!alive.current) return;
      setMsg('Test mano SINISTRA…');
      const sx = await voice.ask("Bene, adesso fai la stessa cosa con la mano sinistra ed io rileverò l'oscillazione.", motion);
      if (!alive.current) return;
      setRes({ dx: label(dx), sx: label(sx) });
      let risultato = '';
      if (dx === 'SI' && sx === 'NO') risultato = 'Induttore DESTRO (Sindrome di Giulietta e Romeo: difficoltà a decidere).';
      else if (dx === 'NO' && sx === 'SI') risultato = 'Induttore SINISTRO (Sindrome di Dante e Beatrice: problema di sogno/conquista).';
      else risultato = 'Combinazione non chiara: ripeti il test.';
      setFinalEsito({ header: 'ESITO TEST INDUTTORE', l1: 'Mano destra', v1: label(dx), l2: 'Mano sinistra', v2: label(sx), risultato });
      setMsg(risultato);
      try { motion.onMove = null; motion.stop(); } catch (err) {}
      try {
        const hist = JSON.parse(localStorage.getItem('av2_hist') || '[]');
        hist.unshift({ when: new Date().toLocaleString(), test: 'Induttore', a: label(dx), b: label(sx), risultato });
        localStorage.setItem('av2_hist', JSON.stringify(hist.slice(0, 50)));
      } catch (err) {}
      setPhase('wait');
    } catch (e) {
      if (alive.current) { setMsg('Test interrotto.'); setPhase('calib'); }
    }
  };
  const repeat = () => {
    try { voice.cancel(); } catch (e) {}
    try { motion.stop(); motion.onMove = null; } catch (e) {}
    setRes({ dx: '', sx: '' });
    setFinalEsito(null);
    setPhase('calib');
    setMsg('Premi "Avvia calibrazione" sul video.');
  };
  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-serif font-black text-cyan-400">6) TEST INDUTTORE</h2>
        <button onClick={onHome} className="text-xs font-bold uppercase tracking-widest text-cyan-500">← Home</button>
      </div>
      <CameraView motion={motion} sensitivity={75} flash={null} onCalibrated={() => { if (phase === 'calib') run(); }} />
      <div className="text-center p-6 rounded-2xl bg-gray-900/40 border border-gray-800 min-h-[90px] flex flex-col justify-center">
        <p className="text-lg text-gray-200">{msg}</p>
        <div className="mt-3 flex justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
          <p>DX: <span className="text-cyan-400">{res.dx || '-'}</span></p>
          <p>SX: <span className="text-cyan-400">{res.sx || '-'}</span></p>
        </div>
      </div>
      <div className="fixed bottom-6 left-0 right-0 flex justify-center gap-3 px-4 z-50">
        {phase !== 'calib' && (
          <button onClick={repeat} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/10">🔁 Ripeti</button>
        )}
        {phase === 'wait' && finalEsito && (
          <button onClick={() => onEsito(finalEsito)} className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest">Prosegui →</button>
        )}
      </div>
    </div>
  );
}

function TestNome({ motion, voice, nome, genere, onEsito, onHome }: { motion: Motion; voice: Voice; nome: string; genere: string; onEsito: (e: Esito) => void; onHome: () => void }) {
  const [phase, setPhase] = useState<'calib' | 'run' | 'wait'>('calib');
  const [msg, setMsg] = useState('Premi "Avvia calibrazione" sul video: il test partirà da solo.');
  const [res, setRes] = useState<{ vero: string; falso: string }>({ vero: '', falso: '' });
  const [finalEsito, setFinalEsito] = useState<Esito | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; try { voice.cancel(); } catch (e) {} try { motion.stop(); motion.onMove = null; } catch (e) {} }, []);

  const generateFakeName = () => {
    const maleNames = ['Marco', 'Luca', 'Andrea', 'Matteo', 'Paolo', 'Giuseppe', 'Francesco', 'Roberto', 'Luigi', 'Antonio', 'Alessandro', 'Davide', 'Stefano', 'Giovanni', 'Federico'];
    const femaleNames = ['Maria', 'Giulia', 'Anna', 'Sofia', 'Chiara', 'Francesca', 'Laura', 'Sara', 'Elena', 'Valentina', 'Alice', 'Giorgia', 'Martina', 'Silvia', 'Beatrice'];
    const isFemale = genere === 'FEMMINA';
    const pool = isFemale ? femaleNames : maleNames;
    const first = (nome || '').trim().toLowerCase();
    const valid = pool.filter((n) => { const l = n.toLowerCase(); return first !== l && !first.includes(l) && !l.includes(first); });
    if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];
    return isFemale ? 'Vittoria' : 'Stefano';
  };

  const run = async () => {
    try {
      setPhase('run');
      setMsg('Test del nome VERO in corso…');
      await voice.speak("Perfetto, mantieni la stessa posizione. Iniziamo il test del nome.");
      if (!alive.current) return;
      const vero = await voice.ask("Bene, sei in posizione? Fai un bel respiro. Caro inconscio, è vero, sì o no, che il tuo nome è " + nome + "? Se ti chiami " + nome + " spingerai il corpo in avanti, altrimenti indietro. Attendo risposta.", motion);
      if (!alive.current) return;
      setRes({ vero: label(vero), falso: '' });
      await new Promise((r) => setTimeout(r, 2000));
      if (!alive.current) return;
      const fake = generateFakeName();
      setMsg('Ora proviamo con un nome FALSO…');
      const falso = await voice.ask("Adesso proviamo con un nome falso. Caro inconscio, è vero, sì o no, che il tuo nome è " + fake + "? Attendo risposta.", motion);
      if (!alive.current) return;
      setRes({ vero: label(vero), falso: label(falso) });
      const outcome = vero === 'SI'
        ? 'Test completato con successo: il tuo inconscio riconosce il tuo nome.'
        : 'Il tuo inconscio non ha confermato il tuo nome. Ti consigliamo di ripetere il test, ma puoi proseguire se vuoi.';
      setFinalEsito({ header: 'ESITO TEST NOME', l1: 'Nome vero', v1: label(vero), l2: 'Nome falso (' + fake + ')', v2: label(falso), risultato: outcome });
      setMsg(outcome);
      try { motion.onMove = null; motion.stop(); } catch (e) {}
      try {
        const hist = JSON.parse(localStorage.getItem('av2_hist') || '[]');
        hist.unshift({ when: new Date().toLocaleString(), test: 'Nome', a: label(vero), b: label(falso), risultato: vero === 'SI' ? 'Nome riconosciuto' : 'Nome non riconosciuto' });
        localStorage.setItem('av2_hist', JSON.stringify(hist.slice(0, 50)));
      } catch (e) {}
      setPhase('wait');
    } catch (e) {
      if (alive.current) { setMsg('Test interrotto.'); setPhase('calib'); }
    }
  };
  const repeat = () => {
    try { voice.cancel(); } catch (e) {}
    try { motion.stop(); motion.onMove = null; } catch (e) {}
    setRes({ vero: '', falso: '' });
    setFinalEsito(null);
    setPhase('calib');
    setMsg('Premi "Avvia calibrazione" sul video.');
  };
  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-serif font-black text-cyan-400">7) TEST NOME</h2>
        <button onClick={onHome} className="text-xs font-bold uppercase tracking-widest text-cyan-500">← Home</button>
      </div>
      <CameraView motion={motion} sensitivity={75} flash={null} onCalibrated={() => { if (phase === 'calib') run(); }} />
      <div className="text-center p-6 rounded-2xl bg-gray-900/40 border border-gray-800 min-h-[90px] flex flex-col justify-center">
        <p className="text-lg text-gray-200">{msg}</p>
        <div className="mt-3 flex justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
          <p>NOME VERO: <span className="text-cyan-400">{res.vero || '-'}</span></p>
          <p>NOME FALSO: <span className="text-cyan-400">{res.falso || '-'}</span></p>
        </div>
      </div>
      <div className="fixed bottom-6 left-0 right-0 flex justify-center gap-3 px-4 z-50">
        {phase !== 'calib' && (
          <button onClick={repeat} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/10">🔁 Ripeti</button>
        )}
        {phase === 'wait' && finalEsito && (
          <button onClick={() => onEsito(finalEsito)} className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest">Prosegui →</button>
        )}
      </div>
    </div>
  );
}

function EsitoScreen({ esito, onHome }: { esito: Esito; onHome: () => void }) {
  return (
    <div className="max-w-md mx-auto px-6 pb-16">
      <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-6 space-y-4 text-center">
        <h2 className="text-lg font-serif font-black text-cyan-400">{esito.header}</h2>
        <p className="text-sm text-gray-400">{esito.l1}: <span className="text-cyan-400 font-bold">{esito.v1}</span></p>
        <p className="text-sm text-gray-400">{esito.l2}: <span className="text-cyan-400 font-bold">{esito.v2}</span></p>
        <p className="text-base text-gray-100 font-semibold">{esito.risultato}</p>
        <p className="text-[10px] text-gray-500">Dati salvati solo su questo dispositivo.</p>
        <button onClick={onHome} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest">Torna alla Home</button>
      </div>
    </div>
  );
}

function PlaceholderTest({ nome, onHome }: { nome: string; onHome: () => void }) {
  return (
    <div className="max-w-4xl mx-auto px-4 pb-16 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-serif font-black text-cyan-400">{nome.toUpperCase()}</h2>
        <button onClick={onHome} className="text-xs font-bold uppercase tracking-widest text-cyan-500">← Home</button>
      </div>
      <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-8 text-center">
        <p className="text-3xl mb-4">🛠️</p>
        <p className="text-gray-300">Test in preparazione.</p>
        <p className="text-sm text-gray-500 mt-2">Userà sempre la rilevazione dell'oscillazione del corpo: arriverà nel prossimo aggiornamento.</p>
      </div>
    </div>
  );
}

function Risultati() {
  const nome = localStorage.getItem('av2_nome') || '-';
  const eta = localStorage.getItem('av2_eta') || '-';
  const genere = localStorage.getItem('av2_genere') || '-';
  let hist: any[] = [];
  try { hist = JSON.parse(localStorage.getItem('av2_hist') || '[]'); } catch (e) {}
  const ultimo = hist[0];
  return (
    <div className="max-w-2xl mx-auto px-4 space-y-4">
      <SimpleCard titolo="ANAGRAFICA" testo={'Nome: ' + nome + ' · Età: ' + eta + ' · Genere: ' + genere} />
      <SimpleCard titolo="ULTIMO ESITO" testo={ultimo ? ultimo.test + ' — ' + ultimo.a + ' / ' + ultimo.b + '. ' + ultimo.risultato : 'Nessun test completato.'} />
    </div>
  );
}

function Storico() {
  let hist: any[] = [];
  try { hist = JSON.parse(localStorage.getItem('av2_hist') || '[]'); } catch (e) {}
  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className="bg-gray-900/40 border border-white/10 rounded-2xl p-6 space-y-3">
        <h2 className="font-serif font-black text-xl text-cyan-400">STORICO SESSIONI</h2>
        {hist.length === 0 && <p className="text-sm text-gray-500">Nessuna sessione salvata.</p>}
        {hist.map((h, i) => (
          <div key={i} className="text-sm bg-black/30 rounded-lg p-3 border border-white/5">
            <p className="text-[10px] text-gray-500">{h.when}</p>
            <p className="text-gray-200">{h.test || 'Induttore'} — {h.a} / {h.b}</p>
            <p className="text-gray-400">{h.risultato}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleCard({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <div className="bg-gray-900/40 border border-white/10 rounded-2xl p-6">
      <h2 className="font-serif font-black text-xl text-cyan-400 mb-2">{titolo}</h2>
      <p className="text-sm text-gray-300">{testo}</p>
    </div>
  );
}
