import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../../services/authService";
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

  const { email, password } = formData; 

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateEmail = (emailStr) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

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
      const { access, refresh } = response.data;
      
      
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
    
      navigate("/dashboard");
    } catch (err) {
      const apiError = err.response?.data?.error || err.response?.data?.detail;
      setError(apiError || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

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
          disabled={loading}
        />

        <div className="password-input-container">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            value={password}
            onChange={handleChange}
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

        <button
          type="submit"
          className="primary-btn flex-center-btn"
          disabled={loading}
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

      <div className="divider">
        OR
      </div>

      <button className="google-btn" disabled={loading}>
        Continue with Google
      </button>

      <p className="signup-text">
        Don't have an account?
        <Link to="/signup">
          <span> Create Account</span>
        </Link>
      </p>
    </div>
  );
};

export default LoginCard;