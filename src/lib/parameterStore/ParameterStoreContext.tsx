/**
 * Parameter Store React Context
 *
 * Provides React context for parameter management with caching
 */

"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
} from "react";
import { parameterStore } from "./index";
import type {
  ParameterKey,
  ParameterFetchOptions,
  ParameterStoreConfig,
} from "@/types/parameters";
import { ParameterStoreError, PUBLIC_PARAMETERS, SECURE_PARAMETERS } from "@/types/parameters";

interface ParameterStoreContextValue {
  /** Get a parameter value */
  getParameter: (
    key: ParameterKey,
    options?: ParameterFetchOptions
  ) => Promise<string>;

  /** Get multiple parameters */
  getParameters: (
    keys: ParameterKey[],
    options?: ParameterFetchOptions
  ) => Promise<Record<string, string>>;

  /** Clear cache for specific key or all */
  clearCache: (key?: ParameterKey) => void;

  /** Check if initialized */
  isInitialized: boolean;

  /** Loading state for initialization */
  isInitializing: boolean;

  /** Initialization error if any */
  initError: Error | null;
}

const ParameterStoreContext = createContext<
  ParameterStoreContextValue | undefined
>(undefined);

interface ParameterStoreProviderProps {
  children: React.ReactNode;

  /** Configuration for Parameter Store client */
  config: ParameterStoreConfig;

  /**
   * Optional: Pre-fetch these parameters on initialization
   * Improves performance by warming up the cache
   */
  prefetchKeys?: ParameterKey[];
}

/**
 * Parameter Store Provider Component
 *
 * Wrap your app with this provider to enable useParameter hook
 *
 * @example
 * ```tsx
 * <ParameterStoreProvider
 *   config={{
 *     region: 'us-east-1',
 *     environment: 'dev',
 *     prefix: '/panther-kolab',
 *     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
 *     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
 *   }}
 *   prefetchKeys={['cognito/user-pool-id', 'cognito/client-id']}
 * >
 *   <App />
 * </ParameterStoreProvider>
 * ```
 */
export function ParameterStoreProvider({
  children,
  config,
  prefetchKeys = [],
}: ParameterStoreProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<Error | null>(null);

  // Initialize on mount
  useEffect(() => {
    const initializeClient = async () => {
      try {
        setIsInitializing(true);
        setInitError(null);

        // Initialize the client
        parameterStore.initialize(config);

        // Pre-fetch parameters if specified
        if (prefetchKeys.length > 0) {
          process.env.NODE_ENV != "production" &&
            console.log(
              `[ParameterStore] Pre-fetching ${prefetchKeys.length} parameters...`
            );
          await parameterStore.getParameters(prefetchKeys);
          process.env.NODE_ENV != "production" &&
            console.log("[ParameterStore] Pre-fetch complete");
        }

        setIsInitialized(true);
      } catch (error) {
        const err =
          error instanceof Error
            ? error
            : new Error("Failed to initialize Parameter Store");
        setInitError(err);
        console.error("[ParameterStore] Initialization failed:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeClient();
  }, [config, prefetchKeys]);

  const getParameter = useCallback(
    async (
      key: ParameterKey,
      options?: ParameterFetchOptions
    ): Promise<string> => {
      if (!isInitialized) {
        throw new ParameterStoreError(
          "Parameter Store not initialized yet",
          "NOT_INITIALIZED"
        );
      }

      // Security check: Prevent accessing secure parameters in client code
      if (SECURE_PARAMETERS.has(key)) {
        const error = new ParameterStoreError(
          `Access denied: '${key}' is a secure parameter and cannot be accessed in browser code. ` +
          `Use an API endpoint instead to fetch this value server-side.`,
          "SECURE_PARAMETER_ACCESS_DENIED",
          key
        );
        console.error(
          `[ParameterStore] Security violation: Attempted to access secure parameter '${key}' in client code`
        );
        throw error;
      }

      // Warning log (don't expose parameter value, only key)
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[ParameterStore] Fetching parameter: ${key} (public parameter)`
        );
      }

      return parameterStore.getParameter(key, options);
    },
    [isInitialized]
  );

  const getParameters = useCallback(
    async (
      keys: ParameterKey[],
      options?: ParameterFetchOptions
    ): Promise<Record<string, string>> => {
      if (!isInitialized) {
        throw new ParameterStoreError(
          "Parameter Store not initialized yet",
          "NOT_INITIALIZED"
        );
      }

      // Security check: Prevent accessing secure parameters in client code
      const secureKeysRequested = keys.filter((key) => SECURE_PARAMETERS.has(key));
      if (secureKeysRequested.length > 0) {
        const error = new ParameterStoreError(
          `Access denied: The following parameters are secure and cannot be accessed in browser code: ${secureKeysRequested.join(", ")}. ` +
          `Use API endpoints instead to fetch these values server-side.`,
          "SECURE_PARAMETER_ACCESS_DENIED"
        );
        console.error(
          `[ParameterStore] Security violation: Attempted to access secure parameters in client code: ${secureKeysRequested.join(", ")}`
        );
        throw error;
      }

      // Warning log (don't expose parameter values, only keys)
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[ParameterStore] Fetching ${keys.length} parameters (all public)`
        );
      }

      return parameterStore.getParameters(keys, options);
    },
    [isInitialized]
  );

  const clearCache = useCallback((key?: ParameterKey) => {
    parameterStore.clearCache(key);
  }, []);

  const value: ParameterStoreContextValue = {
    getParameter,
    getParameters,
    clearCache,
    isInitialized,
    isInitializing,
    initError,
  };

  // Show loading or error state if needed
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Initializing Parameter Store...</p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-md p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-red-800 text-xl font-bold mb-2">
            Initialization Error
          </h2>
          <p className="text-red-600 mb-4">{initError.message}</p>
          <p className="text-sm text-red-500">
            Check your AWS credentials and permissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ParameterStoreContext.Provider value={value}>
      {children}
    </ParameterStoreContext.Provider>
  );
}

/**
 * Hook to access Parameter Store context
 *
 * Must be used within ParameterStoreProvider
 *
 * @throws Error if used outside provider
 */
export function useParameterStoreContext(): ParameterStoreContextValue {
  const context = useContext(ParameterStoreContext);

  if (!context) {
    throw new Error(
      "useParameterStoreContext must be used within ParameterStoreProvider"
    );
  }

  return context;
}
