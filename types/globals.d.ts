export {};

declare global {
  interface Window {
    /** Debug handle for the browser pane and screenshots. Set in src/main.js. */
    __lowbeam: any;
    webkitAudioContext: typeof AudioContext;
  }
}
