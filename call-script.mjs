// @ts-check
import path from 'path'
import { execSync } from 'child_process'

const escapeBashString = (string) => `"${string.replace(/([\$"])/g, '\\$1')}"`

/**
 * Call script
 * @param {string} code
 * @param {?string} fileName
 * @param {?import('./src/logger').LoggerLevel} logLevel
 */
export function callScript(code, fileName, logLevel = 'off') {
  const fileExtension = path.extname(fileName)
  const docker = dockerRunConfigs[fileExtension]
  if (!docker) throw new Error(`Unknown extension "${fileExtension}". Accepted: "${Object.keys(dockerRunConfigs).join('", "')}"`)

  const command = [
    'docker run',
    '-it',
    '--rm',
    '--env',
    `LOG_LEVEL=${logLevel}`,
    docker.image,
    code && escapeBashString(code),
    fileName && escapeBashString(fileName),
  ].filter(Boolean).join(' ')
  execSync(command, { stdio: 'inherit' })
}

/**
 * @typedef DockerRunConfig
 * @property {'lldb-debugger' | 'php-debugger'} image
 * @property {boolean} [privileged]
 */

/** @type {Record<import('./src/configurations').LanguageExtension, DockerRunConfig>} */
const dockerRunConfigs = {
  '.c': {
    image: 'lldb-debugger',
  },
  '.cpp': {
    image: 'lldb-debugger',
  },
  '.php': {
    image: 'php-debugger',
  },
}
