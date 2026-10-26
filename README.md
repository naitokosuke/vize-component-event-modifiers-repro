# vize-component-event-modifiers-repro

Minimal reproduction: in Vapor mode, [vize](https://github.com/ubugeeei-prod/vize) drops event modifiers written on a component, with no warning. `.prevent`, key modifiers such as `.enter`, and `.once` are all lost. `@vue/compiler-sfc` keeps them, and so does vize in non-Vapor mode.

## Steps

```sh
pnpm install
pnpm check
```

`pnpm check` builds the same app twice: once with [`@vitejs/plugin-vue`](./vite.vue.config.js) and once with [`@vizejs/vite-plugin`](./vite.vize.config.js). Both use the same Vue runtime. [`check.js`](./check.js) then mounts each build in happy-dom, fires the same events at both, and compares what the handlers saw with what the modifiers mean. It exits 1 if either build differs.

[`src/App.vue`](./src/App.vue):

```vue
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
```

- [`src/Box.vue`](./src/Box.vue) is `<form><slot /></form>` and declares no emits, so both listeners fall through to its root `<form>` ([v-on listener inheritance](https://vuejs.org/guide/components/attrs.html#v-on-listener-inheritance)).
- [`src/Pinger.vue`](./src/Pinger.vue) declares `emits: ["ping"]` and emits `ping` each time its button is clicked. `.once` is [documented for component events](https://vuejs.org/guide/components/events.html#emitting-and-listening-to-events).

`check.js` fires these, in this order:

1. one cancelable `submit` on the `<form>`
2. a `keydown` for `a`, then one for `Enter`, on the `<form>`
3. two clicks on Pinger's button

## Expected

What the `@vitejs/plugin-vue` build prints:

```
--- vue: as expected ---
submit, defaultPrevented: true
keydown Enter
ping
native submit cancelled: true
```

## Actual

What the `@vizejs/vite-plugin` build prints. `pnpm check` then exits 1:

```
--- vize: NOT as expected ---
submit, defaultPrevented: false
keydown a
keydown Enter
ping
ping
native submit cancelled: false
```

- `.prevent`: the native submit is not cancelled. In a browser, the page navigates.
- `.enter`: the handler runs for any key.
- `.once`: the handler runs on every `ping`.

## Notes

These are the props each compiler gives `<Box>` and `<Pinger>` for `src/App.vue`.

`@vue/compiler-sfc` 3.6.0-rc.13 (`compileTemplate({ vapor: true })`):

```js
onSubmit: () => _withModifiers(_ctx.submit, ["prevent"]),
onKeydown: () => _withKeys(_ctx.key, ["enter"])
const n1 = _createAssetComponent("Pinger", { onPingOnce: () => _ctx.ping })
```

`@vizejs/native` 0.587.0 (`compileSfc(src, { vapor: true })`):

```js
onSubmit: () => (_ctx.submit),
onKeydown: () => (_ctx.key)
const n1 = _createComponentWithFallback(_component_Pinger, { onPing: () => (_ctx.ping) }, null, false)
```

The same file, with `<script setup>` in place of `<script setup vapor>`, keeps the modifiers in vize:

```js
onSubmit: _withModifiers($setup.submit, ["prevent"]),
onKeydown: _withKeys($setup.key, ["enter"])
_createVNode($setup.Pinger, { onPingOnce: $setup.ping }, null, 8 /* PROPS */, ["onPingOnce"])
```

In Vapor mode, vize also keeps the modifier on a native element. `.stop` on a component is dropped the same way:

```vue
<form @submit.prevent="submit"></form>
<Box @click.stop="go" />
```

```js
const n1 = _createComponentWithFallback(_component_Box, { onClick: () => (_ctx.go) }, null, false)
_on(n0, "submit", _withModifiers(e => _ctx.submit(e), ["prevent"]))
```

In vize 0.587.0, [`component_prop_expression_value`](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/crates/vize_atelier_vapor/src/generate/operations/component_props.rs#L296-L325) emits a component's handler prop as the bare handler expression ([L314-L320](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/crates/vize_atelier_vapor/src/generate/operations/component_props.rs#L314-L320)). The modifiers parsed in [`steps/v_on.rs`](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/crates/vize_atelier_vapor/src/steps/v_on.rs#L79-L98) are applied only to element events.

vize 0.474.0, 0.480.0 and 0.562.0 drop all three the same way.

## Environment

vize 0.587.0 (`@vizejs/vite-plugin`), `@vitejs/plugin-vue` 6.0.10, Vue 3.6.0-rc.13, Vite 8.3.5, happy-dom 21.0.4, Node v26.12.1, pnpm 12.9.0, macOS (arm64)
