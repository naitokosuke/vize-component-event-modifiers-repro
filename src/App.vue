<script setup vapor>
import Box from "./Box.vue";
import Pinger from "./Pinger.vue";

const log = (window.log = []);
const outer = () => log.push("outer click");
const submit = (e) => log.push(`submit defaultPrevented=${e.defaultPrevented}`);
const click = () => log.push("box click");
const key = (e) => log.push(`keydown ${e.key}`);
const ping = () => log.push("ping");
</script>

<template>
  <div @click="outer">
    <Box @submit.prevent="submit" @click.stop="click" @keydown.enter="key" />
  </div>
  <Pinger @ping.once="ping" />
</template>
