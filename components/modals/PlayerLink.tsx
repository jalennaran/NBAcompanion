'use client';

import { type MouseEvent, type ReactNode } from 'react';
import { useModal } from './ModalContext';

interface PlayerLinkProps {
  athleteId: string;
  children: ReactNode;
  className?: string;
}

export default function PlayerLink({ athleteId, children, className }: PlayerLinkProps) {
  const { openPlayer } = useModal();

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openPlayer(athleteId);
  };

  return (
    <button
      onClick={handleClick}
      className={`text-left hover:brightness-125 hover:opacity-90 transition-all cursor-pointer ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
