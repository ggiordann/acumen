# Use the official Microsoft Playwright image which includes Node.js and browser dependencies
# Update the version tag to match the required Playwright version (1.50.1)
FROM mcr.microsoft.com/playwright:v1.50.1-jammy

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

# Command to run the application using xvfb-run # "xvfb-run", 
CMD ["node", "server.js"]