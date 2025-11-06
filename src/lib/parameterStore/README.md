# Parameter Store Integration

This directory contains the AWS Parameter Store integration for PantherKolab. It provides on-demand parameter fetching with automatic caching and React hooks.

## Architecture

### Components

1. **`index.ts`** - Core Parameter Store client (Singleton)
2. **`ParameterStoreContext.tsx`** - React context provider
3. **`../hooks/useParameter.ts`** - React hooks for components
4. **`../../types/parameters.ts`** - TypeScript types

## Quick Start

### 1. Setup in Your App

Wrap your application with the `ParameterStoreProvider`:

```tsx
// src/app/layout.tsx
import { ParameterStoreProvider } from '@/lib/parameterStore/ParameterStoreContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ParameterStoreProvider
          config={{
            region: process.env.AWS_REGION || 'us-east-1',
            environment: (process.env.NODE_ENV === 'production' ? 'prod' : 'dev') as 'dev' | 'staging' | 'prod',
            prefix: '/panther-kolab',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          }}
          prefetchKeys={[
            'cognito/user-pool-id',
            'cognito/client-id',
            'cognito/domain',
          ]}
        >
          {children}
        </ParameterStoreProvider>
      </body>
    </html>
  );
}
```

### 2. Use in Components

```tsx
// src/components/MyComponent.tsx
'use client';

import { useParameter } from '@/hooks/useParameter';

export function MyComponent() {
  const { value: userPoolId, loading, error } = useParameter('cognito/user-pool-id');

  if (loading) return <div>Loading configuration...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>User Pool: {userPoolId}</div>;
}
```

### 3. Use Multiple Parameters

```tsx
import { useParameters } from '@/hooks/useParameter';

export function ConfigDisplay() {
  const { values, loading } = useParameters([
    'cognito/user-pool-id',
    'cognito/client-id',
    'dynamodb/users-table',
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <p>Pool: {values['cognito/user-pool-id']}</p>
      <p>Client: {values['cognito/client-id']}</p>
      <p>Table: {values['dynamodb/users-table']}</p>
    </div>
  );
}
```

## Authentication

### Access Key Setup

The system uses **only** AWS Access Key ID and Secret Access Key for authentication.

#### For Development

Add to your `.env.local`:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

#### For Team Members

Each team member should have their own IAM user with this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParametersByPath"
      ],
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

Create IAM users:
- `panther-code-user` (for CI/CD)
- `panther-dev-john` (for team member John)
- `panther-dev-jane` (for team member Jane)

### For Production

Use IAM roles instead of access keys:

```tsx
// In production, get credentials from environment or IAM role
const config = {
  region: process.env.AWS_REGION!,
  environment: 'prod',
  prefix: '/panther-kolab',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
};
```

## Caching

### How It Works

1. **First Request**: Fetches from AWS, stores in memory cache
2. **Subsequent Requests**: Returns from cache (default TTL: 5 minutes)
3. **Cache Invalidation**: Manual clear or TTL expiration

### Cache Configuration

```tsx
// Use cached value (default 5 min TTL)
const { value } = useParameter('cognito/user-pool-id');

// Force refresh from AWS
const { value } = useParameter('cognito/user-pool-id', { refresh: true });

// Custom TTL (1 hour)
const { value } = useParameter('cognito/user-pool-id', {
  ttl: 60 * 60 * 1000,
});
```

### Manual Cache Control

```tsx
import { useParameterStoreContext } from '@/lib/parameterStore/ParameterStoreContext';

function MyComponent() {
  const { clearCache } = useParameterStoreContext();

  const handleClearCache = () => {
    clearCache('cognito/user-pool-id'); // Clear specific parameter
    // or
    clearCache(); // Clear all cached parameters
  };

  return <button onClick={handleClearCache}>Clear Cache</button>;
}
```

## Advanced Usage

### Pre-fetching Parameters

Pre-fetch parameters during app initialization to warm up the cache:

```tsx
<ParameterStoreProvider
  config={config}
  prefetchKeys={[
    'cognito/user-pool-id',
    'cognito/client-id',
    'dynamodb/users-table',
    'dynamodb/messages-table',
  ]}
>
  {children}
</ParameterStoreProvider>
```

### Parameter with Fallback

Use a fallback value if parameter fetch fails:

```tsx
import { useParameterWithFallback } from '@/hooks/useParameter';

function MyComponent() {
  const redirectUrl = useParameterWithFallback(
    'app-urls/redirect-sign-in',
    'http://localhost:3000/' // fallback
  );

  return <a href={redirectUrl}>Sign In</a>;
}
```

### Direct Client Access

For non-React code (API routes, server actions):

```typescript
// src/app/api/config/route.ts
import { parameterStore } from '@/lib/parameterStore';

export async function GET() {
  // Initialize if not already done
  if (!parameterStore.isInitialized()) {
    parameterStore.initialize({
      region: 'us-east-1',
      environment: 'dev',
      prefix: '/panther-kolab',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    });
  }

  const userPoolId = await parameterStore.getParameter('cognito/user-pool-id');

  return Response.json({ userPoolId });
}
```

### Batch Parameter Fetch

Fetch multiple parameters efficiently:

```typescript
const params = await parameterStore.getParameters([
  'cognito/user-pool-id',
  'cognito/client-id',
  'dynamodb/users-table',
]);

console.log(params['cognito/user-pool-id']);
console.log(params['cognito/client-id']);
```

## Available Parameters

See all available parameters in [`src/types/parameters.ts`](../../types/parameters.ts).

### Public Parameters (Safe for Browser)

```typescript
'cognito/user-pool-id'
'cognito/client-id'
'cognito/domain'
'dynamodb/users-table'
'dynamodb/conversations-table'
'dynamodb/messages-table'
'dynamodb/groups-table'
'dynamodb/meetings-table'
'dynamodb/call-sessions-table'
'dynamodb/meeting-invites-table'
'dynamodb/meeting-attendees-table'
'app-urls/redirect-sign-in'
'app-urls/redirect-sign-out'
'appsync/graphql-endpoint'
'appsync/region'
'chime/max-attendees'
'chime/endpoint'
```

### Secure Parameters (Server-Only)

```typescript
'appsync/api-key'  // ❌ Blocked in browser - use API endpoint instead
```

Attempting to access secure parameters in client code will throw an error with helpful guidance.

## Error Handling

```tsx
function MyComponent() {
  const { value, loading, error } = useParameter('cognito/user-pool-id');

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    if (error.code === 'PARAMETER_NOT_FOUND') {
      return <div>Parameter not configured yet</div>;
    }
    if (error.code === 'ACCESS_DENIED') {
      return <div>Access denied. Check IAM permissions.</div>;
    }
    if (error.code === 'SECURE_PARAMETER_ACCESS_DENIED') {
      return <div>Cannot access secure parameters in browser. Use an API endpoint instead.</div>;
    }
    return <div>Error: {error.message}</div>;
  }

  return <div>Value: {value}</div>;
}
```

### Secure Parameter Error

If you attempt to access a secure parameter in client code:

```typescript
const { value } = useParameter('appsync/api-key');
// Throws ParameterStoreError with code: SECURE_PARAMETER_ACCESS_DENIED
// Message: "Access denied: 'appsync/api-key' is a secure parameter and cannot be accessed in browser code. Use an API endpoint instead to fetch this value server-side."
```

**Solution**: Access the secret only in API routes and pass safe data to the client.

## Debugging

### Check Initialization

```tsx
const { isInitialized, isInitializing, initError } = useParameterStoreContext();

console.log('Initialized:', isInitialized);
console.log('Initializing:', isInitializing);
console.log('Error:', initError);
```

### View Cache Statistics

```typescript
import { parameterStore } from '@/lib/parameterStore';

const stats = parameterStore.getCacheStats();
console.log('Cache size:', stats.size);
console.log('Cached keys:', stats.keys);
console.log('Oldest entry:', stats.oldestEntry);
```

### View Configuration

```typescript
const config = parameterStore.getConfig();
console.log('Region:', config?.region);
console.log('Environment:', config?.environment);
console.log('Prefix:', config?.prefix);
// Note: accessKeyId and secretAccessKey are masked as '***'
```

## Security Architecture

### Parameter Classification

Parameters are classified into two categories for security:

**Public Parameters** (Safe for browser):
- Configuration values like table names, endpoint URLs
- Cognito IDs (sent to browser anyway)
- Non-sensitive application settings
- Accessible via `useParameter()` hook in client code

**Secure Parameters** (Server-only):
- API keys, tokens, secrets
- Blocked from browser access with runtime error
- Only accessible in API routes and server-side code
- Require SecureString type in AWS Parameter Store

See [Security Parameters Documentation](../../docs/SECURITY_PARAMETERS.md) for detailed information.

### Runtime Security Checks

The `ParameterStoreContext` enforces security at runtime:

```typescript
// ✅ Allowed - Public parameter in client code
const { value } = useParameter('cognito/user-pool-id');

// ❌ Blocked - Secure parameter in client code
const { value } = useParameter('appsync/api-key');
// Throws: Access denied - secure parameter cannot be accessed in browser code
```

### Security Best Practices

1. **Never commit access keys** to git
2. **Use environment variables** for credentials
3. **Create separate IAM users** for each team member
4. **Use least privilege** IAM policies
5. **Rotate access keys** regularly
6. **Mark all secrets as SecureString** in AWS Parameter Store
7. **Use different prefixes** for dev/staging/prod
8. **Only access secrets in API routes** - never in client components
9. **Use in-memory caching** via Parameter Store singleton (5-min default TTL)

## Performance

- **Cache Hit**: ~1ms (in-memory)
- **Cache Miss**: ~50-100ms (AWS API call)
- **Pre-fetch**: Warms cache during app initialization
- **Parallel Fetch**: Multiple parameters fetched concurrently

## Troubleshooting

### "Parameter Store not initialized yet"

Make sure your component is wrapped in `ParameterStoreProvider`.

### "Access Denied"

Check IAM permissions for your access key. See Authentication section above.

### "Parameter not found"

Verify the parameter exists in AWS Parameter Store at the correct path:
```
/panther-kolab/{environment}/{parameter-key}
```

### Stale Values

Clear cache or reduce TTL:
```tsx
clearCache('cognito/user-pool-id');
// or
useParameter('cognito/user-pool-id', { ttl: 60000 }); // 1 minute
```

## Migration from .env.local

If you have existing `.env.local` values:

1. Create parameters in AWS using the bash scripts
2. Update your app to use `ParameterStoreProvider`
3. Replace direct env access with hooks:

```tsx
// Before
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;

// After
const { value: userPoolId } = useParameter('cognito/user-pool-id');
```

4. Test thoroughly
5. Remove values from `.env.local` (keep only AWS credentials)

## Related Files

- [`src/types/parameters.ts`](../../types/parameters.ts) - Type definitions
- [`src/hooks/useParameter.ts`](../../hooks/useParameter.ts) - React hooks
- [`scripts/setup-parameter-store.sh`](../../../scripts/setup-parameter-store.sh) - Setup script
- [`scripts/fetch-parameters.sh`](../../../scripts/fetch-parameters.sh) - Fetch script