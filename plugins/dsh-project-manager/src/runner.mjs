import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
const OUTPUT_LIMIT = 128 * 1024;
export class ActionRunner {
  constructor() {
    this.runs = new Map();
    this.children = new Map();
  }
  start(action, cwd, checkoutId) {
    if (this.children.size >= 8)
      throw new Error("已有 8 个操作在运行，请先停止一个。");
    const id = randomUUID(),
      run = {
        id,
        name: action.name,
        command: action.command,
        cwd,
        checkoutId,
        startedAt: Date.now(),
        endedAt: null,
        status: "running",
        exitCode: null,
        output: "",
      };
    const child = spawn(
      process.env.SHELL || "/bin/sh",
      ["-lc", action.command],
      {
        cwd,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, TERM: "dumb", NO_COLOR: "1" },
      },
    );
    this.runs.set(id, run);
    this.children.set(id, child);
    const append = (data) => {
      run.output = (run.output + String(data)).slice(-OUTPUT_LIMIT);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", (error) => {
      append(error.message);
      run.status = "failed";
      run.endedAt = Date.now();
      this.children.delete(id);
    });
    child.on("close", (code, signal) => {
      if (run.status === "running")
        run.status = code === 0 ? "completed" : "failed";
      run.exitCode = code;
      run.signal = signal;
      run.endedAt = Date.now();
      this.children.delete(id);
    });
    for (const [key, value] of this.runs)
      if (this.runs.size > 40 && value.status !== "running")
        this.runs.delete(key);
    return { ...run };
  }
  get(id) {
    const run = this.runs.get(id);
    if (!run) throw new Error("找不到这次操作的运行记录。");
    return { ...run };
  }
  list() {
    return [...this.runs.values()]
      .map(({ output, ...run }) => ({ ...run }))
      .reverse();
  }
  async stop(id) {
    const run = this.runs.get(id),
      child = this.children.get(id);
    if (!run) throw new Error("运行记录已不存在。");
    if (!child) return { ...run };
    run.status = "stopped";
    const kill = (signal) => {
      try {
        process.kill(
          process.platform === "win32" ? child.pid : -child.pid,
          signal,
        );
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    };
    const closed = new Promise((resolve) => child.once("close", resolve)),
      timer = setTimeout(() => kill("SIGKILL"), 2000);
    timer.unref();
    kill("SIGTERM");
    try {
      await closed;
    } finally {
      clearTimeout(timer);
    }
    return { ...run };
  }
  async dispose() {
    await Promise.allSettled(
      [...this.children.keys()].map((id) => this.stop(id)),
    );
  }
}
