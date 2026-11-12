import { BOSS_TEST_MS, judge, timedOut, WORKER_SOURCE, type BossProblem, type CaseResult, type WorkerAsk, type WorkerReply } from './boss.ts'

/**
 * Runs the Boss Round's tests in the attendee's own browser, off the main
 * thread (browser only; the judging itself is pure, in lib/meet/boss.ts).
 *
 * One worker, built from a Blob URL (no bundler config, fresh per run), takes
 * the tests one at a time. Each test gets BOSS_TEST_MS: if it doesn't answer
 * by then (an infinite loop, say) the worker is terminate()d, that test is
 * marked timed out, and a fresh worker takes the rest. A syntax error or a
 * missing function fails every test at once and is shown.
 */
export interface BossRun {
  results: CaseResult[]
  /** A syntax error or missing function: why nothing ran. */
  fatal: string | null
}

export async function runBoss(code: string, problem: BossProblem, onCase?: (i: number, r: CaseResult) => void): Promise<BossRun> {
  const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }))
  let worker: Worker | null = null
  const results: CaseResult[] = []
  try {
    for (let i = 0; i < problem.cases.length; i++) {
      const c = problem.cases[i]
      worker ??= new Worker(url)
      const reply = await ask(worker, { code, fn: problem.fn, args: c.args })
      if (reply === 'timeout') {
        worker.terminate()
        worker = null
        results.push(timedOut())
      } else if (reply.kind === 'syntax' || reply.kind === 'missing') {
        const r = judge(c, reply)
        return { results: problem.cases.map(() => ({ ok: false })), fatal: r.error ?? 'It didn’t run.' }
      } else {
        results.push(judge(c, reply))
      }
      onCase?.(i, results[i])
    }
    return { results, fatal: null }
  } finally {
    worker?.terminate()
    URL.revokeObjectURL(url)
  }
}

function ask(worker: Worker, msg: WorkerAsk): Promise<WorkerReply | 'timeout'> {
  return new Promise(resolve => {
    const done = (r: WorkerReply | 'timeout') => {
      clearTimeout(timer)
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
      resolve(r)
    }
    const timer = setTimeout(() => done('timeout'), BOSS_TEST_MS)
    worker.onmessage = (e: MessageEvent<WorkerReply>) => done(e.data)
    worker.onerror = e => {
      e.preventDefault()
      done({ kind: 'threw', error: e.message || 'It crashed.' })
    }
    worker.onmessageerror = () => done({ kind: 'unclonable', shown: 'something that can’t be compared' })
    try {
      worker.postMessage(msg)
    } catch {
      done({ kind: 'threw', error: 'Could not start the test.' })
    }
  })
}
