import { testContext } from "./testContext";
import { vi } from "vitest";

interface WebSocketConfig {
  onSend?: (ws: globalThis.WebSocket, data: any) => void;
  onclose?: (ws: globalThis.WebSocket) => void;
}

class WebSocketMock extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  protocols: string[];
  readyState: number;
  config: any;

  constructor(url: string, protocols: string[], config: WebSocketConfig = {}) {
    super();
    this.url = url;
    this.protocols = protocols;
    this.readyState = global.WebSocket.CONNECTING;
    this.config = config;
    setTimeout(() => {
      this._triggerOpen();
    }, 100);
  }

  send = vi.fn((data: any) => {
    if (this.config.onSend) {
      this.config.onSend(this, data);
    }
  });
  close = vi.fn(() => {
    this.readyState = global.WebSocket.CLOSED;
    if (this.config.onclose) {
      this.config.onclose(this);
    }
  });

  _triggerOpen() {
    this.readyState = global.WebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  _triggerMessage(data: any) {
    this.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify(data) }),
    );
  }

  _triggerError(error: any) {
    this.dispatchEvent(new Event("error", { error } as EventInit));
  }

  _triggerClose(event: any) {
    this.readyState = global.WebSocket.CLOSED;
    this.dispatchEvent(
      new Event("close", {
        code: event.code,
        reason: event.reason,
      } as EventInit),
    );
  }
}

export const mockWebSocket = (config?: WebSocketConfig) => {
  class MockWS extends WebSocketMock {
    constructor(url: string, protocols: string[]) {
      super(url, protocols, config);
      testContext.wsInstance = this;
    }
  }

  // copy WebSocket readyState constants
  (MockWS as any).CONNECTING = WebSocketMock.CONNECTING ?? 0;
  (MockWS as any).OPEN = WebSocketMock.OPEN ?? 1;
  (MockWS as any).CLOSING = WebSocketMock.CLOSING ?? 2;
  (MockWS as any).CLOSED = WebSocketMock.CLOSED ?? 3;

  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: MockWS,
  });
};
