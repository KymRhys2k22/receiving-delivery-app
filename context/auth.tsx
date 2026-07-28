import React, { createContext, useState, useContext, ReactNode } from 'react';

interface AuthContextType {
  isSignedIn: boolean;
  operatorId: string;
  storeCode: string;
  storeName: string;
  loginDate: string;
  signIn: (operatorId: string, storeCode: string, storeName: string, date: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [operatorId, setOperatorId] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [storeName, setStoreName] = useState('');
  const [loginDate, setLoginDate] = useState('');

  const signIn = (opId: string, store: string, sName: string, dateStr: string) => {
    setOperatorId(opId);
    setStoreCode(store);
    setStoreName(sName);
    setLoginDate(dateStr);
    setIsSignedIn(true);
  };

  const signOut = () => {
    setOperatorId('');
    setStoreCode('');
    setStoreName('');
    setLoginDate('');
    setIsSignedIn(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isSignedIn,
        operatorId,
        storeCode,
        storeName,
        loginDate,
        signIn,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
