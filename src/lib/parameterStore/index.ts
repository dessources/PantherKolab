/**
 * AWS Parameter Store Client
 *
 * Provides on-demand parameter fetching with caching.
 * Authentication uses only AWS Access Key ID and Secret Access Key.
 *
 * Usage:
 *   const client = ParameterStoreClient.getInstance();
 *   const value = await client.getParameter('cognito/user-pool-id');
 */

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import type {
  ParameterKey,
  Parameter,
  ParameterCache,
  ParameterStoreConfig,
  ParameterFetchOptions,
} from "@/types/parameters";
import { ParameterStoreError } from "@/types/parameters";
import { PARAMETER_STORE_PREFIX } from "@/utils";

/**
 * Singleton Parameter Store Client
 */
export class ParameterStoreClient {
  private static instance: ParameterStoreClient | null = null;
  private ssmClient: SSMClient | null = null;
  private cache: ParameterCache = {};
  private config: ParameterStoreConfig | null = null;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ParameterStoreClient {
    if (!ParameterStoreClient.instance) {
      ParameterStoreClient.instance = new ParameterStoreClient();
    }
    return ParameterStoreClient.instance;
  }

  /**
   * Initialize the client with configuration
   * Must be called before using getParameter
   */
  public initialize(config: ParameterStoreConfig): void {
    this.config = config;

    // Create SSM client with credentials
    this.ssmClient = new SSMClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    console.log(
      `[ParameterStore] Initialized for environment: ${config.environment}`
    );
  }

  /**
   * Check if client is initialized
   */
  private ensureInitialized(): void {
    if (!this.ssmClient || !this.config) {
      throw new ParameterStoreError(
        "ParameterStoreClient not initialized. Call initialize() first.",
        "NOT_INITIALIZED"
      );
    }
  }

  /**
   * Build full parameter path
   */
  private buildParameterPath(key: ParameterKey): string {
    if (!this.config) {
      throw new ParameterStoreError("Configuration not set", "NO_CONFIG");
    }
    return `${this.config.prefix}/${this.config.environment}/${key}`;
  }

  /**
   * Check if cached parameter is still valid
   */
  private isCacheValid(parameter: Parameter, ttl: number): boolean {
    const age = Date.now() - parameter.lastFetched.getTime();
    return age < ttl;
  }

  /**
   * Fetch parameter from AWS Parameter Store
   */
  private async fetchFromAWS(
    key: ParameterKey,
    withDecryption: boolean = true
  ): Promise<Parameter> {
    this.ensureInitialized();

    const parameterPath = this.buildParameterPath(key);

    try {
      console.log(parameterPath);
      const command = new GetParameterCommand({
        Name: parameterPath,
        WithDecryption: withDecryption,
      });

      const response = await this.ssmClient!.send(command);

      if (!response.Parameter || !response.Parameter.Value) {
        throw new ParameterStoreError(
          `Parameter not found: ${parameterPath}`,
          "PARAMETER_NOT_FOUND",
          key
        );
      }

      const parameter: Parameter = {
        key,
        value: response.Parameter.Value,
        type: response.Parameter.Type as "String" | "SecureString",
        lastFetched: new Date(),
      };

      // Cache the parameter
      this.cache[key] = parameter;

      console.log(`[ParameterStore] Fetched: ${key}`);
      return parameter;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Handle AWS SDK errors
      if (error.name === "ParameterNotFound") {
        throw new ParameterStoreError(
          `Parameter not found in AWS: ${parameterPath}`,
          "PARAMETER_NOT_FOUND",
          key
        );
      }

      if (error.name === "AccessDeniedException") {
        console.log(error.message);
        throw new ParameterStoreError(
          `Access denied for parameter: ${parameterPath}. Check IAM permissions.`,
          "ACCESS_DENIED",
          key
        );
      }

      if (error instanceof ParameterStoreError) {
        throw error;
      }

      // Generic error
      throw new ParameterStoreError(
        `Failed to fetch parameter ${key}: ${error.message}`,
        "FETCH_ERROR",
        key
      );
    }
  }

  /**
   * Get parameter value (from cache or AWS)
   *
   * @param key - Parameter key
   * @param options - Fetch options
   * @returns Parameter value as string
   */
  public async getParameter(
    key: ParameterKey,
    options: ParameterFetchOptions = {}
  ): Promise<string> {
    const {
      refresh = false,
      ttl = this.DEFAULT_TTL,
      withDecryption = true,
    } = options;

    // Check cache first
    const cached = this.cache[key];
    if (cached && !refresh && this.isCacheValid(cached, ttl)) {
      console.log(`[ParameterStore] Using cached: ${key}`);
      return cached.value;
    }

    // Fetch from AWS
    const parameter = await this.fetchFromAWS(key, withDecryption);
    return parameter.value;
  }

  /**
   * Get multiple parameters at once
   * Fetches in parallel for efficiency
   */
  public async getParameters(
    keys: ParameterKey[],
    options: ParameterFetchOptions = {}
  ): Promise<Record<string, string>> {
    const promises = keys.map(async (key) => ({
      key,
      value: await this.getParameter(key, options),
    }));

    const results = await Promise.all(promises);

    return results.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
  }

  /**
   * Clear cache for a specific parameter
   */
  public clearCache(key?: ParameterKey): void {
    if (key) {
      delete this.cache[key];
      console.log(`[ParameterStore] Cleared cache for: ${key}`);
    } else {
      this.cache = {};
      console.log("[ParameterStore] Cleared all cache");
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    keys: ParameterKey[];
    oldestEntry: Date | null;
  } {
    const keys = Object.keys(this.cache) as ParameterKey[];
    const oldestEntry =
      keys.length > 0
        ? new Date(
            Math.min(...keys.map((k) => this.cache[k]!.lastFetched.getTime()))
          )
        : null;

    return {
      size: keys.length,
      keys,
      oldestEntry,
    };
  }

  /**
   * Check if client is ready to use
   */
  public isInitialized(): boolean {
    return this.ssmClient !== null && this.config !== null;
  }

  /**
   * Get current configuration (without sensitive data)
   */
  public getConfig(): Omit<
    ParameterStoreConfig,
    "accessKeyId" | "secretAccessKey"
  > | null {
    if (!this.config) return null;

    return {
      region: this.config.region,
      environment: this.config.environment,
      prefix: this.config.prefix,
    };
  }
}

/**
 * Export singleton instance
 */

const instance = ParameterStoreClient.getInstance();
instance.initialize({
  region: process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  environment: process.env.NODE_ENV == "production" ? "prod" : "dev",
  prefix: PARAMETER_STORE_PREFIX,
});

export const parameterStore = instance;
