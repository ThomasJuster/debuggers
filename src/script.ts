// @ts-check
import path from 'path'
import { logger } from './logger'
import { StepsRunner } from './StepsRunner/StepsRunner'
import { languageByExtension, makeStepsRunner, toLanguageExtension } from './StepsRunner/factory'

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

let runner!: StepsRunner
async function main() {
  logger.debug({ language, fileName, code })
  runner = makeStepsRunner({
    logLevel: 'Off', // logger.level === 'debug' ? 'On' : 'Off',
    main: { code, relativePath: fileName },
    files: [],
  }, language)
  const steps = await runner.runSteps()
  const result = {
    steps,
    demo: 'toto',
    etc: true,
  }
  logger.result(JSON.stringify(result, null, 2))
}

const cleanExit = (origin: string) => async () => {
  logger.debug(`\nCleaning up (${origin})…`)
  if (runner) await runner.destroy('cleanExit')
}

process.on('SIGINT', cleanExit('SIGINT'));
process.on('SIGTERM', cleanExit('SIGTERM'));

main()
  .then(cleanExit('main'))
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
