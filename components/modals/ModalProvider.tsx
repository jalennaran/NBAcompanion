'use client';

import { type ReactNode } from 'react';
import { ModalContextProvider, useModal } from './ModalContext';
import ModalShell from './ModalShell';
import PlayerModalContent from './PlayerModal';
import TeamModalContent from './TeamModal';

function ModalRenderer() {
  const { stack, goBack, closeAll } = useModal();
  if (stack.length === 0) return null;

  const current = stack[stack.length - 1];
  const canGoBack = stack.length > 1;

  return (
    <ModalShell onClose={closeAll} canGoBack={canGoBack} onBack={goBack}>
      {current.kind === 'player' ? (
        <PlayerModalContent athleteId={current.id} />
      ) : (
        <TeamModalContent teamId={current.id} />
      )}
    </ModalShell>
  );
}

export default function ModalProvider({ children }: { children: ReactNode }) {
  return (
    <ModalContextProvider>
      {children}
      <ModalRenderer />
    </ModalContextProvider>
  );
}
