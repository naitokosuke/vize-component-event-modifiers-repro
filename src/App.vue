<script setup vapor>
import Box from "./Box.vue";
import Pinger from "./Pinger.vue";

const seen = (window.seen = []);
const submit = (e) => seen.push(`submit, defaultPrevented: ${e.defaultPrevented}`);
const key = (e) => seen.push(`keydown ${e.key}`);
const ping = () => seen.push("ping");
</script>

<template>
  <Box @submit.prevent="submit" @keydown.enter="key" />
  <Pinger @ping.once="ping" />
</template>
