# AWS Parameter Store Reference

## Complete Parameter List

All parameters are prefixed with `/panther-kolab/` in AWS Systems Manager Parameter Store.

### Global Parameters (No Environment Prefix)

| Parameter Path                                         | Type   | Description                          |
| ------------------------------------------------------ | ------ | ------------------------------------ |
| `/panther-kolab/NEXT_PUBLIC_AWS_REGION`                | String | AWS region (us-east-1)               |
| `/panther-kolab/NEXT_PUBLIC_COGNITO_USER_POOL_ID`      | String | Cognito User Pool ID (public)        |

### Development Environment Parameters

All dev-specific parameters are under `/panther-kolab/dev/`

#### Cognito Configuration

| Parameter Path                                   | Type   | Description                    |
| ------------------------------------------------ | ------ | ------------------------------ |
| `/panther-kolab/dev/cognito/user-pool-id`        | String | Cognito User Pool ID           |
| `/panther-kolab/dev/cognito/client-id`           | String | Cognito Client ID              |
| `/panther-kolab/dev/cognito/domain`              | String | Cognito domain                 |
| `/panther-kolab/dev/redirect-sign-in`            | String | OAuth redirect sign-in URL     |
| `/panther-kolab/dev/redirect-sign-out`           | String | OAuth redirect sign-out URL    |

#### DynamoDB Tables

| Parameter Path                                       | Type   | Description                           |
| ---------------------------------------------------- | ------ | ------------------------------------- |
| `/panther-kolab/dev/dynamodb/users-table`            | String | Users table name                      |
| `/panther-kolab/dev/dynamodb/conversations-table`    | String | Conversations table name              |
| `/panther-kolab/dev/dynamodb/conversmessages-table`  | String | Messages table name (note: typo)      |

**Note:** The messages table parameter has a typo (`conversmessages` instead of `conversations-messages`). This is intentional to match the existing parameter store.

#### AWS Credentials

| Parameter Path                                   | Type         | Description                 |
| ------------------------------------------------ | ------------ | --------------------------- |
| `/panther-kolab/dev/aws_access_key_id`           | SecureString | AWS Access Key ID           |
| `/panther-kolab/dev/aws_secret_access_key`       | SecureString | AWS Secret Access Key       |

#### AppSync Configuration

| Parameter Path                                                  | Type   | Description                      |
| --------------------------------------------------------------- | ------ | -------------------------------- |
| `/panther-kolab/appsync/dev/panther-kolab-chats/api-id`         | String | AppSync API ID                   |
| `/panther-kolab/appsync/dev/panther-kolab-chats/http-api-url`   | String | AppSync HTTP endpoint            |
| `/panther-kolab/appsync/dev/panther-kolab-chats/realtime-api-url` | String | AppSync WebSocket endpoint    |

#### AppSync API Key (if needed)

| Parameter Path                                   | Type         | Description                        |
| ------------------------------------------------ | ------------ | ---------------------------------- |
| `/panther-kolab/dev/appsync-events/api-key`      | SecureString | AppSync API key for backend        |

#### Chime SDK Configuration

| Parameter Path                                   | Type   | Description                             |
| ------------------------------------------------ | ------ | --------------------------------------- |
| `/panther-kolab/dev/chime/max-attendees`         | String | Maximum attendees per meeting (default: 100) |
| `/panther-kolab/dev/chime/endpoint`              | String | Chime SDK endpoint URL (optional)       |

**Note:** Chime SDK uses the same AWS credentials (`aws_access_key_id` and `aws_secret_access_key`) as other services.

---

## Usage in Code

### Environment Variable Mapping

The Parameter Store values are fetched and mapped to environment variables:

```typescript
// Client-side (NEXT_PUBLIC_ prefix makes them available in browser)
process.env.NEXT_PUBLIC_AWS_REGION              // from /panther-kolab/NEXT_PUBLIC_AWS_REGION
process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID    // from /panther-kolab/NEXT_PUBLIC_COGNITO_USER_POOL_ID

// Server-side only
process.env.AWS_ACCESS_KEY_ID                   // from /panther-kolab/dev/aws_access_key_id
process.env.AWS_SECRET_ACCESS_KEY               // from /panther-kolab/dev/aws_secret_access_key
process.env.COGNITO_USER_POOL_ID                // from /panther-kolab/dev/cognito/user-pool-id
process.env.COGNITO_CLIENT_ID                   // from /panther-kolab/dev/cognito/client-id
process.env.DYNAMODB_USERS_TABLE                // from /panther-kolab/dev/dynamodb/users-table
process.env.APPSYNC_HTTP_API_URL                // from /panther-kolab/appsync/dev/panther-kolab-chats/http-api-url
// ... etc
```

### Fetching Parameters

Use the existing scripts:

```bash
# Fetch all parameters and create .env.local
cd scripts
./fetch-parameters.sh
```

### Adding New Parameters

```bash
# Use AWS CLI
aws ssm put-parameter \
  --name "/panther-kolab/dev/your-new-parameter" \
  --value "your-value" \
  --type "String" \
  --region us-east-1

# For sensitive values, use SecureString
aws ssm put-parameter \
  --name "/panther-kolab/dev/your-secret" \
  --value "secret-value" \
  --type "SecureString" \
  --region us-east-1
```

---

## Naming Conventions

### Pattern Structure

```
/panther-kolab/{environment?}/{service}/{parameter-name}
```

### Examples

- **Global:** `/panther-kolab/NEXT_PUBLIC_AWS_REGION`
- **Environment-specific:** `/panther-kolab/dev/cognito/client-id`
- **Service-specific:** `/panther-kolab/appsync/dev/panther-kolab-chats/api-id`

### Environment Prefixes

- `dev/` - Development environment
- `staging/` - Staging environment (future)
- `prod/` - Production environment (future)
- (none) - Global/shared across all environments

### Service Prefixes

- `cognito/` - Authentication service
- `dynamodb/` - Database tables
- `appsync/` - GraphQL/Event API
- (others as needed)

---

## Security Notes

- **SecureString parameters** are encrypted at rest using AWS KMS
- **Never commit** `.env.local` to git (it's in `.gitignore`)
- **IAM permissions** control who can read which parameters
- **Rotate credentials** regularly (access keys, API keys)

---

## Related Documentation

- Parameter Store Setup: `scripts/PARAMETER_STORE_README.md`
- Backend Tasks: `BACKEND_TASKS_Antoine.md`
- Frontend Tasks: `FRONTEND_TASKS_Ousman.md`
- Auth Documentation: `docs/auth.md`
