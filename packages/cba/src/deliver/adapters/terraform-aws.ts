import * as path from 'path'
import {
  EnvironmentPlan,
  ResolvedCell,
  ResolvedConstruct,
  ResolvedProvider,
  ResolvedVariable,
} from '../plan'

export interface TerraformFile {
  path: string
  content: string
}

export interface TerraformResult {
  files: TerraformFile[]
  resources: string[]
  skipped: Array<{ name: string; kind: string; reason: string }>
}

/**
 * Generate Terraform HCL files that provision AWS infrastructure from
 * Technical DNA. Maps Constructs to AWS resources, Cells to ECS tasks
 * or S3+CloudFront, and Variables to Secrets Manager / locals.
 */
export function generateTerraformAws(plan: EnvironmentPlan): TerraformResult {
  const resources: string[] = []
  const skipped: Array<{ name: string; kind: string; reason: string }> = []

  const prefix = `${plan.domain}-${plan.environment}`

  // Find the AWS provider from DNA
  const awsProvider = plan.providers.find((p) => p.name === 'aws' || p.type === 'cloud')
  const region = awsProvider?.region ?? 'us-east-1'
  const accountId = awsProvider?.config?.account_id ?? '000000000000'

  // ── main.tf ──
  const mainTf = buildMainTf(region)

  // ── variables.tf ──
  const { content: variablesTf, varNames } = buildVariablesTf(plan, prefix)

  // ── vpc.tf ──
  const vpcTf = buildVpcTf(prefix)
  resources.push('vpc', 'public-subnets', 'private-subnets', 'nat-gateway')

  // ── storage.tf ──
  const { content: storageTf, resourceNames: storageResources, skipped: storageSkipped } =
    buildStorageTf(plan, prefix)
  resources.push(...storageResources)
  skipped.push(...storageSkipped)

  // ── compute.tf (ECS cluster, task definitions, services) ──
  const { content: computeTf, resourceNames: computeResources, skipped: computeSkipped } =
    buildComputeTf(plan, prefix, region, accountId)
  resources.push(...computeResources)
  skipped.push(...computeSkipped)

  // ── network.tf (API Gateway, ALB, CloudFront) ──
  const { content: networkTf, resourceNames: networkResources, skipped: networkSkipped } =
    buildNetworkTf(plan, prefix)
  resources.push(...networkResources)
  skipped.push(...networkSkipped)

  // ── secrets.tf ──
  const secretsTf = buildSecretsTf(plan, prefix)

  // ── iam.tf ──
  const iamTf = buildIamTf(prefix, plan)

  // ── ecr.tf ──
  const { content: ecrTf, resourceNames: ecrResources } = buildEcrTf(plan, prefix)
  resources.push(...ecrResources)

  // ── outputs.tf ──
  const outputsTf = buildOutputsTf(plan, prefix)

  // ── terraform.tfvars.example ──
  const tfvarsExample = buildTfvarsExample(varNames, plan)

  const dir = plan.deployDir
  const files: TerraformFile[] = [
    { path: path.join(dir, 'main.tf'), content: mainTf },
    { path: path.join(dir, 'variables.tf'), content: variablesTf },
    { path: path.join(dir, 'vpc.tf'), content: vpcTf },
    { path: path.join(dir, 'storage.tf'), content: storageTf },
    { path: path.join(dir, 'compute.tf'), content: computeTf },
    { path: path.join(dir, 'network.tf'), content: networkTf },
    { path: path.join(dir, 'secrets.tf'), content: secretsTf },
    { path: path.join(dir, 'iam.tf'), content: iamTf },
    { path: path.join(dir, 'ecr.tf'), content: ecrTf },
    { path: path.join(dir, 'outputs.tf'), content: outputsTf },
    { path: path.join(dir, 'terraform.tfvars.example'), content: tfvarsExample },
    { path: path.join(dir, 'README.md'), content: buildReadme(plan, resources, skipped) },
  ]

  return { files, resources, skipped }
}

// ──────────────── main.tf ────────────────

function buildMainTf(region: string): string {
  return hcl(
    block('terraform', [], [
      block('required_providers', [], [
        assignment('aws', objectLiteral({
          source: 'hashicorp/aws',
          version: '~> 5.0',
        })),
      ]),
      assignment('required_version', '>= 1.5'),
    ]),
    '',
    block('provider', ['"aws"'], [
      assignment('region', region),
    ]),
  )
}

// ──────────────── variables.tf ────────────────

function buildVariablesTf(
  plan: EnvironmentPlan,
  prefix: string,
): { content: string; varNames: string[] } {
  const blocks: string[] = []
  const varNames: string[] = []

  // VPC CIDR
  blocks.push(hcl(block('variable', ['"vpc_cidr"'], [
    assignment('description', 'CIDR block for the VPC'),
    assignment('type', raw('string')),
    assignment('default', '10.0.0.0/16'),
  ])))
  varNames.push('vpc_cidr')

  // Collect all secret-sourced variables — they become TF input variables
  const secrets = collectSecrets(plan)
  for (const name of secrets) {
    const tfName = tfVarName(name)
    blocks.push(hcl(block('variable', [`"${tfName}"`], [
      assignment('description', `Secret: ${name}`),
      assignment('type', raw('string')),
      assignment('sensitive', raw('true')),
    ])))
    varNames.push(tfName)
  }

  // Collect env-sourced variables — passthrough from deployer's environment
  const envVars = collectEnvVars(plan)
  for (const name of envVars) {
    const tfName = tfVarName(name)
    if (varNames.includes(tfName)) continue // already declared
    blocks.push(hcl(block('variable', [`"${tfName}"`], [
      assignment('description', `Environment variable: ${name}`),
      assignment('type', raw('string')),
      assignment('default', ''),
    ])))
    varNames.push(tfName)
  }

  return { content: blocks.join('\n'), varNames }
}

function collectSecrets(plan: EnvironmentPlan): string[] {
  const seen = new Set<string>()
  for (const v of plan.variables) {
    if (v.source === 'secret') seen.add(v.name)
  }
  for (const cell of plan.cells) {
    for (const v of cell.variables) {
      if (v.source === 'secret') seen.add(v.name)
    }
  }
  return Array.from(seen).sort()
}

function collectEnvVars(plan: EnvironmentPlan): string[] {
  const seen = new Set<string>()
  for (const v of plan.variables) {
    if (v.source === 'env') seen.add(v.name)
  }
  for (const cell of plan.cells) {
    for (const v of cell.variables) {
      if (v.source === 'env') seen.add(v.name)
    }
  }
  return Array.from(seen).sort()
}

// ──────────────── vpc.tf ────────────────

function buildVpcTf(prefix: string): string {
  const id = tfId(prefix)
  return hcl(
    block('resource', ['"aws_vpc"', `"${id}"`], [
      assignment('cidr_block', raw('var.vpc_cidr')),
      assignment('enable_dns_support', raw('true')),
      assignment('enable_dns_hostnames', raw('true')),
      '',
      assignment('tags', objectLiteral({ Name: `${prefix}-vpc` })),
    ]),
    '',
    comment('Public subnets (2 AZs for ALB requirement)'),
    block('resource', ['"aws_subnet"', `"${id}_public_a"`], [
      assignment('vpc_id', raw(`aws_vpc.${id}.id`)),
      assignment('cidr_block', raw('cidrsubnet(var.vpc_cidr, 8, 1)')),
      assignment('availability_zone', raw('data.aws_availability_zones.available.names[0]')),
      assignment('map_public_ip_on_launch', raw('true')),
      assignment('tags', objectLiteral({ Name: `${prefix}-public-a` })),
    ]),
    '',
    block('resource', ['"aws_subnet"', `"${id}_public_b"`], [
      assignment('vpc_id', raw(`aws_vpc.${id}.id`)),
      assignment('cidr_block', raw('cidrsubnet(var.vpc_cidr, 8, 2)')),
      assignment('availability_zone', raw('data.aws_availability_zones.available.names[1]')),
      assignment('map_public_ip_on_launch', raw('true')),
      assignment('tags', objectLiteral({ Name: `${prefix}-public-b` })),
    ]),
    '',
    comment('Private subnets (2 AZs for RDS subnet group)'),
    block('resource', ['"aws_subnet"', `"${id}_private_a"`], [
      assignment('vpc_id', raw(`aws_vpc.${id}.id`)),
      assignment('cidr_block', raw('cidrsubnet(var.vpc_cidr, 8, 10)')),
      assignment('availability_zone', raw('data.aws_availability_zones.available.names[0]')),
      assignment('tags', objectLiteral({ Name: `${prefix}-private-a` })),
    ]),
    '',
    block('resource', ['"aws_subnet"', `"${id}_private_b"`], [
      assignment('vpc_id', raw(`aws_vpc.${id}.id`)),
      assignment('cidr_block', raw('cidrsubnet(var.vpc_cidr, 8, 11)')),
      assignment('availability_zone', raw('data.aws_availability_zones.available.names[1]')),
      assignment('tags', objectLiteral({ Name: `${prefix}-private-b` })),
    ]),
    '',
    block('data', ['"aws_availability_zones"', '"available"'], [
      assignment('state', 'available'),
    ]),
    '',
    comment('Internet Gateway'),
    block('resource', ['"aws_internet_gateway"', `"${id}"`], [
      assignment('vpc_id', raw(`aws_vpc.${id}.id`)),
      assignment('tags', objectLiteral({ Name: `${prefix}-igw` })),
    ]),
    '',
    comment('Elastic IP for NAT Gateway'),
    block('resource', ['"aws_eip"', `"${id}_nat"`], [
      assignment('domain', 'vpc'),
      assignment('tags', objectLiteral({ Name: `${prefix}-nat-eip` })),
    ]),
    '',
    comment('NAT Gateway (public subnet, enables private subnet outbound)'),
    block('resource', ['"aws_nat_gateway"', `"${id}"`], [
      assignment('allocation_id', raw(`aws_eip.${id}_nat.id`)),
      assignment('subnet_id', raw(`aws_subnet.${id}_public_a.id`)),
      assignment('tags', objectLiteral({ Name: `${prefix}-nat` })),
    ]),
    '',
    comment('Route tables'),
    block('resource', ['"aws_route_table"', `"${id}_public"`], [
      assignment('vpc_id', raw(`aws_vpc.${id}.id`)),
      '',
      block('route', [], [
        assignment('cidr_block', '0.0.0.0/0'),
        assignment('gateway_id', raw(`aws_internet_gateway.${id}.id`)),
      ]),
      '',
      assignment('tags', objectLiteral({ Name: `${prefix}-public-rt` })),
    ]),
    '',
    block('resource', ['"aws_route_table"', `"${id}_private"`], [
      assignment('vpc_id', raw(`aws_vpc.${id}.id`)),
      '',
      block('route', [], [
        assignment('cidr_block', '0.0.0.0/0'),
        assignment('nat_gateway_id', raw(`aws_nat_gateway.${id}.id`)),
      ]),
      '',
      assignment('tags', objectLiteral({ Name: `${prefix}-private-rt` })),
    ]),
    '',
    ...['public_a', 'public_b'].map((s) =>
      block('resource', ['"aws_route_table_association"', `"${id}_${s}"`], [
        assignment('subnet_id', raw(`aws_subnet.${id}_${s}.id`)),
        assignment('route_table_id', raw(`aws_route_table.${id}_public.id`)),
      ]) + '\n',
    ),
    ...['private_a', 'private_b'].map((s) =>
      block('resource', ['"aws_route_table_association"', `"${id}_${s}"`], [
        assignment('subnet_id', raw(`aws_subnet.${id}_${s}.id`)),
        assignment('route_table_id', raw(`aws_route_table.${id}_private.id`)),
      ]) + '\n',
    ),
    comment('Security group — ECS tasks'),
    block('resource', ['"aws_security_group"', `"${id}_ecs"`], [
      assignment('name', `${prefix}-ecs-sg`),
      assignment('description', 'Allow inbound from ALB and outbound to all'),
      assignment('vpc_id', raw(`aws_vpc.${id}.id`)),
      '',
      block('ingress', [], [
        assignment('from_port', raw('0')),
        assignment('to_port', raw('65535')),
        assignment('protocol', 'tcp'),
        assignment('security_groups', raw(`[aws_security_group.${id}_alb.id]`)),
      ]),
      '',
      block('egress', [], [
        assignment('from_port', raw('0')),
        assignment('to_port', raw('0')),
        assignment('protocol', '-1'),
        assignment('cidr_blocks', raw('["0.0.0.0/0"]')),
      ]),
      '',
      assignment('tags', objectLiteral({ Name: `${prefix}-ecs-sg` })),
    ]),
    '',
    comment('Security group — ALB'),
    block('resource', ['"aws_security_group"', `"${id}_alb"`], [
      assignment('name', `${prefix}-alb-sg`),
      assignment('description', 'Allow HTTP/HTTPS inbound'),
      assignment('vpc_id', raw(`aws_vpc.${id}.id`)),
      '',
      block('ingress', [], [
        assignment('from_port', raw('80')),
        assignment('to_port', raw('80')),
        assignment('protocol', 'tcp'),
        assignment('cidr_blocks', raw('["0.0.0.0/0"]')),
      ]),
      '',
      block('ingress', [], [
        assignment('from_port', raw('443')),
        assignment('to_port', raw('443')),
        assignment('protocol', 'tcp'),
        assignment('cidr_blocks', raw('["0.0.0.0/0"]')),
      ]),
      '',
      block('egress', [], [
        assignment('from_port', raw('0')),
        assignment('to_port', raw('0')),
        assignment('protocol', '-1'),
        assignment('cidr_blocks', raw('["0.0.0.0/0"]')),
      ]),
      '',
      assignment('tags', objectLiteral({ Name: `${prefix}-alb-sg` })),
    ]),
    '',
    comment('Security group — RDS'),
    block('resource', ['"aws_security_group"', `"${id}_rds"`], [
      assignment('name', `${prefix}-rds-sg`),
      assignment('description', 'Allow Postgres inbound from ECS tasks'),
      assignment('vpc_id', raw(`aws_vpc.${id}.id`)),
      '',
      block('ingress', [], [
        assignment('from_port', raw('5432')),
        assignment('to_port', raw('5432')),
        assignment('protocol', 'tcp'),
        assignment('security_groups', raw(`[aws_security_group.${id}_ecs.id]`)),
      ]),
      '',
      block('egress', [], [
        assignment('from_port', raw('0')),
        assignment('to_port', raw('0')),
        assignment('protocol', '-1'),
        assignment('cidr_blocks', raw('["0.0.0.0/0"]')),
      ]),
      '',
      assignment('tags', objectLiteral({ Name: `${prefix}-rds-sg` })),
    ]),
    '',
    comment('Security group — ElastiCache'),
    block('resource', ['"aws_security_group"', `"${id}_redis"`], [
      assignment('name', `${prefix}-redis-sg`),
      assignment('description', 'Allow Redis inbound from ECS tasks'),
      assignment('vpc_id', raw(`aws_vpc.${id}.id`)),
      '',
      block('ingress', [], [
        assignment('from_port', raw('6379')),
        assignment('to_port', raw('6379')),
        assignment('protocol', 'tcp'),
        assignment('security_groups', raw(`[aws_security_group.${id}_ecs.id]`)),
      ]),
      '',
      block('egress', [], [
        assignment('from_port', raw('0')),
        assignment('to_port', raw('0')),
        assignment('protocol', '-1'),
        assignment('cidr_blocks', raw('["0.0.0.0/0"]')),
      ]),
      '',
      assignment('tags', objectLiteral({ Name: `${prefix}-redis-sg` })),
    ]),
  )
}

// ──────────────── storage.tf ────────────────

interface BuildResult {
  content: string
  resourceNames: string[]
  skipped: Array<{ name: string; kind: string; reason: string }>
}

function buildStorageTf(plan: EnvironmentPlan, prefix: string): BuildResult {
  const blocks: string[] = []
  const resourceNames: string[] = []
  const skipped: Array<{ name: string; kind: string; reason: string }> = []
  const id = tfId(prefix)

  for (const c of plan.constructs) {
    if (c.category !== 'storage') continue

    if (c.provider !== 'aws') {
      skipped.push({
        name: c.name,
        kind: `${c.category}/${c.type}`,
        reason: `external provider "${c.provider}" — not provisionable via Terraform/AWS`,
      })
      continue
    }

    const rid = tfId(c.name)

    if (c.type === 'database' && c.config?.engine === 'postgres') {
      // DB subnet group
      blocks.push(hcl(
        block('resource', ['"aws_db_subnet_group"', `"${rid}"`], [
          assignment('name', `${prefix}-${c.name}-subnet-group`),
          assignment('subnet_ids', raw(`[\n    aws_subnet.${id}_private_a.id,\n    aws_subnet.${id}_private_b.id,\n  ]`)),
          assignment('tags', objectLiteral({ Name: `${prefix}-${c.name}-subnet-group` })),
        ]),
      ))

      // RDS instance
      const version = c.config.version ?? '15'
      const instanceClass = c.config.instance_class ?? 'db.t3.micro'
      blocks.push(hcl(
        block('resource', ['"aws_db_instance"', `"${rid}"`], [
          assignment('identifier', `${prefix}-${c.name}`),
          assignment('engine', 'postgres'),
          assignment('engine_version', String(version)),
          assignment('instance_class', instanceClass),
          assignment('allocated_storage', raw('20')),
          assignment('max_allocated_storage', raw('100')),
          '',
          assignment('db_name', plan.domain),
          assignment('username', `${plan.domain}_app`),
          assignment('manage_master_user_password', raw('true')),
          '',
          assignment('db_subnet_group_name', raw(`aws_db_subnet_group.${rid}.name`)),
          assignment('vpc_security_group_ids', raw(`[aws_security_group.${id}_rds.id]`)),
          '',
          assignment('skip_final_snapshot', raw('true')),
          assignment('storage_encrypted', raw('true')),
          '',
          assignment('tags', objectLiteral({ Name: `${prefix}-${c.name}` })),
        ]),
      ))
      resourceNames.push(`rds:${c.name}`)
    } else if (c.type === 'cache' && c.config?.engine === 'redis') {
      // ElastiCache subnet group
      blocks.push(hcl(
        block('resource', ['"aws_elasticache_subnet_group"', `"${rid}"`], [
          assignment('name', `${prefix}-${c.name}-subnet-group`),
          assignment('subnet_ids', raw(`[\n    aws_subnet.${id}_private_a.id,\n    aws_subnet.${id}_private_b.id,\n  ]`)),
        ]),
      ))

      const version = c.config.version ?? '7'
      blocks.push(hcl(
        block('resource', ['"aws_elasticache_cluster"', `"${rid}"`], [
          assignment('cluster_id', `${prefix}-${c.name}`),
          assignment('engine', 'redis'),
          assignment('engine_version', `${version}.0`),
          assignment('node_type', 'cache.t3.micro'),
          assignment('num_cache_nodes', raw('1')),
          assignment('port', raw('6379')),
          '',
          assignment('subnet_group_name', raw(`aws_elasticache_subnet_group.${rid}.name`)),
          assignment('security_group_ids', raw(`[aws_security_group.${id}_redis.id]`)),
          '',
          assignment('tags', objectLiteral({ Name: `${prefix}-${c.name}` })),
        ]),
      ))
      resourceNames.push(`elasticache:${c.name}`)
    } else if (c.type === 'queue' && c.config?.engine === 'sns+sqs') {
      // SNS topic — single fan-out topic for all signals on this bus
      blocks.push(hcl(
        block('resource', ['"aws_sns_topic"', `"${rid}"`], [
          assignment('name', `${prefix}-${c.name}`),
          assignment('tags', objectLiteral({ Name: `${prefix}-${c.name}` })),
        ]),
      ))

      // SQS queue — subscriber queue (dead-letter optional, omitted for now)
      blocks.push(hcl(
        block('resource', ['"aws_sqs_queue"', `"${rid}"`], [
          assignment('name', `${prefix}-${c.name}-subscriber`),
          assignment('visibility_timeout_seconds', raw('300')),
          assignment('message_retention_seconds', raw('1209600')),
          assignment('tags', objectLiteral({ Name: `${prefix}-${c.name}-subscriber` })),
        ]),
      ))

      // SNS → SQS subscription
      blocks.push(hcl(
        block('resource', ['"aws_sns_topic_subscription"', `"${rid}"`], [
          assignment('topic_arn', raw(`aws_sns_topic.${rid}.arn`)),
          assignment('protocol', 'sqs'),
          assignment('endpoint', raw(`aws_sqs_queue.${rid}.arn`)),
          assignment('raw_message_delivery', raw('true')),
        ]),
      ))

      // SQS queue policy — allow SNS to publish
      blocks.push(hcl(
        block('resource', ['"aws_sqs_queue_policy"', `"${rid}"`], [
          assignment('queue_url', raw(`aws_sqs_queue.${rid}.id`)),
          assignment('policy', raw(`jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "sns.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.${rid}.arn
      Condition = {
        ArnEquals = {
          "aws:SourceArn" = aws_sns_topic.${rid}.arn
        }
      }
    }]
  })`)),
        ]),
      ))

      resourceNames.push(`sns:${c.name}`)
      resourceNames.push(`sqs:${c.name}`)
    } else {
      skipped.push({
        name: c.name,
        kind: `${c.category}/${c.type}`,
        reason: `no Terraform mapping for storage/${c.type} (engine: ${c.config?.engine ?? 'unknown'})`,
      })
    }
  }

  return { content: blocks.join('\n') || comment('No storage constructs to provision'), resourceNames, skipped }
}

// ──────────────── compute.tf ────────────────

function buildComputeTf(
  plan: EnvironmentPlan,
  prefix: string,
  region: string,
  accountId: string,
): BuildResult {
  const blocks: string[] = []
  const resourceNames: string[] = []
  const skipped: Array<{ name: string; kind: string; reason: string }> = []
  const id = tfId(prefix)

  // ECS cluster
  blocks.push(hcl(
    block('resource', ['"aws_ecs_cluster"', `"${id}"`], [
      assignment('name', `${prefix}-cluster`),
      assignment('tags', objectLiteral({ Name: `${prefix}-cluster` })),
    ]),
  ))
  resourceNames.push('ecs-cluster')

  // CloudWatch log group for ECS tasks
  blocks.push(hcl(
    block('resource', ['"aws_cloudwatch_log_group"', `"${id}"`], [
      assignment('name', `/ecs/${prefix}`),
      assignment('retention_in_days', raw('30')),
      assignment('tags', objectLiteral({ Name: `${prefix}-logs` })),
    ]),
  ))

  // Build task definitions + services for deployable cells
  for (const cell of plan.cells) {
    const cellId = tfId(cell.name)
    const isStatic = cell.adapterType.startsWith('vite/')
    const isDb = cell.adapterType === 'postgres'

    if (isDb) {
      skipped.push({
        name: cell.name,
        kind: `cell/${cell.adapterType}`,
        reason: 'database provisioning handled by RDS — no container needed',
      })
      continue
    }

    if (isStatic) {
      // Static UI cells → S3 + CloudFront (handled in network.tf via buildStaticSite)
      // We still need an S3 bucket here
      blocks.push(hcl(
        block('resource', ['"aws_s3_bucket"', `"${cellId}"`], [
          assignment('bucket', `${prefix}-${cellId}-assets`),
          assignment('tags', objectLiteral({ Name: `${prefix}-${cellId}` })),
        ]),
        '',
        block('resource', ['"aws_s3_bucket_public_access_block"', `"${cellId}"`], [
          assignment('bucket', raw(`aws_s3_bucket.${cellId}.id`)),
          assignment('block_public_acls', raw('true')),
          assignment('block_public_policy', raw('true')),
          assignment('ignore_public_acls', raw('true')),
          assignment('restrict_public_buckets', raw('true')),
        ]),
      ))
      resourceNames.push(`s3:${cell.name}`)
      continue
    }

    // Container-based cell → ECS task definition + service
    const construct = plan.constructs.find(
      (c) => c.category === 'compute' && c.type === 'container' && cell.constructs.includes(c.name),
    )
    const cpu = construct?.config?.cpu ?? 256
    const memory = construct?.config?.memory ?? 512
    const port = construct?.config?.port ?? 3000

    // Environment variables for the container
    const envVars = buildContainerEnv(cell, plan)

    blocks.push(hcl(
      block('resource', ['"aws_ecs_task_definition"', `"${cellId}"`], [
        assignment('family', `${prefix}-${cellId}`),
        assignment('network_mode', 'awsvpc'),
        assignment('requires_compatibilities', raw('["FARGATE"]')),
        assignment('cpu', raw(String(cpu))),
        assignment('memory', raw(String(memory))),
        assignment('execution_role_arn', raw(`aws_iam_role.${id}_ecs_execution.arn`)),
        assignment('task_role_arn', raw(`aws_iam_role.${id}_ecs_task.arn`)),
        '',
        assignment('container_definitions', raw(`jsonencode([
    {
      name      = "${cellId}"
      image     = "\${aws_ecr_repository.${cellId}.repository_url}:latest"
      cpu       = ${cpu}
      memory    = ${memory}
      essential = true

      portMappings = [
        {
          containerPort = ${port}
          hostPort      = ${port}
          protocol      = "tcp"
        }
      ]

      environment = [
${envVars.map((e) => `        { name = "${e.name}", value = ${e.value} }`).join(',\n')}
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.${id}.name
          "awslogs-region"        = "${region}"
          "awslogs-stream-prefix" = "${cellId}"
        }
      }
    }
  ])`)),
        '',
        assignment('tags', objectLiteral({ Name: `${prefix}-${cellId}` })),
      ]),
      '',
      block('resource', ['"aws_ecs_service"', `"${cellId}"`], [
        assignment('name', `${prefix}-${cellId}`),
        assignment('cluster', raw(`aws_ecs_cluster.${id}.id`)),
        assignment('task_definition', raw(`aws_ecs_task_definition.${cellId}.arn`)),
        assignment('desired_count', raw('1')),
        assignment('launch_type', 'FARGATE'),
        '',
        block('network_configuration', [], [
          assignment('subnets', raw(`[\n      aws_subnet.${id}_private_a.id,\n      aws_subnet.${id}_private_b.id,\n    ]`)),
          assignment('security_groups', raw(`[aws_security_group.${id}_ecs.id]`)),
          assignment('assign_public_ip', raw('false')),
        ]),
        '',
        block('load_balancer', [], [
          assignment('target_group_arn', raw(`aws_lb_target_group.${cellId}.arn`)),
          assignment('container_name', cellId),
          assignment('container_port', raw(String(port))),
        ]),
        '',
        assignment('tags', objectLiteral({ Name: `${prefix}-${cellId}` })),
      ]),
    ))
    resourceNames.push(`ecs:${cell.name}`)
  }

  return { content: blocks.join('\n'), resourceNames, skipped }
}

function buildContainerEnv(
  cell: ResolvedCell,
  plan: EnvironmentPlan,
): Array<{ name: string; value: string }> {
  const env: Array<{ name: string; value: string }> = []
  for (const v of cell.variables) {
    if (v.source === 'literal') {
      env.push({ name: v.name, value: `"${v.value ?? ''}"` })
    } else if (v.source === 'secret') {
      env.push({ name: v.name, value: `var.${tfVarName(v.name)}` })
    } else if (v.source === 'output') {
      // Output refs resolved at deploy time — use placeholder
      const ref = v.value ?? ''
      env.push({ name: v.name, value: `"$\{${ref}}"` })
    } else if (v.source === 'env') {
      env.push({ name: v.name, value: `var.${tfVarName(v.name)}` })
    }
  }
  return env
}

// ──────────────── network.tf ────────────────

function buildNetworkTf(plan: EnvironmentPlan, prefix: string): BuildResult {
  const blocks: string[] = []
  const resourceNames: string[] = []
  const skipped: Array<{ name: string; kind: string; reason: string }> = []
  const id = tfId(prefix)

  // ALB (always generated — ECS services need a load balancer)
  blocks.push(hcl(
    block('resource', ['"aws_lb"', `"${id}"`], [
      assignment('name', `${prefix}-alb`),
      assignment('internal', raw('false')),
      assignment('load_balancer_type', 'application'),
      assignment('security_groups', raw(`[aws_security_group.${id}_alb.id]`)),
      assignment('subnets', raw(`[\n    aws_subnet.${id}_public_a.id,\n    aws_subnet.${id}_public_b.id,\n  ]`)),
      '',
      assignment('tags', objectLiteral({ Name: `${prefix}-alb` })),
    ]),
    '',
    block('resource', ['"aws_lb_listener"', `"${id}"`], [
      assignment('load_balancer_arn', raw(`aws_lb.${id}.arn`)),
      assignment('port', raw('80')),
      assignment('protocol', 'HTTP'),
      '',
      block('default_action', [], [
        assignment('type', 'fixed-response'),
        '',
        block('fixed_response', [], [
          assignment('content_type', 'text/plain'),
          assignment('message_body', 'Not Found'),
          assignment('status_code', '404'),
        ]),
      ]),
    ]),
  ))
  resourceNames.push('alb')

  // Target groups + listener rules for each ECS cell
  let priority = 100
  for (const cell of plan.cells) {
    const isContainer = !cell.adapterType.startsWith('vite/') && cell.adapterType !== 'postgres'
    if (!isContainer) continue

    const cellId = tfId(cell.name)
    const construct = plan.constructs.find(
      (c) => c.category === 'compute' && c.type === 'container' && cell.constructs.includes(c.name),
    )
    const port = construct?.config?.port ?? 3000
    const isApi = cell.name.includes('api')

    blocks.push(hcl(
      '',
      block('resource', ['"aws_lb_target_group"', `"${cellId}"`], [
        assignment('name', `${prefix}-${cellId}-tg`),
        assignment('port', raw(String(port))),
        assignment('protocol', 'HTTP'),
        assignment('target_type', 'ip'),
        assignment('vpc_id', raw(`aws_vpc.${id}.id`)),
        '',
        block('health_check', [], [
          assignment('path', isApi ? '/health' : '/'),
          assignment('healthy_threshold', raw('2')),
          assignment('unhealthy_threshold', raw('3')),
          assignment('timeout', raw('5')),
          assignment('interval', raw('30')),
        ]),
        '',
        assignment('tags', objectLiteral({ Name: `${prefix}-${cellId}-tg` })),
      ]),
      '',
      block('resource', ['"aws_lb_listener_rule"', `"${cellId}"`], [
        assignment('listener_arn', raw(`aws_lb_listener.${id}.arn`)),
        assignment('priority', raw(String(priority))),
        '',
        block('condition', [], [
          block('path_pattern', [], [
            assignment('values', raw(isApi ? '["/*"]' : '["/*"]')),
          ]),
        ]),
        '',
        block('action', [], [
          assignment('type', 'forward'),
          assignment('target_group_arn', raw(`aws_lb_target_group.${cellId}.arn`)),
        ]),
      ]),
    ))
    resourceNames.push(`tg:${cell.name}`)
    priority += 10
  }

  // API Gateway — map from network/gateway constructs
  for (const c of plan.constructs) {
    if (c.category !== 'network') continue
    if (c.provider !== 'aws') {
      skipped.push({
        name: c.name,
        kind: `${c.category}/${c.type}`,
        reason: `external provider "${c.provider}" — not provisionable via Terraform/AWS`,
      })
      continue
    }

    const rid = tfId(c.name)

    if (c.type === 'gateway') {
      blocks.push(hcl(
        '',
        block('resource', ['"aws_apigatewayv2_api"', `"${rid}"`], [
          assignment('name', `${prefix}-${c.name}`),
          assignment('protocol_type', c.config?.type ?? 'HTTP'),
          assignment('tags', objectLiteral({ Name: `${prefix}-${c.name}` })),
        ]),
        '',
        block('resource', ['"aws_apigatewayv2_stage"', `"${rid}"`], [
          assignment('api_id', raw(`aws_apigatewayv2_api.${rid}.id`)),
          assignment('name', '$default'),
          assignment('auto_deploy', raw('true')),
        ]),
        '',
        block('resource', ['"aws_apigatewayv2_integration"', `"${rid}"`], [
          assignment('api_id', raw(`aws_apigatewayv2_api.${rid}.id`)),
          assignment('integration_type', 'HTTP_PROXY'),
          assignment('integration_method', 'ANY'),
          assignment('integration_uri', raw(`aws_lb_listener.${id}.arn`)),
          assignment('connection_type', 'VPC_LINK'),
        ]),
      ))
      resourceNames.push(`apigateway:${c.name}`)
    } else if (c.type === 'cdn') {
      skipped.push({
        name: c.name,
        kind: `${c.category}/${c.type}`,
        reason: 'CloudFront distribution generated per static UI cell',
      })
    } else {
      skipped.push({
        name: c.name,
        kind: `${c.category}/${c.type}`,
        reason: `no Terraform mapping for network/${c.type}`,
      })
    }
  }

  // CloudFront for static UI cells (vite/*)
  for (const cell of plan.cells) {
    if (!cell.adapterType.startsWith('vite/')) continue
    const cellId = tfId(cell.name)

    blocks.push(hcl(
      '',
      comment(`CloudFront distribution for ${cell.name} (static assets)`),
      block('resource', ['"aws_cloudfront_origin_access_identity"', `"${cellId}"`], [
        assignment('comment', `OAI for ${prefix}-${cellId}`),
      ]),
      '',
      block('resource', ['"aws_s3_bucket_policy"', `"${cellId}"`], [
        assignment('bucket', raw(`aws_s3_bucket.${cellId}.id`)),
        assignment('policy', raw(`jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOAI"
        Effect    = "Allow"
        Principal = { AWS = aws_cloudfront_origin_access_identity.${cellId}.iam_arn }
        Action    = "s3:GetObject"
        Resource  = "\${aws_s3_bucket.${cellId}.arn}/*"
      }
    ]
  })`)),
      ]),
      '',
      block('resource', ['"aws_cloudfront_distribution"', `"${cellId}"`], [
        assignment('enabled', raw('true')),
        assignment('default_root_object', 'index.html'),
        '',
        block('origin', [], [
          assignment('domain_name', raw(`aws_s3_bucket.${cellId}.bucket_regional_domain_name`)),
          assignment('origin_id', `s3-${cellId}`),
          '',
          block('s3_origin_config', [], [
            assignment('origin_access_identity', raw(`aws_cloudfront_origin_access_identity.${cellId}.cloudfront_access_identity_path`)),
          ]),
        ]),
        '',
        block('default_cache_behavior', [], [
          assignment('allowed_methods', raw('["GET", "HEAD", "OPTIONS"]')),
          assignment('cached_methods', raw('["GET", "HEAD"]')),
          assignment('target_origin_id', `s3-${cellId}`),
          assignment('viewer_protocol_policy', 'redirect-to-https'),
          '',
          block('forwarded_values', [], [
            assignment('query_string', raw('false')),
            block('cookies', [], [
              assignment('forward', 'none'),
            ]),
          ]),
        ]),
        '',
        comment('SPA: serve index.html for client-side routes'),
        block('custom_error_response', [], [
          assignment('error_code', raw('403')),
          assignment('response_code', raw('200')),
          assignment('response_page_path', '/index.html'),
        ]),
        block('custom_error_response', [], [
          assignment('error_code', raw('404')),
          assignment('response_code', raw('200')),
          assignment('response_page_path', '/index.html'),
        ]),
        '',
        block('restrictions', [], [
          block('geo_restriction', [], [
            assignment('restriction_type', 'none'),
          ]),
        ]),
        '',
        block('viewer_certificate', [], [
          assignment('cloudfront_default_certificate', raw('true')),
        ]),
        '',
        assignment('tags', objectLiteral({ Name: `${prefix}-${cellId}-cdn` })),
      ]),
    ))
    resourceNames.push(`cloudfront:${cell.name}`)
  }

  return { content: blocks.join('\n'), resourceNames, skipped }
}

// ──────────────── secrets.tf ────────────────

function buildSecretsTf(plan: EnvironmentPlan, prefix: string): string {
  const secrets = collectSecrets(plan)
  if (secrets.length === 0) return comment('No secrets to provision')

  const blocks: string[] = [
    comment('Secrets Manager entries for secret-sourced Variables'),
    comment('The actual secret values are passed via terraform.tfvars (not checked in).'),
    '',
  ]

  for (const name of secrets) {
    const rid = tfId(name.toLowerCase())
    blocks.push(hcl(
      block('resource', ['"aws_secretsmanager_secret"', `"${rid}"`], [
        assignment('name', `${prefix}/${name}`),
        assignment('tags', objectLiteral({ Name: `${prefix}-${name}` })),
      ]),
      '',
      block('resource', ['"aws_secretsmanager_secret_version"', `"${rid}"`], [
        assignment('secret_id', raw(`aws_secretsmanager_secret.${rid}.id`)),
        assignment('secret_string', raw(`var.${tfVarName(name)}`)),
      ]),
    ))
  }

  return blocks.join('\n')
}

// ──────────────── iam.tf ────────────────

function buildIamTf(prefix: string, plan: EnvironmentPlan): string {
  const id = tfId(prefix)

  return hcl(
    comment('ECS execution role — allows ECS to pull images and write logs'),
    block('resource', ['"aws_iam_role"', `"${id}_ecs_execution"`], [
      assignment('name', `${prefix}-ecs-execution`),
      assignment('assume_role_policy', raw(`jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "ecs-tasks.amazonaws.com" }
      }
    ]
  })`)),
      assignment('tags', objectLiteral({ Name: `${prefix}-ecs-execution` })),
    ]),
    '',
    block('resource', ['"aws_iam_role_policy_attachment"', `"${id}_ecs_execution"`], [
      assignment('role', raw(`aws_iam_role.${id}_ecs_execution.name`)),
      assignment('policy_arn', 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'),
    ]),
    '',
    comment('ECS task role — permissions for running containers'),
    block('resource', ['"aws_iam_role"', `"${id}_ecs_task"`], [
      assignment('name', `${prefix}-ecs-task`),
      assignment('assume_role_policy', raw(`jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "ecs-tasks.amazonaws.com" }
      }
    ]
  })`)),
      assignment('tags', objectLiteral({ Name: `${prefix}-ecs-task` })),
    ]),
    '',
    comment('Allow task role to read secrets'),
    block('resource', ['"aws_iam_role_policy"', `"${id}_ecs_task_secrets"`], [
      assignment('name', `${prefix}-ecs-task-secrets`),
      assignment('role', raw(`aws_iam_role.${id}_ecs_task.id`)),
      assignment('policy', raw(`jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:*:*:secret:${prefix}/*"
      }
    ]
  })`)),
    ]),
  )
}

// ──────────────── ecr.tf ────────────────

function buildEcrTf(
  plan: EnvironmentPlan,
  prefix: string,
): { content: string; resourceNames: string[] } {
  const blocks: string[] = []
  const resourceNames: string[] = []

  for (const cell of plan.cells) {
    // Only container-deployable cells need ECR repos
    if (cell.adapterType === 'postgres') continue
    if (cell.adapterType.startsWith('vite/')) continue

    const cellId = tfId(cell.name)
    blocks.push(hcl(
      block('resource', ['"aws_ecr_repository"', `"${cellId}"`], [
        assignment('name', `${prefix}-${cellId}`),
        assignment('image_tag_mutability', 'MUTABLE'),
        '',
        block('image_scanning_configuration', [], [
          assignment('scan_on_push', raw('true')),
        ]),
        '',
        assignment('tags', objectLiteral({ Name: `${prefix}-${cellId}` })),
      ]),
    ))
    resourceNames.push(`ecr:${cell.name}`)
  }

  return {
    content: blocks.join('\n') || comment('No ECR repositories needed'),
    resourceNames,
  }
}

// ──────────────── outputs.tf ────────────────

function buildOutputsTf(plan: EnvironmentPlan, prefix: string): string {
  const id = tfId(prefix)
  const blocks: string[] = []

  blocks.push(hcl(
    block('output', ['"alb_dns_name"'], [
      assignment('description', 'DNS name of the Application Load Balancer'),
      assignment('value', raw(`aws_lb.${id}.dns_name`)),
    ]),
  ))

  // ECR repository URLs
  for (const cell of plan.cells) {
    if (cell.adapterType === 'postgres' || cell.adapterType.startsWith('vite/')) continue
    const cellId = tfId(cell.name)
    blocks.push(hcl(
      block('output', [`"ecr_url_${cellId}"`], [
        assignment('description', `ECR repository URL for ${cell.name}`),
        assignment('value', raw(`aws_ecr_repository.${cellId}.repository_url`)),
      ]),
    ))
  }

  // RDS endpoints
  for (const c of plan.constructs) {
    if (c.category === 'storage' && c.type === 'database' && c.config?.engine === 'postgres' && c.provider === 'aws') {
      const rid = tfId(c.name)
      blocks.push(hcl(
        block('output', [`"rds_endpoint_${rid}"`], [
          assignment('description', `RDS endpoint for ${c.name}`),
          assignment('value', raw(`aws_db_instance.${rid}.endpoint`)),
        ]),
      ))
    }
  }

  // SNS topic ARNs and SQS queue URLs for event bus constructs
  for (const c of plan.constructs) {
    if (c.category === 'storage' && c.type === 'queue' && c.config?.engine === 'sns+sqs' && c.provider === 'aws') {
      const rid = tfId(c.name)
      blocks.push(hcl(
        block('output', [`"sns_topic_arn_${rid}"`], [
          assignment('description', `SNS topic ARN for ${c.name}`),
          assignment('value', raw(`aws_sns_topic.${rid}.arn`)),
        ]),
      ))
      blocks.push(hcl(
        block('output', [`"sqs_queue_url_${rid}"`], [
          assignment('description', `SQS queue URL for ${c.name}`),
          assignment('value', raw(`aws_sqs_queue.${rid}.id`)),
        ]),
      ))
    }
  }

  // CloudFront domains for static cells
  for (const cell of plan.cells) {
    if (!cell.adapterType.startsWith('vite/')) continue
    const cellId = tfId(cell.name)
    blocks.push(hcl(
      block('output', [`"cloudfront_domain_${cellId}"`], [
        assignment('description', `CloudFront domain for ${cell.name}`),
        assignment('value', raw(`aws_cloudfront_distribution.${cellId}.domain_name`)),
      ]),
    ))
  }

  // API Gateway URL
  for (const c of plan.constructs) {
    if (c.category === 'network' && c.type === 'gateway' && c.provider === 'aws') {
      const rid = tfId(c.name)
      blocks.push(hcl(
        block('output', [`"api_gateway_url_${rid}"`], [
          assignment('description', `API Gateway URL for ${c.name}`),
          assignment('value', raw(`aws_apigatewayv2_api.${rid}.api_endpoint`)),
        ]),
      ))
    }
  }

  return blocks.join('\n')
}

// ──────────────── terraform.tfvars.example ────────────────

function buildTfvarsExample(varNames: string[], plan: EnvironmentPlan): string {
  const lines = [
    `# ${plan.domain}/${plan.environment} — Terraform variable values`,
    `# Copy to terraform.tfvars and fill in real values.`,
    `# DO NOT commit terraform.tfvars to version control.`,
    ``,
  ]
  for (const v of varNames) {
    lines.push(`${v} = ""`)
  }
  return lines.join('\n') + '\n'
}

// ──────────────── README ────────────────

function buildReadme(
  plan: EnvironmentPlan,
  resources: string[],
  skipped: Array<{ name: string; kind: string; reason: string }>,
): string {
  const lines = [
    `# ${plan.domain} — ${plan.environment} deployment (terraform/aws)`,
    ``,
    `Generated by \`cba deploy ${plan.domain} --env ${plan.environment} --adapter terraform/aws\`.`,
    ``,
    `## Resources`,
    ``,
    ...resources.map((r) => `- \`${r}\``),
    ``,
    `## Deploy`,
    ``,
    '```bash',
    `cd output/${plan.domain}-deploy`,
    ``,
    `# 1. Configure variables`,
    `cp terraform.tfvars.example terraform.tfvars`,
    `# Edit terraform.tfvars with real secret values`,
    ``,
    `# 2. Initialize and apply`,
    `terraform init`,
    `terraform plan`,
    `terraform apply`,
    ``,
    `# 3. Build and push container images`,
    `# (for each ECR repository in outputs)`,
    `aws ecr get-login-password --region ${plan.providers.find((p) => p.name === 'aws')?.region ?? 'us-east-1'} | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com`,
    `docker build -t <ecr-url>:latest ../path-to-cell-output/`,
    `docker push <ecr-url>:latest`,
    '```',
    ``,
  ]
  if (skipped.length) {
    lines.push(`## Skipped`, ``)
    for (const s of skipped) {
      lines.push(`- \`${s.name}\` (${s.kind}) — ${s.reason}`)
    }
    lines.push(``)
  }
  lines.push(
    `## Regenerating`,
    ``,
    `These files are regenerated from Technical DNA on every \`cba deploy\`.`,
    `Do not edit by hand — edit the DNA instead.`,
    ``,
  )
  return lines.join('\n')
}

// ──────────────── HCL rendering (minimal, no dep) ────────────────

/** Marker for values that should NOT be quoted in HCL */
interface RawValue {
  __raw: true
  value: string
}

function raw(v: string): RawValue {
  return { __raw: true, value: v }
}

function isRaw(v: any): v is RawValue {
  return v && typeof v === 'object' && v.__raw === true
}

type HclLine = string

function comment(text: string): string {
  return `# ${text}`
}

function assignment(key: string, value: string | RawValue | Record<string, string>): HclLine {
  if (isRaw(value)) return `${key} = ${value.value}`
  if (typeof value === 'object') return `${key} = ${renderObjectLiteral(value)}`
  return `${key} = "${escapeHcl(value)}"`
}

function objectLiteral(obj: Record<string, string>): RawValue {
  return raw(renderObjectLiteral(obj))
}

function renderObjectLiteral(obj: Record<string, string>): string {
  const entries = Object.entries(obj)
  if (entries.length === 0) return '{}'
  if (entries.length === 1) {
    const [k, v] = entries[0]
    return `{ ${k} = "${escapeHcl(v)}" }`
  }
  const lines = entries.map(([k, v]) => `    ${k} = "${escapeHcl(v)}"`)
  return `{\n${lines.join('\n')}\n  }`
}

function block(type: string, labels: string[], body: (HclLine | string)[]): string {
  const labelStr = labels.length ? ' ' + labels.join(' ') : ''
  const lines: string[] = [`${type}${labelStr} {`]
  for (const line of body) {
    if (line === '') {
      lines.push('')
    } else {
      // Indent each line of multi-line content
      for (const subline of line.split('\n')) {
        lines.push(subline === '' ? '' : `  ${subline}`)
      }
    }
  }
  lines.push('}')
  return lines.join('\n')
}

function hcl(...parts: string[]): string {
  return parts.filter((p) => p !== undefined).join('\n') + '\n'
}

function escapeHcl(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

// ──────────────── utilities ────────────────

/** Convert a name to a valid Terraform identifier (lowercase, underscores) */
function tfId(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase()
}

/** Convert a variable name to a Terraform-safe variable name */
function tfVarName(name: string): string {
  return name.toLowerCase()
}
