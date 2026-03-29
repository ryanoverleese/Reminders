import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import QuickReminders from "./QuickReminders.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QuickReminders />
  </StrictMode>
);
