import { EnvironmentPlan } from '../plan'

/**
 * Launch-time context passed to adapter.launch() / adapter.teardown().
 * `deployDir` is where the adapter wrote files during generate().
 * `env` is the child-process environment (merged with process.env in the runner).
 * `flags` is the filtered set of orchestration flags from `cba up`/`cba down`.
 */
export interface LaunchContext {
  deployDir: string
  env: Record<string, string>
  flags: LaunchFlags
}

export interface LaunchFlags {
  // docker-compose
  attach?: boolean
  build?: boolean
  forceRecreate?: boolean
  keepVolumes?: boolean
  // terraform/aws
  autoApprove?: boolean
}

export interface GeneratedFile {
  path: string
  content: string
}

/**
 * Result shape shared by all adapters' generate() output. Adapter-specific
 * extensions (services, resources) live on adapter-local result types; this
 * narrow shape is what the common deliver pipeline cares about.
 */
export interface GenerateResult {
  files: GeneratedFile[]
  summary: {
    items: string[]               // services (compose) or resources (terraform)
    itemLabel: 'service' | 'resource'
    skipped: Array<{ name: string; kind: string; reason: string }>
  }
}

export interface DeliveryAdapter {
  id: string
  generate(plan: EnvironmentPlan): GenerateResult
  /**
   * Bring the deployed topology up. Returns the exit code of the underlying
   * child process (0 = success). Adapters own their own child processes and
   * inherit stdio so CLI output streams live.
   */
  launch(ctx: LaunchContext): Promise<number>
  /**
   * Tear down the deployed topology. Returns the child process exit code.
   * Adapters that require confirmation (terraform) must honor `flags.autoApprove`.
   */
  teardown(ctx: LaunchContext): Promise<number>
}
