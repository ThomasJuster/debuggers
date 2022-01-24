// @ts-check
import { execSync } from 'child_process'

const escapeBashString = (string) => `"${string.replace(/([\$"])/g, '\\$1')}"`

/**
 * Call script
 * @param {string} code
 * @param {?string} fileName
 * @param {?import('./src/logger').LoggerLevel} logLevel
 */
export function callScript(code, fileName, logLevel = 'off') {
  const command = `docker run -it --rm --env LOG_LEVEL=${logLevel} php-debugger ${[code, fileName].filter(Boolean).map(escapeBashString).join(' ')}`
  execSync(command, { stdio: 'inherit' })
}
