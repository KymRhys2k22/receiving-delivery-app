import React, { createContext, useContext, useState, ReactNode } from 'react';
import { LocalAiFabModal } from '../components/LocalAiFabModal';

interface AiAssistantContextType {
  isOpen: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
}

const AiAssistantContext = createContext<AiAssistantContextType>({
  isOpen: false,
  openAssistant: () => {},
  closeAssistant: () => {},
  toggleAssistant: () => {},
});

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openAssistant = () => setIsOpen(true);
  const closeAssistant = () => setIsOpen(false);
  const toggleAssistant = () => setIsOpen((prev) => !prev);

  return (
    <AiAssistantContext.Provider
      value={{ isOpen, openAssistant, closeAssistant, toggleAssistant }}>
      {children}
      <LocalAiFabModal
        isOpenControlled={isOpen}
        onCloseControlled={closeAssistant}
        hideFab={true}
        tableName="dlr_records"
        selectFields="*"
        localStorageKeys={[
          'manifest_cids',
          'scanned_cids',
          'manifest_items',
          'scanned_items',
          'item_expiry_dates',
        ]}
      />
    </AiAssistantContext.Provider>
  );
}

export function useAiAssistant() {
  return useContext(AiAssistantContext);
}
