// 页面：时空图构建、模型管理、训练任务管理
window.PAGES = window.PAGES || {};
(function () {
  const { ref, computed, reactive } = Vue;

  PAGES.graph = {
    setup() {
      const cfgs = computed(() => Store.list('graph_config'));
      const cfg = ref(cfgs.value[0]);
      const recs = Store.list('detect_record');
      const rec = ref(recs[2] || recs[0]);
      const stat = reactive({ nodes: 0, edges: 0 });
      const draw = computed(() => { const d = Synth.graph(rec.value, cfg.value); return (ctx, w, h) => Object.assign(stat, d(ctx, w, h)); });
      const sample = computed(() => {
        const r = U.rng(rec.value.event_num);
        return Synth.eventsOf(rec.value).filter(() => r() < 0.002).slice(0, 8).map((p, i) => {
          const t = Math.round(p[3] * cfg.value.time_window_ms * 1000);
          return { i: i + 1, x: p[0].toFixed(1), y: p[1].toFixed(1), t, p: p[2], nx: (p[0] / 640).toFixed(4), ny: (p[1] / 480).toFixed(4),
            nt: (t / (cfg.value.time_window_ms * 1000)).toFixed(4) };
        });
      });
      const cards = computed(() => [
        { label: '平均节点数', value: cfg.value.nodes, icon: 'Share', color: '#3c8cff' },
        { label: '平均边数', value: cfg.value.edges, icon: 'Connection', color: '#36c98e' },
        { label: '平均度', value: cfg.value.avg_degree, icon: 'Histogram', color: '#f0a43a' },
        { label: '建图耗时 (ms)', value: cfg.value.build_ms, icon: 'Timer', color: '#a879f0' }]);
      const columns = [{ prop: 'name', label: '配置名称', minWidth: 130 }, { prop: 'time_window_ms', label: 'ΔT(ms)' }, { prop: 'radius', label: '邻域半径' },
        { prop: 'max_neighbors', label: '最大邻居' }, { prop: 'max_nodes', label: '最大节点' }, { prop: 'avg_degree', label: '平均度' }, { prop: 'status', label: '状态', type: 'tag' }];
      const form = [{ prop: 'name', label: '配置名称', required: true }, { prop: 'time_window_ms', label: '时间窗ΔT(ms)', type: 'number', required: true },
        { prop: 'radius', label: '邻域半径(归一化)', type: 'number', step: 0.001 }, { prop: 'max_neighbors', label: '最大邻居数', type: 'number' },
        { prop: 'max_nodes', label: '最大节点数', type: 'number' }, { prop: 'norm', label: '坐标归一化方式' },
        { prop: 'nodes', label: '平均节点数', type: 'number' }, { prop: 'edges', label: '平均边数', type: 'number' },
        { prop: 'avg_degree', label: '平均度', type: 'number', step: 0.01 }, { prop: 'build_ms', label: '建图耗时(ms)', type: 'number', step: 0.1 },
        { prop: 'status', label: '状态', type: 'select', options: ['启用', '停用'] }];
      const newRow = () => ({ name: '', time_window_ms: 50, radius: 0.01, max_neighbors: 16, max_nodes: 10000, norm: 'L∞ 归一化', nodes: 0, edges: 0, avg_degree: 0, build_ms: 0, status: '启用', updated_at: U.nowText() });
      return { cfgs, cfg, recs, rec, stat, draw, sample, cards, columns, form, newRow };
    },
    template: `<div>
      <stat-cards :items="cards"/>
      <div class="row mb" style="height:560px">
        <panel title="事件时空图可视化" style="flex:1" body-style="display:flex;flex-direction:column;gap:8px">
          <template #extra><el-select v-model="rec" value-key="record_no" size="small" style="width:300px">
            <el-option v-for="r in recs.slice(0,10)" :key="r.record_no" :value="r" :label="r.seq_name+' / 帧 '+r.frame_idx"/></el-select></template>
          <canvas-view :draw="draw" :deps="[rec,cfg]" height="100%" style="flex:1" cap="节点：事件（红/蓝为极性）　边：时空邻域连接" :info="'当前帧采样节点 '+stat.nodes+'　连边 '+stat.edges"/>
        </panel>
        <panel title="图构建参数" style="width:440px">
          <div class="kv">
            <span class="k">配置名称</span><span class="hl">{{cfg.name}}</span>
            <span class="k">时间窗 ΔT</span><span>{{cfg.time_window_ms}} ms</span>
            <span class="k">邻域半径 R</span><span>{{cfg.radius}}（归一化空间）</span>
            <span class="k">最大邻居数 K</span><span>{{cfg.max_neighbors}}</span>
            <span class="k">最大节点数</span><span>{{cfg.max_nodes}}</span>
            <span class="k">坐标归一化</span><span>{{cfg.norm}}</span>
            <span class="k">节点初始特征</span><span>v<sub>i</sub> = [x'<sub>i</sub>, y'<sub>i</sub>, t'<sub>i</sub>, p<sub>i</sub>]</span>
          </div>
          <div class="formula" style="margin-top:16px">x' = x / W,　y' = y / H　　(1)<br>t' = (t − t₀) / ΔT,　t' ∈ [0, 1)　　(2)<br>p ∈ {0,1} → {−1, +1}<br>e<sub>ij</sub> 存在 ⇔ ‖v<sub>i</sub> − v<sub>j</sub>‖ &lt; R 且 j ∈ KNN(i)</div>
          <div style="margin-top:14px" class="muted">RGB 帧按事件坐标视场裁剪缩放，时间窗末端图像帧作为锚定帧，实现时空配准。</div>
        </panel>
      </div>
      <div class="row">
        <panel title="建图配置管理" style="flex:1.1"><crud-table table="graph_config" title="建图配置" :columns="columns" :form="form" :new-row="newRow" :page-size="5" @select="r=>cfg=r"/></panel>
        <panel title="节点归一化示例" style="flex:1">
          <el-table :data="sample" stripe border size="small">
            <el-table-column prop="i" label="#" width="44"/><el-table-column prop="x" label="x"/><el-table-column prop="y" label="y"/>
            <el-table-column prop="t" label="t(μs)"/><el-table-column prop="p" label="p" width="56"/>
            <el-table-column prop="nx" label="x'"/><el-table-column prop="ny" label="y'"/><el-table-column prop="nt" label="t'"/>
          </el-table>
        </panel>
      </div>
    </div>`,
  };
  const VAR = ['dsec', 'feedback', 'gating', 'combine'];
  const VAR_CN = { dsec: '基线 DAGR', feedback: 'SGF 语义反馈', gating: 'ADG 自适应门控', combine: 'SGF + ADG 双向协同' };
  PAGES.models = {
    setup() {
      const models = computed(() => Store.list('model'));
      const sel = ref(models.value.find((m) => m.variant === 'combine' && m.backbone === 'ResNet50') || models.value[0]);
      const bar = computed(() => U.chart({ grid: { left: 50, right: 50, top: 40, bottom: 60 },
        xAxis: U.axis({ type: 'category', data: models.value.map((m) => m.model_code), axisLabel: { color: '#9fb0cc', rotate: 30 } }),
        yAxis: [U.axis({ type: 'value', name: '参数量(M)' }), U.axis({ type: 'value', name: 'mAP(%)', min: 30, splitLine: { show: false } })],
        series: [{ name: '参数量(M)', type: 'bar', barWidth: 18, data: models.value.map((m) => m.params_m) },
          { name: '最佳mAP(%)', type: 'line', yAxisIndex: 1, data: models.value.map((m) => m.best_map), symbolSize: 8 }] }));
      const columns = [{ prop: 'model_code', label: '模型编号', minWidth: 120 }, { prop: 'name', label: '模型名称', minWidth: 170 },
        { prop: 'backbone', label: '图像骨干' }, { prop: 'sgf', label: 'SGF', type: 'bool', width: 80 }, { prop: 'adg', label: 'ADG', type: 'bool', width: 80 },
        { prop: 'grid', label: '语义网格', width: 90 }, { prop: 'beta', label: 'β', width: 60 }, { prop: 'params_m', label: '参数量(M)' },
        { prop: 'flops_g', label: 'GFLOPs' }, { prop: 'best_map', label: '最佳mAP', digits: 2 }, { prop: 'status', label: '状态', type: 'tag' },
        { prop: 'updated_at', label: '更新时间', minWidth: 160 }];
      const yes = [{ label: '启用', value: 1 }, { label: '不启用', value: 0 }];
      const form = [{ prop: 'model_code', label: '模型编号', required: true }, { prop: 'name', label: '模型名称', required: true },
        { prop: 'variant', label: '变体', type: 'select', options: VAR, required: true }, { prop: 'backbone', label: '图像骨干', type: 'select', options: ['ResNet18', 'ResNet50'], required: true },
        { prop: 'sgf', label: 'SGF 语义反馈模块', type: 'select', options: yes }, { prop: 'adg', label: 'ADG 门控模块', type: 'select', options: yes },
        { prop: 'grid', label: 'SGF 语义网格' }, { prop: 'beta', label: 'ADG 调制系数β', type: 'number', step: 0.1 },
        { prop: 'warmup_epochs', label: '反馈 Warmup 轮数', type: 'number' }, { prop: 'params_m', label: '参数量(M)', type: 'number', step: 0.01 },
        { prop: 'flops_g', label: '计算量(GFLOPs)', type: 'number', step: 0.1 }, { prop: 'best_map', label: '最佳mAP(%)', type: 'number', step: 0.01 },
        { prop: 'status', label: '状态', type: 'select', options: ['已部署', '待部署', '训练中', '已停用'] }];
      const filters = [{ prop: 'model_code', label: '模型编号' }, { prop: 'backbone', label: '骨干', type: 'select', options: ['ResNet18', 'ResNet50'] },
        { prop: 'variant', label: '变体', type: 'select', options: VAR }, { prop: 'status', label: '状态', type: 'select', options: ['已部署', '待部署', '训练中', '已停用'] }];
      const newRow = () => ({ model_code: '', name: '', variant: 'combine', backbone: 'ResNet50', sgf: 1, adg: 1, grid: '16×12', beta: 0.5, warmup_epochs: 5,
        params_m: 0, flops_g: 0, best_map: 0, status: '待部署', updated_at: U.nowText() });
      return { models, sel, bar, columns, form, filters, newRow, VAR_CN };
    },
    template: `<div>
      <panel title="检测模型管理" class="mb"><crud-table table="model" title="模型" :columns="columns" :form="form" :filters="filters" :new-row="newRow" :page-size="8" @select="r=>sel=r"/></panel>
      <div class="row" style="height:420px">
        <panel title="双向协同网络结构" style="flex:1.3">
          <div style="display:flex;align-items:center;gap:10px;height:100%;font-size:13px;text-align:center">
            <div style="display:flex;flex-direction:column;gap:14px;width:150px">
              <div class="formula">RGB 图像帧<br>I ∈ R<sup>H×W×3</sup></div><div class="formula">事件流<br>(x, y, t, p)</div></div>
            <div style="display:flex;flex-direction:column;gap:14px;flex:1">
              <div class="formula" style="border-color:#3c8cff">CNN 分支（{{sel.backbone}}）<br>多尺度稠密图像特征 F<sub>img</sub></div>
              <div class="formula" style="border-color:#36c98e">前向路径：图像特征按事件坐标采样 → 注入图节点</div>
              <div class="formula" style="border-color:#3fe0c0">GNN 分支：时空事件图推理 → 节点特征 H<sub>evt</sub></div></div>
            <div style="display:flex;flex-direction:column;gap:14px;width:250px">
              <div class="formula" :style="{opacity: sel.sgf?1:.35, borderColor:'#f0a43a'}"><b>SGF 语义反馈</b><br>Scatter-Mean 聚合到 {{sel.grid}} 网格<br>转置卷积重建 + tanh，注入 Layer3</div>
              <div class="formula" :style="{opacity: sel.adg?1:.35, borderColor:'#a879f0'}"><b>ADG 双层门控</b><br>全局通道门控 + 局部空间门控<br>调制系数 β = {{sel.beta}}</div>
              <div class="formula">检测头（双尺度）<br>car / pedestrian</div></div>
          </div>
        </panel>
        <panel title="模型参数量与精度" style="flex:1"><e-chart :option="bar" :height="350"/></panel>
        <panel title="模型详情" style="width:330px"><div class="kv">
          <span class="k">模型编号</span><span class="hl">{{sel.model_code}}</span><span class="k">模型名称</span><span>{{sel.name}}</span>
          <span class="k">结构变体</span><span>{{VAR_CN[sel.variant]}}</span><span class="k">图像骨干</span><span>{{sel.backbone}}</span>
          <span class="k">SGF 网格</span><span>{{sel.grid}}</span><span class="k">反馈 Warmup</span><span>{{sel.warmup_epochs}} 轮</span>
          <span class="k">ADG β</span><span>{{sel.beta}}</span><span class="k">参数量</span><span>{{sel.params_m}} M</span>
          <span class="k">计算量</span><span>{{sel.flops_g}} GFLOPs</span><span class="k">最佳 mAP</span><span class="hl">{{sel.best_map}} %</span>
          <span class="k">状态</span><span>{{sel.status}}</span></div></panel>
      </div>
    </div>`,
  };
  PAGES.train = {
    setup() {
      const jobs = computed(() => Store.list('train_job'));
      const sel = ref(jobs.value.find((j) => j.model_code === 'combine-r50' && j.status === '已完成') || jobs.value[0]);
      const met = (no) => Store.list('train_metric').filter((m) => m.job_no === no).sort((a, b) => a.epoch - b.epoch);
      const cur = computed(() => met(sel.value.job_no));
      const curve = computed(() => U.chart({ grid: { left: 55, right: 55, top: 40, bottom: 36 },
        xAxis: U.axis({ type: 'category', data: cur.value.map((m) => m.epoch), name: 'epoch' }),
        yAxis: [U.axis({ type: 'value', name: 'mAP(%)' }), U.axis({ type: 'value', name: 'loss', splitLine: { show: false } })],
        series: [{ name: '验证 mAP', type: 'line', smooth: true, showSymbol: false, data: cur.value.map((m) => m.val_map), areaStyle: { opacity: 0.15 } },
          { name: '训练损失', type: 'line', smooth: true, showSymbol: false, yAxisIndex: 1, data: cur.value.map((m) => m.train_loss) }] }));
      const lr = computed(() => U.chart({ grid: { left: 70, right: 20, top: 30, bottom: 36 }, legend: { show: false },
        xAxis: U.axis({ type: 'category', data: cur.value.map((m) => m.epoch), name: 'epoch' }), yAxis: U.axis({ type: 'value', name: 'lr', axisLabel: { color: '#9fb0cc', formatter: (v) => v.toExponential(1) } }),
        series: [{ name: '学习率', type: 'line', showSymbol: false, data: cur.value.map((m) => m.lr), color: '#f0a43a', areaStyle: { opacity: 0.15 } }] }));
      const bb = ref('ResNet50');
      const cmp = computed(() => {
        const list = jobs.value.filter((j) => j.backbone === bb.value && j.status === '已完成');
        const lim = bb.value === 'ResNet50' ? 30 : 60;
        return U.chart({ grid: { left: 55, right: 20, top: 40, bottom: 36 },
          xAxis: U.axis({ type: 'category', data: Array.from({ length: lim }, (_, i) => i), name: 'epoch' }), yAxis: U.axis({ type: 'value', name: 'mAP(%)', min: 10 }),
          series: list.map((j) => ({ name: j.model_code, type: 'line', smooth: true, showSymbol: false, data: met(j.job_no).slice(0, lim).map((m) => m.val_map) })) });
      });
      const columns = [{ prop: 'job_no', label: '任务编号', minWidth: 140 }, { prop: 'model_code', label: '模型' }, { prop: 'backbone', label: '骨干' },
        { prop: 'epochs_done', label: '训练进度', type: 'progress', minWidth: 160, fmt: (r) => (r.epochs_done / r.epochs_total) * 100 },
        { prop: 'epochs_total', label: '总轮数', width: 80 }, { prop: 'lr', label: '初始学习率' }, { prop: 'batch_size', label: 'Batch', width: 70 },
        { prop: 'best_map', label: '最佳mAP', digits: 2 }, { prop: 'gpu', label: '计算资源' }, { prop: 'status', label: '状态', type: 'tag' },
        { prop: 'start_time', label: '开始时间', minWidth: 160 }];
      const form = [{ prop: 'job_no', label: '任务编号', required: true }, { prop: 'model_code', label: '模型编号', type: 'select', required: true, options: Store.list('model').map((m) => m.model_code) },
        { prop: 'backbone', label: '图像骨干', type: 'select', options: ['ResNet18', 'ResNet50'] }, { prop: 'epochs_total', label: '总轮数', type: 'number' },
        { prop: 'epochs_done', label: '已完成轮数', type: 'number' }, { prop: 'lr', label: '初始学习率', type: 'number', step: 0.0001 },
        { prop: 'batch_size', label: '批大小', type: 'number' }, { prop: 'optimizer', label: '优化策略' }, { prop: 'best_map', label: '最佳mAP(%)', type: 'number', step: 0.01 },
        { prop: 'gpu', label: '计算资源' }, { prop: 'status', label: '状态', type: 'select', options: ['排队中', '训练中', '已完成', '已终止'] }];
      const filters = [{ prop: 'job_no', label: '任务编号' }, { prop: 'model_code', label: '模型编号' }, { prop: 'status', label: '状态', type: 'select', options: ['排队中', '训练中', '已完成', '已终止'] }];
      const newRow = () => ({ job_no: 'TJ' + U.nowText().replace(/\D/g, '').slice(0, 11), model_code: 'combine-r50', backbone: 'ResNet50', epochs_total: 60, epochs_done: 0,
        lr: 0.0002, batch_size: 8, optimizer: 'AdamW + 余弦退火 + Warmup', best_map: 0, status: '排队中', gpu: 'A100 ×2', start_time: U.nowText(), end_time: '' });
      return { sel, curve, lr, cmp, bb, columns, form, filters, newRow };
    },
    template: `<div>
      <panel title="训练任务管理" class="mb"><crud-table table="train_job" title="训练任务" :columns="columns" :form="form" :filters="filters" :new-row="newRow" :page-size="6" @select="r=>sel=r"/></panel>
      <div class="row mb">
        <panel :title="'训练曲线 — '+sel.job_no+'（'+sel.model_code+'）'" style="flex:1.4"><e-chart :option="curve" :height="320"/></panel>
        <panel title="学习率调度（Warmup + 余弦退火）" style="flex:1"><e-chart :option="lr" :height="320"/></panel>
      </div>
      <panel title="各变体验证 mAP 对比">
        <template #extra><el-radio-group v-model="bb" size="small"><el-radio-button value="ResNet18">ResNet18（完整训练）</el-radio-button><el-radio-button value="ResNet50">ResNet50（公平窗口 0–29）</el-radio-button></el-radio-group></template>
        <e-chart :option="cmp" :height="300"/></panel>
    </div>`,
  };
})();
