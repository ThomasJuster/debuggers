import cp from 'child_process'
import path from 'path'
import { Readable } from 'stream';
import { Configuration } from '../configurations'
import { logger } from '../logger'

const root = path.join(process.cwd(), 'vscode-lldb')
export const startLLDBAdapterServer: Configuration['startAdapterServer'] = async () => {
  const port = 4711
  const host = 'localhost'
  const liblldb = path.join(root, './lldb/lib/liblldb.so')
  logger.debug('Start LLDB DAP Server on port', port)

  const executable = path.join(root, 'adapter/codelldb');
  const args = ['--liblldb', liblldb, '--port', port.toString()];

  const adapter = await new Promise<cp.ChildProcess>((resolve) => {
    const adapter = cp.spawn(executable, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: root,
    })
    const resolveOnMessage = (origin: string) => (data: any) => {
      const message = data.toString('utf-8')
      logger.debug(`DAP server ready (${origin})`, message)
      if (message.startsWith('Listening on port')) resolve(adapter)
    }
    adapter.stdout.once('data', resolveOnMessage('stdout'))
    adapter.stderr.once('data', resolveOnMessage('stderr'))
    if (logger.level === 'debug') adapter.stdout.on('data', (data) => process.stdout.write(data))
    if (logger.level === 'debug') adapter.stderr.on('data', (data) => process.stderr.write(data))
  })

  return { host, port, adapter }
}
