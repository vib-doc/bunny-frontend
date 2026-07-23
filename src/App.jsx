import { useState, useEffect } from 'react';
import './App.css'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false);
  const loadMessages = async () => {
  try {
    const res = await fetch('/api/chat-history?sessionId=1');
    const data = await res.json();
    if (data.messages) {
      setMessages(data.messages);
    }
  } catch (err) {
    console.error('加载历史消息失败:', err);
  }
};

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat',  {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      })
      const data = await res.json()
      const assistantMessage = { role: 'assistant', content: data.reply || '没有收到回复' }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage = { role: 'assistant', content: '请求失败，请确保后端已启动' }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }
const handleFileUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  setUploading(true);
  try {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('model', 'document-parse');
    formData.append('output_formats', JSON.stringify(['text']));
    formData.append('ocr', 'auto');

    const response = await fetch('https://api.upstage.ai/v1/document-digitization', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer up_8732rooHcrQm2snxOA152FTCtkEH7'
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upstage 返回错误 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log('📦 Upstage 返回的完整数据:', data);
    let extractedText = data.text || data.content || data.result || '';
if (typeof extractedText !== 'string') {
  console.warn('⚠️ extractedText 不是字符串，当前类型:', typeof extractedText);
  extractedText = JSON.stringify(extractedText, null, 2);
} else {
  extractedText = extractedText.replace(/\s+/g, ' ').trim();
}

    if (!extractedText) {
      throw new Error('未能从 PDF 中提取文本');
    }

    setInput(`[PDF内容]\n${extractedText}\n\n请根据以上内容回答：`);
    alert('✅ PDF 解析成功！内容已填入输入框。');
  } catch (error) {
    console.error('PDF 解析失败:', error);
    alert('PDF 解析失败: ' + error.message);
  } finally {
    setUploading(false);
  }
};

useEffect(() => {
  loadMessages();
}, []); 
return (
    <div className="app">
      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              {msg.content}
            </div>
          ))}
          {loading && <div className="message assistant">正在思考...</div>}
        </div>
        <div className="input-area">
  <input
    type="file"
    accept=".pdf"
    onChange={handleFileUpload}
    style={{ display: 'none' }}
    id="pdf-upload"
  />
  <label htmlFor="pdf-upload" style={{ cursor: 'pointer', padding: '8px 12px', background: '#f0ebe6', borderRadius: '40px' }}>
    📄 PDF
  </label>
  <input
    value={input}
    onChange={(e) => setInput(e.target.value)}
    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
    placeholder="输入消息..."
  />
  <button onClick={sendMessage}>发送</button>
</div>
      </div>
    </div>
  )
}

export default App
