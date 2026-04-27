'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ModalEntry =
  | { kind: 'player'; id: string }
  | { kind: 'team'; id: string };

interface ModalContextValue {
  stack: ModalEntry[];
  openPlayer: (id: string) => void;
  openTeam: (id: string) => void;
  goBack: () => void;
  closeAll: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used inside ModalProvider');
  return ctx;
}

export function ModalContextProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ModalEntry[]>([]);

  const openPlayer = useCallback((id: string) => {
    setStack(prev => [...prev, { kind: 'player', id }]);
  }, []);

  const openTeam = useCallback((id: string) => {
    setStack(prev => [...prev, { kind: 'team', id }]);
  }, []);

  const goBack = useCallback(() => {
    setStack(prev => prev.slice(0, -1));
  }, []);

  const closeAll = useCallback(() => {
    setStack([]);
  }, []);

  return (
    <ModalContext.Provider value={{ stack, openPlayer, openTeam, goBack, closeAll }}>
      {children}
    </ModalContext.Provider>
  );
}
