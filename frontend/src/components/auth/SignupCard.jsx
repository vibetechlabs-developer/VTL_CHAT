import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signupUser, googleLogin, storeAuthTokens } from "../../services/authService";
import { useGoogleAuth } from "../../hooks/useGoogleAuth";
import GoogleIcon from "./GoogleIcon";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const SignupCard = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { username, email, password, confirmPassword } = formData;

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

  const validateEmail = (emailStr) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const validateUsername = (usernameStr) => {
    return /^[a-zA-Z0-9_]{3,}$/.test(usernameStr);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (!validateUsername(username)) {
      setError("Username must be at least 3 characters and contain only letters, numbers, or underscores");
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

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await signupUser({ username, email, password });
      setSuccess("Account created successfully! Redirecting...");
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err) {
      const responseErrors = err.response?.data;
      if (responseErrors) {
        const firstErrorKey = Object.keys(responseErrors)[0];
        const firstErrorMessage = responseErrors[firstErrorKey];
        const displayMessage = Array.isArray(firstErrorMessage)
          ? firstErrorMessage[0]
          : firstErrorMessage;
        setError(`${firstErrorKey}: ${displayMessage}`);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const isBusy = loading || googleLoading;

  return (
    <div className="login-card liquid-glass">
      <h2>Create Account</h2>

      {error && <div className="alert-message error">{error}</div>}
      {success && <div className="alert-message success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="username"
          placeholder="Username"
          value={username}
          onChange={handleChange}
          disabled={isBusy}
        />

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

        <div className="password-input-container">
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={handleChange}
            disabled={isBusy}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={isBusy}
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button
          type="submit"
          className="primary-btn flex-center-btn"
          disabled={isBusy}
        >
          {loading ? (
            <>
              <Loader2 className="spinner" size={18} />
              <span>Creating Account...</span>
            </>
          ) : (
            "Create Account"
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
        Already have an account?
        <Link to="/">
          <span> Sign In</span>
        </Link>
      </p>
    </div>
  );
};

export default SignupCard;