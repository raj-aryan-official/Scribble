import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';

const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isGame = location.pathname.startsWith('/game') || location.pathname.startsWith('/lobby');

    const handleExit = () => {
        if (confirm('Are you sure you want to exit?')) {
            window.location.href = '/'; // Hard reload to clear socket state
        }
    };

    if (location.pathname === '/') {
        return null;
    }

    return (
        <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-50">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                <span className="text-2xl">✏️</span>
                <h1 className="font-heading text-2xl text-primary font-bold">SCRIBBLE</h1>
            </div>

            {isGame && (
                <button
                    onClick={handleExit}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors font-bold"
                >
                    <LogOut size={18} />
                    <span className="hidden md:inline">Exit</span>
                </button>
            )}
        </header>
    );
};

export default Header;
