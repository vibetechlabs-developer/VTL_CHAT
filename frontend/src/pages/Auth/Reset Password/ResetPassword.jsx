import Navbar from "../../../components/auth/Navbar";
import HeroContent from "../../../components/auth/HeroContent";
import ResetPasswordCard from "../../../components/auth/ResetPasswordCard";
import VideoBackground from "../../../components/auth/VideoBackground";

import "../Login/Login.scss";

const ResetPassword = () => {
  return (
    <div className="login-page">
      <VideoBackground />

      <div className="overlay-content">
        <Navbar />

        <div className="main-content">
          <HeroContent />
          <ResetPasswordCard />
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
