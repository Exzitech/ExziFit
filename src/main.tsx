import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./polices/polices.css";
import "./theme.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("racine")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
