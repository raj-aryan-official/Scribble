import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from './useSocket';
import { EVENTS } from '../../../shared/types';

export const useVoiceChat = (roomCode, username) => {
    const socket = useSocket();
    const [isMicOn, setIsMicOn] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [peers, setPeers] = useState({}); // { socketId: RTCPeerConnection }
    const localStreamRef = useRef(null);
    const peersRef = useRef({}); // Refs for stability in callbacks

    const cleanup = useCallback(() => {
        // Stop local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        // Close all peer connections
        Object.values(peersRef.current).forEach(pc => pc.close());
        peersRef.current = {};
        setPeers({});

        // Notify server
        socket.emit(EVENTS.VOICE_LEAVE, { roomCode });
    }, [socket, roomCode]);


    // Initialize Local Stream
    const startLocalStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;

            // If mic is specifically toggled off in UI state, disable tracks initially
            stream.getAudioTracks().forEach(track => track.enabled = isMicOn);

            return stream;
        } catch (err) {
            console.error("Failed to get local stream", err);
            return null;
        }
    };

    const createPeerConnection = (targetSocketId, stream) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit(EVENTS.ICE_CANDIDATE, { target: targetSocketId, candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            const remoteAudio = document.getElementById(`audio-${targetSocketId}`);
            if (remoteAudio) {
                remoteAudio.srcObject = event.streams[0];
            } else {
                // Audio element creation handled in React component rendering, 
                // but we can ensure stream is ready/attached if we pass it out
                // For now, we'll expose a map of streams or rely on DOM elements existing
                const existingAudio = document.getElementById(`audio-${targetSocketId}`);
                if (existingAudio) existingAudio.srcObject = event.streams[0];
            }
        };

        if (stream) {
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
        }

        peersRef.current = { ...peersRef.current, [targetSocketId]: pc };
        setPeers(prev => ({ ...prev, [targetSocketId]: pc }));

        return pc;
    };

    useEffect(() => {
        if (!socket) return;

        const handleVoiceJoin = async ({ socketId }) => {
            // New user joined, I initiate call
            if (!localStreamRef.current) await startLocalStream();

            const pc = createPeerConnection(socketId, localStreamRef.current);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socket.emit(EVENTS.VOICE_OFFER, { target: socketId, offer });
        };

        const handleExistingUsers = async (users) => {
            // I joined, wait for offers, but I need to set up my stream and PCs for them if they don't initiate?
            // Actually, usually existing users initiate to me (as per handleVoiceJoin logic above running on their side)
            // Or I initiate to them. Mesh usually works better if "new joiner calls everyone" or "everyone calls new joiner".
            // Let's go with: Existing users call the new joiner. 
            // So this handler might just be for UI lists or prep, but actually `handleVoiceJoin` handles the "im old, you're new" case.
            // What if I am the new joiner? I don't need to do anything but wait for offers?
            // Wait, if I'm new, I need to know who is there to render audio elements?
            // Yes, user list is useful.
            if (!localStreamRef.current) await startLocalStream();
        };

        const handleVoiceOffer = async ({ sender, offer }) => {
            if (!localStreamRef.current) await startLocalStream();

            const pc = createPeerConnection(sender, localStreamRef.current);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit(EVENTS.VOICE_ANSWER, { target: sender, answer });
        };

        const handleVoiceAnswer = async ({ sender, answer }) => {
            const pc = peersRef.current[sender];
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            }
        };

        const handleIceCandidate = async ({ sender, candidate }) => {
            const pc = peersRef.current[sender];
            if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        };

        const handleVoiceLeave = ({ socketId }) => {
            if (peersRef.current[socketId]) {
                peersRef.current[socketId].close();
                const newPeers = { ...peersRef.current };
                delete newPeers[socketId];
                peersRef.current = newPeers;
                setPeers(newPeers);
            }
        };

        socket.on(EVENTS.VOICE_JOIN, handleVoiceJoin);
        socket.on('EXISTING_VOICE_USERS', handleExistingUsers);
        socket.on(EVENTS.VOICE_OFFER, handleVoiceOffer);
        socket.on(EVENTS.VOICE_ANSWER, handleVoiceAnswer);
        socket.on(EVENTS.ICE_CANDIDATE, handleIceCandidate);
        socket.on(EVENTS.VOICE_LEAVE, handleVoiceLeave);

        // Join voice channel on mount
        socket.emit(EVENTS.VOICE_JOIN, { roomCode });

        return () => {
            socket.off(EVENTS.VOICE_JOIN, handleVoiceJoin);
            socket.off('EXISTING_VOICE_USERS', handleExistingUsers);
            socket.off(EVENTS.VOICE_OFFER, handleVoiceOffer);
            socket.off(EVENTS.VOICE_ANSWER, handleVoiceAnswer);
            socket.off(EVENTS.ICE_CANDIDATE, handleIceCandidate);
            socket.off(EVENTS.VOICE_LEAVE, handleVoiceLeave);
            cleanup();
        };
    }, [socket, roomCode, cleanup]);

    // Handle Mic Toggle
    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicOn(audioTrack.enabled);
            }
        } else {
            // Attempt to start if not started
            startLocalStream().then(stream => {
                if (stream) {
                    setIsMicOn(true); // default enabled when explicitly starting
                }
            });
        }
    };

    // Handle Deafened (Speaker off)
    // In Web Audio API / HTML Audio, we can just mute the audio elements
    const toggleDeafen = () => {
        setIsDeafened(prev => !prev);
    };

    return {
        isMicOn,
        toggleMic,
        isDeafened,
        toggleDeafen,
        peers: Object.keys(peers) // Return list of socketIds to render audio elements
    };
};
