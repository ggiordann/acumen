#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Set display port
DISPLAY_NUM=99
export DISPLAY=:${DISPLAY_NUM}
# VNC_PASSWORD is no longer used

# Remove VNC password setup
# mkdir -p $HOME/.vnc
# echo "$VNC_PASSWORD" | vncpasswd -f > $HOME/.vnc/passwd
# chmod 600 $HOME/.vnc/passwd

# Start Xvfb (Virtual Display)
echo "Starting Xvfb on display ${DISPLAY}"
Xvfb ${DISPLAY} -screen 0 1280x960x24 -nolisten tcp -nolisten unix &
XVFB_PID=$!
sleep 2 # Give Xvfb time to start

# Start Fluxbox (Window Manager)
echo "Starting Fluxbox"
fluxbox &
FLUXBOX_PID=$!
sleep 1 # Give Fluxbox time to start

# Start x11vnc (VNC Server sharing the Xvfb display) - REMOVED -passwdfile argument
echo "Starting x11vnc (passwordless)"
x11vnc -display ${DISPLAY} -forever -shared -bg -noipv6 -noshm -repeat -rfbport 5900
X11VNC_PID=$!
sleep 1 # Give x11vnc time to start

# Start noVNC (Web VNC Client)
# Use Render's $PORT environment variable; default to 6080 if not set
NOVNC_PORT=${PORT:-6080}
echo "Starting noVNC on port ${NOVNC_PORT}, proxying to VNC port 5900"
# Adjust path to launch.sh if needed based on the novnc package installation location
/usr/share/novnc/utils/launch.sh --listen ${NOVNC_PORT} --vnc localhost:5900 &
NOVNC_PID=$!

# Start your Playwright script (ensure path is correct relative to WORKDIR)
echo "Starting Playwright script: node fb_login.spec.js"
node fb_login.spec.js

echo "Playwright script finished."

# Keep container running indefinitely to allow VNC access even after script finishes
echo "Entrypoint finished. Keeping container alive for VNC access..."
wait $NOVNC_PID # Wait for noVNC to exit (which it won't unless killed)

# Cleanup (optional, might not run if container is killed abruptly)
kill $XVFB_PID $FLUXBOX_PID $X11VNC_PID $NOVNC_PID 2>/dev/null || true
