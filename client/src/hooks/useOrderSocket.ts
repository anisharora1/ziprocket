'use client';

import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';

interface OrderSocketHandlers {
  onNewOrder?: (data: any) => void;
  onOrderStatusUpdated?: (data: {
    orderId: string;
    orderStatus: string;
    orderType?: string;
    restaurantId?: string;
    zoneId?: string;
    userId?: string;
    [key: string]: any;
  }) => void;
  onOrderCancelled?: (data: {
    orderId: string;
    reason?: string;
    orderType?: string;
    restaurantId?: string;
    zoneId?: string;
    userId?: string;
    [key: string]: any;
  }) => void;
  onDeliveryAssigned?: (data: {
    orderId: string;
    deliveryBoyId: string;
    userId?: string;
    [key: string]: any;
  }) => void;
  onDeliveryAccepted?: (data: {
    orderId: string;
    deliveryBoyId?: string;
    userId?: string;
    [key: string]: any;
  }) => void;
  onDeliveryStatusUpdated?: (data: {
    orderId: string;
    deliveryId?: string;
    status: string;
    userId?: string;
    [key: string]: any;
  }) => void;
  onOrderDelivered?: (data: {
    orderId: string;
    userId?: string;
    [key: string]: any;
  }) => void;
  onPaymentStatusUpdated?: (data: {
    orderId: string;
    paymentStatus: string;
    userId?: string;
    [key: string]: any;
  }) => void;
  onReconnect?: () => void;
}

export function useOrderSocket(handlers: OrderSocketHandlers) {
  const { socket, isConnected } = useSocket();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const wasDisconnectedRef = useRef(false);

  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (data: any) => {
      handlersRef.current.onNewOrder?.(data);
    };

    const handleOrderStatusUpdated = (data: any) => {
      handlersRef.current.onOrderStatusUpdated?.(data);
    };

    const handleOrderCancelled = (data: any) => {
      handlersRef.current.onOrderCancelled?.(data);
    };

    const handleDeliveryAssigned = (data: any) => {
      handlersRef.current.onDeliveryAssigned?.(data);
    };

    const handleDeliveryAccepted = (data: any) => {
      handlersRef.current.onDeliveryAccepted?.(data);
    };

    const handleDeliveryStatusUpdated = (data: any) => {
      handlersRef.current.onDeliveryStatusUpdated?.(data);
    };

    const handleOrderDelivered = (data: any) => {
      handlersRef.current.onOrderDelivered?.(data);
    };

    const handlePaymentStatusUpdated = (data: any) => {
      handlersRef.current.onPaymentStatusUpdated?.(data);
    };

    const handleDisconnect = () => {
      wasDisconnectedRef.current = true;
    };

    const handleConnect = () => {
      if (wasDisconnectedRef.current) {
        console.log("[Socket] Reconnected, triggering stale data refresh...");
        wasDisconnectedRef.current = false;
        handlersRef.current.onReconnect?.();
      }
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_status_updated', handleOrderStatusUpdated);
    socket.on('order_cancelled', handleOrderCancelled);
    socket.on('delivery_assigned', handleDeliveryAssigned);
    socket.on('delivery_accepted', handleDeliveryAccepted);
    socket.on('delivery_status_updated', handleDeliveryStatusUpdated);
    socket.on('order_delivered', handleOrderDelivered);
    socket.on('payment_status_updated', handlePaymentStatusUpdated);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_status_updated', handleOrderStatusUpdated);
      socket.off('order_cancelled', handleOrderCancelled);
      socket.off('delivery_assigned', handleDeliveryAssigned);
      socket.off('delivery_accepted', handleDeliveryAccepted);
      socket.off('delivery_status_updated', handleDeliveryStatusUpdated);
      socket.off('order_delivered', handleOrderDelivered);
      socket.off('payment_status_updated', handlePaymentStatusUpdated);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
    };
  }, [socket]);

  return { isConnected, socket };
}
