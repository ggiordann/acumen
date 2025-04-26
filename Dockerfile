# Use the official Microsoft Playwright image which includes Node.js and browser dependencies
# Using a specific version tag like v1.44.0-jammy is recommended for stability
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Set the working directory inside the container
WORKDIR /app

# Copy package.json AND package-lock.json first for cache efficiency if possible
COPY package*.json ./

# Install ALL dependencies (including devDependencies if needed for build, but omit for production)
# We will run install again after copying all code to be sure
RUN npm install --omit=dev

# Copy the rest of your application code into the container
COPY . .

# Re-run npm install AFTER copying all code to ensure all dependencies are met
# This catches dependencies added in package.json that weren't present in the first copy
RUN npm install --omit=dev

# Expose the port the app runs on. Render will set the PORT env variable automatically.
EXPOSE 10000

# Command to run the application
CMD ["node", "server.js"]