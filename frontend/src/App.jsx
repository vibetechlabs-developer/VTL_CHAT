import AppRoutes from "./routes/AppRoutes";
import { ConfirmProvider } from "./context/ConfirmContext";

function App() {
  return (
    <ConfirmProvider>
      <AppRoutes />
    </ConfirmProvider>
  );
}

export default App;