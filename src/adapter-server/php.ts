// @ts-check
import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import { Configuration } from '../configurations'
import { logger } from '../logger'

const launcherFileDir = path.resolve(process.cwd(), './vscode-php-debug/out')
const launcherFile = 'phpDebug.js'

export const startPHPAdapterServer: Configuration['startAdapterServer'] = async () => {
  const host = 'localhost'
  const port = 4711

  logger.debug('Start PHP DAP Server on port', port)

  return new Promise((resolve, reject) => {
    let childProcess!: ChildProcess
    childProcess = spawn('node', [
        launcherFile,
        `--server=${port}`,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: launcherFileDir,
        detached: true,
      },
    )
    childProcess.on('message', () => {
      logger.debug('Message')
    })
    const resolveOnMessage = (origin: string) => (data: any) => {
      logger.debug(`DAP server ready (${origin})`)
      const message = data.toString('utf8')
      if (message.startsWith('waiting for debug')) resolve({ adapter: childProcess, host, port })
    }
    childProcess?.stdout?.once('data', resolveOnMessage('stderr'))
    childProcess?.stderr?.once('data', resolveOnMessage('stderr'))
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
