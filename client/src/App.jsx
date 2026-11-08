import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { useGame } from './context/GameContext';
import { useSocket } from './hooks/useSocket';
import { useSettings } from './context/SettingsContext';
import Landing from './pages/Landing';
import Join from './pages/Join';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import GameEnd from './pages/GameEnd';
import TestHarness from './pages/TestHarness';
import DevStates from './pages/DevStates';
import AppHeader from './components/Layout/AppHeader';
import ReconnectBanner from './components/ui/ReconnectBanner';
import StatusScreen from './components/ui/StatusScreen';
import ConnectingScreen from './components/ui/ConnectingScreen';
import Toast from './components/ui/Toast';
import SeatClaimModal from './components/Game/SeatClaimModal';
import SettingsModal from './components/Settings/SettingsModal';
import { getRejoinData, clearRejoinData } from './context/SocketContext';
import { EVENTS } from '../../shared/types';
import { LobbyGuard, GameGuard, EndGuard } from './components/Routing/RouteGuards';
import { checkBrowserSupport } from './utils/browserSupport';
import { PAGE_TRANSITION } from './constants/layout';
import errorSvg from './assets/states/error.svg';
import lostSvg from './assets/states/lost.svg';
import unsupportedSvg from './assets/states/unsupported.svg';

function App() {
  const location = useLocation();
  const { settings, isSettingsOpen, closeSettings } = useSettings();
  const osReducedMotion = useReducedMotion();
  const shouldReduceMotion = settings.reducedMotion ? true : osReducedMotion;
  const { state, dispatch } = useGame();
  const socket = useSocket();

  // 1. Browser compatibility check (Canvas, WebRTC, Pointer Events)
  const browserSupport = useMemo(() => checkBrowserSupport(), []);

  // 2. Initial connection check (>300 ms debounce for connecting screen)
  const [showInitialConnecting, setShowInitialConnecting] = useState(false);
  const hasEverConnectedRef = useRef(socket ? socket.connected : false);

  useEffect(() => {
    if (hasEverConnectedRef.current) return;
    if (socket?.connected) {
      hasEverConnectedRef.current = true;
      setShowInitialConnecting(false);
      return;
    }

    const timer = setTimeout(() => {
      if (!hasEverConnectedRef.current && (!socket || !socket.connected)) {
        setShowInitialConnecting(true);
      }
    }, 300);

    const handleConnect = () => {
      hasEverConnectedRef.current = true;
      setShowInitialConnecting(false);
      clearTimeout(timer);
    };

    socket?.on('connect', handleConnect);

    return () => {
      clearTimeout(timer);
      socket?.off('connect', handleConnect);
    };
  }, [socket]);

  // Top-level route keying: e.g. 'root' (landing), 'lobby', 'join', 'game', 'end'
  const topLevelRoute = useMemo(() => {
    const segment = location.pathname.split('/')[1] || 'root';
    return segment.toLowerCase();
  }, [location.pathname]);

  // Determine if Shell Top Bar should be shown: Lobby and GameEnd (Game uses its own GameBar)
  const showTopBar = topLevelRoute === 'lobby' || topLevelRoute === 'end' || (topLevelRoute === 'test-view' && location.pathname.includes('/lobby'));
  const currentRoomCode = location.pathname.split('/')[2]?.toUpperCase() || state.roomCode || '';

  // 5. Document title per screen:
  // ('Scribble', 'Lobby ABCDEF · Scribble', 'Round 2 of 3 · Scribble', 'Game Over · Scribble')
  useEffect(() => {
    if (topLevelRoute === 'lobby') {
      document.title = `Lobby ${currentRoomCode} · Scribble`;
    } else if (topLevelRoute === 'join') {
      document.title = 'Join a Scribble room · Scribble';
    } else if (topLevelRoute === 'game') {
      const round = state.currentRound || 1;
      const total = state.totalRounds || state.settings?.rounds || 3;
      document.title = `Round ${round} of ${total} · Scribble`;
    } else if (topLevelRoute === 'end') {
      document.title = 'Game Over · Scribble';
    } else if (topLevelRoute === 'dev') {
      document.title = 'Failure States Showcase · Scribble';
    } else {
      document.title = 'Scribble';
    }
  }, [topLevelRoute, currentRoomCode, state.currentRound, state.totalRounds, state.settings?.rounds]);

  // Tab-title flash when it's your turn to draw and tab is in background
  const myId = state.currentUser?.id;
  const isDrawer = Boolean(myId && myId === state.drawerId);
  const isDrawingTurn = isDrawer && (state.gameState === 'WORD_SELECTION' || state.gameState === 'DRAWING');

  useEffect(() => {
    if (!settings.tabTitleFlash || !isDrawingTurn) return;

    let isFlash = false;
    let baseTitle = document.title;

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        document.title = isFlash ? '🎨 YOUR TURN! · Scribble' : baseTitle;
        isFlash = !isFlash;
      }
    }, 1000);

    const handleFocus = () => {
      document.title = baseTitle;
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [settings.tabTitleFlash, isDrawingTurn]);

  // 5. Route change: move focus to page's h1 (tabIndex={-1})
  useEffect(() => {
    const timer = setTimeout(() => {
      const h1 = document.querySelector('h1');
      if (h1) {
        h1.focus({ preventScroll: true });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  // 1. Page transition variants:
  // Enter: opacity 0 to 1 and y 12 to 0 over 200 ms. Exit: opacity 1 to 0 over 120 ms.
  // With reduced motion: opacity only (y = 0).
  const pageVariants = {
    initial: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : PAGE_TRANSITION.OFFSET_Y,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: PAGE_TRANSITION.ENTER_DURATION,
        ease: [0.16, 1, 0.3, 1],
      },
    },
    exit: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : -PAGE_TRANSITION.OFFSET_Y,
    },
  };

  // If browser is missing core features: full screen listing what to update
  if (!browserSupport.isSupported) {
    return (
      <StatusScreen
        role="alert"
        illustration={unsupportedSvg}
        title="Unsupported browser"
        sentence="Scribble requires modern browser capabilities for real-time drawing and audio. The following features are missing:"
        primaryAction={{
          label: 'Reload',
          onClick: () => window.location.reload(),
        }}
      >
        <ul className="text-left text-xs text-ink bg-paper p-3 rounded-[6px] border border-ink/30 flex flex-col gap-1.5 list-disc pl-5 my-2">
          {browserSupport.missing.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </StatusScreen>
    );
  }

  // Connecting state on first load (>300 ms)
  if (showInitialConnecting && (!socket || !socket.connected)) {
    return <ConnectingScreen />;
  }

  // Superseded tab: another tab took over this session (E6)
  if (state.isSuperseded) {
    return (
      <StatusScreen
        role="alert"
        illustration={lostSvg}
        title="You're playing in another tab."
        sentence="This session was opened in another window or tab."
        primaryAction={{
          label: 'Take over here',
          onClick: () => {
            const rejoin = getRejoinData();
            if (socket) {
              socket.connect();
              socket.emit(EVENTS.TAKE_OVER, {
                roomCode: rejoin?.roomCode,
                rejoinToken: rejoin?.rejoinToken,
              });
              dispatch({ type: 'SET_SUPERSEDED', payload: false });
            }
          },
        }}
        secondaryAction={{
          label: 'Leave',
          onClick: () => {
            clearRejoinData();
            dispatch({ type: 'SET_SUPERSEDED', payload: false });
            window.location.href = '/';
          },
        }}
      />
    );
  }

  return (
    <MotionConfig reducedMotion={settings.reducedMotion ? 'always' : 'user'}>
      <div className="min-h-[100dvh] bg-paper text-ink font-body flex flex-col selection:bg-marigold selection:text-ink relative">
        {/* Skip to Content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-toast focus:px-4 focus:py-2 focus:bg-card focus:border-2 focus:border-ink focus:shadow-hard focus:text-ink focus:font-bold focus:rounded-[6px] focus:outline-none"
        >
          Skip to content
        </a>

        {/* Global Reconnect / Connection Status Banner */}
        <ReconnectBanner />

        {/* Shell Top Bar: Lobby, Game and GameEnd only (56px desktop / 48px phones) */}
        {showTopBar && (
          <AppHeader roomCode={currentRoomCode} />
        )}

        {/* Main Content Area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 flex flex-col relative w-full outline-none"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={topLevelRoute}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex-1 flex flex-col w-full"
            >
              <Routes location={location}>
                <Route path="/" element={<Landing />} />
                <Route path="/join/:code" element={<Join />} />
                <Route
                  path="/lobby/:code"
                  element={
                    <LobbyGuard>
                      <Lobby />
                    </LobbyGuard>
                  }
                />
                <Route
                  path="/game/:code"
                  element={
                    <GameGuard>
                      <Game />
                    </GameGuard>
                  }
                />
                <Route
                  path="/end/:code"
                  element={
                    <EndGuard>
                      <GameEnd />
                    </EndGuard>
                  }
                />
                <Route path="/test-view/:view" element={<TestHarness />} />
                {import.meta.env.DEV && (
                  <Route path="/dev/states" element={<DevStates />} />
                )}
                {/* 404 Route uses StatusScreen */}
                <Route
                  path="*"
                  element={
                    <StatusScreen
                      role="alert"
                      illustration={errorSvg}
                      title="Something went wrong"
                      sentence="We couldn't find the page you were looking for."
                      primaryAction={{
                        label: 'Reload',
                        onClick: () => {
                          window.location.href = '/';
                        },
                      }}
                    />
                  }
                />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Host Seat Claim Request Modal */}
        {state.seatClaimRequest && (
          <SeatClaimModal
            isOpen={Boolean(state.seatClaimRequest)}
            username={state.seatClaimRequest.username}
            timeout={state.seatClaimRequest.timeout || 20}
            endsAt={state.seatClaimRequest.endsAt}
            onAccept={() => {
              if (socket) {
                socket.emit(EVENTS.RESOLVE_SEAT_CLAIM, {
                  claimId: state.seatClaimRequest.claimId,
                  accepted: true,
                });
              }
              dispatch({ type: 'SET_SEAT_CLAIM_REQUEST', payload: null });
            }}
            onDecline={() => {
              if (socket) {
                socket.emit(EVENTS.RESOLVE_SEAT_CLAIM, {
                  claimId: state.seatClaimRequest.claimId,
                  accepted: false,
                });
              }
              dispatch({ type: 'SET_SEAT_CLAIM_REQUEST', payload: null });
            }}
          />
        )}

        {/* Global Toast */}
        <Toast
          isOpen={Boolean(state.toast)}
          message={state.toast?.message || ''}
          variant={state.toast?.variant || 'info'}
          duration={state.toast?.duration || 3500}
          onClose={() => dispatch({ type: 'HIDE_TOAST' })}
        />

        {/* Global Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={closeSettings}
        />
      </div>
    </MotionConfig>
  );
}

export default App;
