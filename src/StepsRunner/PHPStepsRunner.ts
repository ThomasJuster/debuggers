import cp from 'child_process'
import { LogLevel, SocketDebugClient } from 'node-debugprotocol-client'
import path from 'path'
import { DebugProtocol } from 'vscode-debugprotocol'
import { logger } from '../logger'
import { StepsRunner } from './StepsRunner'

export class PHPStepsRunner extends StepsRunner {
  private language = 'PHP'
  private dap = {
    host: 'localhost',
    port: 4711,
  }

  protected async connect(): Promise<void> {
    logger.debug(1, '[PHP StepsRunner] start adapter server')
    await this.startAdapterServer()
    
    logger.debug(2, '[PHP StepsRunner] instantiate SocketDebugClient')
    this.client = new SocketDebugClient({
      host: this.dap.host,
      port: this.dap.port,
      loggerName: `${this.language} debug adapter client`,
      logLevel: LogLevel[this.options.logLevel ?? 'Off'],
    })

    logger.debug(3, '[PHP StepsRunner] register events')
    this.registerEvents()
    
    logger.debug(4, '[PHP StepsRunner] connect adapter')
    await this.client.connectAdapter()
    
    logger.debug(5, '[PHP StepsRunner] initialize client')
    await this.client.initialize({
      adapterID: this.language,
      pathFormat: 'path',
    })

    logger.debug(6, '[PHP StepsRunner] launch client')
    await this.client.launch({
      program: this.programPath,
      runtimeArgs: ['-dxdebug.mode=debug', '-dxdebug.start_with_request=1'],
    } as DebugProtocol.LaunchRequestArguments)
  }

  protected async afterDestroy(): Promise<void> {
    // silence is golden.
  }

  private async startAdapterServer(): Promise<void> {
    logger.debug('Start PHP DAP Server on port', this.dap.port)
    const launcherFileDir = path.resolve(process.cwd(), './vscode-php-debug/out')
    const launcherFile = 'phpDebug.js'

    return new Promise((resolve, reject) => {
      const subprocess = cp.spawn('node', [
          launcherFile,
          `--server=${this.dap.port}`,
        ], {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: launcherFileDir,
          detached: true,
        },
      )
      this.processes.push(subprocess)

      subprocess.on('message', () => {
        logger.debug('Message')
      })
      const resolveOnMessage = (origin: string) => (data: any) => {
        logger.debug(`DAP server ready (${origin})`)
        const message = data.toString('utf8')
        if (message.startsWith('waiting for debug')) resolve()
      }
      subprocess?.stdout?.once('data', resolveOnMessage('stderr'))
      subprocess?.stderr?.once('data', resolveOnMessage('stderr'))
      if (logger.level === 'debug') subprocess?.stdout?.on('data', (data) => process.stdout.write(data))
      if (logger.level === 'debug') subprocess?.stderr?.on('data', (data) => process.stderr.write(data))
      subprocess.on('error', (error) => {
        reject(error)
        logger.error(error)
        subprocess?.kill(1)
      })
      subprocess.on('exit', (exitCode) => {
        logger.debug('Exited with code', exitCode)
      })
    })
  }
}
