import { useEffect, useState } from "react";
import liff from "@line/liff";

interface UserStats {
  totalMessages: number;
  totalTasks: number;
  aiQueries: number;
  lastActivity: string;
  joinDate: string;
  tasksSummary: {
    active: number;
    completed: number;
    withTime: number;
  };
}

function ProfilePage() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // 取得使用者基本資訊
        const profile = await liff.getProfile();
        setUserProfile(profile);

        // 取得後端 API URL
        const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
        
        // 從後端 API 取得使用者統計資料
        const response = await fetch(`${apiUrl}/api/user-stats/${profile.userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUserStats(data.stats);
        } else {
          throw new Error('Failed to fetch user stats');
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('無法載入使用者資料');
      } finally {
        setLoading(false);
      }
    };

    if (liff.isLoggedIn()) {
      fetchUserData();
    } else {
      liff.login();
    }
  }, []);

  const exportData = async () => {
    if (!userProfile) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const response = await fetch(`${apiUrl}/api/export-data/${userProfile.userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // 建立下載連結
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `linebot-data-${userProfile.userId}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        alert('✅ 資料匯出成功！');
      } else {
        throw new Error('Failed to export data');
      }
    } catch (err) {
      console.error('Error exporting data:', err);
      alert('❌ 資料匯出失敗，請稍後再試');
    }
  };

  const clearAllData = async () => {
    if (!userProfile) return;

    if (!confirm('⚠️ 確定要清除所有資料嗎？此動作無法復原！')) {
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const response = await fetch(`${apiUrl}/api/clear-data/${userProfile.userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        alert('✅ 所有資料已清除！');
        window.location.reload();
      } else {
        throw new Error('Failed to clear data');
      }
    } catch (err) {
      console.error('Error clearing data:', err);
      alert('❌ 清除失敗，請稍後再試');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">
          <h2>載入中...</h2>
          <p>正在取得您的帳戶資訊...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="error">
          <h2>載入失敗</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>重新載入</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>👤 個人帳戶</h1>
      </div>

      {userProfile && (
        <div className="profile-section">
          <div className="profile-card">
            <div className="profile-avatar">
              <img src={userProfile.pictureUrl} alt="Profile" />
            </div>
            <div className="profile-info">
              <h2>{userProfile.displayName}</h2>
              <p className="user-id">ID: {userProfile.userId}</p>
              <p className="status-message">
                {userProfile.statusMessage || "沒有狀態訊息"}
              </p>
            </div>
          </div>
        </div>
      )}

      {userStats && (
        <div className="stats-section">
          <h3>📊 使用統計</h3>
          
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">💬</div>
              <div className="stat-info">
                <span className="stat-number">{userStats.totalMessages}</span>
                <span className="stat-label">總訊息數</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📋</div>
              <div className="stat-info">
                <span className="stat-number">{userStats.totalTasks}</span>
                <span className="stat-label">總任務數</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🤖</div>
              <div className="stat-info">
                <span className="stat-number">{userStats.aiQueries}</span>
                <span className="stat-label">AI 查詢</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <span className="stat-number">{userStats.tasksSummary.active}</span>
                <span className="stat-label">進行中任務</span>
              </div>
            </div>
          </div>

          <div className="date-info">
            <div className="date-item">
              <span className="date-label">📅 加入日期</span>
              <span className="date-value">{userStats.joinDate}</span>
            </div>
            <div className="date-item">
              <span className="date-label">⏰ 最後活動</span>
              <span className="date-value">{userStats.lastActivity}</span>
            </div>
          </div>
        </div>
      )}

      <div className="actions-section">
        <h3>⚙️ 帳戶管理</h3>
        
        <div className="action-buttons">
          <button className="btn-primary" onClick={exportData}>
            📥 匯出資料
          </button>
          
          <button className="btn-secondary" onClick={() => {
            if (liff.isApiAvailable('shareTargetPicker')) {
              liff.shareTargetPicker([{
                type: 'text',
                text: `📊 我的 LINE Bot 使用統計：\n💬 總訊息：${userStats?.totalMessages || 0}\n📋 總任務：${userStats?.totalTasks || 0}\n🤖 AI查詢：${userStats?.aiQueries || 0}`
              }]);
            }
          }}>
            📤 分享統計
          </button>
          
          <button className="btn-danger" onClick={clearAllData}>
            🗑️ 清除所有資料
          </button>
        </div>
      </div>

      <div className="info-section">
        <h3>ℹ️ 關於此服務</h3>
        <div className="info-content">
          <p>這是一個 LINE Bot 任務管理系統，提供以下功能：</p>
          <ul>
            <li>📝 智能任務記錄與管理</li>
            <li>📅 Google Calendar 整合</li>
            <li>🤖 ChatGPT AI 問答</li>
            <li>📊 使用統計與資料分析</li>
            <li>☁️ Supabase 雲端儲存</li>
          </ul>
          
          <p className="privacy-note">
            ⚠️ 隱私說明：您的所有訊息和任務資料都會安全儲存在雲端資料庫中，
            用於提供更好的服務體驗。您可以隨時匯出或清除這些資料。
          </p>
        </div>
      </div>

      <div className="page-footer">
        <button className="btn-close" onClick={() => liff.closeWindow()}>
          關閉
        </button>
      </div>
    </div>
  );
}

export default ProfilePage;