const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
}

function timestamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false })
}

function fmt(color, label, msg) {
  console.log(`${COLORS.dim}${timestamp()}${COLORS.reset} ${color}[${label}]${COLORS.reset} ${msg}`)
}

export const log = {
  req:  (msg) => fmt(COLORS.cyan,    'REQ',  msg),
  res:  (msg) => fmt(COLORS.green,   'RES',  msg),
  tool: (msg) => fmt(COLORS.magenta, 'TOOL', msg),
  loop: (msg) => fmt(COLORS.yellow,  'LOOP', msg),
  err:  (msg) => fmt(COLORS.red,     'ERR',  msg),
}
