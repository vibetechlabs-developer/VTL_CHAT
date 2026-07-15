import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, googleLogin, storeAuthTokens, getLoginErrorMessage } from "../../services/authService";
import { useGoogleAuth } from "../../hooks/useGoogleAuth";
import GoogleIcon from "./GoogleIcon";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const LoginCard = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { email, password } = formData;

  const handleGoogleSuccess = useCallback(
    async (payload) => {
      setError("");
      setGoogleLoading(true);
      try {
        const response = await googleLogin(payload);
        storeAuthTokens(response.data);
        navigate("/dashboard");
      } catch (err) {
        const apiError = err.response?.data?.error || err.response?.data?.detail;
        setError(apiError || "Google sign-in failed");
      } finally {
        setGoogleLoading(false);
      }
    },
    [navigate]
  );

  const handleGoogleError = useCallback((message) => {
    if (message !== "popup_closed_by_user") {
      setError(typeof message === "string" ? message : "Google sign-in failed");
    }
  }, []);

  const { login: loginWithGoogle, isConfigured } = useGoogleAuth(
    handleGoogleSuccess,
    handleGoogleError
  );

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateEmail = (emailStr) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser({ email, password });
      storeAuthTokens(response.data);
      navigate("/dashboard");
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const isBusy = loading || googleLoading;

  return (
    <div className="login-card liquid-glass">
      <h2>Welcome Back</h2>

      {error && <div className="alert-message error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          name="email"
          placeholder="Email Address"
          value={email}
          onChange={handleChange}
          disabled={isBusy}
        />

        <div className="password-input-container">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            value={password}
            onChange={handleChange}
            disabled={isBusy}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
            disabled={isBusy}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <div className="forgot-password-link">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button
          type="submit"
          className="primary-btn flex-center-btn"
          disabled={isBusy}
        >
          {loading ? (
            <>
              <Loader2 className="spinner" size={18} />
              <span>Signing In...</span>
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <div className="divider">OR</div>

      <button
        type="button"
        className="google-btn flex-center-btn"
        onClick={loginWithGoogle}
        disabled={isBusy || !isConfigured}
        title={!isConfigured ? "Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in" : undefined}
      >
        {googleLoading ? (
          <>
            <Loader2 className="spinner" size={18} />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <GoogleIcon />
            <span>Continue with Google</span>
          </>
        )}
      </button>

      <p className="signup-text">
        Don&apos;t have an account?
        <Link to="/signup">
          <span> Create Account</span>
        </Link>
      </p>
    </div>
  );
};

export default LoginCard;
