import WebSocket, { WebSocketServer } from 'ws'; // <-- Import both default and WebSocketServer

class WebSocketService {
    constructor(server) {
        this.wss = new WebSocketServer({ server }); // <-- Use WebSocketServer
        this.connections = new Map(); // Store user connections
        this.setupWebSocket();
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            // Extract user ID from request query
            const userId = new URL(req.url, 'ws://localhost').searchParams.get('userId');
            if (!userId) {
                ws.close();
                return;
            }

            // Store connection
            this.connections.set(userId, ws);

            ws.on('message', async (message) => {
                try {
                    const command = JSON.parse(message);
                    await this.handleCommand(userId, command);
                } catch (error) {
                    ws.send(JSON.stringify({ error: error.message }));
                }
            });

            ws.on('close', () => {
                this.connections.delete(userId);
            });
        });
    }

    async handleCommand(userId, command) {
        const ws = this.connections.get(userId);
        if (!ws) return;

        try {
            switch (command.type) {
                case 'navigate':
                    // Handle navigation command
                    ws.send(JSON.stringify({ status: 'navigating', url: command.url }));
                    break;
                case 'click':
                    // Handle click command
                    ws.send(JSON.stringify({ status: 'clicking', selector: command.selector }));
                    break;
                default:
                    ws.send(JSON.stringify({ error: 'Unknown command' }));
            }
        } catch (error) {
            ws.send(JSON.stringify({ error: error.message }));
        }
    }

    // Send message to specific user
    sendToUser(userId, message) {
        const ws = this.connections.get(userId);
        if (ws && ws.readyState === WebSocket.OPEN) { // <-- Keep WebSocket.OPEN (from default import)
            ws.send(JSON.stringify(message));
        }
    }
}

export default WebSocketService;
