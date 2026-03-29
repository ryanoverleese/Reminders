import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import QuickReminders from "./QuickReminders.jsx";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QuickReminders />
  </StrictMode>
);
