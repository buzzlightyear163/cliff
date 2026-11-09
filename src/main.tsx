import { Buffer } from "buffer";
(window as any).Buffer = (window as any).Buffer || Buffer;

import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import "@fontsource-variable/archivo/standard.css";
import "./styles.css";
import { SiteProvider } from "./lib/site";
import { Footer, Header } from "./components/Chrome";
import Home from "./pages/Home";
import Launch from "./pages/Launch";
import Board from "./pages/Board";
import CoinPage from "./pages/Coin";
import Docs from "./pages/Docs";
import Setup from "./pages/Setup";

const TITLES: Record<string, string> = {
  "/": "CLIFF · the dev's bag waits",
  "/board": "Board · CLIFF",
  "/launch": "Launch a coin · CLIFF",
  "/docs": "Docs · CLIFF",
  "/setup": "Setup · CLIFF",
};

function ScrollTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
    document.title = TITLES[pathname] ?? "CLIFF";
  }, [pathname, hash]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SiteProvider>
        <ScrollTop />
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/launch" element={<Launch />} />
          <Route path="/board" element={<Board />} />
          <Route path="/c/:mint" element={<CoinPage />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="*" element={<Home />} />
        </Routes>
        <Footer />
      </SiteProvider>
    </BrowserRouter>
  </StrictMode>,
);
