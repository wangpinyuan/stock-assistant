FROM node:20-slim

# Install Python for worker scripts
RUN apt-get update && apt-get install -y python3 python3-pip curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
COPY services/api/package.json ./services/api/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build web app
RUN yarn workspace web build

EXPOSE 4000

# Start API server (web is served by API in production)
CMD ["sh", "-c", "cd services/api && node --require tsx/register src/index.ts"]
