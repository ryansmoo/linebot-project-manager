// Supabase 配置檔案
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supabase 設定
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// 建立 Supabase 客戶端
const supabase = createClient(supabaseUrl, supabaseKey);

// 測試連接
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('user_messages')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Supabase 連接測試失敗:', error);
      return false;
    }
    
    console.log('✅ Supabase 連接成功');
    return true;
  } catch (error) {
    console.error('❌ Supabase 連接錯誤:', error);
    return false;
  }
}

// 訊息記錄功能
async function logMessage(messageData) {
  try {
    const { data, error } = await supabase
      .from('user_messages')
      .insert([messageData])
      .select();
    
    if (error) {
      console.error('記錄訊息失敗:', error);
      return { success: false, error };
    }
    
    console.log('✅ 訊息已記錄到 Supabase');
    return { success: true, data: data[0] };
  } catch (error) {
    console.error('記錄訊息錯誤:', error);
    return { success: false, error };
  }
}

// 取得用戶訊息歷史
async function getUserMessages(lineUserId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('user_messages')
      .select('*')
      .eq('line_user_id', lineUserId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('取得用戶訊息失敗:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('取得用戶訊息錯誤:', error);
    return { success: false, error };
  }
}

// 取得用戶任務
async function getUserTasks(lineUserId) {
  try {
    const { data, error } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('line_user_id', lineUserId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('取得用戶任務失敗:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('取得用戶任務錯誤:', error);
    return { success: false, error };
  }
}

// 新增任務
async function addTask(taskData) {
  try {
    const { data, error } = await supabase
      .from('user_tasks')
      .insert([taskData])
      .select();
    
    if (error) {
      console.error('新增任務失敗:', error);
      return { success: false, error };
    }
    
    console.log('✅ 任務已記錄到 Supabase');
    return { success: true, data: data[0] };
  } catch (error) {
    console.error('新增任務錯誤:', error);
    return { success: false, error };
  }
}

// 更新任務狀態
async function updateTaskStatus(taskId, status) {
  try {
    const { data, error } = await supabase
      .from('user_tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select();
    
    if (error) {
      console.error('更新任務狀態失敗:', error);
      return { success: false, error };
    }
    
    return { success: true, data: data[0] };
  } catch (error) {
    console.error('更新任務狀態錯誤:', error);
    return { success: false, error };
  }
}

// 刪除任務
async function deleteTask(taskId, lineUserId) {
  try {
    const { error } = await supabase
      .from('user_tasks')
      .delete()
      .eq('id', taskId)
      .eq('line_user_id', lineUserId);
    
    if (error) {
      console.error('刪除任務失敗:', error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error) {
    console.error('刪除任務錯誤:', error);
    return { success: false, error };
  }
}

module.exports = {
  supabase,
  testConnection,
  logMessage,
  getUserMessages,
  getUserTasks,
  addTask,
  updateTaskStatus,
  deleteTask
};