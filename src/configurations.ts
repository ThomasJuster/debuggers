import { DebugProtocol } from 'vscode-debugprotocol'
import { ChildProcess } from 'child_process'
import { startPHPAdapterServer } from './adapter-server/php'

export type Language = 'php'
export interface Configuration {
  startAdapterServer: () => Promise<{ childProcess: ChildProcess, host: string, port: number }>
  launch: (programPath: string) => DebugProtocol.LaunchRequestArguments,
}

export const configurations: Record<Language, Configuration> = {
  php: {
    startAdapterServer: startPHPAdapterServer,
    launch: (programPath: string) => ({
      program: programPath,
      runtimeArgs: ['-dxdebug.mode=debug', '-dxdebug.start_with_request=1'],
    } as DebugProtocol.LaunchRequestArguments),
  },
}
