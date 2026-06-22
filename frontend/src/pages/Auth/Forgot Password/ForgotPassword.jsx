import Navbar from "../../../components/auth/Navbar";
import HeroContent from "../../../components/auth/HeroContent";
import ForgotPasswordCard from "../../../components/auth/ForgotPasswordCard";
import VideoBackground from "../../../components/auth/VideoBackground";

import "../Login/Login.scss";

const ForgotPassword = () => {
  return (
    <div className="login-page">
      <VideoBackground />

      <div className="overlay-content">
        <Navbar />

        <div className="main-content">
          <HeroContent />
          <ForgotPasswordCard />
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
