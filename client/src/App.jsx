import React, { useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { useGame } from './context/GameContext';
import Landing from './pages/Landing';
import Join from './pages/Join';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import GameEnd from './pages/GameEnd';
import AppHeader from './components/Layout/AppHeader';
import ConnectionBanner from './components/ui/ConnectionBanner';
import { LobbyGuard, GameGuard, EndGuard } from './components/Routing/RouteGuards';
import { PAGE_TRANSITION } from './constants/layout';

function App() {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const { state } = useGame();

  // Top-level route keying: e.g. 'root' (landing), 'lobby', 'join', 'game', 'end'
  const topLevelRoute = useMemo(() => {
    const segment = location.pathname.split('/')[1] || 'root';
    return segment.toLowerCase();
  }, [location.pathname]);

  // Determine if Shell Top Bar should be shown: Lobby, Game and GameEnd only
  const showTopBar = topLevelRoute === 'lobby' || topLevelRoute === 'game' || topLevelRoute === 'end';
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
    } else {
      document.title = 'Scribble';
    }
  }, [topLevelRoute, currentRoomCode, state.currentRound, state.totalRounds, state.settings?.rounds]);

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
      transition: {
        duration: PAGE_TRANSITION.EXIT_DURATION,
        ease: [0.7, 0, 0.84, 0],
      },
    },
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-[100dvh] bg-paper text-ink font-body flex flex-col selection:bg-marigold selection:text-ink relative">
        {/* Skip to Content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-toast focus:px-4 focus:py-2 focus:bg-card focus:border-2 focus:border-ink focus:shadow-hard focus:text-ink focus:font-bold focus:rounded-[6px] focus:outline-none"
        >
          Skip to content
        </a>

        {/* Global Connection Status Banner */}
        <ConnectionBanner />

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
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </MotionConfig>
  );
}

export default App;
