<script setup vapor>
const emit = defineEmits(["ping"]);
</script>

<template>
  <button type="button" @click="emit('ping')">ping</button>
</template>
