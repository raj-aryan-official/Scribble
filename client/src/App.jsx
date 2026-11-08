import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import Landing from './pages/Landing';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import GameEnd from './pages/GameEnd';
import ConnectionBanner from './components/ui/ConnectionBanner';

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-[100dvh] bg-paper text-ink font-body flex flex-col selection:bg-marigold selection:text-ink">
        <ConnectionBanner />
        <main className="flex-1 flex flex-col relative w-full">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/lobby/:code" element={<Lobby />} />
            <Route path="/join/:code" element={<Landing />} />
            <Route path="/game/:code" element={<Game />} />
            <Route path="/end/:code" element={<GameEnd />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </MotionConfig>
  );
}

export default App;
