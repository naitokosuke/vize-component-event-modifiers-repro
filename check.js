// Mount each build in happy-dom, fire the same events, and print what the handlers saw.
import { Window } from "happy-dom";

for (const build of ["vue", "vize"]) {
  const window = new Window();
  // the DOM globals Vue's runtime reads (Node, Text, Element, ...) come from this window
  for (const key of Object.getOwnPropertyNames(window))
    if (/^[A-Z]/.test(key) && typeof window[key] === "function") globalThis[key] = window[key];
  Object.assign(globalThis, { window, document: window.document });

  await import(`./dist/${build}/main.js`);
  const { document } = window;
  const form = document.querySelector("form");

  const submit = new window.Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(submit);
  form.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  form.dispatchEvent(new window.KeyboardEvent("keydown", { key: "a", bubbles: true }));
  form.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const ping = document.querySelector("button");
  ping.click();
  ping.click();

  console.log(`--- ${build} ---`);
  for (const line of window.log) console.log(line);
  console.log(`native submit cancelled: ${submit.defaultPrevented}`);
  await window.happyDOM.close();
}
