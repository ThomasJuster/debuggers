import { SocketDebugClient, Unsubscribable } from 'node-debugprotocol-client'
import fs from 'fs'
import path from 'path'
import cp from 'child_process'
import { logger } from '../logger'
import { DebugProtocol } from 'vscode-debugprotocol'

type Steps = StepSnapshot[]
export interface StepSnapshot {
  stackFrames: StackFrame[]
}
export interface StackFrame extends DebugProtocol.StackFrame {
  scopes: Scope[]
}
export interface Scope extends DebugProtocol.Scope {
  variables: Variable[]
}
export interface Variable extends DebugProtocol.Variable {
  variables: Variable[]
}

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
  protected capabilities?: DebugProtocol.Capabilities
  
  private stepsAcc: Steps = []
  private resolveSteps: () => void = () => {}
  private steps = new Promise<Steps>((resolve) => {
    this.resolveSteps = () => resolve(this.stepsAcc)
  })

  constructor(protected options: StepsRunnerOptions) {}

  protected abstract connect(): Promise<void>
  protected abstract afterDestroy(): Promise<void>
  protected canDigVariable(variable: DebugProtocol.Variable): boolean {
    return true
  }
  protected canDigScope(scope: DebugProtocol.Scope): boolean {
    return true
  }

  async runSteps(): Promise<Steps> {
    await this.beforeConnect()
    await this.connect()
    if (!this.client) throw new Error('Client must be defined after connect hook')

    const subscriber = this.client.onStopped(async (stoppedEvent) => {
      logger.debug('[Event] Stopped', stoppedEvent);
      const reasons = ['breakpoint', 'step']
      if (!reasons.includes(stoppedEvent.reason) || typeof stoppedEvent.threadId !== 'number') return
      this.setSnapshotAndStepIn(stoppedEvent.threadId)
    })
    this.subscribers.push(subscriber)

    await this.setBreakpoints()

    logger.debug('Configuration Done')
    // send 'configuration done' (in some debuggers this will trigger 'continue' if attach was awaited)
    await this.client.configurationDone({})

    const result = await this.steps
    const filtered = result.map((snapshot) => ({
      ...snapshot,
      stackFrames: snapshot.stackFrames.filter((frame) => frame.source?.path === this.programPath),
    })).filter(({ stackFrames }) => stackFrames.length > 0)
    logger.dir({ steps: filtered }, { colors: true, depth: 20 })

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

  private async setSnapshotAndStepIn(threadId: number): Promise<void> {
    const i = this.stepsAcc.length
    try {
      logger.debug('Execute steps', i)
      const snapshot = await this.getSnapshot(threadId)
      logger.dir({ snapshot }, { colors: true, depth: 10 })
      this.stepsAcc.push(snapshot)
      logger.debug('StepIn', i, this.stepsAcc[i-1]?.stackFrames[0].source ?? '')
      logger.debug('Source', i, { sourcePath: snapshot.stackFrames[0].source?.path, programPath: this.programPath })
      snapshot.stackFrames[0].source?.path === this.programPath
        ? await this.client.stepIn({ threadId, granularity: 'instruction' })
        : await this.client.stepOut({ threadId, granularity: 'instruction' })
    } catch (error) {
      logger.debug('Failed at step', i, error)
    }
  }

  private async getSnapshot(threadId: number): Promise<StepSnapshot> {
    const result = await this.client.stackTrace({ threadId });
    const stackFrames = await Promise.all(result.stackFrames.map((stackFrame) => this.getStackFrame(stackFrame)))
    return { stackFrames }
  }

  private async getStackFrame(stackFrame: DebugProtocol.StackFrame): Promise<StackFrame> {
    const result = await this.client.scopes({ frameId: stackFrame.id })
    const scopes = await Promise.all(result.scopes.map((scope) => this.getScope(scope)))
    return { ...stackFrame, scopes }
  }

  private async getScope(scope: DebugProtocol.Scope): Promise<Scope> {
    if (!this.canDigScope(scope)) return { ...scope, variables: [] }
    const result = await this.client.variables({ variablesReference: scope.variablesReference })
    const isLocalScope = scope.name.startsWith('Local')
    const variablesMaxDepth = isLocalScope ? 3 : 0
    // logger.dir({ scope, result })
    const variables = await Promise.all(result.variables.map((variable) => this.getVariable(variable, variablesMaxDepth)))
    return { ...scope, variables }
  }

  private async getVariable(variable: DebugProtocol.Variable, maxDepth: number, currentDepth = 0): Promise<Variable> {
    const shouldGetSubVariables = variable.variablesReference > 0 && currentDepth <= maxDepth && this.canDigVariable(variable)
    if (!shouldGetSubVariables) return { ...variable, variables: [] }
    try {
      const result = await this.client.variables({ variablesReference: variable.variablesReference })
      const variables = await Promise.all(result.variables.map((variable) => this.getVariable(variable, maxDepth, currentDepth + 1)))
      return { ...variable, variables }
    } catch (error) {
      logger.dir({ variable, error })
      return { ...variable, variables: [] }
    }
  }

  protected registerEvents(): void {
    this.client.onContinued((event) => logger.debug('[Event] Continued', event))
    // this.client.onCapabilities((event) => logger.dir({ event }))
    this.client.onExited((event) => {
      logger.debug('[Event] Exited', event.exitCode)
      if (event.exitCode === 0) this.resolveSteps()
    })
    // this.client.onInvalidated((event) => logger.debug('[Event] Invalidated', event))
    // this.client.onInitialized((event) => logger.debug('[Event] Initialized', event))
    // this.client.onLoadedSource((event) => logger.debug('[Event] LoadedSource', event))
    // this.client.onMemory((event) => logger.debug('[Event] Memory', event))
    // this.client.onModule((event) => logger.debug('[Event] Module', event))
    this.client.onOutput(({ output, ...event }) => logger.debug('[Event] Output', JSON.stringify(output), event))
    this.client.onTerminated(async (event) => {
      logger.debug('[Event] Terminated − resolve steps', event ?? '')
      this.resolveSteps()
      this.client.disconnectAdapter();
    });
  
    this.client.onThread((thread) => {
      logger.debug('[Event] Thread', thread)
    })
  }

  private async setBreakpoints(): Promise<void> {
    const lines = this.options.main.code.split('\n').length

    logger.debug('[StepsRunner] set breakpoints')
    let response = await this.client.setBreakpoints({
      breakpoints: Array.from({ length: lines }, (_, i) => ({ line: i + 1 })),
      source: {
        path: this.programPath
      }
    })
    logger.debug('[StepsRunner] set breakpoints intermediate response', response)

    const verifiedBreakpoints = response.breakpoints
      .filter((breakpoint) => breakpoint.verified && typeof breakpoint.line === 'number')
      .map(({ line }) => ({ line: line as number }))

    if (verifiedBreakpoints.length === lines) return

    response = await this.client.setBreakpoints({
      breakpoints: verifiedBreakpoints,
      source: { path: this.programPath },
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
