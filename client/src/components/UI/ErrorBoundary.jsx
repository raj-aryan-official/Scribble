import React from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log error without personal data
        console.error('Unhandled UI exception in ErrorBoundary:', error?.message || error, errorInfo?.componentStack);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 p-4 text-white">
                    <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-md text-center">
                        <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold font-heading mb-2 text-white">Oops! Something went wrong</h2>
                        <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                            An unexpected error occurred while rendering the page. Don't worry, your connection can easily be restored by reloading.
                        </p>
                        <button
                            onClick={this.handleReload}
                            className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reload Game
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
