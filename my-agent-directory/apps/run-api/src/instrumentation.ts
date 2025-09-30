import { defaultSDK } from "@inkeep/agents-run-api/instrumentation";

try {
  defaultSDK.start();
} catch (err) {
  // Avoid crashing the process if instrumentation fails
  console.warn("Instrumentation failed to start", err);
}
