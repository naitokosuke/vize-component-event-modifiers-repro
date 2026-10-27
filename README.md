# vize-component-event-modifiers-repro

Reported as [ubugeeei-prod/vize#10894](https://github.com/ubugeeei-prod/vize/issues/10894).

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

### Where the modifiers are lost

In Vue's compiler, a `v-on` on a component carries its modifiers into the IR as `handlerModifiers` ([`compiler-vapor/src/transforms/vOn.ts`](https://github.com/vuejs/core/blob/v3.6.0-rc.13/packages/compiler-vapor/src/transforms/vOn.ts#L104-L128)). Codegen wraps the handler from them.

vize 0.587.0 has nowhere to put them:

- [`IRProp`](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/crates/vize_atelier_vapor/src/ir/props.rs#L25-L30) has `key`, `values`, `is_component` and `value_kind`, but no modifiers.
- The component lowering of `v-on` ([`lower/element/component.rs`](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/crates/vize_atelier_vapor/src/lower/element/component.rs#L160-L184)) builds the `onX` key and the handler value, and never reads `dir.modifiers`. The same file does read modifiers for `v-bind` and `v-model` (`modelModifiers`).
- So [`component_prop_expression_value`](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/crates/vize_atelier_vapor/src/generate/operations/component_props.rs#L314-L320) can only emit the bare handler.
- Element events take another path, [`steps/v_on.rs`](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/crates/vize_atelier_vapor/src/steps/v_on.rs#L79-L98) → `SetEventIRNode`, which keeps `EventModifiers`.

### Why the Vapor parity corpus does not catch it

The corpus has this exact upstream case: `up.transforms.transformElement.36`, `<Foo @keydown.enter.prevent="a" @keydown.esc.prevent="b" />`, in [`upstream-compiler-vapor.json`](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/tests/_fixtures/vapor-parity/upstream-compiler-vapor.json). Upstream asserts `_withKeys(_withModifiers(_ctx.a, ["prevent"]), ["enter"])` for it ([`transformElement.spec.ts`](https://github.com/vuejs/core/blob/v3.6.0-rc.11/packages/compiler-vapor/__tests__/transforms/transformElement.spec.ts#L613-L621)). Two things let it pass anyway:

- [`extract.ts`](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/tests/tooling/support/vapor-parity/extract.ts#L77-L80) keeps only the first string argument of each `compile*()` call, so upstream's expected output is not kept.
- [`mount.ts`](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/tests/tooling/support/vapor-parity/mount.ts#L74-L82) cannot observe any of the four modifiers:
  - It fires `click`, `mouseenter`, `input`, `keyup` (Enter only) and `submit`, once each. A wrong key, a second event, and `keydown` are never sent, so `.enter`, `.once` and this case's handlers are never checked.
  - Handler arguments are logged as `Event:<type>` ([L20-L22](https://github.com/ubugeeei-prod/vize/blob/v0.587.0/tests/tooling/support/vapor-parity/mount.ts#L20-L22)), so `defaultPrevented` (`.prevent`) and propagation (`.stop`) don't show.

### Versions

vize 0.474.0, 0.480.0 and 0.562.0 drop all three the same way, and so does `@vizejs/native` 0.588.0.

## Environment

vize 0.587.0 (`@vizejs/vite-plugin`), `@vitejs/plugin-vue` 6.0.10, Vue 3.6.0-rc.13, Vite 8.3.5, happy-dom 21.0.4, Node v26.12.1, pnpm 12.9.0, macOS (arm64)
