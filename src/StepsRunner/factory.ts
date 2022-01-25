import { StepsRunner, StepsRunnerOptions } from './StepsRunner'
import { LLDBStepsRunner } from './LLDBStepsRunner'
import { PHPStepsRunner } from './PHPStepsRunner'

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
const languages = Object.keys(languageByExtension) as Language[]

export const makeStepsRunner = (options: StepsRunnerOptions, language: Language): StepsRunner => {
  switch (language) {
    case 'PHP': return new PHPStepsRunner(options)
    case 'C': return new LLDBStepsRunner(options, 'C')
    case 'C++': return new LLDBStepsRunner(options, 'C++')
    default: throw new Error(`Unknown language "${language}". Expected one of "${languages.join('", "')}"`)
  }
}
