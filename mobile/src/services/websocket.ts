/**
 * WebSocket service for real-time updates
 */

import { io, Socket } from 'socket.io-client';
import { secureStorage } from '../utils/secureStorage';

const WS_URL = process.env.WS_URL || 'http://localhost:3000';

type TransactionUpdateHandler = (data: {
  transactionId: string;
  status: string;
  processedAt?: string;
}) => void;

type BalanceUpdateHandler = (data: { balance: number }) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private transactionHandlers: TransactionUpdateHandler[] = [];
  private balanceHandlers: BalanceUpdateHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(): Promise<void> {
    const token = await secureStorage.getItem('ACCESS_TOKEN');

    if (!token) {
      console.warn('No access token available for WebSocket connection');
      return;
    }

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });


    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
      this.reconnectAttempts++;
    });

    this.socket.on('transaction:update', (data) => {
      this.transactionHandlers.forEach((handler) => handler(data));
    });

    this.socket.on('balance:update', (data) => {
      this.balanceHandlers.forEach((handler) => handler(data));
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.transactionHandlers = [];
    this.balanceHandlers = [];
  }

  onTransactionUpdate(handler: TransactionUpdateHandler): () => void {
    this.transactionHandlers.push(handler);
    return () => {
      this.transactionHandlers = this.transactionHandlers.filter((h) => h !== handler);
    };
  }

  onBalanceUpdate(handler: BalanceUpdateHandler): () => void {
    this.balanceHandlers.push(handler);
    return () => {
      this.balanceHandlers = this.balanceHandlers.filter((h) => h !== handler);
    };
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const websocketService = new WebSocketService();
