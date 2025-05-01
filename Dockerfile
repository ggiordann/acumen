FROM mcr.microsoft.com/playwright:latest AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npx playwright install --with-deps

FROM mcr.microsoft.com/playwright:latest
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN apt-get update && apt-get install -y xvfb xauth && rm -rf /var/lib/apt/lists/*
EXPOSE 10000
CMD ["xvfb-run", "--server-args=-screen 0 1280x720x24", "node", "ws-server.js"]