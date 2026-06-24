const VideoBackground = () => {
  return (
    <video
      className="video-background"
      autoPlay
      loop
      muted
      playsInline
    >
      <source
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4"
        type="video/mp4"
      />
    </video>
  );
};

export default VideoBackground;