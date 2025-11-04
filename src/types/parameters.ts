/**
 * Parameter Store Configuration Types
 * Defines all available parameters in AWS Parameter Store
 */

/**
 * All available parameter keys in Parameter Store
 * Path format: /panther-kolab/{environment}/{key}
 */
export type ParameterKey =
  // AWS Configuration
  | "aws-region"

  // Cognito Parameters
  | "cognito/user-pool-id"
  | "cognito/client-id"
  | "cognito/domain"

  // DynamoDB Tables
  | "dynamodb/users-table"
  | "dynamodb/conversations-table"
  | "dynamodb/messages-table"
  | "dynamodb/groups-table"

  // DynamoDB Tables (Chime)
  | "dynamodb/meetings-table"
  | "dynamodb/call-sessions-table"
  | "dynamodb/meeting-invites-table"
  | "dynamodb/meeting-attendees-table"

  // Application URLs
  | "app-urls/redirect-sign-in"
  | "app-urls/redirect-sign-out"

  //Chime config
  | "chime/max-attendees"
  | "chime/endpoint"

  // AppSync (GraphQL)
  | "appsync/graphql-endpoint"
  | "appsync/api-key"
  | "appsync/region";

/**
 * Parameter value type
 */
export interface Parameter {
  key: ParameterKey;
  value: string;
  type: "String" | "SecureString";
  lastFetched: Date;
}

/**
 * Parameter cache structure
 */
export type ParameterCache = Partial<Record<ParameterKey, Parameter>>;

/**
 * Parameter Store client configuration
 */
export interface ParameterStoreConfig {
  region: string;
  environment: "dev" | "staging" | "prod";
  prefix: string; // e.g., '/panther-kolab'

  // Authentication - only access key/secret needed
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Parameter fetch options
 */
export interface ParameterFetchOptions {
  /** Force fetch even if cached */
  refresh?: boolean;

  /** Cache TTL in milliseconds (default: 5 minutes) */
  ttl?: number;

  /** Decrypt SecureString parameters */
  withDecryption?: boolean;
}

/**
 * Parameter Store error types
 */
export class ParameterStoreError extends Error {
  constructor(
    message: string,
    public code?: string,
    public parameterKey?: ParameterKey
  ) {
    super(message);
    this.name = "ParameterStoreError";
  }
}
