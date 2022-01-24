// @ts-check
import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import { Configuration } from '../configurations'
import { logger } from '../logger'

const launcherFileDir = path.resolve(process.cwd(), './vscode-php-debug/out')
const launcherFile = 'phpDebug.js'

logger.debug({ launcherFile })

export const startPHPAdapterServer: Configuration['startAdapterServer'] = async () => {
  const host = 'localhost'
  const port = 4711

  return new Promise((resolve, reject) => {
    let childProcess!: ChildProcess
    childProcess = spawn('node', [
        launcherFile,
        `--server=${port}`,
      ], {
        stdio: 'pipe',
        cwd: launcherFileDir,
        detached: true,
      },
    )
    childProcess.on('message', () => {
      logger.debug('Message')
    })
    childProcess?.stderr?.once('data', (data) => {
      const message = data.toString('utf8')
      if (message.startsWith('waiting for debug')) resolve({ childProcess, host, port })
    })
    if (logger.level === 'debug') childProcess?.stdout?.on('data', (data) => process.stdout.write(data))
    if (logger.level === 'debug') childProcess?.stderr?.on('data', (data) => process.stderr.write(data))
    childProcess.on('error', (error) => {
      reject(error)
      logger.error(error)
      childProcess?.kill(1)
    })
    childProcess.on('exit', (exitCode) => {
      logger.debug('Exited with code', exitCode)
    })
  })
}
