// @ts-check

import fs from 'fs'
import path from 'path'
import { callScript } from './call-script.mjs'

const [file] = process.argv.slice(-1)
if (!file || !fs.existsSync(file)) throw new Error('File not found. Expected a file path like "samples/php/test.php"')

const code = fs.readFileSync(file, 'utf-8')
const fileName = path.basename(file)

callScript(code, fileName, 'debug').then((rawJSON) => {
  console.info('Raw JSON', rawJSON)
  try {
    console.info('JSON:', JSON.parse(rawJSON))
  } catch {
    console.info('could not parse JSON', rawJSON)
  }
})
