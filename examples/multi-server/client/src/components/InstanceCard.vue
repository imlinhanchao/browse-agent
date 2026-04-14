<script setup lang="ts">
import { ref, computed } from 'vue';

interface Instance {
  id: string;
  name: string;
  wsPort: number;
  createdAt: string;
  connected: boolean;
}

const props = defineProps<{ instance: Instance }>();
const emit = defineEmits<{ delete: [id: string] }>();

const secretVisible = ref(false);
const copied = ref<string | null>(null);

const wsUrl = computed(() => `ws://${window.location.hostname}:${props.instance.wsPort}`);
const controlUrl = computed(() => `${window.location.origin}/#/control/${props.instance.id}`);

function copy(text: string, key: string) {
  navigator.clipboard.writeText(text).then(() => {
    copied.value = key;
    setTimeout(() => (copied.value = null), 1500);
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}
</script>

<template>
  <div class="bg-[#1a1d27] border border-[#2a2e3a] rounded-xl p-5 space-y-4 hover:border-[#3a3e4a] transition-colors">
    <!-- Header -->
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <span
          :class="[
            'w-2.5 h-2.5 rounded-full flex-shrink-0',
            instance.connected ? 'bg-[#4ade80]' : 'bg-[#8b8fa3]',
          ]"
          :title="instance.connected ? '已连接' : '未连接'"
        />
        <h3 class="font-semibold text-[#e1e4eb] truncate">{{ instance.name }}</h3>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <router-link
          :to="`/control/${instance.id}`"
          class="px-3 py-1 text-xs bg-[#6c8cff] hover:bg-[#5a7aee] text-white rounded-md transition-colors"
        >
          控制
        </router-link>
        <button
          class="px-2 py-1 text-xs text-[#f87171] hover:bg-[#f87171]/10 border border-transparent hover:border-[#f87171]/30 rounded-md transition-colors"
          title="删除实例"
          @click="emit('delete', instance.id)"
        >
          删除
        </button>
      </div>
    </div>

    <!-- Info rows -->
    <div class="space-y-2 text-sm">
      <!-- WS URL -->
      <div class="flex items-center gap-2">
        <span class="text-[#8b8fa3] w-20 flex-shrink-0">WS 地址</span>
        <span class="font-mono text-xs text-[#e1e4eb] truncate flex-1">{{ wsUrl }}</span>
        <button
          class="text-xs px-2 py-0.5 rounded bg-[#2a2e3a] hover:bg-[#3a3e4a] text-[#8b8fa3] hover:text-[#e1e4eb] transition-colors flex-shrink-0"
          @click="copy(wsUrl, 'ws')"
        >
          {{ copied === 'ws' ? '✓ 已复制' : '复制' }}
        </button>
      </div>

      <!-- Control URL -->
      <div class="flex items-center gap-2">
        <span class="text-[#8b8fa3] w-20 flex-shrink-0">控制地址</span>
        <span class="font-mono text-xs text-[#e1e4eb] truncate flex-1">{{ controlUrl }}</span>
        <button
          class="text-xs px-2 py-0.5 rounded bg-[#2a2e3a] hover:bg-[#3a3e4a] text-[#8b8fa3] hover:text-[#e1e4eb] transition-colors flex-shrink-0"
          @click="copy(controlUrl, 'ctrl')"
        >
          {{ copied === 'ctrl' ? '✓ 已复制' : '复制' }}
        </button>
      </div>

      <!-- Secret (masked) -->
      <div class="flex items-center gap-2">
        <span class="text-[#8b8fa3] w-20 flex-shrink-0">密钥</span>
        <span class="font-mono text-xs text-[#e1e4eb] truncate flex-1">
          {{ secretVisible ? '（请在控制页面查看）' : '••••••••••••••••' }}
        </span>
      </div>
    </div>

    <!-- Footer -->
    <div class="text-xs text-[#8b8fa3]">创建于 {{ formatDate(instance.createdAt) }}</div>
  </div>
</template>
