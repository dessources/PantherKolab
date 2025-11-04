# Parameter Store Implementation Guide

## Overview

PantherKolab now uses AWS Parameter Store for centralized configuration management instead of `.env` files. This provides better security, team collaboration, and environment management.

## What Was Created

### 1. Core Files

- **[src/types/parameters.ts](../src/types/parameters.ts)** - TypeScript types for all parameters
- **[src/lib/parameterStore/index.ts](../src/lib/parameterStore/index.ts)** - Main Parameter Store client (Singleton)
- **[src/lib/parameterStore/ParameterStoreContext.tsx](../src/lib/parameterStore/ParameterStoreContext.tsx)** - React Context Provider
- **[src/hooks/useParameter.ts](../src/hooks/useParameter.ts)** - React hooks for components

### 2. Scripts

- **[scripts/setup-parameter-store.sh](../scripts/setup-parameter-store.sh)** - Interactive script to create parameters in AWS
- **[scripts/fetch-parameters.sh](../scripts/fetch-parameters.sh)** - Fetch parameters and create `.env.local`

### 3. Documentation

- **[src/lib/parameterStore/README.md](../src/lib/parameterStore/README.md)** - Complete API documentation
- **[src/lib/parameterStore/EXAMPLE_USAGE.tsx](../src/lib/parameterStore/EXAMPLE_USAGE.tsx)** - Code examples
- **[scripts/PARAMETER_STORE_README.md](../scripts/PARAMETER_STORE_README.md)** - Script usage guide

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  React Component                        │
│  const { value } = useParameter('cognito/user-pool-id') │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│            ParameterStoreContext                        │
│  - Provides React context                               │
│  - Manages loading states                               │
│  - Handles errors                                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│         ParameterStoreClient (Singleton)                │
│  - On-demand fetching                                   │
│  - In-memory caching (5 min TTL)                        │
│  - Cache management                                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              AWS SSM Client                             │
│  - Authentication: Access Key + Secret                  │
│  - Fetches from Parameter Store                         │
│  - Decrypts SecureString parameters                     │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│        AWS Parameter Store                              │
│  /panther-kolab/dev/cognito/user-pool-id                │
│  /panther-kolab/dev/cognito/client-id                   │
│  /panther-kolab/dev/dynamodb/users-table                │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Authentication

**Only uses AWS Access Key ID and Secret Access Key:**

```bash
# .env.local (only these two needed)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

### 2. On-Demand Fetching

Parameters are fetched **only when requested**:

```tsx
// First request: Fetches from AWS (~100ms)
const { value } = useParameter("cognito/user-pool-id");

// Second request (within 5 min): Returns from cache (~1ms)
const { value } = useParameter("cognito/user-pool-id");
```

### 3. Caching

- **Default TTL**: 5 minutes
- **Storage**: In-memory (per instance)
- **Invalidation**: Manual or TTL expiration
- **Refresh**: Force fetch with `refresh: true` option

### 4. Pre-fetching

Warm up the cache during app initialization:

```tsx
<ParameterStoreProvider
  config={config}
  prefetchKeys={["cognito/user-pool-id", "cognito/client-id"]}
>
  <App />
</ParameterStoreProvider>
```

## Quick Start

### Step 1: Create Parameters in AWS

```bash
cd scripts
chmod +x setup-parameter-store.sh
./setup-parameter-store.sh
```

Enter when prompted:

- Region: `us-east-1`
- Environment: `dev`
- Parameter name: `cognito/user-pool-id`
- Value: `us-east-1_4fWvgNvC3`
- Sensitive: `n`
- (Repeat for each parameter)
- Type `quit` when done

### Step 2: Set Up AWS Credentials

Add to `.env.local`:

```bash
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
```

### Step 3: Wrap Your App

```tsx
// src/app/layout.tsx
import { ParameterStoreProvider } from "@/lib/parameterStore/ParameterStoreContext";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ParameterStoreProvider
          config={{
            region: process.env.AWS_REGION!,
            environment: "dev",
            prefix: "/panther-kolab",
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          }}
          prefetchKeys={["cognito/user-pool-id", "cognito/client-id"]}
        >
          {children}
        </ParameterStoreProvider>
      </body>
    </html>
  );
}
```

### Step 4: Use in Components

```tsx
"use client";

import { useParameter } from "@/hooks/useParameter";

export function MyComponent() {
  const { value, loading, error } = useParameter("cognito/user-pool-id");

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>User Pool: {value}</div>;
}
```

## Team Collaboration

### IAM Setup for Team Members

Each team member gets their own IAM user:

1. **Create IAM User** in AWS Console:

   - Username: `panther-dev-{name}` (e.g., `panther-dev-john`)
   - Access type: Programmatic access

2. **Attach Policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParametersByPath"],
      "Resource": "arn:aws:ssm:us-east-1:*:parameter/panther-kolab/*"
    },
    {
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "ssm.us-east-1.amazonaws.com"
        }
      }
    }
  ]
}
```

3. **Generate Access Keys**
4. **Share with team member** (securely)

### For CI/CD

Create a separate IAM user:

- Username: `panther-kolab-dev`
- Same policy as above
- Add credentials to GitHub Secrets or CI/CD environment

## Available Parameters

All parameters are defined in [src/types/parameters.ts](../src/types/parameters.ts):

| Parameter                      | Description                  | Example Value                                             |
| ------------------------------ | ---------------------------- | --------------------------------------------------------- |
| `cognito/user-pool-id`         | Cognito User Pool ID         | `us-east-1_4fWvgNvC3`                                     |
| `cognito/client-id`            | Cognito App Client ID        | `2fahfmaruotenn36...`                                     |
| `cognito/domain`               | Cognito Domain URL           | `https://...auth.us-east-1.amazoncognito.com`             |
| `dynamodb/users-table`         | DynamoDB Users table         | `PantherKolab-Users-dev`                                  |
| `dynamodb/conversations-table` | DynamoDB Conversations table | `PantherKolab-Conversations-dev`                          |
| `dynamodb/messages-table`      | DynamoDB Messages table      | `PantherKolab-Messages-dev`                               |
| `dynamodb/groups-table`        | DynamoDB Groups table        | `PantherKolab-Groups-dev`                                 |
| `app-urls/redirect-sign-in`    | Post-login redirect          | `http://localhost:3000/`                                  |
| `app-urls/redirect-sign-out`   | Post-logout redirect         | `http://localhost:3000/auth/login`                        |
| `appsync/graphql-endpoint`     | AppSync endpoint             | `https://xxx.appsync-api.us-east-1.amazonaws.com/graphql` |
| `appsync/api-key`              | AppSync API key              | `da2-xxx`                                                 |

## API Reference

### Hooks

#### `useParameter(key, options?)`

Fetch a single parameter.

```tsx
const { value, loading, error, refresh } = useParameter("cognito/user-pool-id");
```

#### `useParameters(keys, options?)`

Fetch multiple parameters.

```tsx
const { values, loading, error, refresh } = useParameters([
  "cognito/user-pool-id",
  "cognito/client-id",
]);
```

#### `useParameterWithFallback(key, fallback, options?)`

Fetch parameter with fallback value.

```tsx
const url = useParameterWithFallback(
  "app-urls/redirect-sign-in",
  "http://localhost:3000/"
);
```

### Client Methods

#### `parameterStore.initialize(config)`

Initialize the client (required before use).

#### `parameterStore.getParameter(key, options?)`

Fetch a single parameter (async).

#### `parameterStore.getParameters(keys, options?)`

Fetch multiple parameters (async).

#### `parameterStore.clearCache(key?)`

Clear cache (specific key or all).

## Security

### ✅ Do's

- Store AWS credentials in `.env.local`
- Use separate IAM users for each team member
- Mark sensitive parameters as SecureString
- Rotate access keys regularly
- Use least privilege IAM policies

### ❌ Don'ts

- Never commit `.env.local` to git
- Never hardcode access keys in code
- Never share access keys between team members
- Never use root AWS credentials

## Costs

**With AWS-managed KMS key (default):**

- Storage: **FREE** (up to 10,000 parameters)
- API calls: **$0.05 per 10,000 calls**
- KMS decryption: **FREE** (with AWS-managed key)

**Estimated for PantherKolab:**

- ~15 parameters
- ~1,000 API calls/day (with 5-min cache)
- **Monthly cost: < $0.50** 🎉

## Troubleshooting

### "Parameter Store not initialized yet"

→ Wrap component in `ParameterStoreProvider`

### "Access Denied"

→ Check IAM permissions (need `ssm:GetParameter` and `kms:Decrypt`)

### "Parameter not found"

→ Run `setup-parameter-store.sh` to create parameters

### Stale values

→ Use `clearCache()` or reduce TTL

## Migration from .env.local

1. ✅ Keep only AWS credentials in `.env.local`:

   ```bash
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   ```

2. ✅ Move all other config to Parameter Store:

   ```bash
   ./scripts/setup-parameter-store.sh
   ```

3. ✅ Update code to use hooks:

   ```tsx
   // Before
   const poolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;

   // After
   const { value: poolId } = useParameter("cognito/user-pool-id");
   ```

## Next Steps

1. **Create parameters** in AWS using the setup script
2. **Update your root layout** to add ParameterStoreProvider
3. **Migrate one component** at a time to use hooks
4. **Test thoroughly** before removing .env.local values
5. **Share IAM credentials** with team members
6. **Set up CI/CD** with the code-user credentials

## Support

- **Documentation**: See [src/lib/parameterStore/README.md](../src/lib/parameterStore/README.md)
- **Examples**: See [src/lib/parameterStore/EXAMPLE_USAGE.tsx](../src/lib/parameterStore/EXAMPLE_USAGE.tsx)
- **Scripts Guide**: See [scripts/PARAMETER_STORE_README.md](../scripts/PARAMETER_STORE_README.md)

---

**Implementation Date**: October 28, 2025
**Status**: ✅ Complete and ready to use
