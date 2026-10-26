// Mount each build in happy-dom, fire the same events at both, and compare what the handlers
// saw with what Vue's modifiers mean. Exits 1 when a build does not match.
import { Window } from "happy-dom";

const expected = ["submit, defaultPrevented: true", "keydown Enter", "ping"];
let failed = false;

for (const build of ["vue", "vize"]) {
  const window = new Window();
  // the DOM globals Vue's runtime reads (Node, Text, Element, ...) come from this window
  for (const key of Object.getOwnPropertyNames(window))
    if (/^[A-Z]/.test(key) && typeof window[key] === "function") globalThis[key] = window[key];
  Object.assign(globalThis, { window, document: window.document });

  await import(`./dist/${build}/main.js`);
  const form = window.document.querySelector("form");
  const button = window.document.querySelector("button");

  // .prevent: the native submit is cancelled
  const submit = new window.Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(submit);
  // .enter: only Enter calls the handler
  form.dispatchEvent(new window.KeyboardEvent("keydown", { key: "a", bubbles: true }));
  form.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  // .once: the second ping calls nothing
  button.click();
  button.click();

  const ok = JSON.stringify(window.seen) === JSON.stringify(expected) && submit.defaultPrevented;
  failed ||= !ok;
  console.log(`--- ${build}: ${ok ? "as expected" : "NOT as expected"} ---`);
  for (const line of window.seen) console.log(line);
  console.log(`native submit cancelled: ${submit.defaultPrevented}`);
  await window.happyDOM.close();
}

process.exitCode = failed ? 1 : 0;
