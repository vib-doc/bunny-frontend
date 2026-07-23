import { createClient } from '@supabase/supabase-js';
// 初始化 Supabase 客户端
// 调试日志：打印环境变量是否加载
console.log('=== 环境变量检查 ===');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '已设置' : '未设置');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? '已设置' : '未设置');
console.log('DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '已设置' : '未设置');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: '消息内容不能为空' });
  }

  try {
    // 1. 确保会话存在（固定使用 session_id = 1）
    const sessionId = 1;
    const { data: existingSession, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (!existingSession) {
      await supabase.from('sessions').insert([{ id: sessionId, name: '默认对话' }]);
    }

    // 2. 保存用户消息
const { error: insertUserError } = await supabase.from('messages').insert([
  { session_id: sessionId, role: 'user', content: message }
]);

if (insertUserError) {
  console.error('保存用户消息失败:', insertUserError);
  return res.status(500).json({ error: '保存用户消息失败', details: insertUserError });
}
    

    // 3. 加载该会话最近的消息历史
    const { data: history, error: historyError } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .eq('visible', true)
      .order('created_at', { ascending: true })
      .limit(20); // 保留最近 20 条消息作为上下文

    // 4. 构建上下文
    const context = history || [];
    // 获取当前时间（北京时间）
const now = new Date();
const beijingTime = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
const timeMessage = `当前时间是：${beijingTime}`;

const messagesWithTime = [
  { role: 'system', content: timeMessage },
  ...context,
  { role: 'user', content: message }
];

// 5. 调用 DeepSeek API
const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
  },
  body: JSON.stringify({
    model: 'deepseek-v4-flash',
    messages: messagesWithTime,
    max_tokens: 500
  })
});

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '没有收到有效回复';

    // 6. 保存 AI 回复到数据库
    const { error: insertAssistantError } = await supabase.from('messages').insert([
  { session_id: sessionId, role: 'assistant', content: reply }
]);

if (insertAssistantError) {
  console.error('保存AI回复失败:', insertAssistantError);
  return res.status(500).json({ error: '保存AI回复失败', details: insertAssistantError });
}

    // 7. 返回回复
    res.status(200).json({ reply });

  } catch (error) {
    console.error('调用模型出错:', error.message);
    res.status(500).json({ error: '模型调用失败，请检查日志' });
  }
}