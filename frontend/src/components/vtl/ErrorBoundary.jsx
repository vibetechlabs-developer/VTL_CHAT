import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import logger from "../../utils/logger";
import "./ErrorBoundary.scss";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error("ErrorBoundary caught an uncaught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-card">
            <div className="error-boundary-icon-wrapper">
              <AlertTriangle size={48} className="error-boundary-icon" />
            </div>
            <h1 className="error-boundary-title">Something went wrong</h1>
            <p className="error-boundary-desc">
              An unexpected error occurred. Please try reloading the page or returning to the dashboard.
            </p>
            {this.state.error && (
              <pre className="error-boundary-details">
                {this.state.error.toString()}
              </pre>
            )}
            <div className="error-boundary-actions">
              <button onClick={() => window.location.reload()} className="vtl-btn vtl-btn--ghost">
                <RefreshCw size={16} /> Reload Page
              </button>
              <button onClick={this.handleReset} className="vtl-btn vtl-btn--primary">
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
