import "./Header.scss";

export default function Header() {

  return (
    <header className="header">

      <div>

        <h1>Welcome Back 👋</h1>

        <p>
          Manage teams, chats and meetings
        </p>

      </div>

      <div className="user-profile">

        <img
          src="https://i.pravatar.cc/150"
          alt=""
        />

      </div>

    </header>
  );
}