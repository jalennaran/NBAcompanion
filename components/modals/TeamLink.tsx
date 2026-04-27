'use client';

import { type MouseEvent, type ReactNode } from 'react';
import { useModal } from './ModalContext';

interface TeamLinkProps {
  teamId: string;
  children: ReactNode;
  className?: string;
}

export default function TeamLink({ teamId, children, className }: TeamLinkProps) {
  const { openTeam } = useModal();

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openTeam(teamId);
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
