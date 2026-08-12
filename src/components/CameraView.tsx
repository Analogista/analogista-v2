import React, { useRef, useEffect, useState } from 'react';
import type { MotionTracker } from '../../utils/motion-tracker';

interface CameraViewProps {
  motion: MotionTracker;
  sensitivity: number;
  flash: string | null;
  onCalibrated?: () => void;
  onVoiceGuide?: () => void;
}

/**
 * Componente per la visualizzazione della camera con overlay di calibrazione
 */
export const CameraView: React.FC<CameraViewProps> = ({
  motion,
  sensitivity,
  flash,
  onCalibrated,
  onVoiceGuide,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [calibrating, setCalibrating] = useState(false);

  // Inizializza la camera e il motion tracker
  useEffect(() => {
    let cancelled = false;

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });

        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();

        await motion.init(video);
        motion.setSensitivity(sensitivity);
        motion.start();

        if (!cancelled) setReady(true);
      } catch (error) {
        if (!cancelled) {
          setCamError('Permesso fotocamera negato o hardware non disponibile.');
        }
      }
    };

    initCamera();

    return () => {
      cancelled = true;
      motion.stop();
      const v = videoRef.current;
      if (v && v.srcObject) {
        (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, [motion]);

  // Aggiorna sensibilità quando cambia
  useEffect(() => {
    motion.setSensitivity(sensitivity);
  }, [sensitivity, motion]);

  // Gestisce la calibrazione con countdown
  const handleCalibrate = () => {
    if (calibrating || !ready) return;

    setCalibrating(true);
    motion.stop();
    setCountdown(5);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeout(() => {
            motion.start();
            motion.calibrate();
            setCalibrating(false);
            onCalibrated?.();
          }, 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto h-[420px] sm:h-[520px] bg-black rounded-3xl overflow-hidden border border-white/10">
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover -scale-x-100"
      />

      {/* Overlay sagoma corpo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg viewBox="0 0 200 300" className="h-[90%] opacity-30">
          <path
            d="M100,50 C80,50 70,70 70,90 C70,110 80,130 100,130 C120,130 130,110 130,90 C130,70 120,50 100,50 M70,140 C40,140 20,180 20,220 L20,300 L180,300 L180,220 C180,180 160,140 130,140 L70,140"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
        </svg>
      </div>

      {/* Status badge */}
      <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/70 border border-white/10 text-[10px] font-mono uppercase tracking-wider">
        {calibrating
          ? `CALIBRAZIONE (${countdown}s)`
          : ready
          ? 'PRONTO'
          : camError
          ? 'ERRORE CAMERA'
          : 'ATTESA…'}
      </div>

      {/* Flash indicatore direzione */}
      {flash && (
        <div
          className={`absolute top-4 right-4 px-6 py-2 rounded-2xl border-2 text-3xl font-black ${
            flash === 'SI'
              ? 'border-green-400 text-green-400'
              : 'border-rose-500 text-rose-500'
          }`}
        >
          {flash}
        </div>
      )}

      {/* Overlay countdown */}
      {calibrating && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="text-white text-[9rem] font-black">{countdown}</div>
        </div>
      )}

      {/* Errore camera */}
      {camError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/90 p-6 text-center text-rose-400 text-sm">
          {camError}
        </div>
      )}

      {/* Controlli */}
      <div className="absolute bottom-4 inset-x-4 flex justify-center gap-3 flex-wrap">
        <button
          onClick={handleCalibrate}
          disabled={!ready || calibrating}
          className="px-5 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest"
        >
          {calibrating ? 'Calibrazione…' : '▶ Avvia calibrazione'}
        </button>

        {onVoiceGuide && (
          <button
            onClick={onVoiceGuide}
            disabled={!ready || calibrating}
            className="px-5 py-2.5 bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-30 border border-indigo-400/40 rounded-xl text-[10px] font-bold uppercase tracking-widest"
          >
            🔊 Ascolta voce guida
          </button>
        )}
      </div>
    </div>
  );
};
