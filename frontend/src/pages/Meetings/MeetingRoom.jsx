import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Mic, MicOff, Video as VideoIcon, VideoOff,
  PhoneOff, Phone, Monitor, MonitorOff, Users, Loader2, AlertCircle,
  PhoneCall, Hand, Settings
} from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import * as workspaceApi from "../../services/workspaceApi";
import { extractErrorMessage, getAvatarColor } from "../../utils/helpers";
import { fetchWsTicket, getWsBaseUrl } from "../../services/wsTicket";
import { getAccessToken } from "../../services/api";
import logger from "../../utils/logger";
import "./MeetingRoom.scss";

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    // TURN server (optional, via env variables)
    ...(import.meta.env.VITE_TURN_URL ? [{
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USER,
      credential: import.meta.env.VITE_TURN_PASS
    }] : []),
  ],
  iceCandidatePoolSize: 10,
};

// Maximum reconnection attempts for signaling WebSocket
const MAX_RECONNECT_ATTEMPTS = 10;

// --- Utility: attach srcObject safely ---
function attachStream(videoEl, stream) {
  if (videoEl && stream && videoEl.srcObject !== stream) {
    videoEl.srcObject = stream;
  }
}

function getAvatarGradient(username) {
  const color = getAvatarColor(username);
  return [color, `${color}99`];
}

// --- Remote Video Tile (Meet-style) ---
function RemoteTile({ peerId, peer }) {
  const videoRef = useRef(null);
  const [streamHasVideo, setStreamHasVideo] = useState(false);
  const [streamHasAudio, setStreamHasAudio] = useState(false);

  useEffect(() => {
    const stream = peer.stream;
    if (!stream) { setStreamHasVideo(false); setStreamHasAudio(false); return; }

    if (videoRef.current) videoRef.current.srcObject = stream;

    const checkTracks = () => {
      const vTracks = stream.getVideoTracks();
      const aTracks = stream.getAudioTracks();
      setStreamHasVideo(vTracks.length > 0);
      setStreamHasAudio(aTracks.length > 0);
    };

    stream.addEventListener("addtrack", checkTracks);
    stream.addEventListener("removetrack", checkTracks);
    checkTracks();

    return () => {
      stream.removeEventListener("addtrack", checkTracks);
      stream.removeEventListener("removetrack", checkTracks);
    };
  }, [peer.stream]);

  const hasVideo = (peer.camEnabled !== false) && streamHasVideo;
  const isMuted = (peer.micEnabled === false) || !streamHasAudio;

  const initials = peer.username ? peer.username.substring(0, 2).toUpperCase() : "?";
  const colors = getAvatarGradient(peer.username);

  return (
    <div className="meet-tile">
      {peer.stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`meet-tile__video ${!hasVideo ? "meet-tile__video--hidden" : ""}`}
        />
      )}
      {!hasVideo && (
        <div
          className="meet-tile__avatar"
          style={{ background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)` }}
        >
          <span>{initials}</span>
        </div>
      )}
      <div className="meet-tile__overlay">
        <div className="meet-tile__name">
          {isMuted && <MicOff size={12} className="meet-tile__mute-icon" />}
          <span>{peer.username}</span>
        </div>
      </div>
    </div>
  );
}

// --- Teams Audio Card (one per participant) ---
function TeamsAudioCard({ username, isMuted, isSelf, avatarColors }) {
  const initials = username ? username.substring(0, 2).toUpperCase() : "?";
  const colors = avatarColors || getAvatarGradient(username);
  const isSpeaking = !isMuted;

  return (
    <div className={`teams-card ${isSpeaking ? "teams-card--speaking" : "teams-card--muted"}`}>
      {/* Concentric ripple rings when speaking */}
      {isSpeaking && (
        <div className="teams-card__rings">
          <div className="teams-card__ring teams-card__ring--1" />
          <div className="teams-card__ring teams-card__ring--2" />
          <div className="teams-card__ring teams-card__ring--3" />
        </div>
      )}
      <div className="teams-card__avatar-wrap">
        <div
          className="teams-card__avatar"
          style={{ background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)` }}
        >
          <span>{initials}</span>
        </div>
        {isMuted && (
          <div className="teams-card__mute-badge">
            <MicOff size={13} />
          </div>
        )}
      </div>
      <div className="teams-card__name">
        <span>{username}{isSelf ? " (You)" : ""}</span>
      </div>
    </div>
  );
}

// --- Remote Audio Tile (reads stream audio state) ---
function RemoteAudioCard({ peer }) {
  const [streamHasAudio, setStreamHasAudio] = useState(false);

  useEffect(() => {
    const stream = peer.stream;
    if (!stream) { setStreamHasAudio(false); return; }

    const check = () => {
      const aTracks = stream.getAudioTracks();
      setStreamHasAudio(aTracks.length > 0);
    };

    stream.addEventListener("addtrack", check);
    stream.addEventListener("removetrack", check);
    check();

    return () => {
      stream.removeEventListener("addtrack", check);
      stream.removeEventListener("removetrack", check);
    };
  }, [peer.stream]);

  const isMuted = (peer.micEnabled === false) || !streamHasAudio;

  return <TeamsAudioCard username={peer.username} isMuted={isMuted} isSelf={false} />;
}

// --- Elapsed timer hook (starts only when call is connected) ---
function useCallTimer(isConnected, waitingLabel = "Ringing...") {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    if (!isConnected) {
      startRef.current = null;
      setElapsed(0);
      return undefined;
    }

    if (startRef.current === null) {
      startRef.current = Date.now();
    }

    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);

    return () => clearInterval(id);
  }, [isConnected]);

  if (!isConnected) return waitingLabel;

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useWorkspace();

  // UI State
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState(null);

  // Media state
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [peers, setPeers] = useState({});
  const [callConnected, setCallConnected] = useState(false);
  // WebSocket connection status for signaling
  const [wsStatus, setWsStatus] = useState('disconnected');
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);

  // A-05: device selection
  const [deviceList, setDeviceList] = useState({ audio: [], video: [] });
  const [selectedMicId, setSelectedMicId] = useState("");
  const [selectedCamId, setSelectedCamId] = useState("");
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);


  // Refs
  const wsRef = useRef(null);
  const localVideoRef = useRef(null);
  const pipVideoRef = useRef(null);          // PiP self-view in video mode
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const activeStreamRef = useRef(null);
  const peersRef = useRef({});
  const micEnabledRef = useRef(false);
  const camEnabledRef = useRef(false);
  const screenSharingRef = useRef(false);
  const participantIdRef = useRef(null);
  const pendingOffersRef = useRef([]);

  const peerCount = Object.keys(peers).length;
  const callStatusLabel = !callConnected
    ? peerCount === 0
      ? (audioOnly ? "Ringing..." : "Waiting...")
      : "Connecting..."
    : "";
  const callTimer = useCallTimer(callConnected, callStatusLabel);

  // Sync refs with state
  useEffect(() => { micEnabledRef.current = micEnabled; }, [micEnabled]);
  useEffect(() => { camEnabledRef.current = camEnabled; }, [camEnabled]);
  useEffect(() => { screenSharingRef.current = screenSharing; }, [screenSharing]);

  // Keep PiP video element in sync with the active stream
  useEffect(() => {
    if (pipVideoRef.current && cameraStreamRef.current) {
      pipVideoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [camEnabled, audioOnly]);

  // ---------- TRACK REPLACEMENT ----------
  const replaceSenderTrack = useCallback((kind, newTrack) => {
    Object.values(peersRef.current).forEach(({ pc }) => {
      let target = pc.getSenders().find(s => s.track?.kind === kind);
      if (!target) {
        const tc = pc.getTransceivers().find(t =>
          t.sender.track?.kind === kind || t.receiver.track?.kind === kind
        );
        if (tc) target = tc.sender;
      }
      if (target) target.replaceTrack(newTrack).catch(e => logger.warn(`replaceTrack(${kind}) failed:`, e));
    });
  }, []);

  // ---------- GET LOCAL CAMERA/MIC STREAM ----------
  const getCameraStream = useCallback(async () => {
    const attempts = [
      { video: { width: 1280, height: 720, facingMode: "user" }, audio: true },
      { video: true, audio: true },
      { video: true, audio: false },
      { video: false, audio: true },
    ];
    let lastError = null;
    for (const constraints of attempts) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        setMediaError(null);
        return { stream: s, hasVideo: !!s.getVideoTracks().length, hasAudio: !!s.getAudioTracks().length };
      } catch (err) { lastError = err; }
    }

    if (lastError?.name === 'NotAllowedError' || lastError?.name === 'PermissionDeniedError') {
       logger.warn("Camera/Mic permissions denied by user.");
       setMediaError({
         type: 'permission',
         message: "Camera or Microphone access was denied."
       });
    } else if (lastError?.name === 'NotFoundError') {
       logger.warn("No camera/mic hardware found:", lastError);
       setMediaError({
         type: 'hardware',
         message: "No camera or microphone found on your device."
       });
    } else if (lastError) {
       logger.warn("Could not access media devices:", lastError);
       setMediaError({
         type: 'other',
         message: "Could not access Camera/Microphone: " + lastError.message
       });
    }

    return { stream: new MediaStream(), hasVideo: false, hasAudio: false };
  }, []);

  // ---------- RETRY MEDIA ACCESS ----------
  const retryMediaAccess = useCallback(async () => {
    setMediaError(null);
    const { stream, hasVideo, hasAudio } = await getCameraStream();
    cameraStreamRef.current = stream;
    activeStreamRef.current = stream;
    setCamEnabled(hasVideo);
    setMicEnabled(hasAudio);
    camEnabledRef.current = hasVideo;
    micEnabledRef.current = hasAudio;
    attachStream(localVideoRef.current, stream);
    attachStream(pipVideoRef.current, stream);
  }, [getCameraStream]);

  const updateCallConnected = useCallback(() => {
    const connected = Object.values(peersRef.current).some(
      ({ pc }) => pc.connectionState === "connected"
    );
    setCallConnected(connected);
  }, []);

  const removePeer = useCallback((peerId) => {
    const peer = peersRef.current[peerId];
    if (peer) {
      peer.pc.close();
      delete peersRef.current[peerId];
      setPeers(prev => { const c = { ...prev }; delete c[peerId]; return c; });
      updateCallConnected();
    }
  }, [updateCallConnected]);

  // ---------- CREATE PEER CONNECTION ----------
    // Helper to safely replace or create a peer connection. Prevents duplicate joins from leaking connections.
  const replacePeerConnection = (peerId, peerUsername) => {
    // If an existing connection exists for this peer, clean it up first to
    // prevent connection leaks when the same peer re-joins (e.g. page refresh
    // or transient reconnect sends a duplicate peer_joined event).
    if (peersRef.current[peerId]) {
      logger.warn(`Duplicate join for peer ${peerId} – closing stale RTCPeerConnection.`);
      const old = peersRef.current[peerId];
      // IMPORTANT: Do NOT call s.track.stop() on senders here.
      // RTCRtpSender.track is the LOCAL capture track (mic / camera) that
      // this user's hardware is producing. Stopping it kills the local stream
      // permanently, which is what caused this regression (A-01).
      // pc.close() is sufficient: it terminates the peer connection and all
      // associated DTLS / ICE state without touching local MediaStreamTracks.
      old.pc.close();
      delete peersRef.current[peerId];
      setPeers(prev => { const copy = { ...prev }; delete copy[peerId]; return copy; });
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const stream = activeStreamRef.current;
    if (stream) stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const hasVideo = stream?.getVideoTracks().length > 0;
    const hasAudio = stream?.getAudioTracks().length > 0;
    if (stream) {
      if (!hasVideo) pc.addTransceiver("video", { direction: "sendrecv", streams: [stream] });
      if (!hasAudio) pc.addTransceiver("audio", { direction: "sendrecv", streams: [stream] });
    } else {
      pc.addTransceiver("video", { direction: "sendrecv" });
      pc.addTransceiver("audio", { direction: "sendrecv" });
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ice_candidate", target: peerId, candidate }));
      }
    };

    pc.ontrack = ({ streams, track }) => {
      setPeers(prev => {
        const existing = prev[peerId];
        let remoteStream = streams[0] || existing?.stream || new MediaStream();
        if (!remoteStream.getTracks().includes(track)) remoteStream.addTrack(track);
        if (peersRef.current[peerId]) peersRef.current[peerId].stream = remoteStream;
        return { ...prev, [peerId]: { ...existing, stream: remoteStream, username: existing?.username } };
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") { if (pc.restartIce) pc.restartIce(); }
      if (pc.connectionState === "disconnected" || pc.connectionState === "closed") removePeer(peerId);
      updateCallConnected();
    };

    pc.oniceconnectionstatechange = () => {
      updateCallConnected();
    };

    pc.onnegotiationneeded = async () => {
      if (peersRef.current[peerId]?.isOfferer) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          wsRef.current?.send(JSON.stringify({
            type: "offer",
            target: peerId,
            sdp: pc.localDescription,
            // A-03: include our own current media state so the answerer
            // learns it without needing a separate media_state message.
            micEnabled: micEnabledRef.current,
            camEnabled: camEnabledRef.current,
          }));
        } catch (e) { logger.warn("Renegotiation failed:", e); }
      }
    };

    peersRef.current[peerId] = { pc, username: peerUsername, stream: null, isOfferer: false };
    setPeers(prev => ({ ...prev, [peerId]: { pc, username: peerUsername, stream: null } }));
    return pc;
  };

  // Backwards compatible wrapper used elsewhere in this file.
  const createPeerConnection = useCallback((peerId, peerUsername) => replacePeerConnection(peerId, peerUsername), [removePeer, updateCallConnected]);

  // ---------- SIGNALING ----------
  const handleSignalingMessage = useCallback(async (message) => {
    const { type, sender_id, sender_username, sdp, candidate, target, micEnabled, camEnabled } = message;
    if (target && Number(target) !== Number(profile?.id)) return;

    switch (type) {
      case "peer_joined": {
        if (Number(sender_id) === Number(profile?.id)) return;
        const pc = createPeerConnection(sender_id, sender_username);
        peersRef.current[sender_id].isOfferer = true;

        if (micEnabled !== undefined || camEnabled !== undefined) {
          setPeers(prev => ({
            ...prev,
            [sender_id]: {
              ...prev[sender_id],
              username: sender_username,
              micEnabled: micEnabled ?? true,
              camEnabled: camEnabled ?? true
            }
          }));
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        wsRef.current?.send(JSON.stringify({
          type: "offer",
          target: sender_id,
          sdp: pc.localDescription,
          // A-03: include our own current media state in the offer so the
          // joining/reconnecting peer learns it as part of SDP exchange.
          micEnabled: micEnabledRef.current,
          camEnabled: camEnabledRef.current,
        }));

        // Also re-send an explicit media_state so reconnecting clients learn
        // our state immediately even if the offer arrives with a slight delay.
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'media_state',
            sender_id: profile?.id,
            micEnabled: micEnabledRef.current,
            camEnabled: camEnabledRef.current,
          }));
        }
        break;
      }
      case "media_state": {
        setPeers(prev => {
          if (!prev[sender_id]) return prev;
          return {
            ...prev,
            [sender_id]: {
              ...prev[sender_id],
              username: prev[sender_id].username,
              micEnabled,
              camEnabled
            }
          };
        });
        break;
      }
      case "offer": {
        let peer = peersRef.current[sender_id];
        const pc = peer ? peer.pc : createPeerConnection(sender_id, sender_username);

        // A-03: apply the offerer's media state if carried in the offer payload.
        if (message.micEnabled !== undefined || message.camEnabled !== undefined) {
          setPeers(prev => {
            if (!prev[sender_id]) return prev;
            return {
              ...prev,
              [sender_id]: {
                ...prev[sender_id],
                username: prev[sender_id].username || sender_username,
                micEnabled: message.micEnabled ?? prev[sender_id]?.micEnabled,
                camEnabled: message.camEnabled ?? prev[sender_id]?.camEnabled,
              },
            };
          });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.send(JSON.stringify({
          type: "answer",
          target: sender_id,
          sdp: pc.localDescription,
          // A-03: echo our own media state in the answer so the offerer learns
          // our state without needing a separate round-trip.
          micEnabled: micEnabledRef.current,
          camEnabled: camEnabledRef.current,
        }));
        break;
      }
      case "answer": {
        const peer = peersRef.current[sender_id];
        if (peer) {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
          // A-03: apply the answerer's media state if carried in the answer payload.
          if (message.micEnabled !== undefined || message.camEnabled !== undefined) {
            setPeers(prev => {
              if (!prev[sender_id]) return prev;
              return {
                ...prev,
                [sender_id]: {
                  ...prev[sender_id],
                  username: prev[sender_id].username,
                  micEnabled: message.micEnabled ?? prev[sender_id]?.micEnabled,
                  camEnabled: message.camEnabled ?? prev[sender_id]?.camEnabled,
                },
              };
            });
          }
        }
        break;
      }
      case "ice_candidate": {
        const peer = peersRef.current[sender_id];
        if (peer && candidate) peer.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => logger.warn("addIceCandidate failed:", e));
        break;
      }
      case "peer_left": {
        removePeer(sender_id);
        break;
      }
      default: break;
    }
  }, [profile?.id, createPeerConnection, removePeer]);

  // ---------- WEBSOCKET ----------
  const initWebSocket = useCallback(async () => {
    if (!getAccessToken()) return;
    const connect = async () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setWsStatus('error');
        return;
      }
      try {
        const ticket = await fetchWsTicket();
        const url = `${getWsBaseUrl()}/ws/call/${meetingId}/?ticket=${encodeURIComponent(ticket)}`;
        const socket = new WebSocket(url);
        wsRef.current = socket;

        socket.onopen = () => {
          logger.log('Signaling WS connected');
          setWsStatus('connected');
          reconnectAttemptsRef.current = 0;
          wsRef.current.send(JSON.stringify({
            type: 'peer_joined',
            sender_id: profile?.id,
            sender_username: profile?.username,
            micEnabled: micEnabledRef.current,
            camEnabled: camEnabledRef.current,
          }));
          // Send any pending offers to existing participants
          pendingOffersRef.current.forEach(offer => {
            wsRef.current.send(JSON.stringify(offer));
          });
          pendingOffersRef.current = [];
        };

        socket.onmessage = async (e) => {
          try { await handleSignalingMessage(JSON.parse(e.data)); }
          catch (err) { logger.error('Signaling error:', err); }
        };

        socket.onerror = (e) => {
          logger.error('WS error:', e);
          socket.close();
        };

        socket.onclose = () => {
          wsRef.current = null;
          if (participantIdRef.current === null) return;
          setWsStatus('reconnecting');
          scheduleReconnect();
        };
      } catch (err) {
        logger.error('Failed to connect signaling WS:', err);
        setWsStatus('reconnecting');
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      reconnectAttemptsRef.current += 1;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    connect();
  }, [meetingId, handleSignalingMessage, profile?.id, profile?.username]);

  // ---------- INIT ----------
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const joinRes = await workspaceApi.joinMeeting(meetingId);
        if (!mounted) return;
        participantIdRef.current = joinRes.data?.id;

        const detailsRes = await workspaceApi.getMeetings();
        const m = detailsRes.data.find(x => Number(x.id) === Number(meetingId));
        if (mounted) setMeeting(m);

        const { stream, hasVideo, hasAudio } = await getCameraStream();
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

        cameraStreamRef.current = stream;
        activeStreamRef.current = stream;
        setCamEnabled(hasVideo);
        setMicEnabled(hasAudio);
        camEnabledRef.current = hasVideo;
        micEnabledRef.current = hasAudio;

        attachStream(localVideoRef.current, stream);
        attachStream(pipVideoRef.current, stream);

        if (location.state?.audioOnly) {
          stream.getVideoTracks().forEach(t => { t.enabled = false; });
          setCamEnabled(false);
          camEnabledRef.current = false;
          setAudioOnly(true);
        }

        // Fetch existing participants and reconnect to those who are present
        try {
          const participantsRes = await workspaceApi.getMeetingParticipants(meetingId);
          if (mounted && participantsRes.data) {
            const presentParticipants = participantsRes.data.filter(p => p.is_present && p.user !== profile?.id);
            for (const participant of presentParticipants) {
              const username = participant.user?.username || participant.user_username || participant.username;
              const userId = participant.user?.id || participant.user_id || participant.id;
              const pc = createPeerConnection(userId, username);
              peersRef.current[userId].isOfferer = true;
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              // Store pending offer to send after WebSocket connects
              pendingOffersRef.current.push({
                target: userId,
                sdp: pc.localDescription,
                micEnabled: micEnabledRef.current,
                camEnabled: camEnabledRef.current,
              });
            }
          }
        } catch (err) {
          logger.warn("Failed to fetch existing participants:", err);
        }

        initWebSocket();
      } catch (err) {
        if (mounted) setError(extractErrorMessage(err) || "Failed to join meeting.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

      return () => {
        mounted = false;
        // Cancel any pending reconnection attempts
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        // Signal intentional leave so onclose does not retry
        const leaveId = participantIdRef.current;
        participantIdRef.current = null;
        pendingOffersRef.current = [];
        cameraStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        Object.values(peersRef.current).forEach(p => p.pc.close());
        peersRef.current = {};
        wsRef.current?.close();
        if (leaveId) {
          workspaceApi.updateParticipantStatus(meetingId, leaveId, { is_present: false }).catch(() => {});
        }
      };
  }, [meetingId, profile?.id, createPeerConnection]);

  // ---------- TOGGLE MIC ----------
  const toggleMic = useCallback(async () => {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      const newState = !micEnabledRef.current;
      audioTracks.forEach(t => { t.enabled = newState; });
      setMicEnabled(newState);
      micEnabledRef.current = newState;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'media_state', sender_id: profile?.id, micEnabled: newState, camEnabled: camEnabledRef.current }));
      }
    } else {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = micStream.getAudioTracks()[0];
        stream.addTrack(audioTrack);
        replaceSenderTrack("audio", audioTrack);
        setMicEnabled(true);
        micEnabledRef.current = true;
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'media_state', sender_id: profile?.id, micEnabled: true, camEnabled: camEnabledRef.current }));
        }
      } catch (err) { logger.warn("Could not access microphone:", err); }
    }
  }, [replaceSenderTrack, profile?.id]);

  // ---------- TOGGLE CAMERA ----------
  const toggleCam = useCallback(async () => {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0) {
      const newState = !camEnabledRef.current;
      videoTracks.forEach(t => { t.enabled = newState; });
      setCamEnabled(newState);
      camEnabledRef.current = newState;
      if (!screenSharingRef.current) {
        attachStream(localVideoRef.current, stream);
        attachStream(pipVideoRef.current, stream);
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'media_state', sender_id: profile?.id, micEnabled: micEnabledRef.current, camEnabled: newState }));
      }
    } else {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        const videoTrack = camStream.getVideoTracks()[0];
        stream.addTrack(videoTrack);
        if (!screenSharingRef.current) {
          replaceSenderTrack("video", videoTrack);
          attachStream(localVideoRef.current, stream);
          attachStream(pipVideoRef.current, stream);
        }
        setCamEnabled(true);
        camEnabledRef.current = true;
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'media_state', sender_id: profile?.id, micEnabled: micEnabledRef.current, camEnabled: true }));
        }
      } catch (err) { logger.warn("Could not access camera:", err); }
    }
  }, [replaceSenderTrack, profile?.id]);

  // ---------- SHARE SCREEN ----------
  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    const cameraVideoTrack = cameraStreamRef.current?.getVideoTracks()[0] ?? null;
    if (cameraVideoTrack) cameraVideoTrack.enabled = camEnabledRef.current;
    replaceSenderTrack("video", cameraVideoTrack);
    activeStreamRef.current = cameraStreamRef.current;
    if (localVideoRef.current) localVideoRef.current.srcObject = cameraStreamRef.current;
    setScreenSharing(false);
    screenSharingRef.current = false;
  }, [replaceSenderTrack]);

  const shareScreen = useCallback(async () => {
    if (screenSharingRef.current) { await stopScreenShare(); return; }
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor", width: 1920, height: 1080 },
        audio: true,
      });
      screenStreamRef.current = displayStream;
      const screenVideoTrack = displayStream.getVideoTracks()[0];
      replaceSenderTrack("video", screenVideoTrack);
      activeStreamRef.current = displayStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = displayStream;
      setScreenSharing(true);
      screenSharingRef.current = true;
      screenVideoTrack.addEventListener("ended", () => stopScreenShare(), { once: true });
    } catch (err) { logger.warn("Screen share cancelled or failed:", err); }
  }, [replaceSenderTrack, stopScreenShare]);

  // ---------- AUDIO-ONLY TOGGLE ----------
  const toggleAudioOnly = useCallback(async () => {
    const stream = cameraStreamRef.current;
    if (!stream) return;

    if (audioOnly) {
      // Switch back to video
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach(t => { t.enabled = true; });
        setCamEnabled(true);
        camEnabledRef.current = true;
      } else {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
          const videoTrack = camStream.getVideoTracks()[0];
          stream.addTrack(videoTrack);
          if (!screenSharingRef.current) {
            replaceSenderTrack("video", videoTrack);
            attachStream(localVideoRef.current, stream);
            attachStream(pipVideoRef.current, stream);
          }
          setCamEnabled(true);
          camEnabledRef.current = true;
        } catch (err) { logger.warn("Could not access camera:", err); }
      }
      setAudioOnly(false);
    } else {
      // Switch to audio-only
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(t => { t.enabled = false; });
      setCamEnabled(false);
      camEnabledRef.current = false;

      if (screenSharingRef.current) {
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        const cameraVideoTrack = stream.getVideoTracks()[0] ?? null;
        replaceSenderTrack("video", cameraVideoTrack);
        activeStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setScreenSharing(false);
        screenSharingRef.current = false;
      }

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks.forEach(t => { t.enabled = true; });
        setMicEnabled(true);
        micEnabledRef.current = true;
      } else {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioTrack = micStream.getAudioTracks()[0];
          stream.addTrack(audioTrack);
          replaceSenderTrack("audio", audioTrack);
          setMicEnabled(true);
          micEnabledRef.current = true;
        } catch (err) { logger.warn("Could not access microphone:", err); }
      }

      setAudioOnly(true);
    }
  }, [audioOnly, replaceSenderTrack]);

  // ---------- A-05: DEVICE ENUMERATION + SWITCHING ----------
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setDeviceList({
        audio: devices.filter((d) => d.kind === "audioinput"),
        video: devices.filter((d) => d.kind === "videoinput"),
      });
    } catch (err) {
      logger.warn("enumerateDevices failed:", err);
    }
  }, []);

  // Run once after initial getUserMedia (permissions grant labels).
  useEffect(() => {
    if (!loading) enumerateDevices();
  }, [loading, enumerateDevices]);

  const switchMic = useCallback(async (deviceId) => {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
      const newTrack = micStream.getAudioTracks()[0];
      const stream = cameraStreamRef.current;
      if (stream) {
        // Remove old audio tracks from the stream.
        stream.getAudioTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
        stream.addTrack(newTrack);
      }
      replaceSenderTrack("audio", newTrack);
      setSelectedMicId(deviceId);
      micEnabledRef.current = true;
      setMicEnabled(true);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "media_state", sender_id: profile?.id, micEnabled: true, camEnabled: camEnabledRef.current }));
      }
      enumerateDevices();
    } catch (err) {
      logger.warn("switchMic failed:", err);
    }
  }, [replaceSenderTrack, enumerateDevices, profile?.id]);

  const switchCam = useCallback(async (deviceId) => {
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId }, width: 1280, height: 720 } });
      const newTrack = camStream.getVideoTracks()[0];
      const stream = cameraStreamRef.current;
      if (stream) {
        stream.getVideoTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
        stream.addTrack(newTrack);
      }
      if (!screenSharingRef.current) {
        replaceSenderTrack("video", newTrack);
        attachStream(localVideoRef.current, stream);
        attachStream(pipVideoRef.current, stream);
      }
      setSelectedCamId(deviceId);
      camEnabledRef.current = true;
      setCamEnabled(true);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "media_state", sender_id: profile?.id, micEnabled: micEnabledRef.current, camEnabled: true }));
      }
      enumerateDevices();
    } catch (err) {
      logger.warn("switchCam failed:", err);
    }
  }, [replaceSenderTrack, enumerateDevices, profile?.id]);

  // ---------- DISCONNECT ----------
  const handleDisconnect = useCallback(() => {
    navigate("/meetings");
  }, [navigate]);

  // ---------- RENDER ----------
  if (loading) {
    return (
      <div className="gmeet-loading">
        <div className="gmeet-loading__spinner">
          <Loader2 size={36} className="spin" />
        </div>
        <h3>Joining meeting...</h3>
        <p>Setting up audio and video</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gmeet-error">
        <AlertCircle size={52} />
        <h2>Couldn't join</h2>
        <p>{error}</p>
        <button className="vtl-btn vtl-btn--primary" onClick={handleDisconnect}>
          Back to Meetings
        </button>
      </div>
    );
  }

  const mediaErrorContent = mediaError && (
    <div className="gmeet-media-error">
      <AlertCircle size={20} />
      <div className="gmeet-media-error__content">
        <span className="gmeet-media-error__message">{mediaError.message}</span>
        {mediaError.type === 'permission' && (
          <div className="gmeet-media-error__instructions">
            <span>To fix:</span>
            <ol>
              <li>Click the lock icon 🔒 in the address bar (left of the URL)</li>
              <li>Click 'Site settings' or 'Permissions'</li>
              <li>Find 'Camera' and 'Microphone' and set them to 'Allow'</li>
              <li>If it shows 'Block', click 'Reset permissions first'</li>
              <li>Close the settings panel and click Retry below</li>
            </ol>
          </div>
        )}
        {mediaError.type === 'hardware' && (
          <div className="gmeet-media-error__instructions">
            <span>Please ensure:</span>
            <ul>
              <li>Your camera/microphone is connected</li>
              <li>No other app is using them</li>
              <li>Your device drivers are working</li>
            </ul>
          </div>
        )}
      </div>
      <button className="vtl-btn vtl-btn--primary vtl-btn--sm" onClick={retryMediaAccess}>
        Retry
      </button>
    </div>
  );

  const peersArray = Object.entries(peers);
  const totalCount = peersArray.length + 1;
  const userName = profile?.username || "You";
  const userInitials = userName.substring(0, 2).toUpperCase();
  const userColors = getAvatarGradient(userName);
  const isAudioMode = audioOnly && !screenSharing;

  return (
    <div className={`gmeet ${isAudioMode ? "gmeet--audio-mode" : "gmeet--video-mode"}`}>

      {/* ---- HEADER ---- */}
      <header className="gmeet__header">
        <div className="gmeet__header-left">
          {isAudioMode ? (
            <div className="gmeet__call-indicator">
              <PhoneCall size={15} className="gmeet__call-icon" />
              <span>Audio Call</span>
            </div>
          ) : (
            <div className="gmeet__call-indicator">
              <VideoIcon size={15} className="gmeet__call-icon" />
              <span>{meeting?.title || "Meeting"}</span>
            </div>
          )}
          <span className="gmeet__timer">{callTimer}</span>
          {wsStatus === 'reconnecting' && (<span className="status-badge reconnecting">Reconnecting…</span>)}
          {wsStatus === 'lost' && (<span className="status-badge lost">Connection lost – please rejoin</span>)}
        </div>
        <div className="gmeet__header-right">
          {mediaErrorContent}
          <div className="gmeet__participants-badge">
            <Users size={13} />
            <span>{totalCount}</span>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════
          AUDIO MODE: Microsoft Teams style
      ════════════════════════════════════════════ */}
      {isAudioMode && (
        <main className="teams-call">
          <div className={`teams-call__grid teams-call__grid--count-${Math.min(totalCount, 9)}`}>
            {/* Self card */}
            <TeamsAudioCard
              username={userName}
              isMuted={!micEnabled}
              isSelf={true}
              avatarColors={userColors}
            />
            {/* Remote participant cards */}
            {peersArray.map(([peerId, peer]) => (
              <RemoteAudioCard key={peerId} peer={peer} />
            ))}
          </div>
        </main>
      )}

      {/* ════════════════════════════════════════════
          VIDEO MODE: Google Meet style
      ════════════════════════════════════════════ */}
      {!isAudioMode && (
        <main className={`meet-grid meet-grid--count-${Math.min(totalCount, 9)}`}>
          {/* Remote tiles only in the main grid */}
          {peersArray.map(([peerId, peer]) => (
            <RemoteTile key={peerId} peerId={peerId} peer={peer} />
          ))}

          {/* If we are the only participant, show ourselves in the grid */}
          {peersArray.length === 0 && (
            <div className="meet-tile meet-tile--self meet-tile--solo">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`meet-tile__video ${!camEnabled && !screenSharing ? "meet-tile__video--hidden" : ""} meet-tile__video--mirror`}
              />
              {!camEnabled && !screenSharing && (
                <div
                  className="meet-tile__avatar"
                  style={{ background: `linear-gradient(135deg, ${userColors[0]} 0%, ${userColors[1]} 100%)` }}
                >
                  <span>{userInitials}</span>
                </div>
              )}
              <div className="meet-tile__overlay">
                <div className="meet-tile__name">
                  {!micEnabled && <MicOff size={12} className="meet-tile__mute-icon" />}
                  <span>You{screenSharing ? " (presenting)" : ""}</span>
                </div>
              </div>
            </div>
          )}

          {/* PiP Self-view (bottom-right corner) — shown when others are present */}
          {peersArray.length > 0 && (
            <div className="meet-pip">
              <video
                ref={pipVideoRef}
                autoPlay
                playsInline
                muted
                className={`meet-pip__video ${!camEnabled && !screenSharing ? "meet-pip__video--hidden" : ""} ${screenSharing ? "" : "meet-pip__video--mirror"}`}
              />
              {!camEnabled && !screenSharing && (
                <div
                  className="meet-pip__avatar"
                  style={{ background: `linear-gradient(135deg, ${userColors[0]} 0%, ${userColors[1]} 100%)` }}
                >
                  <span>{userInitials}</span>
                </div>
              )}
              <div className="meet-pip__label">
                {!micEnabled && <MicOff size={10} />}
                <span>You</span>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ---- CONTROL BAR ---- */}
      <footer className="gmeet__controls">
        <div className="gmeet__controls-center">
          <button
            className={`ctrl-btn ${!micEnabled ? "ctrl-btn--off" : ""}`}
            onClick={toggleMic}
            title={micEnabled ? "Turn off microphone" : "Turn on microphone"}
          >
            <span className="ctrl-btn__icon">
              {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </span>
            <span className="ctrl-btn__label">{micEnabled ? "Mute" : "Unmute"}</span>
          </button>

          <button
            className={`ctrl-btn ${!camEnabled && !audioOnly ? "ctrl-btn--off" : ""} ${audioOnly ? "ctrl-btn--disabled" : ""}`}
            onClick={!audioOnly ? toggleCam : undefined}
            title={audioOnly ? "Camera unavailable in audio call" : camEnabled ? "Turn off camera" : "Turn on camera"}
            disabled={audioOnly}
          >
            <span className="ctrl-btn__icon">
              {camEnabled ? <VideoIcon size={20} /> : <VideoOff size={20} />}
            </span>
            <span className="ctrl-btn__label">{camEnabled ? "Stop video" : "Start video"}</span>
          </button>

          {!audioOnly && (
            <button
              className={`ctrl-btn ${screenSharing ? "ctrl-btn--active" : ""}`}
              onClick={shareScreen}
              title={screenSharing ? "Stop presenting" : "Present now"}
            >
              <span className="ctrl-btn__icon">
                {screenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
              </span>
              <span className="ctrl-btn__label">{screenSharing ? "Stop" : "Present"}</span>
            </button>
          )}

          <button
            className={`ctrl-btn ${audioOnly ? "ctrl-btn--audio-active" : ""}`}
            onClick={toggleAudioOnly}
            title={audioOnly ? "Switch to video call" : "Switch to audio-only call"}
          >
            <span className="ctrl-btn__icon">
              {audioOnly ? <VideoIcon size={20} /> : <Phone size={20} />}
            </span>
            <span className="ctrl-btn__label">{audioOnly ? "Video" : "Audio"}</span>
          </button>

          <button
            className={`ctrl-btn ${handRaised ? "ctrl-btn--active" : ""}`}
            onClick={() => setHandRaised(v => !v)}
            title={handRaised ? "Lower hand" : "Raise hand"}
          >
            <span className="ctrl-btn__icon"><Hand size={20} /></span>
            <span className="ctrl-btn__label">React</span>
          </button>
        </div>

        {/* A-05: Device Settings button + popover */}
        <div className="ctrl-device-wrap">
          <button
            id="device-settings-btn"
            className={`ctrl-btn ctrl-btn--settings ${showDeviceMenu ? "ctrl-btn--active" : ""}`}
            onClick={() => {
              enumerateDevices();
              setShowDeviceMenu((v) => !v);
            }}
            title="Audio &amp; video settings"
          >
            <span className="ctrl-btn__icon"><Settings size={18} /></span>
            <span className="ctrl-btn__label">Settings</span>
          </button>

          {showDeviceMenu && (
            <div id="device-menu" className="device-menu" role="dialog" aria-label="Device settings">
              <button
                className="device-menu__close"
                onClick={() => setShowDeviceMenu(false)}
                aria-label="Close device settings"
              >
                ✕
              </button>

              {deviceList.audio.length > 0 && (
                <div className="device-menu__section">
                  <label className="device-menu__label" htmlFor="mic-select">
                    <Mic size={13} /> Microphone
                  </label>
                  <select
                    id="mic-select"
                    className="device-menu__select"
                    value={selectedMicId}
                    onChange={(e) => switchMic(e.target.value)}
                  >
                    {deviceList.audio.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {deviceList.video.length > 0 && (
                <div className="device-menu__section">
                  <label className="device-menu__label" htmlFor="cam-select">
                    <VideoIcon size={13} /> Camera
                  </label>
                  <select
                    id="cam-select"
                    className="device-menu__select"
                    value={selectedCamId}
                    onChange={(e) => switchCam(e.target.value)}
                  >
                    {deviceList.video.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {deviceList.audio.length === 0 && deviceList.video.length === 0 && (
                <p className="device-menu__empty">No devices found. Grant camera/mic permissions first.</p>
              )}
            </div>
          )}
        </div>

        <button className="ctrl-btn ctrl-btn--leave" onClick={handleDisconnect}>
          <PhoneOff size={20} />
          <span className="ctrl-btn__label">Leave</span>
        </button>
      </footer>
    </div>
  );
}
