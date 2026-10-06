import { spawn } from 'node:child_process'

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const captured = []
    let settled = false
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
    child.once('error', error => {
      settled = true
      reject(error)
    })
    // exit can precede pipe drainage; close guarantees captured diagnostics are complete.
    child.once('close', code => {
      if (settled) return
      const output = Buffer.concat(captured).toString('utf8')
      if (code === 0) resolve(output)
      else reject(new Error(`${command} exited with status ${code}${output ? `\n${output}` : ''}`))
    })
  })
}
