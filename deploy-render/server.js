const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ========== 托管静态文件 ==========
app.use(express.static(path.join(__dirname, 'public')));

// ========== Claude CLI 调用封装 ==========
// ========== AI调用：本地用Claude CLI，线上用通义千问API ==========
const CLAUDE_PATH = '/Users/banyunfei/.local/bin/claude';
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const fs = require('fs');

// 检测是否有本地claude CLI
const hasLocalClaude = fs.existsSync(CLAUDE_PATH);

async function callAI(prompt, timeoutMs = 90000) {
  if (hasLocalClaude) {
    return callClaude(prompt, timeoutMs);
  } else {
    return callQwen(prompt);
  }
}

function callClaude(prompt, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const child = exec(`${CLAUDE_PATH} --print`, { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        if (err.killed) return reject(new Error('AI生成超时，请重试'));
        return reject(new Error('AI调用失败: ' + (err.message || '未知错误')));
      }
      resolve(stdout.trim());
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function callQwen(prompt) {
  const resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DASHSCOPE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'qwen-turbo', messages: [{ role: 'user', content: prompt }], temperature: 0.9 })
  });
  const data = await resp.json();
  if (data.choices && data.choices[0]) return data.choices[0].message.content;
  throw new Error('通义千问返回异常: ' + JSON.stringify(data));
}

// ========== 多轮对话会话管理 ==========
const chatSessions = {};

function getOrCreateSession(sessionId, productTitle) {
  if (!chatSessions[sessionId]) {
    chatSessions[sessionId] = { messages: [], productTitle: productTitle || '', createdAt: new Date().toISOString() };
  }
  return chatSessions[sessionId];
}

// 清理超过2小时的session
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of Object.entries(chatSessions)) {
    if (now - new Date(session.createdAt).getTime() > 2 * 60 * 60 * 1000) delete chatSessions[id];
  }
}, 10 * 60 * 1000);

// ========== Mock数据 ==========
const mock1688Products = [
  { id: '6001', title: '2024新款碎花连衣裙女夏季法式小众', price: 45.8, image: 'https://picsum.photos/seed/dress1/200', sales: 3200, supplier: '杭州四季青服饰' },
  { id: '6002', title: '韩版简约百搭双肩包学生书包', price: 28.5, image: 'https://picsum.photos/seed/bag1/200', sales: 8500, supplier: '广州白云皮具城' },
  { id: '6003', title: '304不锈钢保温杯大容量男女通用', price: 19.9, image: 'https://picsum.photos/seed/cup1/200', sales: 12000, supplier: '永康杯壶工厂' },
  { id: '6004', title: '网红爆款手机壳iPhone15透明防摔', price: 3.5, image: 'https://picsum.photos/seed/case1/200', sales: 50000, supplier: '深圳数码配件厂' },
  { id: '6005', title: '夏季薄款防晒衣女UV50+冰丝外套', price: 22.0, image: 'https://picsum.photos/seed/coat1/200', sales: 6800, supplier: '义乌户外用品' },
];

let spreadProducts = [];
let spreadTasks = {};
let noteContents = [];
let orders = [
  { id: 'XHS20250709001', product: '碎花连衣裙', amount: 128.0, status: 'PENDING', localStatus: '待处理', trackingNumber: '', payTime: '2025-07-09 10:23:00' },
  { id: 'XHS20250709002', product: '双肩包', amount: 79.9, status: 'SOURCING', localStatus: '采购中', trackingNumber: '', payTime: '2025-07-09 11:05:00' },
  { id: 'XHS20250709003', product: '保温杯', amount: 59.9, status: 'SHIPPED', localStatus: '已发货', trackingNumber: 'YT9876543210', payTime: '2025-07-08 09:30:00' },
];

// ========== 1688商品搜索 ==========
app.get('/api/v1/source-products', (req, res) => {
  const { keyword } = req.query;
  let results = mock1688Products;
  if (keyword) results = results.filter(p => p.title.includes(keyword));
  res.json({ code: 0, message: 'success', data: { products: results, total: results.length } });
});

// ========== 一键铺货 ==========
app.post('/api/v1/products/spread', (req, res) => {
  const { sourceProductId, sourcePlatform, priceRule } = req.body;
  const source = mock1688Products.find(p => p.id === sourceProductId);
  if (!source) return res.json({ code: -1, message: '商品不存在' });
  const taskId = 'TASK_' + Date.now();
  const multiplier = priceRule?.value || 2.5;
  spreadTasks[taskId] = { status: 'PROCESSING', progress: 0, sourceProductId };
  setTimeout(() => { spreadTasks[taskId].progress = 30; spreadTasks[taskId].status = 'FETCHING'; }, 1000);
  setTimeout(() => { spreadTasks[taskId].progress = 60; spreadTasks[taskId].status = 'AI_OPTIMIZING'; }, 2000);
  setTimeout(() => {
    spreadTasks[taskId].progress = 100;
    spreadTasks[taskId].status = 'COMPLETED';
    spreadProducts.push({ id: 'PM_' + Date.now(), sourceId: source.id, title: source.title.replace(/厂家直销|批发/g, '').trim() + ' 超好用推荐', image: source.image, costPrice: source.price, sellPrice: Math.round(source.price * multiplier * 10) / 10, profitMargin: Math.round((1 - 1/multiplier) * 100), status: 'ACTIVE', platform: sourcePlatform || '1688', createdAt: new Date().toISOString() });
  }, 3000);
  res.json({ code: 0, message: 'success', data: { taskId, status: 'PROCESSING' } });
});

app.get('/api/v1/products/spread-task/:taskId', (req, res) => {
  const task = spreadTasks[req.params.taskId];
  if (!task) return res.json({ code: -1, message: '任务不存在' });
  res.json({ code: 0, data: task });
});

app.get('/api/v1/products', (req, res) => {
  res.json({ code: 0, data: { products: spreadProducts, total: spreadProducts.length } });
});

// ========== AI生成笔记（调用Claude CLI） ==========
app.post('/api/v1/notes/generate', async (req, res) => {
  const { productTitle, style, targetAudience, antiAiLevel } = req.body;
  if (!productTitle) return res.json({ code: -1, message: '商品名称不能为空' });

  const styleMap = { grass_planting: '种草推荐', review: '真实测评', tutorial: '教程攻略', comparison: '横向对比', daily: '日常分享' };
  const audienceMap = { student: '学生党', office: '上班族', mom: '宝妈', fashion: '潮流青年', general: '通用人群' };
  const styleName = styleMap[style] || '种草推荐';
  const audienceName = audienceMap[targetAudience] || '通用人群';

  const prompt = `你是小红书爆款笔记写手。为商品"${productTitle}"写一篇小红书笔记。
风格：${styleName}，目标人群：${audienceName}
要求：300-500字、口语化自然、包含emoji、包含3-5个#话题标签、像真人分享
${antiAiLevel === 'HIGH' ? '特别注意：多用语气词(emmm/哈哈哈/绝了/谁懂)、不完整句子，完全看不出AI痕迹' : ''}
按JSON格式输出(不要其他内容)：{"title":"标题带emoji20字内","content":"正文","topics":["话题1","话题2","话题3"]}`;

  try {
    const raw = await callAI(prompt);
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: `✨ ${productTitle} 推荐`, content: raw, topics: ['好物推荐', productTitle] };
    } catch (e) {
      parsed = { title: `✨ ${productTitle} 推荐`, content: raw, topics: ['好物推荐', productTitle] };
    }

    const sessionId = 'SESSION_' + Date.now();
    const session = getOrCreateSession(sessionId, productTitle);
    session.messages.push({ role: 'user', content: prompt });
    session.messages.push({ role: 'assistant', content: raw });

    const note = { id: 'NOTE_' + Date.now(), title: parsed.title, content: parsed.content, topics: parsed.topics || [], style, targetAudience, antiAiLevel, status: 'DRAFT', sessionId, createdAt: new Date().toISOString() };
    noteContents.push(note);
    res.json({ code: 0, data: { ...parsed, style, targetAudience, antiAiLevel, _noteId: note.id, sessionId } });
  } catch (err) {
    console.error('AI生成失败:', err.message);
    res.json({ code: -1, message: 'AI生成失败: ' + err.message });
  }
});

// ========== 多轮对话：修改反馈 ==========
app.post('/api/v1/notes/chat', async (req, res) => {
  const { sessionId, feedback } = req.body;
  if (!sessionId || !feedback) return res.json({ code: -1, message: '缺少sessionId或feedback' });

  const session = chatSessions[sessionId];
  if (!session) return res.json({ code: -1, message: '会话不存在或已过期，请重新生成' });

  const lastContent = session.messages.filter(m => m.role === 'assistant').pop()?.content || '';
  const contextPrompt = `你之前为商品"${session.productTitle}"写了一篇小红书笔记：
${lastContent.substring(0, 1000)}

用户反馈："${feedback}"

请根据反馈修改笔记，输出修改后的完整版本。
按JSON格式输出(不要其他内容)：{"title":"修改后标题","content":"修改后正文","topics":["话题1","话题2"],"changeNote":"一句话说明改了什么"}`;

  try {
    const raw = await callAI(contextPrompt);
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: '修改后的笔记', content: raw, topics: [], changeNote: '已修改' };
    } catch (e) {
      parsed = { title: '修改后的笔记', content: raw, topics: [], changeNote: '已修改' };
    }
    session.messages.push({ role: 'user', content: feedback });
    session.messages.push({ role: 'assistant', content: raw });
    res.json({ code: 0, data: { ...parsed, sessionId, round: Math.floor(session.messages.length / 2) } });
  } catch (err) {
    res.json({ code: -1, message: 'AI修改失败: ' + err.message });
  }
});

// ========== 多版本生成(测款) ==========
app.post('/api/v1/notes/generate-multi', async (req, res) => {
  const { productTitle, versionCount = 3, antiAiLevel = 'MEDIUM' } = req.body;
  if (!productTitle) return res.json({ code: -1, message: '商品名称不能为空' });

  const prompt = `你是小红书爆款笔记写手团队。为商品"${productTitle}"写${versionCount}个完全不同版本的笔记用于A/B测试。
每版本必须：风格不同(种草/测评/教程/对比/日常)、人群不同(学生/上班族/宝妈/潮人)、切入角度不同、开头方式不同。
每篇300-500字、口语化、有emoji、有#话题标签。
${antiAiLevel === 'HIGH' ? '多用语气词，完全看不出AI痕迹。' : ''}
按JSON格式输出(不要其他内容)：{"versions":[{"style":"grass_planting/review/tutorial/comparison/daily","targetAudience":"student/office/mom/fashion","title":"标题","content":"正文","topics":["话题1","话题2"]},...]}`; 

  try {
    const raw = await callAI(prompt);
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      if (!parsed || !parsed.versions) throw new Error('no versions');
    } catch (e) {
      return res.json({ code: -1, message: '多版本生成解析失败，请重试' });
    }

    const versions = parsed.versions.map((v, i) => {
      const sid = 'SESSION_M_' + Date.now() + '_' + i;
      chatSessions[sid] = { messages: [{ role: 'user', content: `为"${productTitle}"写笔记` }, { role: 'assistant', content: JSON.stringify(v) }], productTitle, createdAt: new Date().toISOString() };
      return { version: i + 1, style: v.style || 'grass_planting', targetAudience: v.targetAudience || 'general', title: v.title, content: v.content, topics: v.topics || [], antiAiLevel, antiAiApplied: true, sessionId: sid };
    });

    res.json({ code: 0, data: { testGroupId: 'TG_' + Date.now(), versionCount: versions.length, versions, antiAiLevel } });
  } catch (err) {
    res.json({ code: -1, message: '多版本生成失败: ' + err.message });
  }
});

// ========== 采纳笔记 ==========
app.post('/api/v1/notes/adopt', (req, res) => {
  const { title, content, topics, style, targetAudience, antiAiLevel, productId } = req.body;
  const note = { id: 'NOTE_' + Date.now(), title, content, topics: topics || [], style: style || 'grass_planting', targetAudience: targetAudience || 'general', antiAiLevel: antiAiLevel || 'MEDIUM', productId: productId || null, status: 'READY', createdAt: new Date().toISOString() };
  noteContents.push(note);
  res.json({ code: 0, data: { noteId: note.id, message: '笔记已采纳' } });
});

app.get('/api/v1/notes', (req, res) => { res.json({ code: 0, data: { notes: noteContents, total: noteContents.length } }); });

app.post('/api/v1/publish/share', (req, res) => {
  const shareId = 'SHARE_' + Date.now();
  res.json({ code: 0, data: { shareId, shareUrl: `/share.html?id=${shareId}`, shareData: { shareInfo: { type: 'normal', title: req.body.title, content: req.body.content, images: req.body.images || ['https://picsum.photos/seed/xhs/400/500'] }, verifyConfig: { appKey: 'mock_app_key', nonce: 'abc123', timestamp: Date.now(), signature: 'mock_sig_' + Date.now() } }, expireAt: Date.now() + 3600000 }});
});

app.get('/api/v1/orders', (req, res) => { res.json({ code: 0, data: { orders, total: orders.length } }); });
app.post('/api/v1/orders/sync', (req, res) => {
  orders.unshift({ id: 'XHS' + Date.now(), product: '防晒衣', amount: 69.9, status: 'PENDING', localStatus: '待处理', trackingNumber: '', payTime: new Date().toISOString().replace('T',' ').substring(0,19) });
  res.json({ code: 0, data: { message: '同步完成', newCount: 1 } });
});
app.post('/api/v1/orders/:orderId/ship', (req, res) => {
  const order = orders.find(o => o.id === req.params.orderId);
  if (!order) return res.json({ code: -1, message: '订单不存在' });
  order.status = 'SHIPPED'; order.localStatus = '已发货'; order.trackingNumber = 'YT' + Math.random().toString().substring(2, 12);
  res.json({ code: 0, data: { success: true, trackingNumber: order.trackingNumber } });
});

app.get('/api/v1/dashboard/overview', (req, res) => {
  const gmv = orders.reduce((s, o) => s + o.amount, 0);
  res.json({ code: 0, data: { gmv: Math.round(gmv*100)/100, orderCount: orders.length, profitTotal: Math.round(gmv*0.4*100)/100, profitMargin: 40.0, noteCount: noteContents.length, totalViews: Math.floor(Math.random()*5000)+1000, conversionRate: 3.2 } });
});

app.post('/api/v1/products/price-calculate', (req, res) => {
  const { costPrice, ruleValue } = req.body;
  const sellPrice = Math.round(costPrice * (ruleValue || 2.5) * 10) / 10;
  res.json({ code: 0, data: { costPrice, sellPrice, profit: Math.round((sellPrice-costPrice)*10)/10, profitMargin: Math.round((1-costPrice/sellPrice)*100) + '%' } });
});

// ========== 启动 ==========
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`\n🚀 XHS Assistant running at http://localhost:${PORT}`);
  console.log(`🤖 AI: ${hasLocalClaude ? 'Claude CLI (local)' : 'Qwen-turbo (DashScope)'}`);
  console.log(`\n📋 Key APIs:`);
  console.log(`   POST /api/v1/notes/generate       ← AI生成笔记`);
  console.log(`   POST /api/v1/notes/generate-multi  ← 多版本A/B测试`);
  console.log(`   POST /api/v1/notes/chat            ← 多轮对话修改`);
  console.log(`   POST /api/v1/notes/adopt           ← 采纳笔记`);
  console.log(`\n✅ Ready!\n`);
});
