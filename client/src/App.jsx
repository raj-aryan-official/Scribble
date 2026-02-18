import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import GameEnd from './pages/GameEnd';

import Header from './components/Layout/Header';

function App() {
  return (
    <div className="h-screen bg-background text-primary font-body flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 overflow-hidden relative">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/lobby/:code" element={<Lobby />} />
          <Route path="/game/:code" element={<Game />} />
          <Route path="/end/:code" element={<GameEnd />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
