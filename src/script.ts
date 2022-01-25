// @ts-check
import path from 'path'
import { logger } from './logger'
import { DebugClient } from './DebugClient'
import { languageByExtension, toLanguageExtension } from './configurations'

logger.debug('process args', process.argv.slice(2))

const [code, fileName] = process.argv.slice(-2)
if (!code) {
  logger.error(new Error('This program needs a code to debug'))
  process.exit(1)
}

const fileExtension = path.extname(fileName)
const language = languageByExtension[toLanguageExtension(fileExtension)]
if (!language) {
  logger.error(new Error(`Unreckognized file extension: "${fileExtension}". Accepted: "${Object.keys(languageByExtension).join('", "')}"`))
  process.exit(1)
}

let client!: DebugClient
async function main() {
  logger.debug({ language, fileName, code })
  client = new DebugClient({
    language,
    logLevel: 'Off', // logger.level === 'debug' ? 'On' : 'Off',
    code,
    fileName,
  })
  await client.runSteps()
  const result = {
    demo: 'toto',
    etc: true,
  }
  logger.result(JSON.stringify(result, null, 2))
}

const cleanExit = (origin: string) => async () => {
  logger.debug(`\nCleaning up (${origin})…`)
  if (client) await client.disconnect('cleanExit()')
}

process.on('SIGINT', cleanExit('SIGINT'));
process.on('SIGTERM', cleanExit('SIGTERM'));

main()
  .then(cleanExit('main'))
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
