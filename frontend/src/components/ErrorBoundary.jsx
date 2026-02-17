import React from 'react';
import { AlertTriangle, RefreshCcw, Copy } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("Uncaught error:", error, errorInfo);
        // Do not trigger extra state updates here; repeated commit-phase errors can recurse.
    }

    handleReload = () => {
        window.location.reload();
    };

    handleCopyError = () => {
        const errorText = `Error: ${this.state.error?.toString()}\nComponent Stack: ${this.state.errorInfo?.componentStack}`;
        navigator.clipboard.writeText(errorText);
        alert('Error details copied to clipboard');
    };

    render() {
        if (this.state.hasError) {
            // Fallback UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 border-l-4 border-red-500">
                        <div className="flex items-start mb-4">
                            <div className="flex-shrink-0">
                                <AlertTriangle className="h-6 w-6 text-red-500" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-lg font-medium text-gray-900">Something went wrong</h3>
                                <div className="mt-2 text-sm text-gray-500">
                                    <p>The application encountered an unexpected error. Please try reloading the page.</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 bg-gray-100 p-3 rounded text-xs font-mono overflow-auto max-h-32 text-red-800 mb-4">
                            {this.state.error && this.state.error.toString()}
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={this.handleReload}
                                className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                <RefreshCcw className="w-4 h-4 mr-2" />
                                Reload Page
                            </button>

                            {import.meta.env.MODE === 'development' && (
                                <button
                                    onClick={this.handleCopyError}
                                    className="flex-shrink-0 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    title="Copy Error Details"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
