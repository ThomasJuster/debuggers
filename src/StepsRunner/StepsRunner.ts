import { SocketDebugClient, Unsubscribable } from 'node-debugprotocol-client'
import fs from 'fs'
import path from 'path'
import cp from 'child_process'
import { logger } from '../logger'

type Steps = StepSnapshot[]
type StepSnapshot = unknown

interface File {
  code: string,
  relativePath: string,
}
export interface StepsRunnerOptions {
  main: File
  files: Array<File>
  logLevel?: 'On' | 'Off',
}
export abstract class StepsRunner {
  destroyed = false
  protected client!: SocketDebugClient
  protected processes: cp.ChildProcess[] = []
  protected subscribers: Unsubscribable[] = []
  protected programPath = this.getFilePath(this.options.main.relativePath)

  constructor(protected options: StepsRunnerOptions) {}

  protected abstract connect(): Promise<void>
  protected abstract afterDestroy(): Promise<void>

  async runSteps(): Promise<Steps> {
    await this.beforeConnect()
    await this.connect()
    if (!this.client) throw new Error('Client must be defined after connect hook')

    const steps = new Promise<Steps>((resolve) => {
      const subscriber = this.client.onStopped(async (stoppedEvent) => {
        logger.debug('[Event] Stopped', stoppedEvent);
        if (stoppedEvent.reason !== 'breakpoint' || typeof stoppedEvent.threadId !== 'number') return
        resolve(this.executeSteps(stoppedEvent.threadId))
      })
      this.subscribers.push(subscriber)
    })

    await this.setBreakpoints()

    logger.debug('Configuration Done')
    // send 'configuration done' (in some debuggers this will trigger 'continue' if attach was awaited)
    await this.client.configurationDone({})

    const result = await steps
    await this.destroy('runSteps')

    return result
  }

  async destroy(origin: string): Promise<void> {
    if (this.destroyed) return logger.debug('[StepsRunner] destroy already performed')
    
    logger.debug('\n')
    logger.debug(`[StepsRunner] Destroy ⋅ ${origin}`)
    this.subscribers.forEach((subscriber) => subscriber.unsubscribe())
    this.processes.forEach((subprocess) => {
      if (!subprocess.killed) subprocess.kill()
    })
    this.client.disconnectAdapter()
    await this.client.disconnect({}).catch(() => {/* throws if already disconnected */})
    await this.removeFiles()
    await this.afterDestroy()
    this.destroyed = true
  }

  private async executeSteps(threadId: number): Promise<Steps> {
    const steps = [await this.getSnapshot(threadId)]
    // await this.client.stepIn({ threadId: 12, granularity: 'statement' })
    // steps.push(await this.getSnapshot())
    // await this.client.stepOut({ threadId: 12, granularity: 'statement' })
    return steps
  }

  private async getSnapshot(threadId: number): Promise<StepSnapshot> {
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

  protected registerEvents(): void {
    this.client.onContinued((event) => logger.debug('[Event] Continued', event))
    // this.client.onCapabilities((event) => logger.dir({ event }))
    this.client.onExited((event) => logger.dir({ event }))
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
  }

  private async setBreakpoints(): Promise<void> {
    const breakpoints = this.options.main.code.split('\n').map((_, index) => ({ line: index + 1 }))
    // const breakpoints = [{ line: 1 }]
    // logger.dir({ breakpoints })

    logger.debug('[StepsRunner] set breakpoints')
    const response = await this.client.setBreakpoints({
      breakpoints,
      source: {
        path: this.programPath
      }
    })
    logger.debug('[StepsRunner] set breakpoints response', response)
  }

  private async beforeConnect(): Promise<void> {
    await this.createFiles()
  }

  private async createFiles(): Promise<void> {
    const files = [this.options.main, ...this.options.files]
    await Promise.all(files.map(({ code, relativePath }) => {
      // const fileName = path.basename(relativePath)
      return fs.promises.writeFile(this.getFilePath(relativePath), code, 'utf-8')
    }))
  }

  private async removeFiles(): Promise<void> {
    const files = [this.options.main, ...this.options.files]
    await Promise.all(files.map(({ relativePath }) => {
      fs.promises.unlink(this.getFilePath(relativePath)).catch(() => {/* throws when files already deleted */})
    }))
  }

  private getFilePath(relativePath: string): string {
    return path.resolve(process.cwd(), relativePath)
  }
}
