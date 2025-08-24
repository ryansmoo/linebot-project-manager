import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import liff from "@line/liff";
import "./App.css";
import TasksPage from "./pages/TasksPage";
import ProfilePage from "./pages/ProfilePage";

function App() {
  const [liffInitialized, setLiffInitialized] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    liff
      .init({
        liffId: import.meta.env.VITE_LIFF_ID || "2006600537-rGOAqY6l"
      })
      .then(() => {
        console.log("LIFF init succeeded.");
        setLiffInitialized(true);
      })
      .catch((e: Error) => {
        console.error("LIFF init failed:", e);
        setError(`${e}`);
      });
  }, []);

  if (!liffInitialized && !error) {
    return (
      <div className="App">
        <div className="loading">
          <h2>Loading...</h2>
          <p>正在初始化 LIFF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <div className="error">
          <h2>初始化失敗</h2>
          <p>LIFF 初始化失敗，請確認設定是否正確。</p>
          <code>{error}</code>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/" element={<Navigate to="/tasks" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;