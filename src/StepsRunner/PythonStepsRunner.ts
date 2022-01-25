import cp from 'child_process'
import path from 'path'
import { LogLevel, SocketDebugClient } from 'node-debugprotocol-client'
import { DebugProtocol } from 'vscode-debugprotocol'
import { logger } from '../logger'
import { StepsRunner } from './StepsRunner'

export class PythonStepsRunner extends StepsRunner {
  private language = 'Python'
  private logFilePath = path.resolve(process.cwd(), 'debugpy.log')
  private dap = {
    host: 'localhost',
    port: 4711,
  }
  
  protected async connect(): Promise<void> {
    logger.debug(1, '[Python StepsRunner] start adapter server')
    await this.spawnDebugClient()

    logger.debug(2, '[Python StepsRunner] instantiate SocketDebugClient')
    this.client = new SocketDebugClient({
      host: this.dap.host,
      port: this.dap.port,
      loggerName: `${this.language} debug adapter client`,
      logLevel: LogLevel[this.options.logLevel ?? 'Off'],
    })

    const initialized = new Promise<void>((resolve) => {
      this.client.onInitialized(() => {
        logger.debug('[Python StepsRunner] initialized')
        resolve()
      })
    })

    logger.debug(3, '[Python StepsRunner] register events')
    this.registerEvents()
    
    logger.debug(4, '[Python StepsRunner] connect adapter')
    await this.client.connectAdapter()

    logger.debug(5, '[Python StepsRunner] initialize client')
    await this.client.initialize({
      adapterID: this.language,
      pathFormat: 'path',
    })

    logger.debug(6, '[Python StepsRunner] launch client')
    const launched = this.client.launch({
      program: this.programPath,
    } as DebugProtocol.LaunchRequestArguments)

    launched.then((response) => {
      logger.debug('[Python StepsRunner] launch response', response)
    })

    await Promise.race([launched, initialized])
  }

  protected async afterDestroy(): Promise<void> {
    // silence is golden.
  }

  private async spawnDebugClient(): Promise<void> {
    const debugPyFolderPath = await this.findDebugPyFolder()

    return new Promise<void>((resolve) => {
      const subprocess = cp.spawn('python', [
        path.resolve(debugPyFolderPath, 'adapter'),
        '--host',
        this.dap.host,
        '--port',
        this.dap.port.toString(),
        '--log-stderr',
      ], { stdio: ['ignore', 'pipe', 'pipe'] })
      this.processes.push(subprocess)

      subprocess.on('error', (error) => logger.error('Server error:', error))

      // const logData = (origin: string) => (data: any) => slogger.debug('[debugpy]', `(${origin})`, data.toString('utf-8'))
      // subprocess.stdout.on('data', logData('stdout'))
      // subprocess.stderr.on('data', logData('stderr'))

      subprocess.stderr.on('data', (data: any) => {
        const message = data.toString('utf-8')
        if (message.includes('Listening for incoming Client connections')) {
          logger.debug('[Python StepsRunner] resolve')
          resolve()
        }
      })
    })
  }

  private async findDebugPyFolder(): Promise<string> {
    const found = this.findByName('debugpy').find((folderPath) => folderPath.includes('python')) // take first with "python"
    if (!found) throw new Error('DebugPy folder not found')
    return found
  }
  private findByName(name: string, root = '/'): string[] {
    const output = cp.execSync(`find ${root} -name ${name}`, { stdio: ['ignore', 'pipe', 'ignore'] })
    return output.toString('utf-8').split('\n').slice(0, -1) // last one is empty string, remove it
  }
}
// const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
