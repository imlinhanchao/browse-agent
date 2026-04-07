<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  close: [];
  create: [{ name: string; secret: string }];
}>();

const name = ref('');
const secret = ref('');
const loading = ref(false);

function randomName() {
  const adjectives = ['Quick', 'Bright', 'Swift', 'Calm', 'Bold', 'Sharp', 'Silent', 'Active'];
  const nouns = ['Fox', 'Hawk', 'Bear', 'Wolf', 'Tiger', 'Eagle', 'Lion', 'Raven'];
  name.value =
    adjectives[Math.floor(Math.random() * adjectives.length)] +
    nouns[Math.floor(Math.random() * nouns.length)];
}

function randomSecret() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  secret.value = Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function handleSubmit() {
  loading.value = true;
  try {
    emit('create', { name: name.value, secret: secret.value });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    @click.self="emit('close')"
  >
    <div class="bg-[#1a1d27] border border-[#2a2e3a] rounded-xl w-full max-w-md p-6 shadow-2xl">
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-lg font-semibold text-[#e1e4eb]">新建控制实例</h2>
        <button
          class="text-[#8b8fa3] hover:text-[#e1e4eb] text-xl leading-none"
          @click="emit('close')"
        >
          ×
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Name -->
        <div>
          <label class="block text-sm text-[#8b8fa3] mb-1">实例名称</label>
          <div class="flex gap-2">
            <input
              v-model="name"
              type="text"
              placeholder="留空则随机生成"
              class="flex-1 bg-[#0f1117] border border-[#2a2e3a] rounded-lg px-3 py-2 text-sm text-[#e1e4eb] outline-none focus:border-[#6c8cff] transition-colors"
            />
            <button
              type="button"
              class="px-3 py-2 bg-[#2a2e3a] hover:bg-[#3a3e4a] text-[#8b8fa3] hover:text-[#e1e4eb] rounded-lg text-sm transition-colors"
              title="随机生成名称"
              @click="randomName"
            >
              🎲
            </button>
          </div>
        </div>

        <!-- Secret -->
        <div>
          <label class="block text-sm text-[#8b8fa3] mb-1">密钥</label>
          <div class="flex gap-2">
            <input
              v-model="secret"
              type="text"
              placeholder="留空则随机生成"
              class="flex-1 bg-[#0f1117] border border-[#2a2e3a] rounded-lg px-3 py-2 text-sm text-[#e1e4eb] font-mono outline-none focus:border-[#6c8cff] transition-colors"
            />
            <button
              type="button"
              class="px-3 py-2 bg-[#2a2e3a] hover:bg-[#3a3e4a] text-[#8b8fa3] hover:text-[#e1e4eb] rounded-lg text-sm transition-colors"
              title="随机生成密钥"
              @click="randomSecret"
            >
              🎲
            </button>
          </div>
          <p class="mt-1 text-xs text-[#8b8fa3]">密钥用于扩展认证及控制页面访问</p>
        </div>

        <div class="flex gap-3 pt-2">
          <button
            type="button"
            class="flex-1 py-2 border border-[#2a2e3a] rounded-lg text-sm text-[#8b8fa3] hover:text-[#e1e4eb] hover:border-[#3a3e4a] transition-colors"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="flex-1 py-2 bg-[#6c8cff] hover:bg-[#5a7aee] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {{ loading ? '创建中…' : '创建实例' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
