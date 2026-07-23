// api/upload-pdf.js
import Busboy from 'busboy';
// 在 Vercel 环境中需要这个来构建 multipart/form-data
import FormData from 'form-data';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // 1. 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. 检查环境变量
  if (!process.env.UPSTAGE_API_KEY) {
    console.error('错误: 缺少 UPSTAGE_API_KEY 环境变量');
    return res.status(500).json({ error: '服务器配置错误: 缺少 API 密钥' });
  }

  try {
    // 3. 使用 Busboy 解析上传的文件
    const bb = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let fileName = '';

    await new Promise((resolve, reject) => {
      bb.on('file', (name, file, info) => {
        fileName = info.filename;
        const chunks = [];
        file.on('data', (data) => chunks.push(data));
        file.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });
      bb.on('finish', resolve);
      bb.on('error', reject);
      req.pipe(bb);
    });

    // 4. 检查是否成功获取文件
    if (!fileBuffer) {
      return res.status(400).json({ error: '未上传文件或文件为空' });
    }

    // 5. 构建发送给 Upstage 的表单数据
    const formData = new FormData();
    // 关键点1: 使用 'document' 字段
    formData.append('document', fileBuffer, { filename: fileName });
    // 关键点2: 指定模型
    formData.append('model', 'document-parse');
    // 关键点3: 指定输出格式为 text
    formData.append('output_formats', JSON.stringify(['text']));
    // 可选: 开启 OCR
    formData.append('ocr', 'auto');

    // 6. 调用 Upstage API (关键点4: 正确的端点)
    const response = await fetch('https://api.upstage.ai/v1/document-digitization', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.UPSTAGE_API_KEY}`,
        ...formData.getHeaders(), // 必须包含 Content-Type 和 boundary
      },
      body: formData,
    });

    // 7. 处理 Upstage 的响应
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Upstage API 返回错误 (${response.status}):`, errorText);
      throw new Error(`Upstage API 请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    // 尝试从响应中提取文本
    const extractedText = data.text || data.content || data.result || '';

    if (!extractedText) {
      console.error('Upstage 返回的数据中未找到文本:', data);
      return res.status(500).json({ error: '未能从PDF中提取文本' });
    }

    // 8. 成功，返回提取的文本
    res.status(200).json({ text: extractedText });

  } catch (error) {
    console.error('PDF 解析过程中发生错误:', error.message);
    res.status(500).json({ error: 'PDF 解析失败', details: error.message });
  }
}