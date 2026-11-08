import React from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import Card from './Card';
import Button from './Button';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Unhandled UI exception in ErrorBoundary:', error?.message || error, errorInfo?.componentStack);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen w-full flex items-center justify-center bg-paper p-4 text-ink">
                    <Card className="max-w-md w-full text-center p-6 md:p-8">
                        <div className="w-16 h-16 bg-tomato text-white rounded-full border-2 border-ink flex items-center justify-center mx-auto mb-4 shadow-hard-sm">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold font-heading mb-2 text-ink">
                            Oops! Something went wrong
                        </h2>
                        <p className="text-ink-soft text-sm mb-6 leading-relaxed">
                            An unexpected error occurred while rendering the page. Your game session can be restored by reloading.
                        </p>
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={this.handleReload}
                            className="w-full flex items-center justify-center gap-2"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reload Game
                        </Button>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
