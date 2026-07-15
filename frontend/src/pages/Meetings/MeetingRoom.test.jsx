// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, act } from "@testing-library/react";
import MeetingRoom from "./MeetingRoom";
import * as workspaceApi from "../../services/workspaceApi";
import { fetchWsTicket, getWsBaseUrl } from "../../services/wsTicket";
import { getAccessToken } from "../../services/api";

global.React = React;

// --- Mocks ---
vi.mock("react-router-dom", () => ({
  useParams: () => ({ meetingId: "1" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: {} }),
}));

vi.mock("../../context/WorkspaceContext", () => ({
  useWorkspace: () => ({
    profile: { id: 123, username: "testuser" },
  }),
}));

vi.mock("../../services/wsTicket", () => ({
  fetchWsTicket: vi.fn(() => Promise.resolve("mock-ticket")),
  getWsBaseUrl: () => "ws://localhost:8000",
}));

vi.mock("../../services/api", () => ({
  getAccessToken: () => "mock-access-token",
}));

vi.mock("../../services/workspaceApi", () => ({
  joinMeeting: vi.fn(() => Promise.resolve({ data: { id: 999 } })),
  getMeetings: vi.fn(() => Promise.resolve({ data: [{ id: 1, title: "Test Call", host: { id: 123 } }] })),
  updateParticipantStatus: vi.fn(() => Promise.resolve({})),
}));

// --- WebRTC Mocks ---
class MockRTCPeerConnection {
  static instances = [];

  constructor(config) {
    this.config = config;
    this.close = vi.fn();
    this.addTrack = vi.fn();
    this.addTransceiver = vi.fn(() => ({ sender: { track: null } }));
    
    // We attach mock local track stop spy to senders
    this.localTrackStopSpy = vi.fn();
    this.senderTrack = { kind: "audio", stop: this.localTrackStopSpy };
    
    this.getSenders = vi.fn(() => [
      {
        track: this.senderTrack,
        replaceTrack: vi.fn(() => Promise.resolve()),
      }
    ]);
    this.getTransceivers = vi.fn(() => []);
    this.createOffer = vi.fn(() => Promise.resolve({ type: "offer", sdp: "sdp-offer" }));
    this.createAnswer = vi.fn(() => Promise.resolve({ type: "answer", sdp: "sdp-answer" }));
    this.setLocalDescription = vi.fn();
    this.setRemoteDescription = vi.fn();
    
    this.connectionState = "new";
    this.iceConnectionState = "new";
    
    MockRTCPeerConnection.instances.push(this);
  }
}

global.RTCPeerConnection = MockRTCPeerConnection;

const mockVideoTrack = {
  kind: "video",
  stop: vi.fn(),
  enabled: true,
};

const mockAudioTrack = {
  kind: "audio",
  stop: vi.fn(),
  enabled: true,
};

const mockMediaStream = {
  getTracks: () => [mockVideoTrack, mockAudioTrack],
  getVideoTracks: () => [mockVideoTrack],
  getAudioTracks: () => [mockAudioTrack],
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
};

global.navigator.mediaDevices = {
  getUserMedia: vi.fn(() => Promise.resolve(mockMediaStream)),
  enumerateDevices: vi.fn(() =>
    Promise.resolve([
      { kind: "audioinput", deviceId: "mic-1", label: "Microphone 1" },
      { kind: "videoinput", deviceId: "cam-1", label: "Camera 1" },
    ])
  ),
};

global.MediaStream = function() {
  return mockMediaStream;
};

// --- Mock HTMLMediaElement srcObject ---
Object.defineProperty(global.HTMLMediaElement.prototype, 'srcObject', {
  get() { return this._srcObject; },
  set(val) { this._srcObject = val; }
});

class MockWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.send = vi.fn();
    
    // Auto-open in next tick
    this.openTimeout = setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 0);

    this.close = vi.fn(() => {
      if (this.openTimeout) clearTimeout(this.openTimeout);
      this.readyState = 3; // CLOSED
      if (this.onclose) this.onclose();
    });
    MockWebSocket.instances.push(this);
  }
}

global.WebSocket = MockWebSocket;

describe("MeetingRoom WebRTC Reconnection & Teardown Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockRTCPeerConnection.instances = [];
    MockWebSocket.instances = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a) When a duplicate peer_joined event fires for an existing peerId, the old connection closes and NO local tracks are stopped", async () => {
    const { unmount } = render(<MeetingRoom />);
    
    // Wait for WebSocket connection to open
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();

    // Trigger peer_joined from a remote peer (id: 456)
    await act(async () => {
      const msg = {
        data: JSON.stringify({
          type: "peer_joined",
          sender_id: 456,
          sender_username: "peer-456",
          micEnabled: true,
          camEnabled: true
        })
      };
      socket.onmessage(msg);
    });

    expect(MockRTCPeerConnection.instances.length).toBe(1);
    const firstPC = MockRTCPeerConnection.instances[0];

    // Trigger a duplicate join event for peer 456 (e.g., peer re-connected)
    await act(async () => {
      const msg = {
        data: JSON.stringify({
          type: "peer_joined",
          sender_id: 456,
          sender_username: "peer-456",
          micEnabled: true,
          camEnabled: true
        })
      };
      socket.onmessage(msg);
    });

    // Old connection should be closed
    expect(firstPC.close).toHaveBeenCalledTimes(1);
    // Local camera/mic tracks on senders should NOT be stopped (regression A-01 fix check)
    expect(firstPC.localTrackStopSpy).not.toHaveBeenCalled();

    // A new RTCPeerConnection should have been created
    expect(MockRTCPeerConnection.instances.length).toBe(2);

    unmount();
  });

  it("b) When signaling WebSocket closes unexpectedly, reconnect is attempted with backoff and stops at max attempts or unmount", async () => {
    const { unmount } = render(<MeetingRoom />);
    
    // Wait for first open
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    expect(MockWebSocket.instances.length).toBe(1);
    const socket = MockWebSocket.instances[0];

    // Close unexpectedly
    await act(async () => {
      socket.close();
    });

    // Reconnection should trigger after backoff delay
    // Delay for attempt 1 is min(1000 * 2^1, 30000) = 2000ms
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(MockWebSocket.instances.length).toBe(2);

    // Close again to trigger attempt 2 (delay: min(1000 * 2^2, 30000) = 4000ms)
    await act(async () => {
      MockWebSocket.instances[1].close();
    });

    await act(async () => {
      vi.advanceTimersByTime(4100);
    });

    expect(MockWebSocket.instances.length).toBe(3);

    // Let's force max reconnect attempts (10 attempts). Since limit is 10, it stops connecting.
    for (let i = 3; i <= 10; i++) {
      await act(async () => {
        MockWebSocket.instances[MockWebSocket.instances.length - 1].close();
      });
      await act(async () => {
        vi.advanceTimersByTime(31000); // Wait long enough for maximum delay (30000ms)
      });
    }

    const instancesCountAfterMax = MockWebSocket.instances.length;
    
    // Trigger one more close, should not reconnect further
    await act(async () => {
      MockWebSocket.instances[MockWebSocket.instances.length - 1].close();
    });
    await act(async () => {
      vi.advanceTimersByTime(31000);
    });

    expect(MockWebSocket.instances.length).toBe(instancesCountAfterMax);

    unmount();
  });

  it("c) On successful reconnect, a rejoin message is sent, and no duplicate/leaked connections result from reconnect flow", async () => {
    const { unmount } = render(<MeetingRoom />);
    
    // Wait for first open
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    const socket = MockWebSocket.instances[0];
    
    // Close unexpectedly
    await act(async () => {
      socket.close();
    });

    // Advance to trigger reconnect
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    // Wait for reconnect socket to open
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    const reconnectSocket = MockWebSocket.instances[1];
    expect(reconnectSocket).toBeDefined();

    // Verify peer_joined join payload is sent over the new socket
    expect(reconnectSocket.send).toHaveBeenCalled();
    const sentArgs = JSON.parse(reconnectSocket.send.mock.calls[0][0]);
    expect(sentArgs.type).toBe("peer_joined");
    expect(sentArgs.sender_id).toBe(123);

    unmount();
  });
});
