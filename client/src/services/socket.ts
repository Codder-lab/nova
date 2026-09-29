import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private userId: string = 'cli-user';

  public connect(userId = 'cli-user') {
    this.userId = userId;
    if (this.socket && this.socket.connected) return this.socket;

    this.socket = io({
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      this.socket?.emit('join:user', this.userId);
    });

    return this.socket;
  }

  public getSocket(): Socket | null {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  public joinRun(runId: string) {
    this.socket?.emit('join:run', runId);
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketClient = new SocketClient();
