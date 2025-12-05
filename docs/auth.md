# Authentication Documentation

## Overview

AWS Amplify + Cognito for auth, DynamoDB for user profiles. All auth logic is in `AuthContext`. Configuration is managed through `.env.local` files.

---

## Quick Setup

### 1. Install Dependencies

```bash
npm install aws-amplify @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb aws-jwt-verify
```

### 2. Environment Variables (`.env.local`)

Required environment variables:

```bash
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your_pool_id
NEXT_PUBLIC_COGNITO_CLIENT_ID=your_client_id
NEXT_PUBLIC_AWS_REGION=your_region
AWS_ACCESS_KEY_ID=your_key
APP_AWS_SECRET_ACCESS_KEY=your_secret
DYNAMODB_USERS_TABLE=PantherKolab-Users-dev
```

### 3. Wrap App with AuthProvider

```typescript
// src/app/layout.tsx
import { AuthProvider } from "@/components/contexts/AuthContext";
import { ConfigureAmplifyClientSide } from "@/lib/amplify/amplify-config";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ConfigureAmplifyClientSide />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

---

## Using Auth in Components

```typescript
"use client";
import { useAuth } from "@/components/contexts/AuthContext";

export default function MyComponent() {
  const {
    isAuthenticated, // boolean
    user, // user object
    loading, // boolean
    error, // string
    login, // function
    logout, // function
    register, // function
    verify, // function
    resendVerificationCode, // function
    forgotPassword, // function
    confirmResetPassword, // function
  } = useAuth();
  // Not all is required ex: {login, logout} = useAuth()
  return (
    <div>
      {isAuthenticated ? (
        <button onClick={logout}>Logout</button>
      ) : (
        <button onClick={() => login("email", "pass")}>Login</button>
      )}
    </div>
  );
}
```

---

## Protecting Routes

```typescript
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <div>Protected content</div>
    </ProtectedRoute>
  );
}
```

---

## Available Functions

```typescript
// Login
await login(email, password);

// Register (creates Cognito user + DynamoDB profile)
await register({ name, email, password, family_name: lastName });

// Verify email after signup
await verify({ email, code });

// Resend verification code
await resendVerificationCode(email);

// Request password reset (sends code to email)
await forgotPassword(email);

// Confirm password reset with code
await confirmResetPassword({ email, code, newPassword });

// Logout
await logout();

// Get access token for API calls
const token = await getAccessToken();

// Clear error message
clearError();

// Set custom error message
setError(message);

// Re-check authentication status
await checkAuth();
```

---

## API Endpoints

### `POST /api/auth/signup`

Creates user profile in DynamoDB after Cognito signup.

**Request Body:**

```json
{
  "userId": "cognito-sub",
  "email": "user@email.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:** `201 Created`

```json
{
  "message": "User profile created successfully",
  "user": {
    "userId": "cognito-sub",
    "email": "user@email.com",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "emailVerified": false,
    "profilePicture": null,
    "major": null,
    "year": null,
    "bio": null,
    "interests": [],
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**

- `400` - Missing required fields (userId, email, firstName, lastName)
- `409` - User already exists
- `500` - Internal server error

### `GET /api/users/[id]`

Get user profile (must be authenticated).

**Authentication Required:** Bearer token in Authorization header

**Response:** `200 OK`

```json
{
  "userId": "cognito-sub",
  "email": "user@email.com",
  "firstName": "John",
  "lastName": "Doe",
  "fullName": "John Doe"
  // ... other user fields
}
```

### `PUT /api/users/[id]`

Update user profile (must be authenticated, can only update own profile).

**Authentication Required:** Bearer token in Authorization header

**Request Body:**

```json
{
  "firstName": "Jane",
  "bio": "Updated bio",
  "major": "Computer Science"
}
```

---

## File Structure

```
src/
├── lib/
│   ├── amplify/
│   │   └── amplify-config.ts      # Amplify configuration
│   └── dynamodb/
│       └── index.ts               # DynamoDB client
│
├── components/
│   ├── contexts/
│   │   └── AuthContext.tsx        # All auth logic and state
│   ├── auth/
│   │   ├── LoginForm.tsx          # Login form component
│   │   ├── confirm-email/         # Email verification components
│   │   ├── reset-password/        # Password reset components
│   │   └── forgot-password/       # Forgot password components
│   └── ProtectedRoute.tsx         # Route protection wrapper
│
├── services/
│   └── userService.ts             # DynamoDB operations
│
├── app/
│   ├── api/
│   │   ├── auth/signup/route.ts   # Create user in DB
│   │   └── users/[id]/route.ts    # Get/Update user
│   └── auth/
│       ├── login/page.tsx         # Login page
│       ├── signup/page.tsx        # Signup page
│       ├── confirm-email/page.tsx # Email verification page
│       ├── forgot-password/page.tsx # Request reset page
│       └── reset-password/page.tsx  # Reset password page
│
└── types/
    ├── AuthContextTypes.ts        # Auth type definitions
    └── database.ts                # Database type definitions
```

---

## Common Errors

- **"User is not authenticated"** - User needs to login
- **"NotAuthorizedException"** - Wrong password
- **"UserNotConfirmedException"** - Email not verified yet
- **"UsernameExistsException"** - Email already registered
- **"CodeMismatchException"** - Invalid verification/reset code
- **"InvalidParameterException"** - Invalid email format or password requirements not met
- **"LimitExceededException"** - Too many requests, try again later

---

## Testing

**Test API directly (Postman):**

```
POST http://localhost:3000/api/auth/signup
GET http://localhost:3000/api/users/[id]
PUT http://localhost:3000/api/users/[id]
```

**Test full authentication flow:**

1. **Register** at `/auth/signup`

   - Enter FIU email, password, and name
   - User is created in Cognito and DynamoDB
   - Verification code sent to email

2. **Verify Email** at `/auth/confirm-email?email=user@fiu.edu`

   - Enter 6-digit code from email
   - Account is activated

3. **Login** at `/auth/login`

   - Enter email and password
   - Redirected to dashboard on success

4. **Forgot Password** at `/auth/forgot-password`

   - Enter email to receive reset code
   - Redirected to reset password page

5. **Reset Password** at `/auth/reset-password?email=user@fiu.edu`

   - Enter reset code and new password
   - Redirected to login

6. **Access Protected Routes**
   - Wrap any page with `<ProtectedRoute>`
   - Unauthenticated users redirected to login

## Username Format

**Important:** The app uses `email.split("@")[0]` as the Cognito username (e.g., "johndoe" from "johndoe@fiu.edu"). This format must be used consistently across:

- Signup
- Login
- Email verification
- Password reset
- Any direct Cognito operations
