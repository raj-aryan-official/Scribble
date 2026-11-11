import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from './useSocket';
import { EVENTS } from '../../../shared/types';
import {
    MAX_VOICE_PLAYERS,
    DEFAULT_SPEAKING_THRESHOLD,
    SPEAKING_HOLD_MS,
    shouldInitiate,
    isPolitePeer,
    getIceServers,
    calculateRMS,
    updateSpeakingState,
    getMediaErrorMessage
} from '../utils/voiceUtils';

export const useVoiceChat = (roomCode, username, playerCount = 1) => {
    const socket = useSocket();

    const [isMicOn, setIsMicOn] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: MediaStream }
    const [speakingPeers, setSpeakingPeers] = useState({}); // { socketId: boolean }
    const [voiceError, setVoiceError] = useState(null);
    const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);

    const isVoiceAllowed = Boolean(roomCode) && (playerCount || 1) <= MAX_VOICE_PLAYERS;

    // Refs for stable callback access without re-binding effects
    const localStreamRef = useRef(null);
    const peersRef = useRef({}); // { socketId: RTCPeerConnection }
    const candidateQueueRef = useRef({}); // { socketId: Array<RTCIceCandidateInit> }
    const makingOfferRef = useRef({}); // { socketId: boolean }
    const signalingQueueRef = useRef({}); // { socketId: Promise } serializes offer/answer handling per peer
    const lastRemoteOfferSdpRef = useRef({}); // { socketId: sdp } ignores duplicate offers
    const audioContextRef = useRef(null);
    const analysersRef = useRef(new Map()); // socketId -> { sourceNode, analyser, buffer, lastSpokeAt, isSpeaking }
    const animFrameRef = useRef(null);

    const clearVoiceError = useCallback(() => {
        setVoiceError(null);
    }, []);

    // Lazy AudioContext initialization
    const getOrCreateAudioContext = useCallback(() => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                audioContextRef.current = new AudioCtx();
            }
        }
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
        }
        return audioContextRef.current;
    }, []);

    // Attach stream to speaking detector
    const attachSpeakingDetector = useCallback((id, stream) => {
        try {
            const ctx = getOrCreateAudioContext();
            if (!ctx || !stream || stream.getAudioTracks().length === 0) return;

            // Remove existing if any
            if (analysersRef.current.has(id)) {
                const prev = analysersRef.current.get(id);
                try { prev.sourceNode.disconnect(); } catch (e) {}
                analysersRef.current.delete(id);
            }

            const sourceNode = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.2;
            sourceNode.connect(analyser);

            analysersRef.current.set(id, {
                sourceNode,
                analyser,
                buffer: new Float32Array(analyser.fftSize),
                lastSpokeAt: 0,
                isSpeaking: false
            });
        } catch (e) {
            console.warn('Could not attach speaking detector for', id, e);
        }
    }, [getOrCreateAudioContext]);

    // Detach speaking detector
    const detachSpeakingDetector = useCallback((id) => {
        if (analysersRef.current.has(id)) {
            const item = analysersRef.current.get(id);
            try { item.sourceNode.disconnect(); } catch (e) {}
            analysersRef.current.delete(id);
        }
        setSpeakingPeers(prev => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, []);

    // Continuous speaking analysis loop
    useEffect(() => {
        let isRunning = true;

        const checkSpeaking = () => {
            if (!isRunning) return;

            const now = Date.now();
            let hasChanges = false;
            const updates = {};

            analysersRef.current.forEach((item, id) => {
                // If local mic is muted, local user cannot be speaking
                if (id === socket?.id && !isMicOn) {
                    if (item.isSpeaking) {
                        item.isSpeaking = false;
                        item.lastSpokeAt = 0;
                        updates[id] = false;
                        hasChanges = true;
                    }
                    return;
                }

                item.analyser.getFloatTimeDomainData(item.buffer);
                const rms = calculateRMS(item.buffer);

                const nextState = updateSpeakingState({
                    currentRMS: rms,
                    threshold: DEFAULT_SPEAKING_THRESHOLD,
                    now,
                    lastSpokeAt: item.lastSpokeAt,
                    holdDurationMs: SPEAKING_HOLD_MS
                });

                item.lastSpokeAt = nextState.lastSpokeAt;

                if (nextState.isSpeaking !== item.isSpeaking) {
                    item.isSpeaking = nextState.isSpeaking;
                    updates[id] = nextState.isSpeaking;
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                setSpeakingPeers(prev => ({
                    ...prev,
                    ...updates
                }));
            }

            animFrameRef.current = requestAnimationFrame(checkSpeaking);
        };

        animFrameRef.current = requestAnimationFrame(checkSpeaking);

        return () => {
            isRunning = false;
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
        };
    }, [socket?.id, isMicOn]);

    // Full cleanup on unmount or room leave
    const cleanup = useCallback(() => {
        // Stop local media tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                try { track.stop(); } catch (e) {}
            });
            localStreamRef.current = null;
        }

        // Close peer connections
        Object.values(peersRef.current).forEach((pc) => {
            try { pc.close(); } catch (e) {}
        });
        peersRef.current = {};
        candidateQueueRef.current = {};
        makingOfferRef.current = {};
        signalingQueueRef.current = {};
        lastRemoteOfferSdpRef.current = {};

        // Stop all audio analysers & close AudioContext
        analysersRef.current.forEach((item) => {
            try { item.sourceNode.disconnect(); } catch (e) {}
        });
        analysersRef.current.clear();

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            try { audioContextRef.current.close(); } catch (e) {}
            audioContextRef.current = null;
        }

        setRemoteStreams({});
        setSpeakingPeers({});
        setIsMicOn(false);

        if (socket && roomCode) {
            socket.emit(EVENTS.VOICE_LEAVE, { roomCode });
        }
    }, [socket, roomCode]);

    // Peer Connection Factory with recvonly default and candidate queueing
    const getOrCreatePeerConnection = useCallback((targetSocketId) => {
        if (peersRef.current[targetSocketId]) {
            return peersRef.current[targetSocketId];
        }

        const iceServers = getIceServers();
        const pc = new RTCPeerConnection({ iceServers });

        candidateQueueRef.current[targetSocketId] = candidateQueueRef.current[targetSocketId] || [];

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit(EVENTS.ICE_CANDIDATE, {
                    roomCode,
                    target: targetSocketId,
                    candidate: event.candidate
                });
            }
        };

        pc.ontrack = (event) => {
            const stream = event.streams[0] || new MediaStream([event.track]);
            setRemoteStreams(prev => ({
                ...prev,
                [targetSocketId]: stream
            }));
            attachSpeakingDetector(targetSocketId, stream);
        };

        // Attach local track if mic was already granted; otherwise add recvonly transceiver
        const localAudioTrack = localStreamRef.current?.getAudioTracks()?.[0];
        if (localAudioTrack) {
            pc.addTrack(localAudioTrack, localStreamRef.current);
        } else {
            pc.addTransceiver('audio', { direction: 'recvonly' });
        }

        peersRef.current[targetSocketId] = pc;
        return pc;
    }, [socket, roomCode, attachSpeakingDetector]);

    // Flush queued ICE candidates after remote description is set
    const flushCandidateQueue = useCallback(async (targetSocketId, pc) => {
        const queue = candidateQueueRef.current[targetSocketId] || [];
        if (queue.length > 0) {
            for (const cand of queue) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (err) {
                    console.warn('Error adding queued ICE candidate for', targetSocketId, err);
                }
            }
            candidateQueueRef.current[targetSocketId] = [];
        }
    }, []);

    // Upgrade all peer connections when mic is turned on for the first time
    const upgradePeerConnectionsWithLocalTrack = useCallback(async (stream) => {
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return;

        const myId = socket?.id;

        for (const [peerId, pc] of Object.entries(peersRef.current)) {
            try {
                const transceivers = pc.getTransceivers();
                const audioTransceiver = transceivers.find(t =>
                    t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio'
                );

                if (audioTransceiver) {
                    audioTransceiver.direction = 'sendrecv';
                    await audioTransceiver.sender.replaceTrack(audioTrack);
                } else {
                    pc.addTrack(audioTrack, stream);
                }

                // If renegotiation is needed and we are initiator, send new offer
                if (shouldInitiate(myId, peerId) && pc.signalingState === 'stable') {
                    makingOfferRef.current[peerId] = true;
                    try {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        socket.emit(EVENTS.VOICE_OFFER, {
                            roomCode,
                            target: peerId,
                            offer
                        });
                    } finally {
                        makingOfferRef.current[peerId] = false;
                    }
                }
            } catch (err) {
                console.warn('Failed upgrading peer connection for', peerId, err);
            }
        }
    }, [socket, roomCode]);

    // Handle Mic Toggle: Request mic on first tap (Opt-In), or toggle track enabled
    const toggleMic = useCallback(async () => {
        if (!isVoiceAllowed) {
            setVoiceError(`Voice chat is limited to rooms of up to ${MAX_VOICE_PLAYERS} players.`);
            return;
        }

        // Case A: Mic stream already acquired previously
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                const nextState = !audioTrack.enabled;
                audioTrack.enabled = nextState;
                setIsMicOn(nextState);

                // If muted, clear local speaking ring immediately
                if (!nextState && socket?.id) {
                    setSpeakingPeers(prev => ({ ...prev, [socket.id]: false }));
                }
            }
            return;
        }

        // Case B: First tap -> Request microphone permission (Opt-in)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;

            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = true;
            }

            setIsMicOn(true);
            setVoiceError(null);

            // Hook local stream to speaking detection
            if (socket?.id) {
                attachSpeakingDetector(socket.id, stream);
            }

            // Upgrade all existing peer connections
            await upgradePeerConnectionsWithLocalTrack(stream);
        } catch (err) {
            console.error('Failed to get microphone stream:', err);
            const msg = getMediaErrorMessage(err);
            setVoiceError(msg);
            setIsMicOn(false);
        }
    }, [isVoiceAllowed, socket?.id, attachSpeakingDetector, upgradePeerConnectionsWithLocalTrack]);

    const toggleDeafen = useCallback(() => {
        setIsDeafened(prev => !prev);
    }, []);

    // Unlock blocked autoplay on user gesture
    const handleEnableSound = useCallback(() => {
        setIsAutoplayBlocked(false);
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
        }
    }, []);

    // Socket Event Listeners for Voice Signaling (Mesh)
    useEffect(() => {
        if (!socket || !roomCode || !isVoiceAllowed) return;

        const myId = socket.id;

        // Perfect-negotiation signals for one peer must be applied in order:
        // duplicate or overlapping offers/answers otherwise leave the PC in a
        // state where setLocalDescription/setRemoteDescription throws.
        const enqueueSignal = (peerId, task) => {
            const previous = signalingQueueRef.current[peerId] || Promise.resolve();
            const next = previous.then(task, task);
            signalingQueueRef.current[peerId] = next.catch(() => {});
            return next;
        };

        // When another user joins voice channel
        const handleVoiceJoin = async ({ socketId }) => {
            if (!socketId || socketId === myId) return;

            // Already negotiated with this peer: a repeated join (reconnect,
            // hot reload) must not trigger a duplicate offer/answer exchange.
            const existingPeer = peersRef.current[socketId];
            if (existingPeer && existingPeer.connectionState === 'connected') {
                return;
            }
            if (makingOfferRef.current[socketId] || (existingPeer && existingPeer.signalingState !== 'stable')) {
                return;
            }

            // Only the player with the smaller socket ID initiates (sends offer)
            if (shouldInitiate(myId, socketId)) {
                try {
                    const pc = getOrCreatePeerConnection(socketId);
                    makingOfferRef.current[socketId] = true;
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    socket.emit(EVENTS.VOICE_OFFER, {
                        roomCode,
                        target: socketId,
                        offer
                    });
                } catch (err) {
                    console.error('Error initiating voice offer to', socketId, err);
                } finally {
                    makingOfferRef.current[socketId] = false;
                }
            } else {
                // We are receiver: create PC in recvonly state waiting for remote offer
                getOrCreatePeerConnection(socketId);
            }
        };

        // When we join, server sends list of existing voice users
        const handleExistingUsers = async (users) => {
            if (!Array.isArray(users)) return;

            for (const peerId of users) {
                if (peerId === myId) continue;

                const existingPeer = peersRef.current[peerId];
                if (existingPeer && existingPeer.connectionState === 'connected') {
                    continue;
                }
                if (makingOfferRef.current[peerId]) {
                    continue;
                }

                // Initiate only if our socket ID is smaller
                if (shouldInitiate(myId, peerId)) {
                    try {
                        const pc = getOrCreatePeerConnection(peerId);
                        makingOfferRef.current[peerId] = true;
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);

                        socket.emit(EVENTS.VOICE_OFFER, {
                            roomCode,
                            target: peerId,
                            offer
                        });
                    } catch (err) {
                        console.error('Error creating offer for existing user', peerId, err);
                    } finally {
                        makingOfferRef.current[peerId] = false;
                    }
                } else {
                    // Receiver: prepare PC
                    getOrCreatePeerConnection(peerId);
                }
            }
        };

        // Handle incoming Offer with Perfect Negotiation (Polite peer handling)
        const handleVoiceOffer = ({ sender, offer }) => {
            if (!sender || sender === myId || !offer) return;

            enqueueSignal(sender, async () => {
                if (offer.sdp && lastRemoteOfferSdpRef.current[sender] === offer.sdp) {
                    return;
                }

                try {
                    const pc = getOrCreatePeerConnection(sender);
                    const isPolite = isPolitePeer(myId, sender);
                    const state = pc.signalingState;

                    // Duplicate offer for an offer we are already answering: applying
                    // it again would leave the peer in an impossible state.
                    if (state === 'have-remote-offer') {
                        return;
                    }

                    if (state === 'have-local-offer' || makingOfferRef.current[sender]) {
                        if (!isPolite) {
                            // Impolite peer ignores colliding offer
                            return;
                        }
                        // Rollback is only valid while we have a local offer.
                        if (state === 'have-local-offer') {
                            await pc.setLocalDescription({ type: 'rollback' });
                        } else {
                            return;
                        }
                    }

                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    await flushCandidateQueue(sender, pc);

                    if (pc.signalingState !== 'have-remote-offer') return;
                    const answer = await pc.createAnswer();
                    if (pc.signalingState !== 'have-remote-offer') return;
                    await pc.setLocalDescription(answer);
                    lastRemoteOfferSdpRef.current[sender] = offer.sdp;

                    socket.emit(EVENTS.VOICE_ANSWER, {
                        roomCode,
                        target: sender,
                        answer
                    });
                } catch (err) {
                    console.error('Error handling voice offer from', sender, err);
                }
            });
        };

        // Handle incoming Answer
        const handleVoiceAnswer = ({ sender, answer }) => {
            if (!sender || !answer) return;

            enqueueSignal(sender, async () => {
                const pc = peersRef.current[sender];
                if (!pc || pc.signalingState !== 'have-local-offer') {
                    // Stale or duplicate answer (the exchange already completed).
                    return;
                }
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                    await flushCandidateQueue(sender, pc);
                } catch (err) {
                    console.error('Error setting remote answer from', sender, err);
                }
            });
        };

        // Handle incoming ICE Candidate (with pre-setRemoteDescription queueing)
        const handleIceCandidate = async ({ sender, candidate }) => {
            if (!sender || !candidate) return;
            const pc = peersRef.current[sender];
            if (pc && pc.signalingState === 'closed') return;

            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.warn('Error adding ICE candidate from', sender, err);
                }
            } else {
                // Queue until setRemoteDescription completes
                if (!candidateQueueRef.current[sender]) {
                    candidateQueueRef.current[sender] = [];
                }
                candidateQueueRef.current[sender].push(candidate);
            }
        };

        // Handle peer leaving
        const handleVoiceLeave = ({ socketId }) => {
            if (!socketId) return;

            detachSpeakingDetector(socketId);

            if (peersRef.current[socketId]) {
                try {
                    peersRef.current[socketId].close();
                } catch (e) {}
                delete peersRef.current[socketId];
            }
            delete candidateQueueRef.current[socketId];
            delete makingOfferRef.current[socketId];
            delete signalingQueueRef.current[socketId];
            delete lastRemoteOfferSdpRef.current[socketId];

            setRemoteStreams(prev => {
                if (!prev[socketId]) return prev;
                const next = { ...prev };
                delete next[socketId];
                return next;
            });
        };

        socket.on(EVENTS.VOICE_JOIN, handleVoiceJoin);
        socket.on(EVENTS.EXISTING_VOICE_USERS, handleExistingUsers);
        socket.on(EVENTS.VOICE_OFFER, handleVoiceOffer);
        socket.on(EVENTS.VOICE_ANSWER, handleVoiceAnswer);
        socket.on(EVENTS.ICE_CANDIDATE, handleIceCandidate);
        socket.on(EVENTS.VOICE_LEAVE, handleVoiceLeave);

        // Join voice room on server as receiver
        socket.emit(EVENTS.VOICE_JOIN, { roomCode });

        return () => {
            socket.off(EVENTS.VOICE_JOIN, handleVoiceJoin);
            socket.off(EVENTS.EXISTING_VOICE_USERS, handleExistingUsers);
            socket.off(EVENTS.VOICE_OFFER, handleVoiceOffer);
            socket.off(EVENTS.VOICE_ANSWER, handleVoiceAnswer);
            socket.off(EVENTS.ICE_CANDIDATE, handleIceCandidate);
            socket.off(EVENTS.VOICE_LEAVE, handleVoiceLeave);
            cleanup();
        };
    }, [
        socket,
        roomCode,
        isVoiceAllowed,
        getOrCreatePeerConnection,
        flushCandidateQueue,
        detachSpeakingDetector,
        cleanup
    ]);

    return {
        isMicOn,
        toggleMic,
        isDeafened,
        toggleDeafen,
        remoteStreams,
        peersCount: Object.keys(remoteStreams).length,
        speakingPeers,
        isVoiceAllowed,
        voiceError,
        clearVoiceError,
        isAutoplayBlocked,
        setIsAutoplayBlocked,
        handleEnableSound
    };
};
