import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { GameProvider } from './context/GameContext';
import { SocketProvider } from './context/SocketContext';
import { VoiceProvider } from './context/VoiceContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Clear any leftover session data from the old auto-rejoin feature
localStorage.removeItem('scribble_session');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <GameProvider>
        <SocketProvider>
          <VoiceProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </VoiceProvider>
        </SocketProvider>
      </GameProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
