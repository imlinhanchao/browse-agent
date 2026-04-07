<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import InstanceCard from '../components/InstanceCard.vue';
import CreateModal from '../components/CreateModal.vue';

interface Instance {
  id: string;
  name: string;
  wsPort: number;
  createdAt: string;
  connected: boolean;
}

const instances = ref<Instance[]>([]);
const showModal = ref(false);
const loading = ref(false);
const error = ref('');
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function loadInstances() {
  try {
    const res = await fetch('/api/instances');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    instances.value = await res.json();
  } catch (e: any) {
    error.value = e.message;
  }
}

async function handleCreate(payload: { name: string; secret: string }) {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    showModal.value = false;
    await loadInstances();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function handleDelete(id: string) {
  if (!confirm('确定要删除此实例吗？')) return;
  try {
    const res = await fetch(`/api/instances/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadInstances();
  } catch (e: any) {
    error.value = e.message;
  }
}

onMounted(async () => {
  await loadInstances();
  pollTimer = setInterval(loadInstances, 5000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <div class="min-h-screen bg-[#0f1117] text-[#e1e4eb]">
    <!-- Header -->
    <header class="border-b border-[#2a2e3a] bg-[#1a1d27]">
      <div class="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-[#e1e4eb]">🌐 Browse Agent</h1>
          <p class="text-xs text-[#8b8fa3] mt-0.5">多实例浏览器控制台</p>
        </div>
        <button
          class="flex items-center gap-2 px-4 py-2 bg-[#6c8cff] hover:bg-[#5a7aee] text-white text-sm font-medium rounded-lg transition-colors"
          @click="showModal = true"
        >
          <span class="text-lg leading-none">+</span>
          新建实例
        </button>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-5xl mx-auto px-6 py-8">
      <!-- Error -->
      <div
        v-if="error"
        class="mb-4 p-3 bg-[#f87171]/10 border border-[#f87171]/30 rounded-lg text-[#f87171] text-sm"
      >
        {{ error }}
      </div>

      <!-- Empty state -->
      <div v-if="instances.length === 0" class="text-center py-20">
        <div class="text-5xl mb-4">🌐</div>
        <h2 class="text-lg font-semibold text-[#e1e4eb] mb-2">暂无控制实例</h2>
        <p class="text-sm text-[#8b8fa3] mb-6">
          创建一个实例，获取 WS 地址和密钥，粘贴到 Browse Agent 扩展即可开始控制浏览器
        </p>
        <button
          class="px-5 py-2.5 bg-[#6c8cff] hover:bg-[#5a7aee] text-white text-sm font-medium rounded-lg transition-colors"
          @click="showModal = true"
        >
          创建第一个实例
        </button>
      </div>

      <!-- Instance grid -->
      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InstanceCard
          v-for="inst in instances"
          :key="inst.id"
          :instance="inst"
          @delete="handleDelete"
        />
      </div>

      <!-- Usage guide -->
      <div class="mt-10 p-5 bg-[#1a1d27] border border-[#2a2e3a] rounded-xl">
        <h3 class="text-sm font-semibold text-[#e1e4eb] mb-3">使用说明</h3>
        <ol class="text-sm text-[#8b8fa3] space-y-2 list-decimal list-inside">
          <li>点击「新建实例」创建一个控制实例（名称和密钥均可随机生成）</li>
          <li>复制实例的 <strong class="text-[#e1e4eb]">WS 地址</strong> 和 <strong class="text-[#e1e4eb]">密钥</strong>，粘贴到 Browse Agent 浏览器扩展</li>
          <li>扩展连接成功后，状态指示灯变为绿色</li>
          <li>点击「控制」按钮访问控制页面，输入密钥即可远程控制浏览器</li>
        </ol>
      </div>
    </main>

    <!-- Create modal -->
    <CreateModal
      v-if="showModal"
      @close="showModal = false"
      @create="handleCreate"
    />
  </div>
</template>
