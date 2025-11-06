# Security: Parameter Store Access Control

This document explains how PantherKolab prevents sensitive parameters from being exposed to the browser.

## Overview

Parameters in AWS Parameter Store are classified into two categories:

### Public Parameters
Safe to expose to browser code. These are typically non-sensitive configuration values.

**Examples:**
- `cognito/user-pool-id` - User Pool ID (public knowledge)
- `cognito/client-id` - Client ID (sent to browser anyway)
- `dynamodb/*` - Table names (not sensitive)
- `chime/*` - Meeting configuration (public)

### Secure Parameters
**MUST NEVER** be exposed to browser code. These are secrets and credentials.

**Examples:**
- `appsync/api-key` - API key (SECRET!)
- AWS credentials, tokens, API keys

## How It Works

### Browser Code Protection

When client-side code attempts to access a secure parameter:

```typescript
// ❌ FAILS - Client code trying to access secure parameter
'use client';

import { useParameter } from '@/hooks/useParameter';

export function MyComponent() {
  const { value: apiKey } = useParameter('appsync/api-key');
  // ^ THROWS ERROR: Access denied - secure parameter in client code
}
```

**Error thrown:**
```
Access denied: 'appsync/api-key' is a secure parameter and cannot be
accessed in browser code. Use an API endpoint instead to fetch this value
server-side.
```

### Server-Side Access (Allowed)

Server-side code can freely access secure parameters:

```typescript
// ✅ WORKS - Server-side code
export async function GET(req: NextRequest) {
  const apiKey = await parameterStore.getParameter('appsync/api-key');
  // Use it here, never expose to client
}
```

## Usage Examples

### Frontend: Use Public Parameters

```typescript
'use client';

import { useParameter } from '@/hooks/useParameter';

export function ConfigDisplay() {
  // ✅ OK - cognito/user-pool-id is public
  const { value: poolId } = useParameter('cognito/user-pool-id');

  return <div>Pool: {poolId}</div>;
}
```

### Frontend: Need a Secret?

If your frontend needs a secret (like an API key), fetch it from an API endpoint:

```typescript
// ❌ DON'T - Direct access to secure parameter
const { value: apiKey } = useParameter('appsync/api-key');

// ✅ DO - Fetch from secure API endpoint
const response = await fetch('/api/config/appsync-key');
const { apiKey } = await response.json();
```

### Backend: Create Secure Endpoints

```typescript
// src/app/api/config/appsync-key/route.ts
import { parameterStore } from '@/lib/parameterStore';
import { NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Only accessible server-side
    const apiKey = await parameterStore.getParameter('appsync/api-key');

    // Return only what's needed
    return NextResponse.json({ apiKey });
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    );
  }
}
```

### Server Actions: Access Secrets

```typescript
'use server';

import { parameterStore } from '@/lib/parameterStore';

export async function loadSecretConfig() {
  const apiKey = await parameterStore.getParameter('appsync/api-key');
  return { apiKey };
}
```

## Parameter Classification

### Public Parameters (Safe for Browser)

```typescript
// src/types/parameters.ts
export const PUBLIC_PARAMETERS = new Set<ParameterKey>([
  'cognito/user-pool-id',
  'cognito/client-id',
  'cognito/domain',
  'dynamodb/users-table',
  'dynamodb/conversations-table',
  'dynamodb/messages-table',
  'dynamodb/groups-table',
  'dynamodb/meetings-table',
  'dynamodb/call-sessions-table',
  'dynamodb/meeting-invites-table',
  'dynamodb/meeting-attendees-table',
  'app-urls/redirect-sign-in',
  'app-urls/redirect-sign-out',
  '/appsync/panther-kolab-chats/realtime-api-url',
  '/appsync/panther-kolab-chats/http-api-url',
  'chime/max-attendees',
  'chime/endpoint',
]);
```

### Secure Parameters (Server-Only)

```typescript
// src/types/parameters.ts
export const SECURE_PARAMETERS = new Set<ParameterKey>([
  '/appsync/panther-kolab-chats/api-id',
  // Add other secrets here
]);
```

## Best Practices

### 1. Never Import parameterStore in Client Code

```typescript
// ❌ BAD - Client code
'use client';
import { parameterStore } from '@/lib/parameterStore';

// ✅ GOOD - Server code only
// No 'use client' directive
import { parameterStore } from '@/lib/parameterStore';
```

### 2. Use API Routes for Secrets

```typescript
// ✅ GOOD - Secure endpoint
export async function GET(req: NextRequest) {
  const secret = await parameterStore.getParameter('secret-key');
  return NextResponse.json({ secret }); // Or use it server-side
}
```

### 3. Mark Secrets as SecureString in AWS

```bash
aws ssm put-parameter \
  --name "/panther-kolab/dev/appsync/api-key" \
  --type "SecureString" \
  --value "da2-xxxxxxxxxxxxx" \
  --key-id "alias/aws/ssm"
```

### 4. Log Wisely

```typescript
// ❌ BAD - Logs expose value
console.log('API Key:', apiKey);

// ✅ GOOD - Log only that it was retrieved
console.log('API key retrieved successfully');
```

### 5. Don't Display Secrets in DOM

```typescript
// ❌ BAD - Exposes secret in browser
return <div>{apiKey}</div>;

// ✅ GOOD - Use secret server-side only
// Return only public info to client
return <div>Connected</div>;
```

## Adding New Secure Parameters

When adding a new sensitive parameter:

1. **Add to SECURE_PARAMETERS in types/parameters.ts:**
```typescript
export const SECURE_PARAMETERS = new Set<ParameterKey>([
  'appsync/api-key',
  'my-new-secret',  // ← Add here
]);
```

2. **Create as SecureString in AWS:**
```bash
aws ssm put-parameter \
  --name "/panther-kolab/dev/my-new-secret" \
  --type "SecureString" \
  --value "secret-value"
```

3. **Access only in server-side code:**
```typescript
// ✅ In API routes, server actions, scripts
const secret = await parameterStore.getParameter('my-new-secret');
```

## Error Handling

When client code tries to access a secure parameter:

```typescript
try {
  const { value } = useParameter('appsync/api-key');
} catch (error) {
  if (error.code === 'SECURE_PARAMETER_ACCESS_DENIED') {
    // Handle security error
    console.error('Cannot access this parameter in browser code');
  }
}
```

## Related Documentation

- [Parameter Store Integration](../src/lib/parameterStore/README.md)
- [Example Usage](../src/lib/parameterStore/EXAMPLE_USAGE.tsx)
- [Parameter Store Reference](./PARAMETER_STORE_REFERENCE.md)
- [AWS Secrets Management Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)