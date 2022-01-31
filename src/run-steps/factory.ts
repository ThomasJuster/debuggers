import { RunnerOptions, Steps } from './runner'
import { runStepsWithPHPDebugger } from './php-runner'
import { runStepsWithPythonDebugger } from './python-runner'
import { runStepsWithLLDB } from './lldb-runner'

export const runSteps = (language: Language, options: RunnerOptions): Promise<Steps> => {
  switch (language) {
    case 'PHP': return runStepsWithPHPDebugger(options)
    case 'C': return runStepsWithLLDB('C', options)
    case 'C++': return runStepsWithLLDB('C++', options)
    case 'Python': return runStepsWithPythonDebugger(options)
  }
  throw new Error(`Unknown language "${language}". Expected one of "${languages.join('", "')}"`)
}

export type Language = 'C++' | 'C' | 'PHP' | 'Python'
export type LanguageExtension = '.c' | '.cpp' | '.php' | '.py'
export const toLanguageExtension = (value: string): LanguageExtension => {
  if (languageByExtension.hasOwnProperty(value)) return value as LanguageExtension
  throw new Error(`Unknown extension "${value}". Expected one of "${Object.keys(languageByExtension).join('", "')}"`)
}

export const languageByExtension: Record<LanguageExtension, Language> = {
  '.c': 'C',
  '.cpp': 'C++',
  '.php': 'PHP',
  '.py': 'Python',
}
const languages = Object.keys(languageByExtension) as Language[]
