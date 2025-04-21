FROM mcr.microsoft.com/playwright:focal
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# install Playwright browsers and dependencies
RUN npx playwright install --with-deps
ENV PORT=1989
EXPOSE 1989
CMD ["node", "server.js"]