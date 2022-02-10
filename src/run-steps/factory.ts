import { RunnerOptions, Steps } from './runner'
import { runStepsWithPHPDebugger } from './php-runner'
import { runStepsWithPythonDebugger } from './python-runner'
import { runStepsWithLLDB } from './lldb-runner'
import { runStepsWithJDB } from './java-runner'

export const runSteps = (language: Language, options: RunnerOptions): Promise<Steps> => {
  switch (language) {
    case 'C': return runStepsWithLLDB('C', options)
    case 'C++': return runStepsWithLLDB('C++', options)
    case 'Java': return runStepsWithJDB(options)
    case 'PHP': return runStepsWithPHPDebugger(options)
    case 'Python': return runStepsWithPythonDebugger(options)
  }
  throw new Error(`Unknown language "${language}". Expected one of "${languages.join('", "')}"`)
}

export type Language = 'C++' | 'C' | 'Java' | 'PHP' | 'Python'
export type LanguageExtension = '.c' | '.cpp' | '.java' | '.php' | '.py'
export const toLanguageExtension = (value: string): LanguageExtension => {
  if (languageByExtension.hasOwnProperty(value)) return value as LanguageExtension
  throw new Error(`Unknown extension "${value}". Expected one of "${Object.keys(languageByExtension).join('", "')}"`)
}

export const languageByExtension: Record<LanguageExtension, Language> = {
  '.c': 'C',
  '.cpp': 'C++',
  '.java': 'Java',
  '.php': 'PHP',
  '.py': 'Python',
}
const languages = Object.keys(languageByExtension) as Language[]
