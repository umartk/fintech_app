import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { createServer } from 'http';
import { initializeWebSocket } from './websocket';

const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);

// Initialize WebSocket server
initializeWebSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

export default httpServer;
