import React, { createContext, useState, useContext, ReactNode } from 'react';

interface AuthContextType {
  isSignedIn: boolean;
  operatorId: string;
  storeCode: string;
  loginDate: string;
  signIn: (operatorId: string, storeCode: string, date: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [operatorId, setOperatorId] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [loginDate, setLoginDate] = useState('');

  const signIn = (opId: string, store: string, dateStr: string) => {
    setOperatorId(opId);
    setStoreCode(store);
    setLoginDate(dateStr);
    setIsSignedIn(true);
  };

  const signOut = () => {
    setOperatorId('');
    setStoreCode('');
    setLoginDate('');
    setIsSignedIn(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isSignedIn,
        operatorId,
        storeCode,
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
