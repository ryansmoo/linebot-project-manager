import { useEffect, useState } from "react";
import liff from "@line/liff";

interface Task {
  id: string;
  text: string;
  timestamp: string;
  date: string;
  hasTime?: boolean;
  taskTime?: string;
  status?: string;
}

function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        // 取得使用者資訊
        const profile = await liff.getProfile();
        setUserProfile(profile);

        // 取得後端 API URL（從環境變數或使用預設值）
        const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
        
        // 從後端 API 取得所有任務
        const response = await fetch(`${apiUrl}/api/tasks/${profile.userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTasks(data.tasks || []);
        } else {
          throw new Error('Failed to fetch tasks');
        }
      } catch (err) {
        console.error('Error fetching tasks:', err);
        setError('無法載入任務資料');
      } finally {
        setLoading(false);
      }
    };

    if (liff.isLoggedIn()) {
      fetchTasks();
    } else {
      liff.login();
    }
  }, []);

  const deleteTask = async (taskId: string) => {
    if (!userProfile) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const response = await fetch(`${apiUrl}/api/tasks/${userProfile.userId}/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setTasks(tasks.filter(task => task.id !== taskId));
        // 顯示成功訊息
        liff.sendMessages([{
          type: 'text',
          text: `✅ 任務已刪除`
        }]);
      } else {
        throw new Error('Failed to delete task');
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('刪除失敗，請稍後再試');
    }
  };

  const shareTask = (task: Task) => {
    if (liff.isApiAvailable('shareTargetPicker')) {
      liff.shareTargetPicker([{
        type: 'text',
        text: `📋 我的任務：${task.text}\n📅 ${task.date}${task.hasTime && task.taskTime ? ` ${task.taskTime}` : ''}`
      }]);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">
          <h2>載入中...</h2>
          <p>正在取得您的任務資料...</p>
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
        <h1>📋 全部任務</h1>
        {userProfile && (
          <p className="user-info">Hi, {userProfile.displayName}!</p>
        )}
      </div>

      <div className="task-stats">
        <div className="stat-item">
          <span className="stat-number">{tasks.length}</span>
          <span className="stat-label">總任務數</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{tasks.filter(t => t.hasTime).length}</span>
          <span className="stat-label">有時間任務</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{tasks.filter(t => t.status === 'active').length}</span>
          <span className="stat-label">進行中</span>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <h3>🎉 目前沒有任務</h3>
          <p>您目前沒有任何任務記錄</p>
          <button onClick={() => liff.closeWindow()}>返回聊天</button>
        </div>
      ) : (
        <div className="tasks-list">
          {tasks.map((task, index) => (
            <div key={task.id} className="task-item">
              <div className="task-header">
                <span className="task-number">#{index + 1}</span>
                <span className="task-date">{task.date}</span>
                {task.hasTime && (
                  <span className="task-time">⏰ {task.taskTime}</span>
                )}
              </div>
              
              <div className="task-content">
                <p>{task.text}</p>
              </div>

              <div className="task-actions">
                <button 
                  className="btn-share" 
                  onClick={() => shareTask(task)}
                >
                  分享
                </button>
                <button 
                  className="btn-delete" 
                  onClick={() => deleteTask(task.id)}
                >
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="page-footer">
        <button className="btn-close" onClick={() => liff.closeWindow()}>
          關閉
        </button>
      </div>
    </div>
  );
}

export default TasksPage;