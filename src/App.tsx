import React, { useEffect, useRef, useState } from 'react';
import { Motion } from './motion';
import { Voice } from './voice';

type Screen = 'home' | 'calib' | 'test' | 'esito';
type Esito = { dx: string; sx: string; risultato: string };

const CALIB_TEXT = "Poggia lo smartphone o il pc di fronte a te e mettiti in piedi. È sufficiente che la telecamera inquadri il tuo busto, dalla vita alla testa. Questo test ci servirà per calibrare l'oscillazione del tuo corpo, in avanti o indietro. In alto trovi la barra per regolare la sensibilità. Quando premerai il pulsante di calibrazione ci sarà un conto alla rovescia da 5 a 0 che congelerà la posizione iniziale del tuo corpo. Buona continuazione.";

const label = (r: string) => (r === 'SI' ? 'Avanti' : r === 'NO' ? 'Indietro' : 'Non rilevato');

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [nome, setNome] = useState(() => localStorage.getItem('av2_nome') || '');
  const [statusMsg, setStatusMsg] = useState<{ kind: string; text: string } | null>(null);
  const [esito, setEsito] = useState<Esito | null>(null);
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
  const toggleVoice = (text: string) => {
    if (voiceBusy.current) {
      voice.cancel();
      voiceBusy.current = false;
      setVoiceActive(false);
      return;
    }
    voiceBusy.current = true;
    setVoiceActive(true);
    voice.speak(text).finally(() => { voiceBusy.current = false; setVoiceActive(false); });
  };
  const goHome = () => {
    try { voice.cancel(); } catch (e) {}
    voiceBusy.current = false;
    setVoiceActive(false);
    try { motion.stop(); motion.onMove = null; } catch (e) {}
    setScreen('home');
  };
  return (
    <div className="min-h-screen font-sans">
      {statusMsg && (
        <div className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center text-xs font-mono ${statusMsg.kind === 'error' ? 'bg-rose-950 text-rose-300' : 'bg-cyan-950 text-cyan-300'}`}>
          {statusMsg.text}
        </div>
      )}
      <header className="pt-8 pb-4 text-center">
        <h1 className="font-serif font-black text-2xl text-cyan-400">Analogista Virtuale</h1>
        <p className="text-[10px] uppercase tracking-widest text-gray-500">© 2026 Max Pisani - PACommunication</p>
      </header>
      {screen === 'home' && <Home nome={nome} onStart={(n: string) => { setNome(n); setScreen('calib'); }} />}
      {screen === 'calib' && <Calibrazione motion={motion} voice={voice} voiceActive={voiceActive} onVoiceGuide={() => toggleVoice(CALIB_TEXT)} onHome={goHome} onDone={() => setScreen('test')} />}
      {screen === 'test' && <TestInduttore motion={motion} voice={voice} nome={nome || 'ospite'} onHome={goHome} onEsito={(e: Esito) => { setEsito(e); setScreen('esito'); }} />}
      {screen === 'esito' && esito && <EsitoScreen esito={esito} onHome={goHome} />}
    </div>
  );
}

function Home({ nome, onStart }: { nome: string; onStart: (n: string) => void }) {
  const [n, setN] = useState(nome);
  const [checked, setChecked] = useState(false);
  return (
    <div className="max-w-md mx-auto px-6 pb-16">
      <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">Nome del soggetto</label>
        <input value={n} onChange={(e) => setN(e.target.value)} placeholder="Es. Mario"
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-400" />
        <div className="text-xs text-gray-400 bg-black/30 rounded-lg p-4 h-36 overflow-y-auto">
          <p className="font-bold text-gray-200 mb-2">ACCORDO DI RISERVATEZZA (NDA)</p>
          <p>Lo strumento è fornito "così com'è" per finalità di intrattenimento e approfondimento personale. Non costituisce dispositivo medico né fornisce diagnosi. L'utilizzatore si impegna a non diffondere contenuti, esiti o metodologie. I dati restano sul dispositivo e sotto la responsabilità dell'operatore.</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" />
          Ho letto e accetto l'accordo di riservatezza.
        </label>
        <button disabled={!checked || !n.trim()} onClick={() => { localStorage.setItem('av2_nome', n.trim()); localStorage.setItem('av2_nda', '1'); onStart(n.trim()); }}
          className="w-full bg-cyan-600 disabled:bg-gray-700 disabled:text-gray-400 hover:bg-cyan-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest">
          Inizia
        </button>
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
        <h2 className="text-lg font-serif font-black text-cyan-400">CALIBRAZIONE</h2>
        <button onClick={onHome} className="text-xs font-bold uppercase tracking-widest text-cyan-500">← Esci</button>
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
      const e: Esito = { dx: label(dx), sx: label(sx), risultato };
      setFinalEsito(e);
      setMsg(risultato);
      try { motion.onMove = null; motion.stop(); } catch (err) {}
      try {
        const hist = JSON.parse(localStorage.getItem('av2_hist') || '[]');
        hist.unshift({ when: new Date().toLocaleString(), ...e });
        localStorage.setItem('av2_hist', JSON.stringify(hist.slice(0, 20)));
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
        <h2 className="text-lg font-serif font-black text-cyan-400">TEST INDUTTORE</h2>
        <button onClick={onHome} className="text-xs font-bold uppercase tracking-widest text-cyan-500">← Esci</button>
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

function EsitoScreen({ esito, onHome }: { esito: Esito; onHome: () => void }) {
  return (
    <div className="max-w-md mx-auto px-6 pb-16">
      <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-6 space-y-4 text-center">
        <h2 className="text-lg font-serif font-black text-cyan-400">ESITO TEST INDUTTORE</h2>
        <p className="text-sm text-gray-400">Mano destra: <span className="text-cyan-400 font-bold">{esito.dx}</span></p>
        <p className="text-sm text-gray-400">Mano sinistra: <span className="text-cyan-400 font-bold">{esito.sx}</span></p>
        <p className="text-base text-gray-100 font-semibold">{esito.risultato}</p>
        <p className="text-[10px] text-gray-500">Dati salvati solo su questo dispositivo.</p>
        <button onClick={onHome} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest">Nuova sessione</button>
      </div>
    </div>
  );
}import React, { useEffect, useRef, useState } from 'react';
import { Motion } from './motion';
import { Voice } from './voice';

type Screen = 'home' | 'calib' | 'test' | 'esito';
type Esito = { dx: string; sx: string; risultato: string };

const CALIB_TEXT = "Poggia lo smartphone o il pc di fronte a te e mettiti in piedi. E' sufficiente che la telecamera inquadri il tuo busto, dalla vita alla testa. Questo test ci servira' per calibrare l'oscillazione del tuo corpo, in avanti o indietro. In alto trovi la barra per regolare la sensibilita'. Quando premerai il pulsante di calibrazione ci sara' un conto alla rovescia da 5 a 0 che congelera' la posizione iniziale del tuo corpo. Buona continuazione.";

const label = (r: string) => (r === 'SI' ? 'Avanti' : r === 'NO' ? 'Indietro' : 'Non rilevato');

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [nome, setNome] = useState(() => localStorage.getItem('av2_nome') || '');
  const [statusMsg, setStatusMsg] = useState<{ kind: string; text: string } | null>(null);
  const [esito, setEsito] = useState<Esito | null>(null);
  const motionRef = useRef<Motion | null>(null);
  const voiceRef = useRef<Voice | null>(null);
  if (!motionRef.current) motionRef.current = new Motion();
  if (!voiceRef.current) {
    voiceRef.current = new Voice();
    voiceRef.current.onStatus = (i) => setStatusMsg(i.text ? i : null);
  }
  const motion = motionRef.current!;
  const voice = voiceRef.current!;
  const goHome = () => {
    try { voice.cancel(); } catch (e) {}
    try { motion.stop(); motion.onMove = null; } catch (e) {}
    setScreen('home');
  };
  return (
    <div className="min-h-screen font-sans">
      {statusMsg && (
        <div className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center text-xs font-mono ${statusMsg.kind === 'error' ? 'bg-rose-950 text-rose-300' : 'bg-cyan-950 text-cyan-300'}`}>
          {statusMsg.text}
        </div>
      )}
      <header className="pt-8 pb-4 text-center">
        <h1 className="font-serif font-black text-2xl text-cyan-400">Analogista Virtuale</h1>
        <p className="text-[10px] uppercase tracking-widest text-gray-500">© 2026 Max Pisani - PACommunication</p>
      </header>
      {screen === 'home' && <Home nome={nome} onStart={(n: string) => { setNome(n); setScreen('calib'); }} />}
      {screen === 'calib' && <Calibrazione motion={motion} voice={voice} onHome={goHome} onDone={() => setScreen('test')} />}
      {screen === 'test' && <TestInduttore motion={motion} voice={voice} nome={nome || 'ospite'} onHome={goHome} onEsito={(e: Esito) => { setEsito(e); setScreen('esito'); }} />}
      {screen === 'esito' && esito && <EsitoScreen esito={esito} onHome={goHome} />}
    </div>
  );
}

function Home({ nome, onStart }: { nome: string; onStart: (n: string) => void }) {
  const [n, setN] = useState(nome);
  const [checked, setChecked] = useState(false);
  return (
    <div className="max-w-md mx-auto px-6 pb-16">
      <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">Nome del soggetto</label>
        <input value={n} onChange={(e) => setN(e.target.value)} placeholder="Es. Mario"
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-400" />
        <div className="text-xs text-gray-400 bg-black/30 rounded-lg p-4 h-36 overflow-y-auto">
          <p className="font-bold text-gray-200 mb-2">ACCORDO DI RISERVATEZZA (NDA)</p>
          <p>Lo strumento e' fornito "cosi' com'e" per finalita' di intrattenimento e approfondimento personale. Non costituisce dispositivo medico ne' fornisce diagnosi. L'utilizzatore si impegna a non diffondere contenuti, esiti o metodologie. I dati restano sul dispositivo e sotto la responsabilita' dell'operatore.</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" />
          Ho letto e accetto l'accordo di riservatezza.
        </label>
        <button disabled={!checked || !n.trim()} onClick={() => { localStorage.setItem('av2_nome', n.trim()); localStorage.setItem('av2_nda', '1'); onStart(n.trim()); }}
          className="w-full bg-cyan-600 disabled:bg-gray-700 disabled:text-gray-400 hover:bg-cyan-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest">
          Inizia
        </button>
      </div>
    </div>
  );
}

function CameraView({ motion, sensitivity, onCalibrated, onVoiceGuide, flash }: {
  motion: Motion; sensitivity: number; onCalibrated?: () => void; onVoiceGuide?: () => void; flash: string | null;
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
        <svg viewBox="0 0 200 300" className="h-[90%] opacity-30">
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
            className="px-5 py-2.5 bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-30 border border-indigo-400/40 rounded-xl text-[10px] font-bold uppercase tracking-widest">
            🔊 Ascolta voce guida
          </button>
        )}
      </div>
    </div>
  );
}

function Calibrazione({ motion, voice, onDone, onHome }: { motion: Motion; voice: Voice; onDone: () => void; onHome: () => void }) {
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
        <h2 className="text-lg font-serif font-black text-cyan-400">CALIBRAZIONE</h2>
        <button onClick={onHome} className="text-xs font-bold uppercase tracking-widest text-cyan-500">← Esci</button>
      </div>
      <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
        <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-gray-400">Sensibilità: {sens}%</label>
        <input type="range" min={0} max={100} value={sens} onChange={(e) => setSens(parseInt(e.target.value))} className="w-full accent-cyan-400" />
      </div>
      <CameraView motion={motion} sensitivity={sens} flash={flash}
        onVoiceGuide={() => { voice.speak(CALIB_TEXT).catch(() => {}); }}
        onCalibrated={() => setDone(true)} />
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
  const [flash, setFlash] = useState<string | null>(null);
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
      const e: Esito = { dx: label(dx), sx: label(sx), risultato };
      setFinalEsito(e);
      setMsg(risultato);
      try { motion.onMove = null; motion.stop(); } catch (err) {}
      try {
        const hist = JSON.parse(localStorage.getItem('av2_hist') || '[]');
        hist.unshift({ when: new Date().toLocaleString(), ...e });
        localStorage.setItem('av2_hist', JSON.stringify(hist.slice(0, 20)));
      } catch (err) {}
      setPhase('wait');
    } catch (e) {
      if (alive.current) { setMsg('Test interrotto.'); setPhase('calib'); }
    }
  };
  const repeat = () => { try { voice.cancel(); } catch (e) {} try { motion.stop(); motion.onMove = null; } catch (e) {} setRes({ dx: '', sx: '' }); setFinalEsito(null); setPhase('calib'); setMsg('Premi "Avvia calibrazione" sul video.'); };
  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-serif font-black text-cyan-400">TEST INDUTTORE</h2>
        <button onClick={onHome} className="text-xs font-bold uppercase tracking-widest text-cyan-500">← Esci</button>
      </div>
      <CameraView motion={motion} sensitivity={75} flash={flash} onCalibrated={() => { if (phase === 'calib') run(); }} />
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

function EsitoScreen({ esito, onHome }: { esito: Esito; onHome: () => void }) {
  return (
    <div className="max-w-md mx-auto px-6 pb-16">
      <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-6 space-y-4 text-center">
        <h2 className="text-lg font-serif font-black text-cyan-400">ESITO TEST INDUTTORE</h2>
        <p className="text-sm text-gray-400">Mano destra: <span className="text-cyan-400 font-bold">{esito.dx}</span></p>
        <p className="text-sm text-gray-400">Mano sinistra: <span className="text-cyan-400 font-bold">{esito.sx}</span></p>
        <p className="text-base text-gray-100 font-semibold">{esito.risultato}</p>
        <p className="text-[10px] text-gray-500">Dati salvati solo su questo dispositivo.</p>
        <button onClick={onHome} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest">Nuova sessione</button>
      </div>
    </div>
  );
}
