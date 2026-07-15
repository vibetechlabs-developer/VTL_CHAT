import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import AppLayout from "../../components/vtl/AppLayout";
import "./NotFound.scss";

export default function NotFound() {
  return (
    <AppLayout
      title="404 Not Found"
      subtitle="Oops! The page you are looking for does not exist."
      showSearch={false}
    >
      <div className="notfound-page">
        <AlertCircle size={64} className="notfound-icon" />
        <h2 className="notfound-title">Page Not Found</h2>
        <p className="notfound-desc">
          The requested URL was not found on this server. Please check the URL or return to the home page.
        </p>
        <Link to="/dashboard" className="vtl-btn vtl-btn--primary">
          Go to Dashboard
        </Link>
      </div>
    </AppLayout>
  );
}
