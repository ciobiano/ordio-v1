FROM node:20-bullseye

# Install Chrome and FFmpeg deps
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ffmpeg \
    --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy monorepo config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/convex/package.json ./packages/convex/
COPY apps/web/package.json ./apps/web/
# We only need renderer's package.json specifically, but copying all structure is safer for workspace resolution
COPY apps/renderer/package.json ./apps/renderer/

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Build shared package if needed (usually just TS)
# RUN pnpm --filter @Ordio/shared build

# Set specific environment for Remotion
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app/apps/renderer

# Expose port for the HTTP server
EXPOSE 8000

# Start the server
CMD ["npx", "tsx", "src/server.ts"]
