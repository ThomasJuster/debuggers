// @ts-check
import path from 'path'
import cp from 'child_process'

const escapeBashString = (string) => `"${string.replace(/([\$"])/g, '\\$1')}"`
// const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Call script
 * @param {string} code
 * @param {?string} fileName
 * @param {?import('./src/logger').LoggerLevel} logLevel
 * @returns {Promise<string>} rawJSON
 */
export async function callScript(code, fileName, logLevel = 'off') {
  const fileExtension = path.extname(fileName)
  const docker = dockerRunConfigs[fileExtension]
  if (!docker) throw new Error(`Unknown extension "${fileExtension}". Accepted: "${Object.keys(dockerRunConfigs).join('", "')}"`)

  const command = [
    'docker', 'run',
    '-it',
    '--rm',
    '--env',
    `LOG_LEVEL=${logLevel}`,
    docker.image,
    // code,
    // fileName,
    code && escapeBashString(code),
    fileName && escapeBashString(fileName),
  ].filter(Boolean)

  const json = new Promise((resolve, reject) => {
    process.on('error', (error) => {
      console.error('process error:', error)
      reject(error)
    })

    const begin = 'RESULT_BEGIN'
    const end = 'RESULT_END'
    let raw = ''
    const onData = (data) => {
      let message = data.toString('utf-8')
      if (message.includes(begin)) {
        message = message.slice(message.indexOf(begin) + begin.length)
        if (!message.includes(end)) raw += message
      }
      if (message.includes(end)) {
        message = message.slice(0, message.indexOf(end))
        resolve((raw + message).trim())
        process.stdout.off('data', onData)
      }
    }
    process.stdout.on('data', onData)
  })

  console.info('command', command.join(' '))
  cp.execSync(command.join(' '), { stdio: 'inherit' })
  // const subprocess = cp.spawn(command[0], command.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] })

  // if (logLevel === 'debug') subprocess.stdout.on('data', (data) => process.stdout.write(data))
  // if (logLevel === 'debug') subprocess.stderr.on('data', (data) => process.stderr.write(data))
  
  const rawJSON = await json
  return rawJSON
}

/**
 * @typedef {'lldb-debugger' | 'php-debugger' | 'python-debugger'} DockerImage
 */

/**
 * @typedef DockerRunConfig
 * @property {DockerImage} image
 * @property {boolean} [privileged]
 */

/** @type {Record<import('./src/StepsRunner/factory').LanguageExtension, DockerRunConfig>} */
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
  '.py': {
    image: 'python-debugger',
  }
}
