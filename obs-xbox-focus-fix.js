/**
 * OBS Xbox Focus Fix
 *
 * Automatically enables Chromium Focus Emulation for Xbox Remote Play
 * Browser Sources running inside OBS.
 *
 * Requirements:
 * OBS must be started with:
 *   --remote-debugging-port=9222
 *   --remote-allow-origins=http://localhost:9222
 *
 * Usage:
 *   node obs-xbox-focus-fix.js
 *   node obs-xbox-focus-fix.js --watch
 *   node obs-xbox-focus-fix.js --port 9222 --timeout 60 --interval 5 --watch
 *
 * MIT License
 */

import WebSocket from "ws";
import { debug, info, warn, error, success } from "./logger.js";

const DEFAULT_PORT = 9222;
const DEFAULT_STARTUP_TIMEOUT_S = 60;
const DEFAULT_WATCH_INTERVAL_S = 5;
const POLL_INTERVAL_MS = 1000;
const CDP_COMMAND_TIMEOUT_MS = 5000;

function parseArgs(argv) {
  const args = {
    watch: false,
    port: DEFAULT_PORT,
    timeoutMs: DEFAULT_STARTUP_TIMEOUT_S * 1000,
    intervalMs: DEFAULT_WATCH_INTERVAL_S * 1000,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--watch") args.watch = true;
    else if (argv[i] === "--port") args.port = Number(argv[++i]);
    else if (argv[i] === "--timeout") args.timeoutMs = Number(argv[++i]) * 1000;
    else if (argv[i] === "--interval") args.intervalMs = Number(argv[++i]) * 1000;
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTargets(port) {
  const res = await fetch(`http://localhost:${port}/json`);
  if (!res.ok) throw new Error(`HTTP ${res.status} sur /json`);
  return res.json();
}

function findXboxTarget(targets) {
  return targets.find(
    (t) => t.type === "page" && t.url?.includes("xbox.com") && t.url.includes("/play")
  );
}

const FOCUS_STATE_EXPRESSION = `JSON.stringify({
  hasFocus: document.hasFocus(),
  hidden: document.hidden,
  visibilityState: document.visibilityState,
  userActivation: {
    hasBeenActive: navigator.userActivation.hasBeenActive,
    isActive: navigator.userActivation.isActive,
  },
})`;

// Ouvre une session CDP sur la target, exécute les commandes fournies via
// `send(method, params)`, puis ferme la connexion.
function withCdpSession(target, run) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const pending = new Map();
    let nextId = 1;

    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error("timeout CDP (5s) en attente de réponse"));
    }, CDP_COMMAND_TIMEOUT_MS);

    function send(method, params) {
      return new Promise((res, rej) => {
        const id = nextId++;
        pending.set(id, { res, rej });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }

    socket.on("open", async () => {
      try {
        const result = await run(send);
        clearTimeout(timer);
        socket.close();
        resolve(result);
      } catch (err) {
        clearTimeout(timer);
        socket.close();
        reject(err);
      }
    });

    socket.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.error) entry.rej(new Error(msg.error.message));
      else entry.res(msg.result);
    });

    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Reproduit ce que fait Chrome quand tu donnes le focus à un onglet
// DevTools inspecté (Page.bringToFront), en plus de l'émulation de focus.
// Nécessaire sur une page "fraîche" (userActivation.hasBeenActive=false,
// ex: juste après un reload suite au clic "prolonger la session") — la
// simple attache CDP ne suffit pas à activer un document qui n'a encore
// jamais reçu le moindre geste utilisateur réel.
async function activateTarget(send) {
  await send("Page.enable", {});
  await send("Page.bringToFront", {});
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
}

async function applyFocusEmulation(target) {
  return withCdpSession(target, async (send) => {
    await activateTarget(send);

    const evalResult = await send("Runtime.evaluate", {
      expression: FOCUS_STATE_EXPRESSION,
      returnByValue: true,
    });
    let state = null;
    try {
      state = JSON.parse(evalResult.result.value);
    } catch {
      // évaluation impossible (contexte détruit, page en transition...) — pas bloquant
    }
    return state;
  });
}

// Session CDP qui reste ouverte (contrairement à withCdpSession) — c'est le
// fait d'être attaché en continu (comme ouvrir /devtools/inspector.html à la
// main) qui maintient l'activation Xbox, pas une commande à rejouer.
function openPersistentCdpSession(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;

  const ready = new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  function send(method, params) {
    return new Promise((res, rej) => {
      const id = nextId++;
      pending.set(id, { res, rej });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  socket.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.rej(new Error(msg.error.message));
    else entry.res(msg.result);
  });

  return { ready, send, socket, close: () => socket.close() };
}

async function readFocusState(send) {
  const evalResult = await send("Runtime.evaluate", {
    expression: FOCUS_STATE_EXPRESSION,
    returnByValue: true,
  });
  try {
    return JSON.parse(evalResult.result.value);
  } catch {
    return null;
  }
}

async function findAndApply(port) {
  const targets = await fetchTargets(port);
  const target = findXboxTarget(targets);
  if (!target) return null;
  const state = await applyFocusEmulation(target);
  if (state) {
    debug(
      "🔬",
      `État page: hasFocus=${state.hasFocus} hidden=${state.hidden} visibilityState=${state.visibilityState} userActivation.isActive=${state.userActivation.isActive} userActivation.hasBeenActive=${state.userActivation.hasBeenActive}`
    );
  }
  return target;
}

async function waitForFirstSuccess(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const target = await findAndApply(port);
      if (target) return target;
      debug("🔎", "Target Xbox pas encore présente, nouvelle tentative...");
    } catch (err) {
      debug("🔧", `Tentative échouée: ${err.message}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `aucune target Xbox (xbox.com/*/play) trouvée après ${timeoutMs / 1000}s — ` +
      "vérifie qu'OBS tourne avec --remote-debugging-port et que la Browser Source Xbox est ouverte"
  );
}

// Garde une session CDP ouverte en continu sur la target. Se termine (et rend
// la main) dès que la target ferme/recharge (ex: clic "prolonger la
// session"), pour qu'on reparte chercher + réactiver la nouvelle target.
async function runPersistentSession(target, checkIntervalMs) {
  const session = openPersistentCdpSession(target);
  await session.ready;

  let stopped = false;
  session.socket.once("close", () => {
    stopped = true;
  });

  await activateTarget(session.send);
  info("🔗", `Session CDP attachée sur "${target.title}" — connexion maintenue ouverte`);

  while (!stopped) {
    await sleep(checkIntervalMs);
    if (stopped) break;
    try {
      const state = await readFocusState(session.send);
      if (state) {
        debug(
          "🔬",
          `État page: hasFocus=${state.hasFocus} userActivation.isActive=${state.userActivation.isActive}`
        );
      }
    } catch (err) {
      warn("⚠️", `Vérification échouée: ${err.message}`);
      break;
    }
  }

  session.close();
  warn("🔌", "Session CDP fermée (target fermée/rechargée) — recherche d'une nouvelle target...");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  info("🎮", `Recherche de la Browser Source Xbox sur localhost:${args.port} (timeout ${args.timeoutMs / 1000}s)...`);

  let target;
  try {
    target = await waitForFirstSuccess(args.port, args.timeoutMs);
  } catch (err) {
    error("❌", err.message);
    process.exit(1);
  }

  success("✅", `Focus emulation activé sur "${target.title}" (${target.url})`);

  if (args.watch) {
    while (true) {
      await runPersistentSession(target, args.intervalMs);
      try {
        target = await waitForFirstSuccess(args.port, args.timeoutMs);
      } catch (err) {
        error("❌", err.message);
        process.exit(1);
      }
    }
  } else {
    process.exit(0);
  }
}

main();
