import formidable from 'formidable';
import fs from 'fs';

// 需要先安装 formidable：npm install formidable
export const config = {
  api: {
    bodyParser: false, // 关闭默认解析，用 formidable 处理文件
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. 解析上传的文件
    const form = formidable({});
    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];

    if (!file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    // 2. 读取文件内容
    const fileBuffer = fs.readFileSync(file.filepath);

    // 3. 调用 Upstage API 解析 PDF
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer]), file.originalFilename);

    const response = await fetch('https://api.upstage.ai/v1/document-ai/pdf', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.UPSTAGE_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upstage API 请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    // Upstage 返回的数据结构可能包含 text 或 content，根据实际返回调整
    const extractedText = data.text || data.content || data.result || '';

    // 4. 返回提取的文本
    res.status(200).json({ text: extractedText });

  } catch (error) {
    console.error('PDF 解析失败:', error.message);
    res.status(500).json({ error: 'PDF 解析失败', details: error.message });
  }
}