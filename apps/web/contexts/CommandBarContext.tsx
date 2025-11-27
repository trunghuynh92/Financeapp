'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface CommandBarContextType {
  isOpen: boolean;
  openCommandBar: () => void;
  closeCommandBar: () => void;
  toggleCommandBar: () => void;
}

const CommandBarContext = createContext<CommandBarContextType | undefined>(undefined);

export function CommandBarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openCommandBar = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeCommandBar = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleCommandBar = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Global keyboard shortcut: Shift+S
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Shift+S to toggle command bar
      if (event.shiftKey && event.key === 'S') {
        // Don't trigger if user is typing in an input/textarea
        const target = event.target as HTMLElement;
        const isTyping = target.tagName === 'INPUT' ||
                        target.tagName === 'TEXTAREA' ||
                        target.isContentEditable;

        if (!isTyping) {
          event.preventDefault();
          toggleCommandBar();
        }
      }

      // Escape to close
      if (event.key === 'Escape' && isOpen) {
        closeCommandBar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggleCommandBar, closeCommandBar]);

  return (
    <CommandBarContext.Provider
      value={{
        isOpen,
        openCommandBar,
        closeCommandBar,
        toggleCommandBar,
      }}
    >
      {children}
    </CommandBarContext.Provider>
  );
}

export function useCommandBar() {
  const context = useContext(CommandBarContext);
  if (context === undefined) {
    throw new Error('useCommandBar must be used within a CommandBarProvider');
  }
  return context;
}
