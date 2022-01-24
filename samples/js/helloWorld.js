simpleInstructions()
const result = toStepInto()

function simpleInstructions() {
  const a = '3';
  var b = 5;
  let c = true;
  const d = ['a', 'b', 'c'];
  const e = { a: 5, b: 3, c: 4 };
  console.log('hello');
  console.log('world');
  console.log('!');
}
function toStepInto() {
  console.log('step into')
  const result1 = toStepOver()
  console.log('end')
  return 'StepInto'
}
function toStepOver() {
  console.log('step over')
  const result2 = toStepOut()
  console.log('end')
  return 'StepOver'
}

function toStepOut() {
   console.log('step out')
  console.log('end')
  return 'StepOut'
}
