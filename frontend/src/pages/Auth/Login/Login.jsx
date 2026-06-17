import Navbar from "../../../components/auth/Navbar";
import HeroContent from "../../../components/auth/HeroContent";
import LoginCard from "../../../components/auth/LoginCard";
import VideoBackground from "../../../components/auth/VideoBackground";

import "./Login.scss";

const Login = () => {
  return (
    <div className="login-page">
      <VideoBackground />

      <div className="overlay-content">

        <Navbar />

        <div className="main-content">

          <HeroContent />

          <LoginCard />

        </div>

      </div>
    </div>
  );
};

export default Login;