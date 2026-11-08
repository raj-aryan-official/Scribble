import React from 'react';
import StatusScreen from './StatusScreen';
import errorSvg from '../../assets/states/error.svg';

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
                <StatusScreen
                    role="alert"
                    illustration={errorSvg}
                    title="Something went wrong"
                    sentence="An unexpected error occurred while rendering the page."
                    primaryAction={{
                        label: 'Reload',
                        onClick: this.handleReload,
                    }}
                />
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
