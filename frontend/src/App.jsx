import AppRoutes from "./routes/AppRoutes";

import { ConfirmProvider } from "./context/ConfirmContext";

import { SettingsProvider } from "./context/SettingsContext";

import { ToastProvider } from "./context/ToastContext";

import ErrorBoundary from "./components/vtl/ErrorBoundary";



function App() {

  return (

    <ErrorBoundary>

      <ToastProvider>

        <SettingsProvider>

          <ConfirmProvider>

            <AppRoutes />

          </ConfirmProvider>

        </SettingsProvider>

      </ToastProvider>

    </ErrorBoundary>

  );

}



export default App;

