import cp from 'child_process'
import { LogLevel, SocketDebugClient } from 'node-debugprotocol-client'
import fs from 'fs'
import path from 'path'
import { DebugProtocol } from 'vscode-debugprotocol'
import { logger } from '../logger'
import { MakeRunnerParams, makeRunner, RunnerOptions } from './runner'


export const runStepsWithJDB = (options: RunnerOptions) => {
  let executablePath: string | null = null
  const runner = makeRunner({
    connect: connect((exe) => executablePath = exe),
    canDigScope: (scope) => {
      return true
    },
    afterDestroy: async () => {
      logger.debug('[JDB StepsRunner] remove executable file')
      if (executablePath) await fs.promises.unlink(executablePath).catch(() => {/* throws if already deleted */})
    },
  })
  return runner(options)
}

const connect = (onExecutablePath: (thePath: string) => void): MakeRunnerParams['connect'] => async ({ beforeInitialize, logLevel, processes, programPath }) => {
  const language = 'Java'
  const dap = {
    host: 'localhost',
    port: 4711,
  }

  logger.debug(1, '[JDB StepsRunner] start adapter server')
  await spawnAdapterServer(dap, processes)
  
  logger.debug(2, '[JDB StepsRunner] instantiate SocketDebugClient')
  const client = new SocketDebugClient({
    host: dap.host,
    port: dap.port,
    loggerName: `${language} debug adapter client`,
    logLevel,
  })

  logger.debug(3, '[JDB StepsRunner] register events')
  beforeInitialize(client)
  
  logger.debug(4, '[JDB StepsRunner] connect adapter')
  await client.connectAdapter()
  
  logger.debug(5, '[JDB StepsRunner] initialize client')
  await client.initialize({
    adapterID: language,
    pathFormat: 'path',
  })

  const executablePath = compile(programPath)
  onExecutablePath(executablePath)

  const spawnedTerminalRequest = new Promise<void>((resolve, reject) => {
    client.onRunInTerminalRequest(async ({ args: [argv, ...args], cwd, env, kind, title }) => {
      logger.debug('[Event] RunInTerminalRequest', { argv, args, cwd, kind, title })
      const subprocess = cp.spawn(argv, args, {
        stdio: 'inherit',
        env: { ...env, RUST_BACKTRACE: 'full' },
        shell: true,
      })
      processes.push(subprocess)
      subprocess.on('error', (error) => {
        logger.error(error)
        reject(error)
      })
      // resolve()
      logger.debug(7, '[JDB StepsRunner] ran requested command in terminal')
      setTimeout(resolve, 1)
      // subprocess.stdout.on('data', (data) => logger.debug('[stdout]', data.toString('utf-8')))
      // subprocess.stderr.on('data', (data) => logger.debug('[stderr]', data.toString('utf-8')))
      return { processId: subprocess.pid, shellProcessId: process.pid }
    })
  })

  logger.debug(6, '[JDB StepsRunner] launch client')
  const launched = client.launch({
    program: executablePath,
    // mainClass: ?
  } as DebugProtocol.LaunchRequestArguments)

  await Promise.race([ launched, spawnedTerminalRequest ])

  return { client }
}

async function spawnAdapterServer(dap: { host: string, port: number }, processes: cp.ChildProcess[]): Promise<void> {
  logger.debug('Start JDB DAP Server on port', dap.port)

  await new Promise<void>((resolve) => {
    const adapter = cp.spawn('jdb', ['-listen', dap.port.toString()], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    processes.push(adapter)
    const resolveOnMessage = (origin: string) => (data: any) => {
      const message = data.toString('utf-8')
      if (message.startsWith('Listening at address')) {
        logger.debug(`DAP server ready (${origin})`, message)
        resolve()
      }
    }
    adapter.stdout.once('data', resolveOnMessage('stdout'))
    adapter.stderr.once('data', resolveOnMessage('stderr'))
    if (logger.level === 'debug') adapter.stdout.on('data', (data) => process.stdout.write(data))
    if (logger.level === 'debug') adapter.stderr.on('data', (data) => process.stderr.write(data))
  })
}

const compile = (mainFilePath: string): string => {
  const executablePath = `${removeExt(mainFilePath)}.class`
  cp.execSync(`javac ${mainFilePath}`, { stdio: 'inherit' })
  return executablePath
}
const removeExt = (filePath: string) => filePath.slice(0, -path.extname(filePath).length)
