
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import UserContext from "./context/UserContext.jsx";
import "./index.css";


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <UserContext>
        <App />
      </UserContext>
    </BrowserRouter>
  </StrictMode>
)
