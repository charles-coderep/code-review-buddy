// Web Worker for sandboxed JavaScript code execution
// Runs user code in an isolated thread with console capture and timeout safety

// Hijack console methods to post messages back to main thread
["log", "warn", "error", "info"].forEach(function (method) {
  console[method] = function () {
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
      try {
        var arg = arguments[i];
        if (arg === undefined) {
          args.push("undefined");
        } else if (arg === null) {
          args.push("null");
        } else if (typeof arg === "object") {
          args.push(JSON.stringify(arg, null, 2));
        } else {
          args.push(String(arg));
        }
      } catch (e) {
        args.push("[Unserializable]");
      }
    }
    self.postMessage({
      type: "console",
      method: method,
      args: args,
      timestamp: Date.now(),
    });
  };
});

// Listen for code execution requests
self.onmessage = function (event) {
  if (event.data.type === "execute") {
    try {
      // Use indirect eval so code runs in global scope
      var result = (0, eval)(event.data.code);

      // If the code returns a value, send it as console output
      if (result !== undefined) {
        self.postMessage({
          type: "console",
          method: "log",
          args: [
            typeof result === "object"
              ? JSON.stringify(result, null, 2)
              : String(result),
          ],
          timestamp: Date.now(),
        });
      }

      self.postMessage({ type: "done" });
    } catch (error) {
      self.postMessage({
        type: "console",
        method: "error",
        args: [error.name + ": " + error.message],
        timestamp: Date.now(),
      });
      self.postMessage({ type: "done", error: true });
    }
  }
};
