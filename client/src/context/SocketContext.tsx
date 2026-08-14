'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { initSocket, disconnectSocket, getSocket } from '../services/socketClient';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinDeliveryZone: (zoneId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, token } = useAuth();
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (token && user) {
      const sock = initSocket(token);
      setSocketInstance(sock);

      const handleConnect = () => {
        setIsConnected(true);
      };

      const handleDisconnect = () => {
        setIsConnected(false);
      };

      sock.on('connect', handleConnect);
      sock.on('disconnect', handleDisconnect);

      if (sock.connected) {
        setIsConnected(true);
      } else {
        sock.connect();
      }

      return () => {
        sock.off('connect', handleConnect);
        sock.off('disconnect', handleDisconnect);
      };
    } else {
      setIsConnected(false);
      disconnectSocket();
      setSocketInstance(null);
    }
  }, [token, user]);

  const joinDeliveryZone = useCallback((zoneId: string) => {
    const activeSocket = getSocket() || socketInstance;
    if (activeSocket && activeSocket.connected && zoneId) {
      activeSocket.emit('join_delivery_zone', zoneId);
    }
  }, [socketInstance]);

  const value = useMemo(() => ({
    socket: socketInstance,
    isConnected,
    joinDeliveryZone,
  }), [socketInstance, isConnected, joinDeliveryZone]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
