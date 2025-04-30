# Use the official Playwright image which includes browsers and xvfb
FROM mcr.microsoft.com/playwright:v1.50.1-jammy

# Set the working directory inside the container
WORKDIR /app

# Environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV VNC_PASSWORD=yourpassword 
# CHANGE THIS or use Render secrets

# Switch to root to install system packages
USER root

# Install VNC components, window manager, and utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    x11vnc \
    novnc \
    fluxbox \
    net-tools \
    tightvncserver \
    # Add any other dependencies your script might need
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# Switch back to the non-root user 'pwuser' created by the base image
USER pwuser

# Set home directory for pwuser (needed for .vnc password file)
ENV HOME=/home/pwuser
WORKDIR $HOME

# Copy package files first for layer caching
COPY --chown=pwuser:pwuser package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the rest of the application code
COPY --chown=pwuser:pwuser . .

# Make the entrypoint script executable
RUN chmod +x $HOME/entrypoint.sh

# Expose the port noVNC will listen on (Render uses $PORT automatically)
# EXPOSE 6080 # Not strictly needed for Render, but good practice

# Set the entrypoint script as the command to run
ENTRYPOINT ["/home/pwuser/entrypoint.sh"]
# CMD ["/home/pwuser/entrypoint.sh"]
# Keep CMD commented or removed