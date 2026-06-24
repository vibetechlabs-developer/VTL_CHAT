import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../services/authService";
import { Loader2 } from "lucide-react";

const ForgotPasswordCard = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (emailStr) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setDevResetUrl("");

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const response = await forgotPassword({ email: email.trim().toLowerCase() });
      setSuccess(response.data.message);
      if (response.data.reset_url) {
        setDevResetUrl(response.data.reset_url);
      }
    } catch (err) {
      const apiError = err.response?.data?.error || err.response?.data?.detail;
      setError(apiError || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card liquid-glass">
      <h2>Forgot Password</h2>
      <p className="auth-subtitle">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      {error && <div className="alert-message error">{error}</div>}
      {success && <div className="alert-message success">{success}</div>}

      {devResetUrl && (
        <div className="dev-reset-link">
          <span>Dev reset link:</span>
          <a href={devResetUrl}>{devResetUrl}</a>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          name="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />

        <button
          type="submit"
          className="primary-btn flex-center-btn"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="spinner" size={18} />
              <span>Sending...</span>
            </>
          ) : (
            "Send Reset Link"
          )}
        </button>
      </form>

      <p className="signup-text">
        Remember your password?
        <Link to="/">
          <span> Sign In</span>
        </Link>
      </p>
    </div>
  );
};

export default ForgotPasswordCard;
