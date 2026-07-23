// api/chat-history.js
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 客户端（和 chat.js 里一样）
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  // 只允许 GET 请求（因为我们只是“取”数据，不是“发”数据）
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 固定使用 session_id = 1（和你之前一致）
    const sessionId = 1;

    // 从 Supabase 查询该会话的所有可见消息（按时间顺序排列）
    const { data: messages, error } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .eq('visible', true)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    // 把查询到的消息返回给前端
    res.status(200).json({ messages });
  } catch (error) {
    console.error('加载历史消息失败:', error.message);
    res.status(500).json({ error: '加载历史消息失败' });
  }
}