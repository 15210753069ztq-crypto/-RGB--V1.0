// 页面：检测总览大屏、数据集管理、事件流可视化
window.PAGES = window.PAGES || {};
(function () {
  const { ref, computed, reactive } = Vue;

  PAGES.dashboard = {
    setup() {
      const recs = computed(() => [...Store.list('detect_record')].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
      const cur = ref(0);
      const rec = computed(() => recs.value[cur.value] || recs.value[0]);
      const seqs = Store.list('sequence');
      const cards = computed(() => [
        { label: '数据序列数', value: seqs.length, icon: 'Files', color: '#3c8cff' },
        { label: '事件总量（百万）', value: seqs.reduce((a, s) => a + Number(s.events_m || 0), 0).toFixed(1), icon: 'Lightning', color: '#36c98e' },
        { label: '已部署模型', value: Store.list('model').filter((m) => m.status === '已部署').length, icon: 'Cpu', color: '#f0a43a' },
        { label: '运行中检测任务', value: Store.list('detect_task').filter((t) => t.status === '运行中').length, icon: 'VideoPlay', color: '#a879f0' },
        { label: '最佳 mAP（%）', value: Math.max(...Store.list('eval_result').map((e) => e.map)).toFixed(2), icon: 'TrendCharts', color: '#f0625a' },
      ]);
      const tasks = computed(() => Store.list('detect_task'));
      return { recs, cur, rec, cards, tasks, Synth, U };
    },
    template: `<div>
      <stat-cards :items="cards"/>
      <div class="row mb" style="height:600px">
        <panel title="实时检测画面" style="flex:1" body-style="display:flex;flex-direction:column;gap:10px">
          <template #extra>
            <el-select v-model="cur" style="width:330px" size="small">
              <el-option v-for="(r,i) in recs.slice(0,12)" :key="r.record_no" :value="i" :label="r.seq_name+' / 帧 '+r.frame_idx+' / '+r.model_code"/>
            </el-select>
          </template>
          <div class="grid2" style="flex:1">
            <canvas-view :draw="Synth.rgb(rec)" :deps="rec" cap="RGB 图像 + 检测结果" :info="'场景：'+rec.scene+'　车辆 '+rec.car_num+'　行人 '+rec.ped_num"/>
            <canvas-view :draw="Synth.fusion(rec)" :deps="rec" cap="RGB-事件融合（红：正极性　蓝：负极性）" :info="'窗口事件数 '+rec.event_num+'　推理耗时 '+rec.latency_ms+' ms'"/>
          </div>
          <div class="muted" style="font-size:13px">当前模型：<span class="hl">{{rec.model_code}}</span>　序列：{{rec.seq_name}}　帧序号：{{rec.frame_idx}}　平均置信度：{{rec.avg_score}}　检测时间：{{rec.created_at}}</div>
        </panel>
        <panel title="最新检测记录" style="width:400px" body-style="overflow:auto">
          <div class="feed">
            <div class="feed-item" v-for="(r,i) in recs.slice(0,7)" :key="r.record_no" :style="{borderLeftColor: r.ped_num ? '#f0a43a' : '#3fe0c0', cursor:'pointer'}" @click="cur=i">
              <div class="ft"><span>{{r.seq_name}}</span><el-tag size="small" effect="dark" :type="r.scene==='夜间低照度'?'warning':'success'">{{r.scene}}</el-tag></div>
              <div>记录编号：{{r.record_no}}　模型：{{r.model_code}}</div>
              <div>检出：车辆 {{r.car_num}} / 行人 {{r.ped_num}}，平均置信度 {{r.avg_score}}，耗时 {{r.latency_ms}} ms</div>
              <div class="muted">{{r.created_at}}</div>
            </div>
          </div>
        </panel>
      </div>
      <panel title="检测任务实时状态">
        <el-table :data="tasks" stripe border>
          <el-table-column prop="task_no" label="任务编号" width="180"/>
          <el-table-column prop="seq_name" label="数据序列" min-width="160"/>
          <el-table-column prop="model_code" label="检测模型" width="150"/>
          <el-table-column prop="frames" label="待检测帧数" width="120"/>
          <el-table-column label="进度" min-width="260"><template #default="{row}"><el-progress :percentage="row.progress" :stroke-width="10" :status="row.progress>=100?'success':''"/></template></el-table-column>
          <el-table-column prop="fps" label="处理速度(帧/s)" width="140"/>
          <el-table-column label="状态" width="110"><template #default="{row}"><el-tag :type="U.tagType(row.status)" effect="dark" size="small">{{row.status}}</el-tag></template></el-table-column>
          <el-table-column prop="created_at" label="创建时间" width="180"/>
        </el-table>
      </panel>
    </div>`,
  };

  const SCENES = ['城市道路', '夜间低照度', '强光对比', '高速运动'];
  PAGES.dataset = {
    setup() {
      const seqs = computed(() => Store.list('sequence'));
      const sel = ref(null);
      const pie = computed(() => U.chart({ tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: '#c3d0e6' } },
        series: [{ type: 'pie', radius: ['38%', '64%'], center: ['50%', '45%'], label: { color: '#c3d0e6', formatter: '{b}\n{c} 个' },
          data: SCENES.map((s) => ({ name: s, value: seqs.value.filter((x) => x.scene === s).length })) }] }));
      const bar = computed(() => U.chart({ legend: { top: 4, textStyle: { color: '#c3d0e6' } }, grid: { left: 60, right: 16, top: 40, bottom: 30 },
        xAxis: U.axis({ type: 'category', data: ['train', 'val', 'test'] }), yAxis: U.axis({ type: 'value', name: '标注数' }),
        series: [{ name: '车辆', type: 'bar', data: ['train', 'val', 'test'].map((k) => seqs.value.filter((x) => x.split === k).reduce((a, x) => a + x.car_count, 0)) },
          { name: '行人', type: 'bar', data: ['train', 'val', 'test'].map((k) => seqs.value.filter((x) => x.split === k).reduce((a, x) => a + x.ped_count, 0)) }] }));
      const columns = [
        { prop: 'seq_name', label: '序列名称', minWidth: 150 }, { prop: 'scene', label: '场景类型' }, { prop: 'split', label: '划分', width: 70 },
        { prop: 'frames', label: 'RGB帧数' }, { prop: 'events_m', label: '事件数(百万)', minWidth: 110 }, { prop: 'resolution', label: '分辨率' },
        { prop: 'duration_s', label: '时长(s)' }, { prop: 'car_count', label: '车辆标注' }, { prop: 'ped_count', label: '行人标注' },
        { prop: 'status', label: '状态', type: 'tag' }, { prop: 'created_at', label: '创建时间', minWidth: 160 }];
      const form = [
        { prop: 'seq_name', label: '序列名称', required: true }, { prop: 'scene', label: '场景类型', type: 'select', options: SCENES, required: true },
        { prop: 'split', label: '数据划分', type: 'select', options: ['train', 'val', 'test'], required: true },
        { prop: 'frames', label: 'RGB帧数', type: 'number' }, { prop: 'events_m', label: '事件数(百万)', type: 'number', step: 0.1 },
        { prop: 'resolution', label: '分辨率' }, { prop: 'duration_s', label: '时长(s)', type: 'number', step: 0.1 },
        { prop: 'car_count', label: '车辆标注数', type: 'number' }, { prop: 'ped_count', label: '行人标注数', type: 'number' },
        { prop: 'status', label: '状态', type: 'select', options: ['已就绪', '预处理中', '已停用'] }, { prop: 'image_url', label: '示例图片路径' }];
      const filters = [{ prop: 'seq_name', label: '序列名称' }, { prop: 'scene', label: '场景', type: 'select', options: SCENES },
        { prop: 'split', label: '划分', type: 'select', options: ['train', 'val', 'test'] }, { prop: 'status', label: '状态', type: 'select', options: ['已就绪', '预处理中', '已停用'] }];
      const newRow = () => ({ seq_name: '', scene: '城市道路', split: 'train', frames: 0, events_m: 0, resolution: '640×480', duration_s: 0,
        car_count: 0, ped_count: 0, status: '预处理中', image_url: '', created_at: U.nowText() });
      return { pie, bar, columns, form, filters, newRow, sel };
    },
    template: `<div class="row" style="align-items:flex-start">
      <panel title="DSEC-Detection 数据序列管理" style="flex:1">
        <crud-table table="sequence" title="数据序列" :columns="columns" :form="form" :filters="filters" :new-row="newRow" :page-size="14" @select="r=>sel=r"/>
      </panel>
      <div style="width:420px;display:flex;flex-direction:column;gap:16px">
        <panel title="场景类型分布"><e-chart :option="pie" :height="330"/></panel>
        <panel title="各划分标注数量"><e-chart :option="bar" :height="300"/></panel>
        <panel title="序列详情" v-if="sel"><div class="kv"><span class="k">序列名称</span><span>{{sel.seq_name}}</span>
          <span class="k">场景</span><span>{{sel.scene}}</span><span class="k">帧数 / 时长</span><span>{{sel.frames}} 帧 / {{sel.duration_s}} s</span>
          <span class="k">事件数</span><span>{{sel.events_m}} 百万</span></div></panel>
      </div>
    </div>`,
  };
  PAGES.events = {
    setup() {
      const recs = Store.list('detect_record');
      const names = [...new Set(recs.map((r) => r.seq_name))];
      const seq = ref(names.includes('interlaken_00_a') ? 'interlaken_00_a' : names[0]);
      const dt = ref(50);
      const rec = computed(() => recs.find((r) => r.seq_name === seq.value) || recs[0]);
      const pts = computed(() => Synth.eventsOf(rec.value).filter((p) => p[3] < dt.value / 50));
      const pos = computed(() => pts.value.filter((p) => p[2] > 0).length);
      const rate = computed(() => {
        const r = U.rng(rec.value.event_num); const xs = [], a = [], b = [];
        for (let i = 0; i < 40; i++) { xs.push((i * 2.5).toFixed(1)); const base = rec.value.event_num / 50 * (0.75 + 0.5 * Math.sin(i / 5) * Math.sin(i / 11) + r() * 0.25);
          a.push(Math.round(base * 0.53)); b.push(Math.round(base * 0.47)); }
        return U.chart({ grid: { left: 60, right: 20, top: 40, bottom: 36 }, xAxis: U.axis({ type: 'category', data: xs, name: 'ms', boundaryGap: false }),
          yAxis: U.axis({ type: 'value', name: '事件率(个/ms)' }),
          series: [{ name: '正极性', type: 'line', smooth: true, showSymbol: false, areaStyle: { opacity: 0.25 }, data: a, color: '#f0625a' },
            { name: '负极性', type: 'line', smooth: true, showSymbol: false, areaStyle: { opacity: 0.25 }, data: b, color: '#3c8cff' }] });
      });
      const scatter = computed(() => U.chart({ tooltip: { show: false }, grid: { left: 50, right: 20, top: 36, bottom: 36 },
        xAxis: U.axis({ type: 'value', name: 'x', min: 0, max: 640 }), yAxis: U.axis({ type: 'value', name: 't(ms)', min: 0, max: dt.value }),
        series: [{ name: '正极性', type: 'scatter', symbolSize: 2, color: '#f0625a', data: pts.value.filter((p, i) => p[2] > 0 && i % 3 === 0).map((p) => [p[0], p[3] * 50]) },
          { name: '负极性', type: 'scatter', symbolSize: 2, color: '#3c8cff', data: pts.value.filter((p, i) => p[2] < 0 && i % 3 === 0).map((p) => [p[0], p[3] * 50]) }] }));
      const pie = computed(() => U.chart({ tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: '#c3d0e6' } },
        series: [{ type: 'pie', radius: ['40%', '66%'], center: ['50%', '44%'], label: { color: '#c3d0e6', formatter: '{b}\n{d}%' },
          data: [{ name: '正极性 (p=+1)', value: pos.value, itemStyle: { color: '#f0625a' } }, { name: '负极性 (p=-1)', value: pts.value.length - pos.value, itemStyle: { color: '#3c8cff' } }] }] }));
      return { names, seq, dt, rec, pts, pos, rate, scatter, pie, Synth };
    },
    template: `<div>
      <panel title="事件流参数" class="mb"><div class="query" style="margin:0">
        <div class="q"><span>数据序列</span><el-select v-model="seq" style="width:220px"><el-option v-for="n in names" :key="n" :value="n" :label="n"/></el-select></div>
        <div class="q" style="width:460px"><span>时间窗 ΔT</span><el-slider v-model="dt" :min="5" :max="50" :step="5" show-input style="width:360px"/><span>ms</span></div>
        <div class="q">场景：<span class="hl">{{rec.scene}}</span></div><div class="q">窗口事件：<span class="hl">{{pts.length}}</span> 个</div>
        <div class="q">归一化：x' = x / W，y' = y / H，t' = (t − t₀) / ΔT，p ∈ {−1, +1}</div></div></panel>
      <div class="row mb" style="height:470px">
        <panel title="事件帧（极性着色）" style="flex:1.2"><canvas-view :draw="Synth.eventDark(rec, dt)" :deps="[rec,dt]" height="100%" cap="红：亮度增加　蓝：亮度减小"/></panel>
        <panel title="对应 RGB 锚定帧（时间窗末端）" style="flex:1"><canvas-view :draw="Synth.rgb(rec,false)" :deps="rec" height="100%" :info="'帧序号 '+rec.frame_idx"/></panel>
        <panel title="极性统计" style="width:340px"><e-chart :option="pie" :height="390"/></panel>
      </div>
      <div class="grid2">
        <panel title="事件率随时间变化"><e-chart :option="rate" :height="300"/></panel>
        <panel title="x-t 时空投影"><e-chart :option="scatter" :height="300"/></panel>
      </div>
    </div>`,
  };
})();
