import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router";
import App from "./app/App.tsx";
import { Presenter } from "./app/Presenter.tsx";
import { SettingsProvider } from "./app/contexts/SettingsContext";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <SettingsProvider>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/presenter" element={<Presenter />} />
      </Routes>
    </HashRouter>
  </SettingsProvider>
);