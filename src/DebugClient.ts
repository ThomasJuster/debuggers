import fs from 'fs'
import path from 'path'
import cp from 'child_process'
import { LogLevel, SocketDebugClient, Unsubscribable } from 'node-debugprotocol-client'
import { configurations, Language } from './configurations'
import { logger } from './logger'

type Steps = unknown
type Snapshot = unknown
export interface DebugClient {
  new (options: DebugClientOptions): void
  disconnect(origin: string): Promise<void>
  runSteps(): Promise<Steps>
}

interface DebugClientOptions {
  code: string,
  fileName: string,
  language: Language,
  logLevel?: 'On' | 'Off',
}

export class DebugClient {
  private client!: SocketDebugClient
  private config = configurations[this.options.language]
  private stoppedListener?: Unsubscribable
  private processes: cp.ChildProcess[] = []
  private programPath = path.resolve(process.cwd(), 'programs', this.options.fileName)
  private executablePath?: string
  private launched?: Promise<unknown>

  constructor(private options: DebugClientOptions) {
    logger.debug({ config: this.config, options: this.options })
  }

  async runSteps(): Promise<Steps> {
    await this.connect()

    const promise = new Promise((resolve, reject) => {
      this.stoppedListener = this.client.onStopped(async (stoppedEvent) => {
        logger.debug('[Event] Stopped', stoppedEvent);
        if (stoppedEvent.reason !== 'breakpoint' || typeof stoppedEvent.threadId !== 'number') return
        resolve(this.executeSteps(stoppedEvent.threadId))
      })
    })

    logger.debug('Configuration Done')
    // send 'configuration done' (in some debuggers this will trigger 'continue' if attach was awaited)
    await this.client.configurationDone({})
    await this.launched

    const result = await promise

    await this.disconnect('runSteps()')
    return result
  }

  async disconnect(origin: string): Promise<void> {
    this.stoppedListener?.unsubscribe()

    logger.debug('\n')
    logger.debug(`-- Disconnect Debug Client (${origin}) --`)
    
    logger.debug('[FS] Remove temporary file')
    try { fs.unlinkSync(this.programPath) } catch {/* throws when already deleted */}
    if (this.executablePath) try { fs.unlinkSync(this.executablePath) } catch {/* throws when already deleted */}

    if (this.client) {
      logger.debug('[DAP Client] Disconnect')
      try {
        this.client.disconnectAdapter()
        await this.client.disconnect({ })
      } catch {/* throws when already disconnected */}
    }

    logger.debug('[DAP Server] Stop')
    this.processes.forEach((subprocess) => subprocess.kill())
  }

  private async executeSteps(threadId: number): Promise<Steps> {
    const steps = [await this.getSnapshot(threadId)]
    // await this.client.stepIn({ threadId: 12, granularity: 'statement' })
    // steps.push(await this.getSnapshot())
    // await this.client.stepOut({ threadId: 12, granularity: 'statement' })
    return steps
  }

  private async getSnapshot(threadId: number): Promise<Snapshot> {
    const { stackFrames } = await this.client.stackTrace({ threadId });
    logger.dir({ stackFrames })

    const { scopes } = await this.client.scopes({ frameId: stackFrames[0].id })
    logger.dir({ scopes })
    const localsScope = scopes.find((scope) => scope.name.startsWith('Local'))
    if (!localsScope) return {}

    const { variables } = await this.client.variables({ variablesReference: localsScope.variablesReference })
    logger.dir({ variables })

    return {}
  }

  private async connect(): Promise<void> {
    logger.debug(1, 'Create file')
    await fs.promises.writeFile(this.programPath, this.options.code, 'utf-8')

    if (this.config.compile) {
      logger.debug('\n\n\n')
      logger.debug('Compile…')
      const compiled = await this.config.compile(this.programPath)
      this.executablePath = compiled.outputPath
      logger.debug('Test executable path', compiled.outputPath)
      cp.execSync(this.executablePath, { stdio: 'inherit' })
      logger.debug('\n\n\n')
    }
    
    logger.debug(2, 'Start Adapter Server')
    const { host, port, adapter } = await this.config.startAdapterServer()
    
    this.processes.push(adapter)
    this.client = new SocketDebugClient({
      host,
      port,
      loggerName: `${this.options.language} debug adapter client`,
      logLevel: LogLevel[this.options.logLevel ?? 'Off'],
    })
    
    logger.debug(3, 'Connect Adapter')
    // connect
    await this.client.connectAdapter();

    this.client.onContinued((event) => logger.debug('[Event] Continued', event))
    // this.client.onCapabilities((event) => logger.dir({ event }))
    // this.client.onExited((event) => logger.dir({ event }))
    // this.client.onInvalidated((event) => logger.debug('[Event] Invalidated', event))
    // this.client.onInitialized((event) => logger.debug('[Event] Initialized', event))
    // this.client.onLoadedSource((event) => logger.debug('[Event] LoadedSource', event))
    // this.client.onMemory((event) => logger.debug('[Event] Memory', event))
    // this.client.onModule((event) => logger.debug('[Event] Module', event))
    this.client.onOutput(({ output, ...event }) => logger.debug('[Event] Output', output, event))
    this.client.onTerminated(async (event) => {
      logger.debug('[Event] Terminated')
      this.client.disconnectAdapter();
    });
  
    this.client.onThread((thread) => {
      logger.debug('[Event] Thread', thread)
    })

    logger.debug(4, 'Initialize Client')
    // initialize first
    await this.client.initialize({
      adapterID: this.options.language,
      pathFormat: 'path',
      supportsRunInTerminalRequest: true,
    })


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
        setTimeout(resolve, 1)
        // subprocess.stdout.on('data', (data) => logger.debug('[stdout]', data.toString('utf-8')))
        // subprocess.stderr.on('data', (data) => logger.debug('[stderr]', data.toString('utf-8')))
        return { processId: subprocess.pid, shellProcessId: process.pid }
      })
    })

    logger.debug(5, 'Launch Client')
    this.launched = this.client.launch(this.config.launch(this.executablePath ?? this.programPath)).catch((error) => {
      logger.error('Launch Error:', error)
      throw error
    })
    this.launched.then((response) => logger.debug('After launch', { response }))
    await Promise.race([this.launched, spawnedTerminalRequest])

    const breakpoints = this.options.code.split('\n').map((_, index) => ({ line: index + 1 }))
    // const breakpoints = [{ line: 1 }]
    logger.dir({ breakpoints })
    logger.debug(6, 'Set Breakpoints')
    const response = await this.client.setBreakpoints({
      breakpoints,
      source: {
        path: this.programPath
      }
    })
    logger.debug('Breakpoints response', response)
  }
}
