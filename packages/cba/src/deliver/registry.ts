import { LaunchContext } from './adapters/types'
import { launchCompose, teardownCompose } from './adapters/docker-compose'
import { launchTerraform, teardownTerraform } from './adapters/terraform-aws'

/**
 * Shared registry of launch/teardown hooks per delivery adapter. Consumed by
 * `cba up` and `cba down`. The generate() side still lives in deliver/index.ts
 * (it's tightly coupled to the plan/json/human output machinery there); this
 * registry is intentionally narrow — just the process-orchestration hooks.
 */
export const DELIVERY_ADAPTERS = ['docker-compose', 'terraform/aws'] as const
export type DeliveryAdapterId = (typeof DELIVERY_ADAPTERS)[number]

export function isDeliveryAdapterId(id: string): id is DeliveryAdapterId {
  return (DELIVERY_ADAPTERS as readonly string[]).includes(id)
}

export function launchWith(id: DeliveryAdapterId, ctx: LaunchContext): Promise<number> {
  switch (id) {
    case 'docker-compose':
      return launchCompose(ctx)
    case 'terraform/aws':
      return launchTerraform(ctx)
  }
}

export function teardownWith(id: DeliveryAdapterId, ctx: LaunchContext): Promise<number> {
  switch (id) {
    case 'docker-compose':
      return teardownCompose(ctx)
    case 'terraform/aws':
      return teardownTerraform(ctx)
  }
}
