# Use the official Microsoft Playwright image which includes Node.js and browser dependencies
# Using a specific version tag like v1.44.0-jammy is recommended for stability
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available) first
# This leverages Docker layer caching
COPY package.json ./
# If you have a package-lock.json, uncomment the next line
# COPY package-lock.json ./

# Install Node.js dependencies
# Use --omit=dev if you have devDependencies you don't need in production
RUN npm install --omit=dev

# Copy the rest of your application code into the container
# This includes server.js, your .spec.js files, and any session files
COPY . .

# Expose the port the app runs on. Render will set the PORT env variable automatically.
# Your server.js already uses process.env.PORT || 1989, which is good.
EXPOSE 10000 
# Render expects services to listen on port 10000 by default, but it sets PORT env var.

# Command to run the application
# Since server.js uses ES Modules, we just run it with node
CMD ["node", "server.js"]