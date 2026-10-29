// 页面：检测推理分析、评估与消融、方法对比
window.PAGES = window.PAGES || {};
(function () {
  const { ref, computed } = Vue;

  PAGES.infer = {
    setup() {
      const recs = computed(() => Store.list('detect_record'));
      const models = Store.list('model').filter((m) => m.status === '已部署').map((m) => m.model_code);
      const rec = ref(recs.value.find((r) => r.ped_num > 0 && r.car_num >= 3) || recs.value[0]);
      const model = ref('combine-r50');
      const running = ref(false); const prog = ref(100);
      const shown = ref(rec.value);
      const run = () => {
        running.value = true; prog.value = 0;
        const t = setInterval(() => { prog.value = Math.min(100, prog.value + 12); if (prog.value >= 100) { clearInterval(t); running.value = false; shown.value = rec.value; } }, 120);
      };
      const gate = computed(() => Synth.channelGate(shown.value));
      const gateOpt = computed(() => U.chart({ grid: { left: 45, right: 10, top: 30, bottom: 30 }, legend: { show: false },
        xAxis: U.axis({ type: 'category', data: gate.value.map((_, i) => i), name: '通道' }), yAxis: U.axis({ type: 'value', min: 0.5, max: 1.5, name: 'w_c' }),
        series: [{ type: 'bar', data: gate.value.map((v) => ({ value: v, itemStyle: { color: v >= 1 ? '#36c98e' : '#f0625a' } })),
          markLine: { symbol: 'none', data: [{ yAxis: 1 }], lineStyle: { color: '#f0a43a' }, label: { color: '#f0a43a', formatter: '1.0' } } }] }));
      const boxes = computed(() => (shown.value.boxes || []).map((b, i) => ({ i: i + 1, ...b, cls: b.cls === 'car' ? '车辆 car' : '行人 pedestrian' })));
      return { recs, models, rec, model, running, prog, shown, run, gateOpt, boxes, Synth };
    },
    template: `<div>
      <panel title="推理参数" class="mb"><div class="query" style="margin:0">
        <div class="q"><span>检测帧</span><el-select v-model="rec" value-key="record_no" style="width:330px">
          <el-option v-for="r in recs" :key="r.record_no" :value="r" :label="r.seq_name+' / 帧 '+r.frame_idx+'（'+r.scene+'）'"/></el-select></div>
        <div class="q"><span>检测模型</span><el-select v-model="model" style="width:170px"><el-option v-for="m in models" :key="m" :value="m" :label="m"/></el-select></div>
        <div class="q"><span>置信度阈值</span><el-input-number :model-value="0.5" :step="0.05" size="default" controls-position="right" style="width:110px"/></div>
        <el-button type="primary" :loading="running" @click="run"><el-icon><VideoPlay/></el-icon>&nbsp;开始检测</el-button>
        <el-progress :percentage="prog" style="width:260px" :stroke-width="10"/></div></panel>
      <div class="row">
        <div class="grid2" style="flex:1">
          <canvas-view :draw="Synth.rgb(shown)" :deps="shown" cap="① RGB 分支检测结果"/>
          <canvas-view :draw="Synth.event(shown)" :deps="shown" cap="② 事件分支（极性事件帧）检测结果"/>
          <canvas-view :draw="Synth.sgf(shown)" :deps="shown" cap="③ SGF 语义反馈图（16×12 网格 → 上采样）"/>
          <canvas-view :draw="Synth.adg(shown)" :deps="shown" cap="④ ADG 局部空间门控权重 s(x,y)"/>
        </div>
        <div style="width:520px;display:flex;flex-direction:column;gap:16px">
          <panel title="检测结果明细"><el-table :data="boxes" stripe border size="small" max-height="330">
            <el-table-column prop="i" label="#" width="40"/><el-table-column prop="cls" label="类别" min-width="110"/>
            <el-table-column prop="score" label="置信度"/><el-table-column prop="iou" label="IoU"/>
            <el-table-column label="边框 (x, y, w, h)" min-width="170"><template #default="{row}">{{row.x}}, {{row.y}}, {{row.w}}, {{row.h}}</template></el-table-column>
          </el-table>
          <div class="muted" style="margin-top:10px;font-size:13px">模型 <span class="hl">{{model}}</span>　车辆 {{shown.car_num}}　行人 {{shown.ped_num}}　窗口事件 {{shown.event_num}}　耗时 {{shown.latency_ms}} ms</div></panel>
          <panel title="ADG 全局通道门控权重 w_c = 1 + β(2σ(z) − 1)"><e-chart :option="gateOpt" :height="300"/></panel>
        </div>
      </div>
    </div>`,
  };
  const MET = [['map', 'mAP'], ['ap50', 'AP50'], ['ap75', 'AP75'], ['aps', 'APs'], ['apm', 'APm'], ['apl', 'APl']];
  const VN = { dsec: 'dsec（基线）', feedback: 'feedback（+SGF）', gating: 'gating（+ADG）', combine: 'combine（SGF+ADG）' };
  PAGES.eval = {
    setup() {
      const all = computed(() => Store.list('eval_result'));
      const wins = computed(() => [...new Set(all.value.map((e) => e.backbone + ' · ' + e.eval_window))]);
      const win = ref(wins.value[0]);
      const rows = computed(() => all.value.filter((e) => e.backbone + ' · ' + e.eval_window === win.value));
      const cols = ['map', 'ap50', 'ap75', 'aps', 'apm', 'apl', 'f1', 'recall'];
      const best = computed(() => U.best(rows.value, cols));
      const base = computed(() => rows.value.find((r) => r.variant === 'dsec'));
      const bar = computed(() => U.chart({ grid: { left: 50, right: 20, top: 44, bottom: 30 },
        xAxis: U.axis({ type: 'category', data: ['mAP', 'AP75', 'APs', 'Recall'] }), yAxis: U.axis({ type: 'value', name: '%', min: 20 }),
        series: rows.value.map((r) => ({ name: VN[r.variant], type: 'bar', barGap: '10%', data: [r.map, r.ap75, r.aps, r.recall] })) }));
      const radar = computed(() => {
        const r50 = all.value.filter((e) => e.eval_window === '完整训练' && e.backbone === 'ResNet50');
        return U.chart({ tooltip: { trigger: 'item' }, legend: { top: 4, textStyle: { color: '#c3d0e6' } },
          radar: { radius: '62%', center: ['50%', '56%'], indicator: MET.map(([k, n]) => ({ name: n, max: k === 'apl' ? 85 : k === 'ap50' ? 72 : k === 'apm' ? 66 : 42, min: k === 'apl' ? 70 : 0 })),
            axisName: { color: '#9fb0cc' }, splitLine: { lineStyle: { color: '#2a4268' } }, splitArea: { show: false }, axisLine: { lineStyle: { color: '#2a4268' } } },
          series: [{ type: 'radar', areaStyle: { opacity: 0.18 }, data: r50.map((e) => ({ name: VN[e.variant], value: MET.map(([k]) => e[k]) })) }] });
      });
      const gain = computed(() => U.chart({ grid: { left: 50, right: 20, top: 40, bottom: 30 }, legend: { show: false },
        xAxis: U.axis({ type: 'category', data: rows.value.filter((r) => r.variant !== 'dsec').map((r) => VN[r.variant]) }),
        yAxis: U.axis({ type: 'value', name: 'ΔmAP' }),
        series: [{ type: 'bar', barWidth: 36, label: { show: true, position: 'top', color: '#d6e2f5', formatter: (p) => '+' + p.value },
          data: rows.value.filter((r) => r.variant !== 'dsec').map((r) => Number((r.map - (base.value ? base.value.map : 0)).toFixed(2))), color: '#3fe0c0' }] }));
      const b = (r, c) => (r[c] === best.value[c] ? `<b class="best">${U.fmt(r[c])}</b>` : U.fmt(r[c]));
      return { wins, win, rows, cols, b, bar, radar, gain, VN };
    },
    template: `<div>
      <panel title="评估与消融结果（DSEC-Detection）" class="mb">
        <template #extra><el-radio-group v-model="win"><el-radio-button v-for="w in wins" :key="w" :value="w">{{w}}</el-radio-button></el-radio-group></template>
        <el-table :data="rows" border stripe>
          <el-table-column label="模型变体" min-width="190"><template #default="{row}">{{VN[row.variant]}}</template></el-table-column>
          <el-table-column prop="model_code" label="模型编号" width="140"/>
          <el-table-column v-for="c in cols" :key="c" :label="({map:'mAP',ap50:'AP50',ap75:'AP75',aps:'APs',apm:'APm',apl:'APl',f1:'F1',recall:'Recall'})[c]+'(%)'">
            <template #default="{row}"><span v-html="b(row,c)"></span></template></el-table-column>
        </el-table>
        <div class="muted" style="margin-top:10px;font-size:13px">ResNet50 公平窗口仅统计 epoch 0–29，用于模块级比较；完整训练为当前可得的最长训练结果。</div>
      </panel>
      <div class="grid3">
        <panel title="各变体关键指标对比"><e-chart :option="bar" :height="340"/></panel>
        <panel title="相对基线的 mAP 增益"><e-chart :option="gain" :height="340"/></panel>
        <panel title="ResNet50 完整训练多尺度指标"><e-chart :option="radar" :height="340"/></panel>
      </div>
    </div>`,
  };
  PAGES.compare = {
    setup() {
      const rows = computed(() => [...Store.list('compare_method')].sort((a, b) => a.is_ours - b.is_ours));
      const cols = ['map', 'ap50', 'ap75', 'aps', 'apm', 'apl'];
      const best = computed(() => U.best(rows.value, cols));
      const b = (r, c) => (r[c] === best.value[c] ? `<b class="best">${U.fmt(r[c], 2)}</b>` : U.fmt(r[c], 2));
      const bar = computed(() => U.chart({ grid: { left: 50, right: 20, top: 40, bottom: 60 }, legend: { show: false },
        xAxis: U.axis({ type: 'category', data: rows.value.map((r) => r.method), axisLabel: { color: '#9fb0cc', rotate: 20 } }), yAxis: U.axis({ type: 'value', name: 'mAP(%)', min: 30 }),
        series: [{ type: 'bar', barWidth: 34, label: { show: true, position: 'top', color: '#d6e2f5' },
          data: rows.value.map((r) => ({ value: r.map, itemStyle: { color: r.is_ours ? '#3fe0c0' : '#3c8cff' } })) }] }));
      const scale = computed(() => U.chart({ grid: { left: 50, right: 20, top: 40, bottom: 60 },
        xAxis: U.axis({ type: 'category', data: rows.value.map((r) => r.method), axisLabel: { color: '#9fb0cc', rotate: 20 } }), yAxis: U.axis({ type: 'value', name: '%' }),
        series: [['aps', 'APs 小目标'], ['apm', 'APm 中目标'], ['apl', 'APl 大目标']].map(([k, n]) => ({ name: n, type: 'line', symbolSize: 8, data: rows.value.map((r) => r[k]) })) }));
      const columns = [{ prop: 'method', label: '方法' }, { prop: 'modality', label: '输入模态' }, { prop: 'backbone', label: '骨干' }];
      const form = [{ prop: 'method', label: '方法', required: true }, { prop: 'modality', label: '输入模态' }, { prop: 'backbone', label: '骨干网络' },
        ...cols.map((c) => ({ prop: c, label: c.toUpperCase().replace('MAP', 'mAP') + '(%)', type: 'number', step: 0.1 })),
        { prop: 'is_ours', label: '是否本方法', type: 'select', options: [{ label: '是', value: 1 }, { label: '否', value: 0 }] }];
      const newRow = () => ({ method: '', modality: 'RGB+Event', backbone: 'ResNet50', map: 0, ap50: 0, ap75: 0, aps: 0, apm: 0, apl: 0, is_ours: 0 });
      return { rows, cols, b, bar, scale, columns, form, newRow };
    },
    template: `<div>
      <panel title="与现有方法对比（DSEC-Detection）" class="mb">
        <el-table :data="rows" border :row-class-name="({row}) => row.is_ours ? 'ours' : ''">
          <el-table-column prop="method" label="方法" min-width="200"><template #default="{row}"><b v-if="row.is_ours" class="hl">{{row.method}}</b><span v-else>{{row.method}}</span></template></el-table-column>
          <el-table-column prop="modality" label="输入模态" width="130"/><el-table-column prop="backbone" label="骨干网络" width="150"/>
          <el-table-column v-for="c in cols" :key="c" :label="({map:'mAP',ap50:'AP50',ap75:'AP75',aps:'APs',apm:'APm',apl:'APl'})[c]+'(%)'">
            <template #default="{row}"><span v-html="b(row,c)"></span></template></el-table-column>
        </el-table>
        <div class="muted" style="margin-top:10px;font-size:13px">每列最优结果加粗显示；本文方法置于表格最下方。</div>
      </panel>
      <div class="grid2 mb">
        <panel title="mAP 对比"><e-chart :option="bar" :height="330"/></panel>
        <panel title="不同尺度目标检测精度"><e-chart :option="scale" :height="330"/></panel>
      </div>
      <panel title="对比方法维护"><crud-table table="compare_method" title="对比方法" :columns="columns" :form="form" :new-row="newRow" :page-size="4" size="small"/></panel>
    </div>`,
  };
})();
