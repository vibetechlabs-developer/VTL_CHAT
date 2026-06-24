import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../../services/authService";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const ResetPasswordCard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Invalid reset link. Request a new one from the sign-in page.");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Please fill in both password fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await resetPassword({
        token,
        new_password: password,
      });
      setSuccess(response.data.message);
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      const apiError = err.response?.data?.error || err.response?.data?.detail;
      setError(apiError || "Could not reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card liquid-glass">
      <h2>Reset Password</h2>
      <p className="auth-subtitle">Choose a new password for your account.</p>

      {error && <div className="alert-message error">{error}</div>}
      {success && <div className="alert-message success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="password-input-container">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
            disabled={loading}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <div className="password-input-container">
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={loading}
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button
          type="submit"
          className="primary-btn flex-center-btn"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="spinner" size={18} />
              <span>Updating...</span>
            </>
          ) : (
            "Update Password"
          )}
        </button>
      </form>

      <p className="signup-text">
        Back to
        <Link to="/">
          <span> Sign In</span>
        </Link>
      </p>
    </div>
  );
};

export default ResetPasswordCard;
