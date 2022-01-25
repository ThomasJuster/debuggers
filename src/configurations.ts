import path from 'path'
import { ChildProcess, execSync } from 'child_process'
import { DebugProtocol } from 'vscode-debugprotocol'
import { startPHPAdapterServer } from './adapter-server/php'
import { startLLDBAdapterServer } from './adapter-server/lldb'

export type Language = 'C++' | 'C' | 'PHP'
export type LanguageExtension = '.c' | '.cpp' | '.php'
export const toLanguageExtension = (value: string): LanguageExtension => {
  if (languageByExtension.hasOwnProperty(value)) return value as LanguageExtension
  throw new Error(`Unknown extension "${value}". Expected one of "${Object.keys(languageByExtension).join('", "')}"`)
}

export const languageByExtension: Record<LanguageExtension, Language> = {
  '.c': 'C',
  '.cpp': 'C++',
  '.php': 'PHP',
}
export interface Configuration {
  compile?: (inputPath: string) => Promise<{ outputPath: string }>
  startAdapterServer: () => Promise<{ adapter: ChildProcess, host: string, port: number }>
  launch: (programPath: string) => DebugProtocol.LaunchRequestArguments,
}

const removeExt = (filePath: string) => filePath.slice(0, -path.extname(filePath).length)

export const configurations: Record<Language, Configuration> = {
  PHP: {
    startAdapterServer: startPHPAdapterServer,
    launch: (programPath) => ({
      program: programPath,
      runtimeArgs: ['-dxdebug.mode=debug', '-dxdebug.start_with_request=1'],
    } as DebugProtocol.LaunchRequestArguments),
  },
  C: {
    compile: async (inputPath) => {
      // execSync(disableASLRCommand(), { stdio: 'inherit' })
      const outputPath = removeExt(inputPath)
      execSync(`gcc -g ${inputPath} -o ${outputPath}`, { stdio: 'inherit' })
      return { outputPath }
    },
    startAdapterServer: startLLDBAdapterServer,
    launch: (programPath) => ({
      program: programPath,
      initCommands: ['settings set target.disable-aslr false']
    } as DebugProtocol.LaunchRequestArguments)
  },
  'C++': {
    compile: async (inputPath) => {
      const outputPath = removeExt(inputPath)
      execSync(`g++ -g ${inputPath} -o ${outputPath}`, { stdio: 'inherit' })
      return { outputPath }
    },
    startAdapterServer: startLLDBAdapterServer,
    launch: (programPath) => ({
      program: programPath,
    } as DebugProtocol.LaunchRequestArguments)
  },
}

// const disableASLRCommand = () => 'sysctl -w kernel.randomize_va_space=0'
// const disableASLRCommand = () => 'echo 0 | tee /proc/sys/kernel/randomize_va_space'
