import { useState, useEffect, useCallback } from 'react';

/**
 * Hook per gestire la sensibilità del motion tracker
 * @param initialSensitivity - Valore iniziale (0-100)
 * @returns [sensitivity, setSensitivity]
 */
export function useSensitivity(initialSensitivity: number = 75): [number, (value: number) => void] {
  const [sensitivity, setSensitivityState] = useState(initialSensitivity);
  
  const setSensitivity = useCallback((value: number) => {
    setSensitivityState(Math.min(100, Math.max(0, value)));
  }, []);
  
  return [sensitivity, setSensitivity];
}

/**
 * Hook per gestire lo stato di countdown
 * @param duration - Durata in secondi
 * @param onComplete - Callback quando il countdown finisce
 * @returns [countdown, isRunning, start, stop]
 */
export function useCountdown(
  duration: number,
  onComplete?: () => void
): [number, boolean, () => void, () => void] {
  const [countdown, setCountdown] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  
  const start = useCallback(() => {
    if (isRunning) return;
    
    setIsRunning(true);
    setCountdown(duration);
    
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsRunning(false);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [duration, isRunning, onComplete]);
  
  const stop = useCallback(() => {
    setIsRunning(false);
    setCountdown(0);
  }, []);
  
  return [countdown, isRunning, start, stop];
}

/**
 * Hook per gestire la cleanup delle risorse al unmount
 * @param cleanupFn - Funzione di cleanup da eseguire
 */
export function useCleanup(cleanupFn: () => void): void {
  useEffect(() => {
    return () => {
      cleanupFn();
    };
  }, [cleanupFn]);
}

/**
 * Hook per gestire uno storico di dati in localStorage
 * @param key - Chiave localStorage
 * @param maxItems - Numero massimo di elementi da mantenere
 * @returns [history, addItem, clearHistory]
 */
export function useHistory<T>(key: string, maxItems: number = 20) {
  const [history, setHistory] = useState<T[]>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  const addItem = useCallback((item: T) => {
    setHistory((prev) => {
      const updated = [item, ...prev].slice(0, maxItems);
      try {
        localStorage.setItem(key, JSON.stringify(updated));
      } catch {
        // Ignora errori di localStorage
      }
      return updated;
    });
  }, [key, maxItems]);
  
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignora errori di localStorage
    }
  }, [key]);
  
  return [history, addItem, clearHistory] as const;
}
