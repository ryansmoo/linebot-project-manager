import { useEffect, useState } from "react";

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
  const [filter, setFilter] = useState<string>("all");
  const [pageTitle, setPageTitle] = useState<string>("📋 所有任務");
  const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, pending: 0 });

  useEffect(() => {
    // 從 URL 查詢參數獲取過濾器設定
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get('filter') || 'all';
    
    // 添加調試日誌
    console.log('🔍 TasksPage Debug:');
    console.log('URL:', window.location.href);
    console.log('Search params:', window.location.search);
    console.log('Filter param:', filterParam);
    
    setFilter(filterParam);
    
    // 設定頁面標題
    switch(filterParam) {
      case 'today':
        setPageTitle("📅 今日任務");
        break;
      case 'all':
        setPageTitle("📋 所有任務");
        break;
      default:
        setPageTitle("📋 任務清單");
    }
    
    console.log('Set filter to:', filterParam);
    console.log('Set title to:', filterParam === 'today' ? "📅 今日任務" : "📋 所有任務");
  }, []);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        // 暫時使用測試資料
        setUserProfile({ displayName: 'Test User', userId: 'test-user' });

        // 取得後端 API URL（從環境變數或使用預設值）
        const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
        
        // 根據過濾器決定 API 端點
        let endpoint = `${apiUrl}/api/tasks/test-user`;
        if (filter === 'today') {
          endpoint = `${apiUrl}/api/today-tasks/test-user`;
        }
        
        // 從後端 API 取得任務
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const taskList = data.tasks || [];
          setTasks(taskList);
          
          // 計算任務統計
          const total = taskList.length;
          const completed = taskList.filter((task: Task) => task.status === 'completed').length;
          const pending = total - completed;
          setTaskStats({ total, completed, pending });
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

    // 直接載入任務，不檢查 LIFF 登入狀態
    fetchTasks();
  }, [filter]);

  const toggleTaskComplete = async (taskId: string, currentStatus: string) => {
    if (!userProfile) return;

    try {
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      
      const response = await fetch(`${apiUrl}/api/tasks/${userProfile.userId}/${taskId}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        // 更新本地狀態
        const updatedTasks = tasks.map(task => 
          task.id === taskId ? { ...task, status: newStatus } : task
        );
        setTasks(updatedTasks);
        
        // 重新計算統計
        const total = updatedTasks.length;
        const completed = updatedTasks.filter(task => task.status === 'completed').length;
        const pending = total - completed;
        setTaskStats({ total, completed, pending });
      } else {
        alert('❌ 更新任務狀態失敗');
      }
    } catch (err) {
      console.error('Error updating task:', err);
      alert('❌ 更新任務狀態失敗');
    }
  };

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
        // 顯示成功訊息（暫時用 alert）
        alert('✅ 任務已刪除');
      } else {
        throw new Error('Failed to delete task');
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('刪除失敗，請稍後再試');
    }
  };

  const shareTask = (task: Task) => {
    // 暫時使用簡單的分享功能
    const shareText = `📋 我的任務：${task.text}\n📅 ${task.date}${task.hasTime && task.taskTime ? ` ${task.taskTime}` : ''}`;
    if (navigator.share) {
      navigator.share({ text: shareText });
    } else {
      alert('分享功能：' + shareText);
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
        <h1>{pageTitle}</h1>
        {userProfile && (
          <p className="user-info">Hi, {userProfile.displayName}!</p>
        )}
      </div>

      {/* 調試信息 - 臨時顯示 */}
      <div style={{backgroundColor: '#ffeb3b', padding: '10px', margin: '10px 0', fontSize: '12px'}}>
        🔍 Debug: filter="{filter}", title="{pageTitle}"<br/>
        URL: {window.location.href}<br/>
        Tasks count: {tasks.length}<br/>
        Loading: {loading.toString()}<br/>
        Error: {error || 'none'}
      </div>
      
      {filter === 'today' ? (
        <>
          {/* 區塊1: 今日任務統計 */}
          <div className="today-stats-section">
            <h3>📊 今日任務概況</h3>
            <div className="today-stats-grid">
              <div className="stat-card total">
                <div className="stat-icon">📋</div>
                <div className="stat-info">
                  <span className="stat-number">{taskStats.total}</span>
                  <span className="stat-label">總任務</span>
                </div>
              </div>
              <div className="stat-card completed">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <span className="stat-number">{taskStats.completed}</span>
                  <span className="stat-label">已完成</span>
                </div>
              </div>
              <div className="stat-card pending">
                <div className="stat-icon">⏳</div>
                <div className="stat-info">
                  <span className="stat-number">{taskStats.pending}</span>
                  <span className="stat-label">未完成</span>
                </div>
              </div>
            </div>
          </div>

          {/* 區塊2: 今日任務列表 */}
          <div className="today-tasks-section">
            <h3>📝 今日任務列表</h3>
            {tasks.length === 0 ? (
              <div className="no-tasks">
                <p>🎉 今天還沒有任務！</p>
                <p>享受您的自由時光吧～</p>
              </div>
            ) : (
              <div className="tasks-with-checkbox">
                {tasks.map((task) => (
                  <div key={task.id} className={`task-item-with-checkbox ${task.status === 'completed' ? 'completed' : ''}`}>
                    <div className="task-checkbox-container">
                      <input
                        type="checkbox"
                        checked={task.status === 'completed'}
                        onChange={() => toggleTaskComplete(task.id, task.status || 'pending')}
                        className="task-checkbox"
                      />
                    </div>
                    <div className="task-content">
                      <div className={`task-text ${task.status === 'completed' ? 'completed-text' : ''}`}>
                        {task.hasTime && <span className="task-time">🕐 {task.taskTime}</span>}
                        {task.text}
                      </div>
                      <div className="task-meta">
                        {task.date}
                      </div>
                    </div>
                    <div className="task-actions">
                      <button
                        className="btn-delete"
                        onClick={() => deleteTask(task.id)}
                        title="删除任务"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* 原有的所有任務顯示 */}
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
              <span className="stat-number">{tasks.filter(t => t.status === 'completed').length}</span>
              <span className="stat-label">已完成</span>
            </div>
          </div>
          
          {/* 所有任務模式的任務列表顯示 */}
          {tasks.length === 0 ? (
            <div className="empty-state">
              <h3>🎉 目前沒有任務</h3>
              <p>您目前沒有任何任務記錄</p>
              <button onClick={() => window.history.back()}>返回</button>
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
        </>
      )}

      <div className="page-footer">
        <button className="btn-close" onClick={() => window.history.back()}>
          關閉
        </button>
      </div>
    </div>
  );
}

export default TasksPage;