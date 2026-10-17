import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { langueDuSysteme } from "./i18n";
import { appliquerLangue } from "./langue";
import "./polices/polices.css";
import "./theme.css";
import "./styles.css";

// Avant les réglages (et pour leurs erreurs de lecture) : la langue du téléphone.
appliquerLangue(langueDuSysteme());

ReactDOM.createRoot(document.getElementById("racine")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
