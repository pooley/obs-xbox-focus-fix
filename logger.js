import chalk from "chalk";

// 🎯 Niveaux de log
const LOG_LEVELS = {
  DEBUG: 0,
  PLAIN: 1,
  INFO: 2,
  WARN: 3,
  SUCCESS: 4,
  ERROR: 5,
};

// 🔧 Niveau minimum à afficher
const CURRENT_LOG_LEVEL = LOG_LEVELS.DEBUG;

// 🧠 Logger principal avec couleurs
const log = (level, emoji, msg, data) => {
  if (level < CURRENT_LOG_LEVEL) return;

  const timestamp = chalk.gray(new Date().toLocaleTimeString());
  const levelStr = Object.keys(LOG_LEVELS).find((k) => LOG_LEVELS[k] === level);

  // 🎨 Couleurs selon niveau
  const color =
    {
      DEBUG: chalk.dim,
      PLAIN: chalk.white,
      INFO: chalk.blueBright,
      WARN: chalk.yellow.bold,
      ERROR: chalk.red.bold,
      SUCCESS: chalk.green.bold,
    }[levelStr] || chalk.white;

  console.log(`${timestamp} ${color(`[${levelStr}] ${emoji} ${msg}`)} `);

  if (data !== undefined) {
    try {
      const formatted =
        typeof data === "string" ? data : JSON.stringify(data, null, 2);
      console.log(chalk.gray("   ↳ ") + chalk.blueBright(formatted));
    } catch {
      console.log(chalk.gray("   ↳ ") + chalk.red("(data non sérialisable)"));
    }
  }
};

// 🚀 Raccourcis par niveau
export const debug = (emoji, msg, data) =>
  log(LOG_LEVELS.DEBUG, emoji, msg, data);
export const plain = (emoji, msg, data) =>
  log(LOG_LEVELS.PLAIN, emoji, msg, data);
export const info = (emoji, msg, data) =>
  log(LOG_LEVELS.INFO, emoji, msg, data);
export const warn = (emoji, msg, data) =>
  log(LOG_LEVELS.WARN, emoji, msg, data);
export const error = (emoji, msg, data) =>
  log(LOG_LEVELS.ERROR, emoji, msg, data);
export const success = (emoji, msg, data) =>
  log(LOG_LEVELS.SUCCESS, emoji, msg, data);