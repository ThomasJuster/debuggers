// @ts-check
import { logger } from './logger'
import { DebugClient } from './DebugClient'

logger.debug('process args', process.argv.slice(2))

const [code, fileName] = process.argv.slice(-2)
if (!code) {
  logger.error(new Error('This program needs a code to debug'))
  process.exit(1)
}

let client!: DebugClient
async function main() {
  client = new DebugClient({
    language: 'php',
    logLevel: 'Off',
    code,
    fileName,
  })
  await client.runSteps()
  // await debugPHP(
  //   code,
  //   fileName || 'tmp.php',
  //   LogLevel.Off, // logger.level === 'off' ? LogLevel.Off : LogLevel.Verbose,
  // )
  const result = {
    demo: 'toto',
    etc: true,
  }
  logger.result(JSON.stringify(result, null, 2))
}

const cleanExit = (origin: string) => async () => {
  logger.debug(`\nCleaning up (${origin})…`)
  await client.disconnect()
  process.exit(0)
}

process.on('SIGINT', cleanExit('SIGINT'));
process.on('SIGTERM', cleanExit('SIGTERM'));

main()
  .catch((error) => {
    logger.error('Error:', error)
    return cleanExit('main().catch()')
  })
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
