import type { WsMessage } from "@/types/api";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

type WsHandler = (message: WsMessage) => void;

interface WsClientOptions {
  token: string;
  onMessage: WsHandler;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * WebSocket client with auto-reconnect and heartbeat.
 *
 * Channels:
 *   /ws/dashboards/{dashboardId}?token=jwt
 *   /ws/alerts?token=jwt
 *   /ws/events?token=jwt
 */
export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private options: WsClientOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  constructor(path: string, options: WsClientOptions) {
    this.url = `${WS_BASE}${path}?token=${options.token}`;
    this.options = options;
  }

  connect() {
    this.intentionalClose = false;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.options.onConnect?.();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as WsMessage;
      if (message.type === "pong") return; // heartbeat response
      this.options.onMessage(message);
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.options.onDisconnect?.();
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(message: WsMessage | { type: string; payload?: unknown }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    this.intentionalClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.ws?.close();
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: "ping" });
    }, 30_000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
}

// ---------- Channel factory helpers ----------

export function createDashboardWs(
  dashboardId: string,
  token: string,
  onMessage: WsHandler
) {
  return new WsClient(`/ws/dashboards/${dashboardId}`, {
    token,
    onMessage,
  });
}

export function createAlertsWs(token: string, onMessage: WsHandler) {
  return new WsClient("/ws/alerts", { token, onMessage });
}

export function createEventsWs(token: string, onMessage: WsHandler) {
  return new WsClient("/ws/events", { token, onMessage });
}
