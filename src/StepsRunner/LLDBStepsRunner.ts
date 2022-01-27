import cp from 'child_process'
import { LogLevel, SocketDebugClient } from 'node-debugprotocol-client'
import fs from 'fs'
import path from 'path'
import { DebugProtocol } from 'vscode-debugprotocol'
import { logger } from '../logger'
import { StepsRunner, StepsRunnerOptions } from './StepsRunner'

type Language = 'C' | 'C++'

export class LLDBStepsRunner extends StepsRunner {
  private executablePath?: string
  private config = configurations[this.language]
  private dap = {
    host: 'localhost',
    port: 4711,
  }

  constructor(protected options: StepsRunnerOptions, private language: Language) {
    super(options)
  }

  protected override canDigScope(scope: DebugProtocol.Scope): boolean {
    // if (this.language === 'C++')
    const forbiddenScopes = ['Registers', 'Static']
    return !forbiddenScopes.includes(scope.name)
  }

  protected async connect(): Promise<void> {
    logger.debug(1, '[LLDB StepsRunner] start adapter server')
    await this.startAdapterServer()
    
    logger.debug(2, '[LLDB StepsRunner] instantiate SocketDebugClient')
    this.client = new SocketDebugClient({
      host: this.dap.host,
      port: this.dap.port,
      loggerName: `${this.language} debug adapter client`,
      // logLevel: LogLevel[this.options.logLevel ?? 'Off'],
      logLevel: LogLevel['Off'],
    })

    logger.debug(3, '[LLDB StepsRunner] register events')
    this.registerEvents()
    
    logger.debug(4, '[LLDB StepsRunner] connect adapter')
    await this.client.connectAdapter()
    
    logger.debug(5, '[LLDB StepsRunner] initialize client')
    await this.client.initialize({
      adapterID: this.language,
      pathFormat: 'path',
    })

    this.executablePath = this.config.compile(this.programPath).executablePath

    const spawnedTerminalRequest = new Promise<void>((resolve, reject) => {
      this.client.onRunInTerminalRequest(async ({ args: [argv, ...args], cwd, env, kind, title }) => {
        logger.debug('[Event] RunInTerminalRequest', { argv, args, cwd, kind, title })
        const subprocess = cp.spawn(argv, args, {
          stdio: 'inherit',
          env: { ...env, RUST_BACKTRACE: 'full' },
          shell: true,
        })
        this.processes.push(subprocess)
        subprocess.on('error', (error) => {
          logger.error(error)
          reject(error)
        })
        // resolve()
        logger.debug(7, '[LLDB StepsRunner] ran requested command in terminal')
        setTimeout(resolve, 1)
        // subprocess.stdout.on('data', (data) => logger.debug('[stdout]', data.toString('utf-8')))
        // subprocess.stderr.on('data', (data) => logger.debug('[stderr]', data.toString('utf-8')))
        return { processId: subprocess.pid, shellProcessId: process.pid }
      })
    })

    logger.debug(6, '[LLDB StepsRunner] launch client')
    const launched = this.client.launch({
      program: this.executablePath,
      ...this.config.launchArgs,
    } as DebugProtocol.LaunchRequestArguments)

    await Promise.race([ launched, spawnedTerminalRequest ])
  }

  protected async afterDestroy(): Promise<void> {
    logger.debug('[LLDB StepsRunner] remove executable file')
    if (this.executablePath) await fs.promises.unlink(this.executablePath).catch(() => {/* throws if already deleted */})
  }

  private async startAdapterServer(): Promise<void> {
    logger.debug('Start LLDB DAP Server on port', this.dap.port)

    const root = path.join(process.cwd(), 'vscode-lldb')
    const liblldb = path.join(root, './lldb/lib/liblldb.so')
    logger.debug('Start LLDB DAP Server on port', this.dap.port)

    const executable = path.join(root, 'adapter/codelldb');
    const args = ['--liblldb', liblldb, '--port', this.dap.port.toString()];

    await new Promise<void>((resolve) => {
      const adapter = cp.spawn(executable, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: root,
      })
      this.processes.push(adapter)
      const resolveOnMessage = (origin: string) => (data: any) => {
        const message = data.toString('utf-8')
        logger.debug(`DAP server ready (${origin})`, message)
        if (message.startsWith('Listening on port')) resolve()
      }
      adapter.stdout.once('data', resolveOnMessage('stdout'))
      adapter.stderr.once('data', resolveOnMessage('stderr'))
      if (logger.level === 'debug') adapter.stdout.on('data', (data) => process.stdout.write(data))
      if (logger.level === 'debug') adapter.stderr.on('data', (data) => process.stderr.write(data))
    })
  }

}

interface Configuration {
  compile: (mainFilePath: string) => { executablePath: string },
  launchArgs?: DebugProtocol.LaunchRequestArguments
}
const configurations: Record<Language, Configuration> = {
  C: {
    compile: (mainFilePath) => {
      // execSync(disableASLRCommand(), { stdio: 'inherit' })
      const executablePath = removeExt(mainFilePath)
      cp.execSync(`gcc -g ${mainFilePath} -o ${executablePath}`, { stdio: 'inherit' })
      return { executablePath }
    },
    launchArgs: {
      initCommands: ['settings set target.disable-aslr false']
    } as DebugProtocol.LaunchRequestArguments
  },
  'C++': {
    compile: (mainFilePath) => {
      const executablePath = removeExt(mainFilePath)
      cp.execSync(`g++ -g ${mainFilePath} -o ${executablePath}`, { stdio: 'inherit' })
      return { executablePath }
    },
  },
}
const removeExt = (filePath: string) => filePath.slice(0, -path.extname(filePath).length)
