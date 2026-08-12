import React, { useEffect, useRef, useState } from 'react';
import { MotionTracker } from './utils/motion-tracker';
import { VoiceSynthesizer } from './utils/voice-synthesizer';
import type { TestResult } from './components';
import {
  HomeScreen,
  CalibrationScreen,
  InductorTestScreen,
  ResultScreen,
} from './components';

type Screen = 'home' | 'calib' | 'test' | 'esito';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [nome, setNome] = useState(() => localStorage.getItem('av2_nome') || '');
  const [statusMsg, setStatusMsg] = useState<{ kind: string; text: string } | null>(null);
  const [esito, setEsito] = useState<TestResult | null>(null);
  const motionRef = useRef<MotionTracker | null>(null);
  const voiceRef = useRef<VoiceSynthesizer | null>(null);
  
  if (!motionRef.current) motionRef.current = new MotionTracker();
  if (!voiceRef.current) {
    voiceRef.current = new VoiceSynthesizer();
    voiceRef.current.onStatus = (info) => setStatusMsg(info.text ? info : null);
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
        <div className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center text-xs font-mono ${
          statusMsg.kind === 'error' ? 'bg-rose-950 text-rose-300' : 'bg-cyan-950 text-cyan-300'
        }`}>
          {statusMsg.text}
        </div>
      )}
      <header className="pt-8 pb-4 text-center">
        <h1 className="font-serif font-black text-2xl text-cyan-400">Analogista Virtuale</h1>
        <p className="text-[10px] uppercase tracking-widest text-gray-500">© 2026 Max Pisani - PACommunication</p>
      </header>
      {screen === 'home' && <HomeScreen nome={nome} onStart={(n: string) => { setNome(n); setScreen('calib'); }} />}
      {screen === 'calib' && <CalibrationScreen motion={motion} voice={voice} onHome={goHome} onDone={() => setScreen('test')} />}
      {screen === 'test' && <InductorTestScreen motion={motion} voice={voice} nome={nome || 'ospite'} onHome={goHome} onEsito={(e: TestResult) => { setEsito(e); setScreen('esito'); }} />}
      {screen === 'esito' && esito && <ResultScreen esito={esito} onHome={goHome} />}
    </div>
  );
}
