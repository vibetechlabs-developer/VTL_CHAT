import AppRoutes from "./routes/AppRoutes";
import { ConfirmProvider } from "./context/ConfirmContext";
import { SettingsProvider } from "./context/SettingsContext";

function App() {
  return (
    <SettingsProvider>
      <ConfirmProvider>
        <AppRoutes />
      </ConfirmProvider>
    </SettingsProvider>
  );
}

export default App;