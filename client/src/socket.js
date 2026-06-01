import { io } from 'socket.io-client';

const DEFAULT_BACKEND_URL = 'http://localhost:4000';

export function createSocket(options = {}) {
  const backendUrl = options.backendUrl ?? import.meta.env.VITE_BACKEND_URL ?? DEFAULT_BACKEND_URL;

  return io(backendUrl, {
    autoConnect: false,
    transports: ['websocket', 'polling']
  });
}
