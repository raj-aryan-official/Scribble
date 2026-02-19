import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, LogOut } from 'lucide-react';

const MobileNavBar = ({ roomCode, isMicOn, toggleMic, isDeafened, toggleDeafen, onExit, onEndGame, isHost }) => {
    return (
        <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-3 py-2 flex justify-between items-center z-50 shadow-md">
            {/* Left: Room Code */}
            <div className="flex flex-col shrink-0 mr-2">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Team Code</span>
                <span className="text-xl font-heading font-bold text-primary select-all">{roomCode}</span>
            </div>

            {/* Right: Controls (Mic -> Speaker -> Exit -> End Game) */}
            <div className="flex items-center gap-2">
                <button
                    onClick={toggleMic}
                    className={`p-2.5 rounded-full transition-colors shadow-sm ${isMicOn ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}
                    title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                >
                    {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                </button>

                <button
                    onClick={toggleDeafen}
                    className={`p-2.5 rounded-full transition-colors shadow-sm ${!isDeafened ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'
                        }`}
                    title={isDeafened ? "Enable Audio" : "Disable Audio"}
                >
                    {isDeafened ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>

                <button
                    onClick={onExit}
                    className="p-2.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors shadow-sm border border-red-100"
                    title="Exit Game"
                >
                    <LogOut size={20} />
                </button>

                {isHost && (
                    <button
                        onClick={onEndGame}
                        className="p-2.5 rounded-full bg-[#D9443E] text-white hover:bg-red-600 transition-colors shadow-sm flex items-center justify-center"
                        title="End Game"
                    >
                        <span className="font-bold text-xs leading-none">END</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default MobileNavBar;
