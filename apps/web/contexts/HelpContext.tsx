'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface HelpContextType {
  isOpen: boolean;
  currentSection: string;
  openHelp: (section?: string) => void;
  closeHelp: () => void;
  navigateTo: (section: string) => void;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState('getting-started/welcome');

  const openHelp = useCallback((section?: string) => {
    if (section) {
      setCurrentSection(section);
    }
    setIsOpen(true);
  }, []);

  const closeHelp = useCallback(() => {
    setIsOpen(false);
  }, []);

  const navigateTo = useCallback((section: string) => {
    setCurrentSection(section);
  }, []);

  return (
    <HelpContext.Provider
      value={{
        isOpen,
        currentSection,
        openHelp,
        closeHelp,
        navigateTo,
      }}
    >
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const context = useContext(HelpContext);
  if (context === undefined) {
    throw new Error('useHelp must be used within a HelpProvider');
  }
  return context;
}
