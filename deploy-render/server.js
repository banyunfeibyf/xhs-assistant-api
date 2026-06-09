const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());

// ========== 托管静态文件（产品介绍页+Demo页） ==========
app.use(express.static(path.join(__dirname, 'public')));

// ========== Mock数据 ==========
const mock1688Products = [
  { id: '6001', title: '2024新款碎花连衣裙女夏季法式小众', price: 45.8, image: 'https://picsum.photos/seed/dress1/200', sales: 3200, supplier: '杭州四季青服饰' },
  { id: '6002', title: '韩版简约百搭双肩包学生书包', price: 28.5, image: 'https://picsum.photos/seed/bag1/200', sales: 8500, supplier: '广州白云皮具城' },
  { id: '6003', title: '304不锈钢保温杯大容量男女通用', price: 19.9, image: 'https://picsum.photos/seed/cup1/200', sales: 12000, supplier: '永康杯壶工厂' },
  { id: '6004', title: '网红爆款手机壳iPhone15透明防摔', price: 3.5, image: 'https://picsum.photos/seed/case1/200', sales: 50000, supplier: '深圳数码配件厂' },
  { id: '6005', title: '夏季薄款防晒衣女UV50+冰丝外套', price: 22.0, image: 'https://picsum.photos/seed/coat1/200', sales: 6800, supplier: '义乌户外用品' },
];

let spreadProducts = []; // 已铺货商品
let spreadTasks = {};    // 铺货任务
let noteContents = [];   // 生成的笔记
let orders = [           // 模拟订单
  { id: 'XHS20250709001', product: '碎花连衣裙', amount: 128.0, status: 'PENDING', localStatus: '待处理', trackingNumber: '', payTime: '2025-07-09 10:23:00' },
  { id: 'XHS20250709002', product: '双肩包', amount: 79.9, status: 'SOURCING', localStatus: '采购中', trackingNumber: '', payTime: '2025-07-09 11:05:00' },
  { id: 'XHS20250709003', product: '保温杯', amount: 59.9, status: 'SHIPPED', localStatus: '已发货', trackingNumber: 'YT9876543210', payTime: '2025-07-08 09:30:00' },
];

// ========== 1688商品搜索 ==========
app.get('/api/v1/source-products', (req, res) => {
  const { keyword, platform } = req.query;
  let results = mock1688Products;
  if (keyword) {
    results = results.filter(p => p.title.includes(keyword));
  }
  res.json({ code: 0, message: 'success', data: { products: results, total: results.length } });
});

// ========== 一键铺货 ==========
app.post('/api/v1/products/spread', (req, res) => {
  const { sourceProductId, sourcePlatform, priceRule } = req.body;
  const source = mock1688Products.find(p => p.id === sourceProductId);
  if (!source) return res.json({ code: -1, message: '商品不存在' });

  const taskId = 'TASK_' + Date.now();
  const multiplier = priceRule?.value || 2.5;
  
  // 模拟异步铺货（3秒后完成）
  spreadTasks[taskId] = { status: 'PROCESSING', progress: 0, sourceProductId };
  
  setTimeout(() => { spreadTasks[taskId].progress = 30; spreadTasks[taskId].status = 'FETCHING'; }, 1000);
  setTimeout(() => { spreadTasks[taskId].progress = 60; spreadTasks[taskId].status = 'AI_OPTIMIZING'; }, 2000);
  setTimeout(() => {
    spreadTasks[taskId].progress = 100;
    spreadTasks[taskId].status = 'COMPLETED';
    spreadProducts.push({
      id: 'PM_' + Date.now(),
      sourceId: source.id,
      title: source.title.replace(/厂家直销|批发/g, '').trim() + ' 超好用推荐',
      image: source.image,
      costPrice: source.price,
      sellPrice: Math.round(source.price * multiplier * 10) / 10,
      profitMargin: Math.round((1 - 1/multiplier) * 100),
      status: 'ACTIVE',
      platform: sourcePlatform || '1688',
      createdAt: new Date().toISOString()
    });
  }, 3000);

  res.json({ code: 0, message: 'success', data: { taskId, status: 'PROCESSING' } });
});

// ========== 铺货任务状态 ==========
app.get('/api/v1/products/spread-task/:taskId', (req, res) => {
  const task = spreadTasks[req.params.taskId];
  if (!task) return res.json({ code: -1, message: '任务不存在' });
  res.json({ code: 0, data: task });
});

// ========== 已铺货商品列表 ==========
app.get('/api/v1/products', (req, res) => {
  res.json({ code: 0, data: { products: spreadProducts, total: spreadProducts.length } });
});

// ========== AI生成笔记 ==========
app.post('/api/v1/notes/generate', (req, res) => {
  const { productTitle, style, targetAudience, antiAiLevel } = req.body;
  if (!productTitle) return res.json({ code: -1, message: '商品名称不能为空' });
  
  const styles = {
    grass_planting: { prefix: '姐妹们！', emoji: '✨🌟💕', tone: '种草推荐' },
    review: { prefix: '用了一个月来说说真实感受', emoji: '📝👀💡', tone: '真实测评' },
    tutorial: { prefix: '手把手教你', emoji: '📖✅🎯', tone: '教程攻略' },
  };
  const audiences = {
    student: '学生党', office: '上班族', mom: '宝妈', general: '通用'
  };

  const s = styles[style] || styles.grass_planting;
  const title = `${s.emoji[0]} ${s.prefix}这个${productTitle}真的绝了${s.emoji[1]}`;
  const content = `${s.prefix}\n\n今天给大家分享一个我最近超爱的好物——${productTitle}${s.emoji[2]}\n\n说真的，用了之后真的回不去了，性价比也太高了吧！\n\n作为一个${audiences[targetAudience] || '普通人'}，我觉得这个真的很适合日常使用。\n\n${antiAiLevel === 'HIGH' ? 'emmm怎么说呢，就是那种用过就离不开的感觉哈哈哈' : '推荐给需要的姐妹们～'}\n\n#好物推荐 #${audiences[targetAudience] || '日常分享'}`;
  
  const note = { id: 'NOTE_' + Date.now(), title, content, topics: ['好物推荐', productTitle, audiences[targetAudience] || '日常'], style, targetAudience, antiAiLevel, status: 'DRAFT', createdAt: new Date().toISOString() };
  noteContents.push(note);
  
  res.json({ code: 0, data: { title, content, topics: note.topics, style, targetAudience, antiAiLevel, _noteId: note.id } });
});

// ========== 单版本重新生成(换风格/换人群) ==========
app.post('/api/v1/notes/regenerate-version', (req, res) => {
  const { productTitle, style, targetAudience, antiAiLevel = 'MEDIUM' } = req.body;
  // 复用单版本生成逻辑
  const fakeReq = { body: { productTitle, style, targetAudience, antiAiLevel } };
  const styles = {
    grass_planting: { prefix: '姐妹们！', emoji: '✨🌟💕', tone: '种草推荐' },
    review: { prefix: '用了一个月来说说真实感受', emoji: '📝👀💡', tone: '真实测评' },
    tutorial: { prefix: '手把手教你', emoji: '📖✅🎯', tone: '教程攻略' },
    comparison: { prefix: '对比了3款终于选到了', emoji: '⚖️🔥👑', tone: '横向对比' },
    daily: { prefix: '今天的日常分享', emoji: '🌸☀️💫', tone: '日常vlog风' },
  };
  const audiences = { student: '学生党', office: '上班族', mom: '宝妈', fashion: '潮人', general: '通用' };
  const s = styles[style] || styles.grass_planting;
  const colloquials = ['说真的', '不得不说', '讲真', 'emmm', '绝了', '谁懂啊', '救命', '天花板'];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const title = `${s.emoji[0]} ${s.prefix}这个${productTitle}真的绝了${s.emoji[1]}`;
  const content = `${s.prefix}\n\n${pick(colloquials)}，今天分享这个${productTitle}${s.emoji[2]}\n\n作为${audiences[targetAudience] || '普通人'}，${pick(colloquials)}用了之后真的回不去了...\n\n推荐给${audiences[targetAudience]}们～`;
  res.json({ code: 0, data: { title, content, topics: [productTitle, audiences[targetAudience]], style, targetAudience } });
});

// ========== 多版本生成(测款) - 带防AI检测+个性化风格化 ==========
app.post('/api/v1/notes/generate-multi', (req, res) => {
  const { productTitle, versionCount = 3, antiAiLevel = 'MEDIUM' } = req.body;

  // 防AI检测：口语化插入语库
  const colloquials = ['说真的', '不得不说', '讲真', 'emmm', '哈哈哈', '绝了', '谁懂啊', '救命', '天花板', 'yyds'];
  const personalExpr = ['我个人觉得', '用了一段时间下来', '被闺蜜安利的', '犹豫了好久终于入手了', '回购了好几次了', '之前踩过坑所以'];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // 风格模板（每个风格有完全不同的结构和语气）
  const templates = {
    grass_planting: (title, audience) => ({
      noteTitle: `✨ ${pick(personalExpr)}这个${title}也太好用了吧${['！！','～','！'][Math.floor(Math.random()*3)]}`,
      noteContent: `${pick(['姐妹们','宝子们','家人们'])}${['！','～','!!'][Math.floor(Math.random()*3)]}\n\n${pick(personalExpr)}，今天必须给你们安利这个${title}${['✨','💕','🌟'][Math.floor(Math.random()*3)]}\n\n${pick(colloquials)}，第一次用的时候就惊了，这性价比也太高了吧...\n\n作为一个${audience === 'student' ? '学生党穷鬼' : audience === 'office' ? '996打工人' : '带娃宝妈'}，我对价格还是很敏感的，但这个真的值${['！','～','。'][Math.floor(Math.random()*3)]}\n\n${antiAiLevel === 'HIGH' ? pick(colloquials) + '，就是那种一旦用了就回不去的感觉哈哈哈哈\n\n而且我发现周围好几个朋友也在用，果然好东西大家都会发现的' : '推荐给需要的姐妹们'}\n\n📌 总结：\n- 颜值在线\n- 性价比高\n- 日常使用完全够\n\n${['冲就完了','闭眼入不踩雷','早买早享受'][Math.floor(Math.random()*3)]}～`,
      topics: ['好物推荐', title, audience === 'student' ? '学生党必备' : audience === 'office' ? '打工人好物' : '宝妈推荐', '平价好物']
    }),
    review: (title, audience) => ({
      noteTitle: `📝 ${title}真实使用${Math.floor(Math.random()*30)+7}天｜${['优缺点全说','不吹不黑','客观测评'][Math.floor(Math.random()*3)]}`,
      noteContent: `${pick(personalExpr)}，这个${title}到手已经${Math.floor(Math.random()*20)+10}天了，来说说真实感受。\n\n${pick(colloquials)}，先说结论：${['7分推荐','值得入手','看需求'][Math.floor(Math.random()*3)]}\n\n✅ 优点：\n1. 做工质感不错，${audience === 'student' ? '这个价位算很良心了' : '对得起这个价格'}\n2. 日常使用很方便，不需要特别维护\n3. 颜值在线，拿出来不丢面子\n\n❌ 缺点（${pick(['客观说','实话说','不吹不黑'])}）：\n1. 包装比较简单，送人的话可能差点意思\n2. 色差略微有一点，但不影响使用\n\n🎯 适合人群：${audience === 'student' ? '预算有限但想要品质的学生党' : audience === 'office' ? '追求效率的上班族' : '注重实用性的家庭用户'}\n\n${antiAiLevel === 'HIGH' ? '对了补充一下，' + pick(colloquials) + '，我是在' + pick(['某宝','1688','朋友推荐']) + '买的，价格比专柜便宜不少' : ''}\n\n总的来说，如果你${['预算够','需要这类产品','在纠结要不要入'][Math.floor(Math.random()*3)]}，可以考虑～`,
      topics: [title + '测评', '真实体验', audience === 'student' ? '学生党' : '好物测评', '使用感受']
    }),
    tutorial: (title, audience) => ({
      noteTitle: `📖 ${['手把手教你','保姆级攻略','小白也能懂'][Math.floor(Math.random()*3)]}｜${title}${['使用技巧','正确打开方式','避坑指南'][Math.floor(Math.random()*3)]}`,
      noteContent: `${pick(['哈喽大家好','嗨姐妹们','Hello宝子们'])}～\n\n今天来分享一下${title}的${['使用心得','正确用法','避坑经验'][Math.floor(Math.random()*3)]}，${audience === 'student' ? '特别适合刚入手的新手同学' : '希望对你有帮助'}！\n\n${pick(colloquials)}，我当初也是摸索了好久才搞明白...\n\n📌 Step 1：开箱检查\n先看看有没有破损，确认配件齐全\n\n📌 Step 2：基础设置\n按照说明书来就行，${pick(colloquials)}其实很简单\n\n📌 Step 3：日常使用\n${audience === 'mom' ? '带娃的时候' : audience === 'office' ? '上班通勤时' : '在宿舍'}用起来特别方便\n\n📌 Step 4：保养维护\n${['定期清洁就好','不需要特别维护','简单擦拭即可'][Math.floor(Math.random()*3)]}\n\n⚠️ 避坑提醒：\n- 不要${['贪便宜买到假货','忽略售后','跟风乱买'][Math.floor(Math.random()*3)]}\n- ${pick(personalExpr)}，选对渠道很重要\n\n${antiAiLevel === 'HIGH' ? '啊对了，' + pick(colloquials) + '，有问题可以评论区问我哈～我看到都会回的' : '有问题欢迎评论区交流～'}`,
      topics: [title + '教程', '使用攻略', '新手必看', audience === 'student' ? '学生党' : '生活技巧']
    })
  };

  const configs = [
    { style: 'grass_planting', audience: 'student' },
    { style: 'review', audience: 'office' },
    { style: 'tutorial', audience: 'mom' },
    { style: 'grass_planting', audience: 'office' },
    { style: 'review', audience: 'student' },
  ];

  const versions = configs.slice(0, versionCount).map((c, i) => {
    const gen = (templates[c.style] || templates.grass_planting)(productTitle, c.audience);
    return {
      version: i + 1,
      style: c.style,
      targetAudience: c.audience,
      title: gen.noteTitle,
      content: gen.noteContent,
      topics: gen.topics,
      antiAiLevel,
      antiAiApplied: true
    };
  });

  res.json({ code: 0, data: { testGroupId: 'TG_' + Date.now(), versionCount: versions.length, versions, antiAiLevel } });
});

// ========== 采纳笔记（保存到列表）==========
app.post('/api/v1/notes/adopt', (req, res) => {
  const { title, content, topics, style, targetAudience, antiAiLevel, productId } = req.body;
  const note = {
    id: 'NOTE_' + Date.now(),
    title,
    content,
    topics: topics || [],
    style: style || 'grass_planting',
    targetAudience: targetAudience || 'general',
    antiAiLevel: antiAiLevel || 'MEDIUM',
    productId: productId || null,
    status: 'READY',  // DRAFT -> READY -> PUBLISHED
    createdAt: new Date().toISOString()
  };
  noteContents.push(note);
  res.json({ code: 0, data: { noteId: note.id, message: '笔记已采纳，可在内容列表查看' } });
});

// ========== 笔记列表 ==========
app.get('/api/v1/notes', (req, res) => {
  res.json({ code: 0, data: { notes: noteContents, total: noteContents.length } });
});

// ========== 半自动发布(生成签名) ==========
app.post('/api/v1/publish/share', (req, res) => {
  const shareId = 'SHARE_' + Date.now();
  res.json({ code: 0, data: {
    shareId,
    shareUrl: `/share.html?id=${shareId}`,
    shareData: {
      shareInfo: { type: 'normal', title: req.body.title, content: req.body.content, images: req.body.images || ['https://picsum.photos/seed/xhs/400/500'] },
      verifyConfig: { appKey: 'mock_app_key', nonce: 'abc123', timestamp: Date.now(), signature: 'mock_signature_' + Date.now() }
    },
    expireAt: Date.now() + 3600000
  }});
});

// ========== 订单列表 ==========
app.get('/api/v1/orders', (req, res) => {
  res.json({ code: 0, data: { orders, total: orders.length } });
});

// ========== 订单同步 ==========
app.post('/api/v1/orders/sync', (req, res) => {
  // 模拟新增一个订单
  orders.unshift({ id: 'XHS' + Date.now(), product: '防晒衣', amount: 69.9, status: 'PENDING', localStatus: '待处理', trackingNumber: '', payTime: new Date().toISOString().replace('T',' ').substring(0,19) });
  res.json({ code: 0, data: { message: '同步完成，新增1个订单', newCount: 1 } });
});

// ========== 订单发货 ==========
app.post('/api/v1/orders/:orderId/ship', (req, res) => {
  const order = orders.find(o => o.id === req.params.orderId);
  if (!order) return res.json({ code: -1, message: '订单不存在' });
  if (order.status === 'SHIPPED') return res.json({ code: -1, message: '订单已发货，不能重复操作' });
  order.status = 'SHIPPED';
  order.localStatus = '已发货';
  order.trackingNumber = 'YT' + Math.random().toString().substring(2, 12);
  res.json({ code: 0, data: { success: true, trackingNumber: order.trackingNumber, logisticsCompany: '圆通快递' } });
});

// ========== 数据看板 ==========
app.get('/api/v1/dashboard/overview', (req, res) => {
  const gmv = orders.reduce((s, o) => s + o.amount, 0);
  res.json({ code: 0, data: { gmv: Math.round(gmv*100)/100, orderCount: orders.length, profitTotal: Math.round(gmv*0.4*100)/100, profitMargin: 40.0, noteCount: noteContents.length, totalViews: Math.floor(Math.random()*5000)+1000, conversionRate: 3.2 } });
});

// ========== 价格试算 ==========
app.post('/api/v1/products/price-calculate', (req, res) => {
  const { costPrice, ruleType, ruleValue } = req.body;
  const sellPrice = Math.round(costPrice * (ruleValue || 2.5) * 10) / 10;
  res.json({ code: 0, data: { costPrice, sellPrice, profit: Math.round((sellPrice-costPrice)*10)/10, profitMargin: Math.round((1-costPrice/sellPrice)*100) + '%' } });
});

// ========== 启动 ==========
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`\n🚀 XHS Mock Server running at http://localhost:${PORT}`);
  console.log(`\n📋 Available APIs:`);
  console.log(`   GET  /api/v1/source-products?keyword=连衣裙`);
  console.log(`   POST /api/v1/products/spread`);
  console.log(`   GET  /api/v1/products/spread-task/:taskId`);
  console.log(`   GET  /api/v1/products`);
  console.log(`   POST /api/v1/notes/generate`);
  console.log(`   POST /api/v1/notes/generate-multi`);
  console.log(`   POST /api/v1/publish/share`);
  console.log(`   GET  /api/v1/orders`);
  console.log(`   POST /api/v1/orders/sync`);
  console.log(`   POST /api/v1/orders/:id/ship`);
  console.log(`   GET  /api/v1/dashboard/overview`);
  console.log(`   POST /api/v1/products/price-calculate`);
  console.log(`\n✅ Ready for frontend integration!\n`);
});
