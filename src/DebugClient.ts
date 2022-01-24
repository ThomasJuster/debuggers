import fs from 'fs'
import path from 'path'
import { ChildProcess } from 'child_process'
import { LogLevel, SocketDebugClient, Unsubscribable } from 'node-debugprotocol-client'
import { configurations, Language } from './configurations'
import { logger } from './logger'

type Steps = unknown
type Snapshot = unknown
export interface DebugClient {
  new (options: DebugClientOptions): void
  disconnect(): Promise<void>
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
  private adapterServerProcess?: ChildProcess
  private programPath = path.resolve(process.cwd(), 'programs', this.options.fileName)

  constructor(private options: DebugClientOptions) {}

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

    const result = await promise

    await this.disconnect()
    return result
  }

  async disconnect(): Promise<void> {
    this.stoppedListener?.unsubscribe()

    logger.debug('\n')
    logger.debug('-- Disconnect Debug Client --')
    
    logger.debug('[FS] Remove temporary file')
    fs.unlinkSync(this.programPath)

    if (this.client) {
      logger.debug('[DAP Client] Disconnect')
      try {
        this.client.disconnectAdapter()
        await this.client.disconnect({ })
      } catch {/* throws when already disconnected */}
    }

    if (this.adapterServerProcess) {
      logger.debug('[DAP Server] Stop')
      this.adapterServerProcess.kill()
    }
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
    const localsScope = scopes.find((scope) => scope.name === 'Locals')
    if (!localsScope) return {}

    const { variables } = await this.client.variables({ variablesReference: localsScope.variablesReference })
    logger.dir({ variables })

    return {}
  }

  private async connect(): Promise<void> {
    logger.debug('Create file')
    await fs.promises.writeFile(this.programPath, this.options.code, 'utf-8')
    
    logger.debug('Start Adapter Server')
    const { host, port, childProcess } = await this.config.startAdapterServer()
    
    this.adapterServerProcess = childProcess
    this.client = new SocketDebugClient({
      host,
      port,
      loggerName: `${this.options.language} debug adapter client`,
      logLevel: LogLevel[this.options.logLevel ?? 'Off'],
    })
    
    logger.debug('Connect Adapter')
    // connect
    await this.client.connectAdapter();

    logger.debug('Initialize Client')
    // initialize first
    await this.client.initialize({
      adapterID: this.options.language,
      pathFormat: 'path',
    })

    this.client.onTerminated(async (event) => {
      logger.debug('[Event] Terminated')
      this.client.disconnectAdapter();
    });
  
    this.client.onThread((thread) => {
      logger.debug('[Event] Thread')
      logger.dir({ thread })
    })

    logger.debug('Launch Client')
    await this.client.launch(this.config.launch(this.programPath))

    const breakpoints = this.options.code.split('\n').map((_, index) => ({ line: index + 1 }))
    logger.dir({ breakpoints })

    await this.client.setBreakpoints({
      breakpoints,
      source: {
        path: this.programPath
      }
    })
  }
}
