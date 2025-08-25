import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import TasksPage from "./pages/TasksPage";
import ProfilePage from "./pages/ProfilePage";

function App() {
  const [liffInitialized, setLiffInitialized] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log('App useEffect 執行');
    // 暫時跳過 LIFF 初始化，直接載入應用程式
    setTimeout(() => {
      console.log('設置 LIFF 為已初始化');
      setLiffInitialized(true);
    }, 100);
  }, []);

  // 添加調試信息
  console.log('App render state:', { liffInitialized, error });

  if (!liffInitialized && !error) {
    return (
      <div className="App">
        <div className="loading">
          <h2>Loading...</h2>
          <p>正在初始化 LIFF...</p>
          <p style={{fontSize: '12px', color: '#666'}}>
            Debug: liffInitialized={liffInitialized.toString()}, error={error}
          </p>
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
    <Router basename="/liff">
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