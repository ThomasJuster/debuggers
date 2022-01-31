import cp from 'child_process'
import { SocketDebugClient } from 'node-debugprotocol-client'
import path from 'path'
import { DebugProtocol } from 'vscode-debugprotocol'
import { logger } from '../logger'
import { makeRunner, MakeRunnerParams } from './runner'

export const runStepsWithPHPDebugger = makeRunner({
  connect: (params) => connect(params),
})

const connect: MakeRunnerParams['connect'] = async ({ logLevel, processes, programPath, beforeInitialize, subscribers }) => {
  const language = 'PHP'
  const dap = {
    host: 'localhost',
    port: 4711,
  }

  logger.debug(1, '[PHP StepsRunner] start adapter server')
    await spawnAdapterServer(dap, processes)
    
    logger.debug(2, '[PHP StepsRunner] instantiate SocketDebugClient')
    const client = new SocketDebugClient({
      host: dap.host,
      port: dap.port,
      loggerName: `${language} debug adapter client`,
      logLevel,
    })

    logger.debug(3, '[PHP StepsRunner] register events')
    beforeInitialize(client)
    
    logger.debug(4, '[PHP StepsRunner] connect adapter')
    await client.connectAdapter()
    
    logger.debug(5, '[PHP StepsRunner] initialize client')
    await client.initialize({
      adapterID: language,
      pathFormat: 'path',
    })

    logger.debug(6, '[PHP StepsRunner] launch client')
    await client.launch({
      program: programPath,
      runtimeArgs: ['-dxdebug.mode=debug', '-dxdebug.start_with_request=1'],
    } as DebugProtocol.LaunchRequestArguments)

    return { client }
}

async function spawnAdapterServer(dap: { host: string, port: number }, processes: cp.ChildProcess[]): Promise<void> {
  logger.debug('Start PHP DAP Server on port', dap.port)
  const launcherFileDir = path.resolve(process.cwd(), './vscode-php-debug/out')
  const launcherFile = 'phpDebug.js'

  return new Promise((resolve, reject) => {
    const subprocess = cp.spawn('node', [
        launcherFile,
        `--server=${dap.port}`,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: launcherFileDir,
        detached: true,
      },
    )
    processes.push(subprocess)

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
