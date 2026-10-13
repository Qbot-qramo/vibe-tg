// Runs WebLLM off the main thread so the page and turtle animation stay responsive while the model generates.
import { WEBLLM_URL } from './webllm.js';

// Messages can arrive before the library finishes loading, so hold them until the handler exists.
const pending = [];
let handler = null;
self.onmessage = message => (handler ? handler.onmessage(message) : pending.push(message));

import(WEBLLM_URL).then(({ WebWorkerMLCEngineHandler }) => {
  handler = new WebWorkerMLCEngineHandler();
  pending.splice(0).forEach(message => handler.onmessage(message));
});
