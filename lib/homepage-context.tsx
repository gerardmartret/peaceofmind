'use client';

import { createContext, useContext, ReactNode, useState } from 'react';

interface HomepageContextType {
  resetToImport: (() => void) | null;
  setResetToImport: (fn: (() => void) | null) => void;
}

const HomepageContext = createContext<HomepageContextType>({
  resetToImport: null,
  setResetToImport: () => {},
});

export const useHomepageContext = () => {
  const context = useContext(HomepageContext);
  if (!context) {
    throw new Error('useHomepageContext must be used within a HomepageProvider');
  }
  return context;
};

export const HomepageProvider = ({ children }: { children: ReactNode }) => {
  const [resetToImport, setResetToImport] = useState<(() => void) | null>(null);

  return (
    <HomepageContext.Provider value={{ resetToImport, setResetToImport }}>
      {children}
    </HomepageContext.Provider>
  );
};
