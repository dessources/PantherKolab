# Production Deployment Guide

This guide covers deploying PantherKolab to production with Socket.IO support.

## Overview

PantherKolab uses a **custom Node.js server** ([server.ts](../server.ts)) that combines:

- Next.js application server
- Socket.IO server for real-time features (calls, messages)

**IMPORTANT:** You MUST use the custom server in production. The default `next start` command will NOT work because it doesn't include Socket.IO.

---

## Quick Start

### 1. Build the Application

```bash
npm run build
```

This compiles the Next.js app into the `.next` directory.

### 2. Set Up Production Environment Variables

Create a `.env.production` file (or configure environment variables in your hosting platform):

```bash
# Production Domain
NEXT_PUBLIC_APP_URL=https://pantherkolab.com

# Cognito Configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_4fWvgNvC3
NEXT_PUBLIC_COGNITO_CLIENT_ID=2fahfmaruotenn36rnavjm51s5

# AWS Credentials (production)
AWS_ACCESS_KEY_ID=your-production-key
APP_AWS_SECRET_ACCESS_KEY=your-production-secret
APPSYNC_EVENT_API_ID=your-production-appsync-id

# Optional: Custom port (defaults to 3000)
PORT=3000
```

**Security Note:** Never commit `.env.production` to version control!

### 3. Start the Production Server

```bash
npm start
```

This runs: `NODE_ENV=production tsx server.ts`

The server will:

- Start Next.js in production mode
- Initialize Socket.IO server
- Bind to `0.0.0.0:3000` (all network interfaces)
- Enable CORS for `pantherkolab.com` and `www.pantherkolab.com`

---

## Configuration Details

### Server Configuration ([server.ts](../server.ts))

**Development Mode:**

- Hostname: `localhost`
- CORS: `*` (allow all origins)
- Auto-reload on file changes

**Production Mode:**

- Hostname: `0.0.0.0` (binds to all interfaces)
- CORS: Only `pantherkolab.com`, `www.pantherkolab.com`, and `NEXT_PUBLIC_APP_URL`
- Optimized build from `.next` directory

### Socket.IO Client Configuration

The client ([src/lib/socket-client.ts](../src/lib/socket-client.ts)) automatically determines the server URL:

1. **`NEXT_PUBLIC_SOCKET_URL`** (if set) - for custom Socket.IO server
2. **`NEXT_PUBLIC_APP_URL`** (if set) - production domain
3. **Development fallback:** `http://localhost:3000`
4. **Production fallback:** Current domain (`window.location.origin`)

### Transport Configuration

**Transports enabled:** WebSocket (preferred) and HTTP long-polling (fallback)

**Client side:**

```typescript
transports: ["websocket", "polling"];
```

**Server side:**

```typescript
transports: ["websocket", "polling"];
allowEIO3: true; // Compatibility with older clients
```

---

## Deployment Platforms

### AWS EC2

Deploy to an ARM-based EC2 instance for cost-effective production hosting.

#### Phase 1: AWS Infrastructure Setup

**1. Launch EC2 Instance**

- **AMI:** Amazon Linux 2023 (ARM64)
- **Instance type:** `t4g.micro` (free tier eligible for 12 months)
- **Storage:** 20GB gp3 EBS
- **Security Group Rules:**
  - Port 22 (SSH) - Your IP only
  - Port 80 (HTTP) - 0.0.0.0/0
  - Port 443 (HTTPS) - 0.0.0.0/0

**2. Elastic IP**

```bash
# Allocate and associate static IP (free while attached to running instance)
aws ec2 allocate-address --domain vpc
aws ec2 associate-address --instance-id <instance-id> --allocation-id <allocation-id>
```

**3. IAM Role for EC2**

Create an IAM role with these policies and attach to the EC2 instance:

- `AmazonDynamoDBFullAccess`
- `AmazonChimeSDK`
- `CloudWatchAgentServerPolicy`

This eliminates the need for AWS credentials in `.env.local`.

---

#### Phase 2: Server Configuration

**4. Install Dependencies (SSH into EC2)**

```bash
# Update system
sudo yum update -y

# Install Node.js 20 LTS (ARM)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs git

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo yum install -y nginx
```

**5. Clone & Build Application**

```bash
# Clone repository
git clone https://github.com/dessources/PantherKolab.git /home/ec2-user/pantherkolab
cd /home/ec2-user/pantherkolab

# Install dependencies (including devDependencies for build)
npm ci --production=false

# Build Next.js application
npm run build
```

**6. Environment Variables**

Create `/home/ec2-user/pantherkolab/.env.local`:

```bash
# Production Domain
NEXT_PUBLIC_APP_URL=https://pantherkolab.com

# Cognito Configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxx

# AWS Region (credentials come from IAM role, not env vars)
AWS_REGION=us-east-1

# DynamoDB Tables
DYNAMODB_USERS_TABLE=PantherKolab-Users-prod
DYNAMODB_CONVERSATIONS_TABLE=PantherKolab-Conversations-prod
DYNAMODB_MESSAGES_TABLE=PantherKolab-Messages-prod
DYNAMODB_GROUPS_TABLE=PantherKolab-Groups-prod
DYNAMODB_CALLS_TABLE=PantherKolab-Calls-prod

# AWS Chime
AWS_CHIME_REGION=us-east-1

# AppSync (optional)
NEXT_PUBLIC_APPSYNC_EVENT_HTTP_ENDPOINT=https://xxx.appsync-api.us-east-1.amazonaws.com/event
APPSYNC_EVENT_API_KEY=da2-xxxxx

# Port
PORT=3000
```

**Note:** Do NOT include `AWS_ACCESS_KEY_ID` or `APP_AWS_SECRET_ACCESS_KEY` - the IAM role provides credentials automatically.

---

#### Phase 3: Process Management & Reverse Proxy

**7. PM2 Ecosystem File**

Create `/home/ec2-user/pantherkolab/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "pantherkolab",
      script: "server.ts",
      interpreter: "npx",
      interpreter_args: "tsx",
      cwd: "/home/ec2-user/pantherkolab",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
```

**8. Nginx Configuration**

Create `/etc/nginx/conf.d/pantherkolab.conf`:

```nginx
upstream pantherkolab {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name pantherkolab.com www.pantherkolab.com;

    # Redirect HTTP to HTTPS (after SSL is configured)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://pantherkolab;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Socket.IO specific path
    location /socket.io/ {
        proxy_pass http://pantherkolab;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

**9. Start Services**

```bash
# Start application with PM2
cd /home/ec2-user/pantherkolab
pm2 start ecosystem.config.js

# Save PM2 process list and configure startup
pm2 save
pm2 startup

# Test Nginx configuration
sudo nginx -t

# Enable and start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

#### Phase 4: SSL & Domain

**10. DNS Configuration**

Point your domain's A record to the Elastic IP:

| Record Type | Host | Value        |
| ----------- | ---- | ------------ |
| A           | @    | <Elastic-IP> |
| A           | www  | <Elastic-IP> |

**11. SSL Certificate with Let's Encrypt**

```bash
# Install Certbot
sudo yum install -y certbot python3-certbot-nginx

# Obtain and configure SSL certificate
sudo certbot --nginx -d pantherkolab.com -d www.pantherkolab.com

# Verify auto-renewal is configured
sudo systemctl status certbot-renew.timer
```

After SSL is configured, uncomment the HTTPS redirect in the Nginx config.

---

#### Deployment Script

Create `/home/ec2-user/deploy.sh` for future updates:

```bash
#!/bin/bash
set -e

cd /home/ec2-user/pantherkolab

echo "Pulling latest changes..."
git pull origin main

echo "Installing dependencies..."
npm ci --production=false

echo "Building application..."
npm run build

echo "Restarting PM2..."
pm2 restart pantherkolab

echo "Deployment complete!"
```

Make executable: `chmod +x /home/ec2-user/deploy.sh`

---

#### Estimated Monthly Cost

| Resource      | Cost                        |
| ------------- | --------------------------- |
| EC2 t4g.micro | $0 (free tier) or ~$6/month |
| Elastic IP    | $0 (while attached)         |
| EBS 20GB gp3  | ~$1.60/month                |
| Data transfer | ~$1-3/month                 |
| **Total**     | **~$3-10/month**            |

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production=false

# Copy source code
COPY . .

# Build Next.js app
RUN npm run build

# Expose port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Start server
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t pantherkolab .
docker run -p 3000:3000 --env-file .env.production pantherkolab
```

### Vercel + AWS AppSync Events (Recommended for Low-Cost)

Deploy to Vercel's free tier by replacing Socket.IO with AWS AppSync Events API for real-time functionality.

#### Overview

This approach eliminates the need for `server.ts` by using:

- **Vercel** — Hosts Next.js app (serverless)
- **AWS AppSync Events** — Handles real-time WebSocket connections
- **Cognito** — Authentication at the API level

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client                                     │
│                    (Cognito JWT Auth)                                │
└──────────────┬────────────────────────────────┬─────────────────────┘
               │                                │
               ▼                                ▼
┌──────────────────────────┐      ┌────────────────────────────────────┐
│   AppSync Events API     │      │     Vercel API Routes              │
│   (Real-time broadcast)  │      │     (DB persistence)               │
│                          │      │                                    │
│  • HTTP POST to publish  │      │  /api/messages POST → DynamoDB     │
│  • WebSocket subscribe   │      │  /api/calls POST → DynamoDB+Chime  │
│  • onPublish: timestamp  │      │                                    │
└──────────────────────────┘      └────────────────────────────────────┘
```

#### Phase 1: AppSync Events Setup (AWS Console)

**1. Create Event API**

- AWS Console → AppSync → Create API → **Event API**
- Name: `PantherKolab-Events`
- Authorization: **Amazon Cognito User Pool**
  - User Pool: Select your existing Cognito pool
  - Default action: ALLOW

**2. Create Namespaces with onPublish Handlers**

Create these namespaces in the AppSync console:

| Namespace | Purpose           | onPublish Handler     |
| --------- | ----------------- | --------------------- |
| `/chats`  | Message events    | Add `timestamp` field |
| `/calls`  | Call signaling    | Add `timestamp` field |
| `/typing` | Typing indicators | None (ephemeral)      |

**Example onPublish handler** (add in console):

```javascript
export function onPublish(ctx) {
  ctx.events.forEach((event) => {
    event.timestamp = util.time.nowISO8601();
  });
  return ctx.events;
}
```

**3. Note Your Endpoints**

After creation, note these values:

- HTTP Endpoint: `https://xxx.appsync-api.us-east-1.amazonaws.com/event`
- Realtime Endpoint: `wss://xxx.appsync-realtime-api.us-east-1.amazonaws.com/event/realtime`

---

#### Phase 2: Code Migration

**1. Remove Socket.IO Dependencies**

```bash
npm uninstall socket.io socket.io-client
```

**2. Delete server.ts** (no longer needed)

**3. Update package.json scripts**

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start"
  }
}
```

**4. Create AppSync Client** (`src/lib/appsync-client.ts`)

```typescript
// Client-side AppSync Events subscription
import { fetchAuthSession } from "aws-amplify/auth";

const REALTIME_ENDPOINT = process.env.NEXT_PUBLIC_APPSYNC_REALTIME_ENDPOINT!;
const HTTP_ENDPOINT = process.env.NEXT_PUBLIC_APPSYNC_EVENT_HTTP_ENDPOINT!;

export async function publishEvent(channel: string, event: object) {
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken?.toString();

  const response = await fetch(HTTP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token!,
    },
    body: JSON.stringify({
      channel,
      events: [JSON.stringify(event)],
    }),
  });

  if (!response.ok) {
    throw new Error(`AppSync publish failed: ${response.status}`);
  }
}

export function subscribeToChannel(
  channel: string,
  onEvent: (event: any) => void,
  onError?: (error: Error) => void
): () => void {
  // WebSocket subscription implementation
  // See AWS AppSync Events documentation for full implementation
  // Returns unsubscribe function
}
```

**5. Replace Socket.IO Usage**

Before (Socket.IO):

```typescript
socket.emit('send-message', { conversationId, content });
socket.on('new-message', (message) => { ... });
```

After (AppSync Events + API Route):

```typescript
// Send message: publish to AppSync AND persist to DB
await Promise.all([
  publishEvent(`/chats/${conversationId}`, {
    type: "MESSAGE_SENT",
    data: { content, senderId: userId },
  }),
  fetch("/api/messages", {
    method: "POST",
    body: JSON.stringify({ conversationId, content }),
  }),
]);

// Receive messages: subscribe to channel
const unsubscribe = subscribeToChannel(`/chats/${conversationId}`, (event) => {
  if (event.type === "MESSAGE_SENT") {
    addMessage(event.data);
  }
});
```

---

#### Phase 3: Channel Design

| Channel Pattern            | Use Case                   | Subscribers        |
| -------------------------- | -------------------------- | ------------------ |
| `/chats/{conversationId}`  | Messages in a conversation | All participants   |
| `/calls/{sessionId}`       | Call signaling             | Caller + recipient |
| `/users/{userId}`          | Direct notifications       | Single user        |
| `/typing/{conversationId}` | Typing indicators          | All participants   |

**Call Signaling Flow:**

```
1. Caller publishes to /users/{recipientId}:
   { type: 'INCOMING_CALL', callerId, sessionId }

2. Recipient accepts → publishes to /calls/{sessionId}:
   { type: 'CALL_ACCEPTED' }

3. API route creates Chime meeting, returns credentials

4. Both subscribe to /calls/{sessionId} for ongoing events
```

---

#### Phase 4: Vercel Deployment

**1. Connect Repository**

- Vercel Dashboard → New Project → Import Git Repository
- Framework: Next.js (auto-detected)

**2. Environment Variables**

Add in Vercel Dashboard → Settings → Environment Variables:

```bash
# Cognito
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxx

# AppSync Events
NEXT_PUBLIC_APPSYNC_EVENT_HTTP_ENDPOINT=https://xxx.appsync-api.us-east-1.amazonaws.com/event
NEXT_PUBLIC_APPSYNC_REALTIME_ENDPOINT=wss://xxx.appsync-realtime-api.us-east-1.amazonaws.com/event/realtime

# AWS (for API routes - use Vercel's AWS integration or env vars)
AWS_ACCESS_KEY_ID=xxxxx
APP_AWS_SECRET_ACCESS_KEY=xxxxx
AWS_REGION=us-east-1

# DynamoDB Tables
DYNAMODB_USERS_TABLE=PantherKolab-Users-prod
DYNAMODB_CONVERSATIONS_TABLE=PantherKolab-Conversations-prod
DYNAMODB_MESSAGES_TABLE=PantherKolab-Messages-prod
DYNAMODB_GROUPS_TABLE=PantherKolab-Groups-prod
DYNAMODB_CALLS_TABLE=PantherKolab-Calls-prod
```

**3. Deploy**

```bash
vercel --prod
```

Or enable automatic deployments on push to `main`.

---

#### Estimated Monthly Cost

| Resource                   | Cost                                     |
| -------------------------- | ---------------------------------------- |
| Vercel (Hobby)             | $0                                       |
| AppSync Events (free tier) | $0 (250K connections, 1M messages/month) |
| DynamoDB                   | ~$0-2 (on-demand, low usage)             |
| Cognito                    | $0 (first 50K MAU free)                  |
| **Total**                  | **$0-2/month**                           |

---

#### Trade-offs vs Socket.IO

| Aspect           | Socket.IO (EC2)            | AppSync Events (Vercel) |
| ---------------- | -------------------------- | ----------------------- |
| Cost             | ~$3-10/month               | ~$0/month               |
| Latency          | ~10-50ms                   | ~50-150ms               |
| Setup complexity | Higher (server management) | Lower (serverless)      |
| Scaling          | Manual                     | Automatic               |
| User presence    | Built-in (rooms)           | Requires custom impl    |
| Maintenance      | PM2, Nginx, SSL renewal    | Zero                    |

**Best for:** Passion projects, MVPs, low-traffic apps where cost matters more than minimal latency.

---

### Vercel / Netlify with Socket.IO (NOT SUPPORTED)

⚠️ **Vercel and Netlify do NOT support custom Node.js servers with persistent Socket.IO connections.**

If you need Socket.IO specifically, use the [AWS EC2](#aws-ec2) or [Docker](#docker-deployment) deployment options.

---

## Troubleshooting

### WebSocket Connection Fails

**Symptoms:**

- Socket.IO falls back to polling
- Connection errors in browser console
- `ERR_CONNECTION_REFUSED` or `wss:// failed`

**Solutions:**

1. **Check server is using custom server:**

   ```bash
   # Correct (uses server.ts with Socket.IO)
   npm start

   # Wrong (Next.js standalone without Socket.IO)
   npm run start:next
   ```

2. **Verify environment variables:**

   ```bash
   echo $NEXT_PUBLIC_APP_URL
   # Should output: https://pantherkolab.com
   ```

3. **Check reverse proxy WebSocket headers:**

   ```nginx
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   ```

4. **Verify firewall allows port 3000:**

   ```bash
   sudo ufw allow 3000
   ```

5. **Check CORS configuration:**
   - Ensure your domain is in the CORS allowed origins list in [server.ts:47-53](../server.ts#L47-L53)

### Authentication Issues

**Symptoms:**

- "Unauthorized" Socket.IO errors
- Connection immediately disconnects

**Solutions:**

1. **Verify JWT token is being sent:**

   - Check browser DevTools > Network > socket.io > Headers
   - Look for `auth.token` in connection handshake

2. **Check Cognito configuration:**

   ```bash
   # Verify environment variables match AWS Cognito
   echo $NEXT_PUBLIC_COGNITO_USER_POOL_ID
   echo $NEXT_PUBLIC_COGNITO_CLIENT_ID
   ```

3. **Update Cognito allowed callback URLs:**
   - AWS Console > Cognito > User Pools > App Integration
   - Add production domain to allowed callback URLs
   - Add production domain to allowed logout URLs

### Server Won't Start

**Symptoms:**

- `Error: listen EADDRINUSE: address already in use`

**Solutions:**

1. **Check if port 3000 is already in use:**

   ```bash
   lsof -i :3000
   # Kill the process
   kill -9 <PID>
   ```

2. **Use a different port:**
   ```bash
   PORT=4000 npm start
   ```

---

## Monitoring

### Server Logs

```bash
# PM2 logs
pm2 logs pantherkolab

# Docker logs
docker logs <container-id>

# Direct server logs
npm start 2>&1 | tee server.log
```

### Health Check Endpoint

Add to [server.ts](../server.ts):

```typescript
server.on("request", (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", socketIO: true }));
    return;
  }
  // ... existing handler
});
```

---

## Performance Optimization

### Enable Compression

Install compression middleware:

```bash
npm install compression
```

Update [server.ts](../server.ts):

```typescript
import compression from "compression";

const server = createServer(compression(), async (req, res) => {
  // ... existing code
});
```

### Enable Rate Limiting

Prevent abuse of Socket.IO connections:

```typescript
io.use((socket, next) => {
  const userId = socket.handshake.auth.userId;

  // Limit to 5 connections per user
  const userSockets = Array.from(io.sockets.sockets.values()).filter(
    (s) => s.handshake.auth.userId === userId
  );

  if (userSockets.length >= 5) {
    return next(new Error("Too many connections"));
  }

  next();
});
```

---

## Security Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS (not HTTP) in production
- [ ] Configure CORS to allow only your domain
- [ ] Enable `credentials: true` for cookies
- [ ] Use secure environment variables (not hardcoded)
- [ ] Enable rate limiting on Socket.IO
- [ ] Keep dependencies updated (`npm audit`)
- [ ] Use process manager (PM2) with auto-restart
- [ ] Set up server monitoring and alerts

---

## Additional Resources

- [Socket.IO Production Best Practices](https://socket.io/docs/v4/server-options/)
- [Next.js Custom Server Documentation](https://nextjs.org/docs/pages/building-your-application/configuring/custom-server)
- [PM2 Process Manager](https://pm2.keymetrics.io/)
- [nginx WebSocket Proxy](https://nginx.org/en/docs/http/websocket.html)
