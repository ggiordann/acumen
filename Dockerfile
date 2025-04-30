# Use the official Playwright image which includes browsers and the correct Node.js version
FROM mcr.microsoft.com/playwright:v1.50.1-jammy

# Set the working directory inside the container (default user is pwuser)
WORKDIR /app

# Copy package.json and package-lock.json first for layer caching
COPY package.json package-lock.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy the rest of your application code from acumen-1 into the container's /app directory
COPY . .

# Expose the port the app runs on (Render uses $PORT env var, but EXPOSE is good practice)
EXPOSE 10000

# Command to run the application (using the default npm start script: node server.js)
CMD ["npm", "start"]