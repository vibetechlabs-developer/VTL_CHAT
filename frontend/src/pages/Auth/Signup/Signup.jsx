import Navbar from "../../../components/auth/Navbar";
import HeroContent from "../../../components/auth/HeroContent";
import SignupCard from "../../../components/auth/SignupCard";
import VideoBackground from "../../../components/auth/VideoBackground";


import "../Login/Login.scss";
const Signup = () => {
  return (
    <div className="login-page">

      <VideoBackground />

      <div className="overlay-content">

        <Navbar />

        <div className="main-content">

          <HeroContent />

          <SignupCard />

        </div>

      </div>

    </div>
  );
};

export default Signup;