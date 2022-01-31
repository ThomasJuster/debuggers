// @ts-check

import fs from 'fs'
import { callScript } from './call-script.mjs'

const [filePath] = process.argv.slice(-1)
if (!filePath || !fs.existsSync(filePath)) throw new Error('File not found. Expected a file path like "samples/php/test.php"')

callScript(filePath, 'off').then((rawJSON) => {
  console.info('Raw JSON', rawJSON)
  try {
    console.info('JSON:', JSON.parse(rawJSON))
  } catch {
    console.info('could not parse JSON', rawJSON)
  }
})
