// @ts-check
import path from 'path'
import { logger } from './logger'
import { StepsRunner } from './StepsRunner/StepsRunner'
import { languageByExtension, makeStepsRunner, toLanguageExtension } from './StepsRunner/factory'

logger.debug('process args', process.argv.slice(2))

const [mainFilePath] = process.argv.slice(-1)

const fileExtension = path.extname(mainFilePath)
const language = languageByExtension[toLanguageExtension(fileExtension)]
if (!language) {
  logger.error(new Error(`Unreckognized file extension: "${fileExtension}". Accepted: "${Object.keys(languageByExtension).join('", "')}"`))
  process.exit(1)
}

let runner: StepsRunner
async function main() {
  logger.debug({ language, mainFilePath })
  runner = makeStepsRunner(language, {
    // logLevel: 'On',
    logLevel: logger.level === 'debug' ? 'On' : 'Off',
    main: { relativePath: mainFilePath },
    files: [],
  })
  const result = await runner.runSteps()
  logger.result('RESULT_BEGIN', JSON.stringify(result), 'RESULT_END')
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
