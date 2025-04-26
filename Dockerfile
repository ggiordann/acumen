# Use the official Microsoft Playwright image which includes Node.js and browser dependencies
# Using a specific version tag like v1.44.0-jammy is recommended for stability
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Set the working directory inside the container
WORKDIR /app

# Copy package.json AND package-lock.json first
COPY package*.json ./

# Copy the rest of your application code into the container
COPY . .

# Run npm install AFTER copying all code to ensure all dependencies are met
# using the final package.json and package-lock.json
RUN npm install --omit=dev

# Expose the port the app runs on. Render will set the PORT env variable automatically.
EXPOSE 10000

# Command to run the application
CMD ["node", "server.js"]