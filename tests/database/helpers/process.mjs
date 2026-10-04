import { spawn } from 'node:child_process'

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const captured = []
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.capture ? ['pipe', 'pipe', 'pipe']
        : options.input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    })
    if (options.capture) {
      child.stdout.on('data', chunk => captured.push(chunk))
      child.stderr.on('data', chunk => captured.push(chunk))
    }
    if (options.input !== undefined) child.stdin.end(options.input)
    child.once('error', reject)
    child.once('exit', code => code === 0
      ? resolve(Buffer.concat(captured).toString('utf8'))
      : reject(new Error(`${command} exited with status ${code}`)))
  })
}
