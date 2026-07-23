// api/upload-pdf.js
import Busboy from 'busboy';
import { Readable } from 'stream';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.UPSTAGE_API_KEY) {
    return res.status(500).json({ error: '缺少 UPSTAGE_API_KEY 环境变量' });
  }

  try {
    // 1. 解析上传的文件
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

    if (!fileBuffer) {
      return res.status(400).json({ error: '未上传文件或文件为空' });
    }

    // 2. 使用原生 FormData（Node.js 21+ 内置）
    const formData = new FormData();
    // 使用 Blob 包装文件数据
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('document', blob, fileName);
    formData.append('model', 'document-parse');
    formData.append('output_formats', JSON.stringify(['text']));
    formData.append('ocr', 'auto');

    // 3. 调用 Upstage API
    const response = await fetch('https://api.upstage.ai/v1/document-digitization', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.UPSTAGE_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upstage API 返回 ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const extractedText = data.text || data.content || data.result || '';

    if (!extractedText) {
      return res.status(500).json({ error: '未能从PDF中提取文本' });
    }

    res.status(200).json({ text: extractedText });

  } catch (error) {
    console.error('PDF 解析失败:', error.message);
    res.status(500).json({ error: 'PDF 解析失败', details: error.message });
  }
}