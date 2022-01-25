const levels = {
  debug: 'debug',
  off: 'off',
  on: 'on',
  verbose: 'verbose'
} as const
export type LoggerLevel = keyof typeof levels

let level: LoggerLevel = (levels as any)[process.env.LOG_LEVEL as string] || 'off'

export const logger = {
  get level() { return level },
  info: (...args: any[]) => level !== levels.off && console.info(...args),
  log: (...args: any[]) => level !== levels.off && console.log(...args),
  debug: (...args: any[]) => level === levels.debug && console.debug(...args),
  dir: (obj: any, options?: Parameters<typeof console.dir>[1]) => level !== levels.off && console.dir(obj, {
    colors: true,
    depth: 3,
    ...options,
  }),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
  result: (...args: any[]) => console.info(...args),
  setLevel: (newLevel: LoggerLevel) => { level = newLevel },
}
