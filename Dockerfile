FROM mcr.microsoft.com/playwright:latest AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npx playwright install --with-deps

FROM mcr.microsoft.com/playwright:latest
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Install Xvfb and additional dependencies for headed browsers
RUN apt-get update && apt-get install -y \
    xvfb \
    xauth \
    x11vnc \
    fluxbox \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Create Xvfb startup script
RUN echo '#!/bin/bash\nXvfb :99 -ac -screen 0 1280x1024x24 &\nfluxbox &\nx11vnc -display :99 -forever -nopw &\nexport DISPLAY=:99\nexec "$@"' > /entrypoint.sh \
    && chmod +x /entrypoint.sh

EXPOSE 10000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]