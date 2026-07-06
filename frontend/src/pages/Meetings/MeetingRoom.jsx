import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Mic, MicOff, Video as VideoIcon, VideoOff,
  PhoneOff, Phone, Monitor, MonitorOff, Users, Loader2, AlertCircle,
  Hand, PhoneCall
} from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import * as workspaceApi from "../../services/workspaceApi";
import { extractErrorMessage } from "../../utils/helpers";
import "./MeetingRoom.scss";

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

// --- Utility: attach srcObject safely ---
function attachStream(videoEl, stream) {
  if (videoEl && stream && videoEl.srcObject !== stream) {
    videoEl.srcObject = stream;
  }
}

// Generate a consistent color from a username string
function getAvatarColor(username) {
  const colors = [
    ["#5264AE", "#3949AB"],
    ["#7B5EA7", "#512DA8"],
    ["#C96480", "#AD1457"],
    ["#3D8B8B", "#00695C"],
    ["#4A6FA5", "#1565C0"],
    ["#7B6B42", "#5D4037"],
    ["#C45B2E", "#BF360C"],
  ];
  if (!username) return colors[0];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// --- Remote Video Tile (Meet-style) ---
function RemoteTile({ peerId, peer }) {
  const videoRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const stream = peer.stream;
    if (!stream) { setHasVideo(false); setIsMuted(true); return; }

    if (videoRef.current) videoRef.current.srcObject = stream;

    const checkTracks = () => {
      const vTracks = stream.getVideoTracks();
      const aTracks = stream.getAudioTracks();
      setHasVideo(vTracks.length > 0 && vTracks.some(t => t.enabled && !t.muted));
      setIsMuted(!(aTracks.length > 0 && aTracks.some(t => t.enabled && !t.muted)));
    };

    stream.addEventListener("addtrack", checkTracks);
    stream.addEventListener("removetrack", checkTracks);
    const tracks = stream.getTracks();
    tracks.forEach(t => {
      t.addEventListener("mute", checkTracks);
      t.addEventListener("unmute", checkTracks);
      t.addEventListener("ended", checkTracks);
    });
    checkTracks();

    return () => {
      stream.removeEventListener("addtrack", checkTracks);
      stream.removeEventListener("removetrack", checkTracks);
      tracks.forEach(t => {
        t.removeEventListener("mute", checkTracks);
        t.removeEventListener("unmute", checkTracks);
        t.removeEventListener("ended", checkTracks);
      });
    };
  }, [peer.stream]);

  const initials = peer.username ? peer.username.substring(0, 2).toUpperCase() : "?";
  const colors = getAvatarColor(peer.username);

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
          <span>{peer.username || "Participant"}</span>
        </div>
      </div>
    </div>
  );
}

// --- Teams Audio Card (one per participant) ---
function TeamsAudioCard({ username, isMuted, isSelf, avatarColors }) {
  const initials = username ? username.substring(0, 2).toUpperCase() : "?";
  const colors = avatarColors || getAvatarColor(username);
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
        <span>{username || "Participant"}{isSelf ? " (You)" : ""}</span>
      </div>
    </div>
  );
}

// --- Remote Audio Tile (reads stream audio state) ---
function RemoteAudioCard({ peer }) {
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const stream = peer.stream;
    if (!stream) { setIsMuted(true); return; }

    const check = () => {
      const aTracks = stream.getAudioTracks();
      setIsMuted(!(aTracks.length > 0 && aTracks.some(t => t.enabled && !t.muted)));
    };

    stream.addEventListener("addtrack", check);
    stream.addEventListener("removetrack", check);
    stream.getTracks().forEach(t => {
      t.addEventListener("mute", check);
      t.addEventListener("unmute", check);
      t.addEventListener("ended", check);
    });
    check();

    return () => {
      stream.removeEventListener("addtrack", check);
      stream.removeEventListener("removetrack", check);
      stream.getTracks().forEach(t => {
        t.removeEventListener("mute", check);
        t.removeEventListener("unmute", check);
        t.removeEventListener("ended", check);
      });
    };
  }, [peer.stream]);

  return <TeamsAudioCard username={peer.username} isMuted={isMuted} isSelf={false} />;
}

// --- Elapsed timer hook ---
function useCallTimer() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
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

  // Media state
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [peers, setPeers] = useState({});
  const [handRaised, setHandRaised] = useState(false);

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

  const callTimer = useCallTimer();

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
      if (target) target.replaceTrack(newTrack).catch(e => console.warn(`replaceTrack(${kind}) failed:`, e));
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
    for (const constraints of attempts) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        return { stream: s, hasVideo: !!s.getVideoTracks().length, hasAudio: !!s.getAudioTracks().length };
      } catch (_) { /* try next */ }
    }
    return { stream: new MediaStream(), hasVideo: false, hasAudio: false };
  }, []);

  // ---------- CREATE PEER CONNECTION ----------
  const createPeerConnection = useCallback((peerId, peerUsername) => {
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
        return { ...prev, [peerId]: { ...existing, stream: remoteStream } };
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") { if (pc.restartIce) pc.restartIce(); }
      if (pc.connectionState === "disconnected" || pc.connectionState === "closed") removePeer(peerId);
    };

    pc.onnegotiationneeded = async () => {
      if (peersRef.current[peerId]?.isOfferer) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          wsRef.current?.send(JSON.stringify({ type: "offer", target: peerId, sdp: pc.localDescription }));
        } catch (e) { console.warn("Renegotiation failed:", e); }
      }
    };

    peersRef.current[peerId] = { pc, username: peerUsername, stream: null, isOfferer: false };
    setPeers(prev => ({ ...prev, [peerId]: { pc, username: peerUsername, stream: null } }));
    return pc;
  }, []);

  const removePeer = useCallback((peerId) => {
    const peer = peersRef.current[peerId];
    if (peer) {
      peer.pc.close();
      delete peersRef.current[peerId];
      setPeers(prev => { const c = { ...prev }; delete c[peerId]; return c; });
    }
  }, []);

  // ---------- SIGNALING ----------
  const handleSignalingMessage = useCallback(async (message) => {
    const { type, sender_id, sender_username, sdp, candidate, target } = message;
    if (target && Number(target) !== Number(profile?.id)) return;

    switch (type) {
      case "peer_joined": {
        if (Number(sender_id) === Number(profile?.id)) return;
        const pc = createPeerConnection(sender_id, sender_username);
        peersRef.current[sender_id].isOfferer = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        wsRef.current?.send(JSON.stringify({ type: "offer", target: sender_id, sdp: pc.localDescription }));
        break;
      }
      case "offer": {
        let peer = peersRef.current[sender_id];
        const pc = peer ? peer.pc : createPeerConnection(sender_id, sender_username);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.send(JSON.stringify({ type: "answer", target: sender_id, sdp: pc.localDescription }));
        break;
      }
      case "answer": {
        const peer = peersRef.current[sender_id];
        if (peer) await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        break;
      }
      case "ice_candidate": {
        const peer = peersRef.current[sender_id];
        if (peer && candidate) peer.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn("addIceCandidate failed:", e));
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
  const initWebSocket = useCallback(() => {
    const token = localStorage.getItem("access");
    if (!token) return;
    const base = (import.meta.env.VITE_WS_URL || "ws://localhost:8000").replace(/\/$/, "");
    const url = `${base}/ws/call/${meetingId}/?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);
    wsRef.current = socket;
    socket.onopen = () => console.log("✅ Signaling WS connected");
    socket.onmessage = async (e) => {
      try { await handleSignalingMessage(JSON.parse(e.data)); }
      catch (err) { console.error("Signaling error:", err); }
    };
    socket.onerror = (e) => console.error("WS error:", e);
    socket.onclose = () => console.warn("WS closed");
  }, [meetingId, handleSignalingMessage]);

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
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peersRef.current).forEach(p => p.pc.close());
      peersRef.current = {};
      wsRef.current?.close();
      if (participantIdRef.current) {
        workspaceApi.updateParticipantStatus(meetingId, participantIdRef.current, { is_present: false }).catch(() => {});
      }
    };
  }, [meetingId]);

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
    } else {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = micStream.getAudioTracks()[0];
        stream.addTrack(audioTrack);
        replaceSenderTrack("audio", audioTrack);
        setMicEnabled(true);
        micEnabledRef.current = true;
      } catch (err) { console.warn("Could not access microphone:", err); }
    }
  }, [replaceSenderTrack]);

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
      } catch (err) { console.warn("Could not access camera:", err); }
    }
  }, [replaceSenderTrack]);

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
    } catch (err) { console.warn("Screen share cancelled or failed:", err); }
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
        } catch (err) { console.warn("Could not access camera:", err); }
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
        } catch (err) { console.warn("Could not access microphone:", err); }
      }

      setAudioOnly(true);
    }
  }, [audioOnly, replaceSenderTrack]);

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

  const peersArray = Object.entries(peers);
  const totalCount = peersArray.length + 1;
  const userName = profile?.username || "You";
  const userInitials = userName.substring(0, 2).toUpperCase();
  const userColors = getAvatarColor(userName);
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
        </div>
        <div className="gmeet__header-right">
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
                ref={localVideoRef}
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

        <button className="ctrl-btn ctrl-btn--leave" onClick={handleDisconnect}>
          <PhoneOff size={20} />
          <span className="ctrl-btn__label">Leave</span>
        </button>
      </footer>
    </div>
  );
}
