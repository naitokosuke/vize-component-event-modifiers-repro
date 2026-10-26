# vize-component-event-modifiers-repro

Minimal reproduction: in Vapor mode, [vize](https://github.com/ubugeeei-prod/vize) drops event modifiers written on a component. `.prevent`, `.stop`, key modifiers such as `.enter`, and `.once` are all lost, with no warning. `@vue/compiler-sfc` keeps them, and so does vize in non-Vapor mode.

## Steps

```sh
pnpm install
pnpm check
```

`pnpm check` builds the same app twice, once with [`@vitejs/plugin-vue`](./vite.vue.config.js) and once with [`@vizejs/vite-plugin`](./vite.vize.config.js). It then mounts each build in happy-dom, fires the same events at both ([`check.js`](./check.js)), and prints what the handlers saw.

[`src/App.vue`](./src/App.vue):

```vue
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
```

- [`src/Box.vue`](./src/Box.vue) is `<form><slot /></form>` and declares no emits, so the three listeners fall through to its root `<form>`.
- [`src/Pinger.vue`](./src/Pinger.vue) declares `emits: ["ping"]` and emits `ping` on each click of its button.

`check.js` dispatches the following:

- one cancelable `submit`, one `click`, then a `keydown` for `a` and one for `Enter`, all on the `<form>`
- two clicks on Pinger's button

## Expected

The `@vitejs/plugin-vue` build:

```
--- vue ---
submit defaultPrevented=true
box click
keydown Enter
ping
native submit cancelled: true
```

## Actual

The `@vizejs/vite-plugin` build:

```
--- vize ---
submit defaultPrevented=false
box click
outer click
keydown a
keydown Enter
ping
ping
native submit cancelled: false
```

| Modifier | What vize does instead |
| --- | --- |
| `.prevent` | The native submit is not cancelled. In a browser, the page navigates. |
| `.stop` | The click reaches the outer `<div>`. |
| `.enter` | The handler runs for any key. |
| `.once` | The handler runs on every `ping`, not just the first. |

## Notes

The prop object each compiler passes to `<Box>` and `<Pinger>` in Vapor mode:

- `@vue/compiler-sfc` 3.6.0-rc.13 (`compileTemplate({ vapor: true })`):

  ```js
  onSubmit: () => _withModifiers(_ctx.submit, ["prevent"]),
  onClick: () => _withModifiers(_ctx.click, ["stop"]),
  onKeydown: () => _withKeys(_ctx.key, ["enter"])
  // and for <Pinger>
  onPingOnce: () => _ctx.ping
  ```

- `@vizejs/native` 0.587.0 (`compileSfc(src, { vapor: true })`):

  ```js
  onSubmit: () => (_ctx.submit),
  onClick: () => (_ctx.click),
  onKeydown: () => (_ctx.key)
  // and for <Pinger>
  onPing: () => (_ctx.ping)
  ```

On a native element, vize keeps the modifier. `<form @submit.prevent="submit">` compiles to `_on(n1, "submit", _withModifiers(e => _ctx.submit(e), ["prevent"]))`.

Vize's non-Vapor output keeps all four: `_withModifiers(…, ["prevent"])`, `_withModifiers(…, ["stop"])`, `_withKeys(…, ["enter"])` and `onPingOnce`.

In vize 0.587.0, [`component_prop_expression_value`](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/crates/vize_atelier_vapor/src/generate/operations/component_props.rs#L296-L325) emits a component's handler prop as the plain handler expression ([L314-L320](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/crates/vize_atelier_vapor/src/generate/operations/component_props.rs#L314-L320)). The modifiers parsed in [`steps/v_on.rs`](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/crates/vize_atelier_vapor/src/steps/v_on.rs#L79-L98) are applied only to element events.

The [Vue docs](https://vuejs.org/guide/components/events.html) say `.once` is supported on component event listeners. `.prevent`, `.stop` and key modifiers act on the native event that a [fallthrough listener](https://vuejs.org/guide/components/attrs.html#v-on-listener-inheritance) receives.

vize 0.474.0 and 0.562.0 compile it to the same output.

## Environment

vize 0.587.0 (`@vizejs/vite-plugin`), `@vitejs/plugin-vue` 6.0.10, Vue 3.6.0-rc.13, Vite 8.3.5, happy-dom 21.0.4, Node v26.12.1, pnpm 12.9.0, macOS (arm64)
