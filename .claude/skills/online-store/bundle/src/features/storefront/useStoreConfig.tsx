import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import * as api from '@/lib/api';
import type { StoreConfig } from '@/types/database';

interface StoreConfigContextValue {
  config: StoreConfig | null;
  loading: boolean;
  formatPrice: (price: number) => string;
}

export const StoreConfigContext = createContext<StoreConfigContextValue>({
  config: null,
  loading: true,
  formatPrice: (p) => `£${p.toFixed(2)}`,
});

export function useStoreConfig() {
  return useContext(StoreConfigContext);
}

export function StoreConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.fetchStoreConfig()
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatPrice = useCallback(
    (price: number) => `${config?.currency_symbol || '£'}${Number(price).toFixed(2)}`,
    [config]
  );

  return (
    <StoreConfigContext.Provider value={{ config, loading, formatPrice }}>
      {children}
    </StoreConfigContext.Provider>
  );
}
