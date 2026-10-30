// Stable module IDs match the backend registry. Availability is supplied by /api/health.
export const modules = [
  {id:'video',name:'Code to Video',icon:'video',available:true,description:'从一个想法，到一段可解释、可编辑的动画。'},
  {id:'image',name:'Code to Image',icon:'image',available:false,description:'用代码描绘视觉，生成插画与图像。'},
  {id:'3d',name:'Code to 3D',icon:'box',available:false,description:'让想法拥有形状，构建三维模型。'},
  {id:'world',name:'Code to World',icon:'globe',available:false,description:'构建可以探索的空间与世界。'},
  {id:'games',name:'Code to Games',icon:'game',available:false,description:'将规则、故事与交互变成游戏。'},
];
const styleResponse = await fetch(new URL('./video-styles.json', import.meta.url), {cache:'no-cache'});
if (!styleResponse.ok) throw new Error('视觉风格配置加载失败，请刷新网页。');
const styleCatalog = await styleResponse.json();
export const styles = styleCatalog.styles.map(style => ({...style, version:styleCatalog.version}));
const presetResponse=await fetch(new URL('./video-presets.json',import.meta.url),{cache:'no-cache'});
if(!presetResponse.ok)throw new Error('画质配置加载失败，请刷新网页。');
export const qualities=(await presetResponse.json()).qualities;
export const templates = [
  {id:'pythagoras',name:'看得见的勾股定理',tag:'数学 · 几何',art:'a² + b² = c²',palette:'forest',style:'math',description:'用面积与几何动画，让抽象的公式变得直观。',prompt:'用中文讲解勾股定理：从直角三角形出发，用三个正方形的面积说明 a²+b²=c²，再用 3、4、5 的例子验证。画面简洁，步骤循序渐进。'},
  {id:'fourier',name:'用圆，画出一切',tag:'数学 · 傅里叶',art:'∑ sin(nωt)',palette:'sand',style:'math',description:'将多个旋转向量相加，逐步构建周期波形。',prompt:'用中文直观讲解傅里叶级数：用一个旋转向量对应正弦波，再叠加三个不同频率的正弦波，展示如何逼近方波。标注每个频率，先简单后复杂。'},
  {id:'neural',name:'神经网络如何学习',tag:'AI · 神经网络',art:'● → ◉ → ●',palette:'blue',style:'blueprint',description:'把输入、权重与误差，串联成一个学习过程。',prompt:'用中文讲解一个简单神经网络如何学习。展示 3 个输入节点、4 个隐藏节点、2 个输出节点，用动画表示前向传播、损失计算与反向更新权重。'},
  {id:'linear',name:'矩阵，让空间变形',tag:'数学 · 线性代数',art:'[ A ] · x',palette:'olive',style:'math',description:'观察坐标网格与基向量，理解线性变换。',prompt:'用中文讲解二维矩阵与线性变换。从单位网格和两个基向量出发，依次展示缩放、剪切和旋转，说明矩阵的列向量如何决定基向量的位置。'},
  {id:'sort',name:'排序算法的小剧场',tag:'编程 · 算法',art:'▂ ▅ ▁ ▇ ▃',palette:'clay',style:'minimal',description:'让数组中的元素动起来，看懂冒泡排序。',prompt:'用中文讲解冒泡排序。用 5 根不同高度的柱子表示数组 [5, 2, 4, 1, 3]，用颜色高亮比较的两个元素，演示交换和每轮确定的最大值。'},
  {id:'orbit',name:'为什么行星绕着太阳转',tag:'物理 · 运动',art:'☉ ⟲ ◦',palette:'night',style:'math',description:'用速度向量与引力方向，解释轨道的形成。',prompt:'用中文直观讲解行星轨道。展示太阳与一颗行星，画出指向太阳的引力向量和切线方向的速度向量，说明二者结合如何形成持续绕行。避免长段落文字。'},
];
export const stages = [
  {id:'outline',name:'内容规划',icon:'file'}, {id:'storyboard',name:'分镜设计',icon:'layers'},
  {id:'narration',name:'解说撰写',icon:'file'}, {id:'tts',name:'语音合成',icon:'volume'},
  {id:'code',name:'代码生成',icon:'code'}, {id:'render',name:'动画渲染',icon:'film'}, {id:'merge',name:'对齐合成',icon:'check'},
];
export const statusNames = {queued:'排队中',running:'生成中',completed:'已完成',failed:'生成失败',cancelled:'已停止'};
