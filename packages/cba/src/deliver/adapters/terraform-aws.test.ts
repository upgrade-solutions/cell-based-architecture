/**
 * terraform-aws adapter — generation tests.
 *
 * Builds in-memory EnvironmentPlan fixtures and asserts the right resource
 * blocks appear (or don't) for each cell type. We don't run `terraform
 * validate` here — that requires the terraform binary and lives in the
 * separate integration tier — but every block we emit must at least show up
 * in the generated HCL so renames downstream catch immediately.
 */
import { generateTerraformAws } from './terraform-aws'
import { EnvironmentPlan } from '../plan'

function basePlan(overrides: Partial<EnvironmentPlan> = {}): EnvironmentPlan {
  return {
    domain: 'lending',
    environment: 'prod',
    paths: { domain: 'lending', root: '/tmp/none', dna: '/tmp/none/dna' } as any,
    constructs: [],
    cells: [],
    variables: [],
    providers: [{ name: 'aws', type: 'cloud', region: 'us-east-1' }],
    scripts: [],
    deployDir: '/tmp/none/deploy',
    ...overrides,
  }
}

function findFile(plan: EnvironmentPlan, name: string): string {
  const result = generateTerraformAws(plan)
  const file = result.files.find((f) => f.path.endsWith(`/${name}`))
  if (!file) throw new Error(`Missing ${name} in generated output`)
  return file.content
}

describe('terraform-aws — lambda compute target', () => {
  const lambdaPlan = basePlan({
    cells: [
      {
        name: 'api',
        adapterType: 'node/fastify',
        adapterConfig: { compute: 'lambda', port: 3001 },
        constructs: [],
        variables: [],
        outputs: [],
        outputDir: '/tmp/none/output/api',
      },
    ],
  })

  test('emits aws_lambda_function with zip + handler', () => {
    const computeTf = findFile(lambdaPlan, 'compute.tf')
    expect(computeTf).toContain('aws_lambda_function" "api"')
    expect(computeTf).toContain('runtime = "nodejs20.x"')
    expect(computeTf).toContain('handler = "handler.handler"')
    expect(computeTf).toContain('filename = "../output/api/lambda.zip"')
  })

  test('emits aws_lambda_function_url with RESPONSE_STREAM + auth NONE', () => {
    const computeTf = findFile(lambdaPlan, 'compute.tf')
    expect(computeTf).toContain('aws_lambda_function_url" "api"')
    expect(computeTf).toContain('authorization_type = "NONE"')
    expect(computeTf).toContain('invoke_mode = "RESPONSE_STREAM"')
  })

  test('emits aws_lambda_permission for CloudFront principal', () => {
    const computeTf = findFile(lambdaPlan, 'compute.tf')
    expect(computeTf).toContain('aws_lambda_permission" "api_cloudfront"')
    expect(computeTf).toContain('lambda:InvokeFunctionUrl')
    expect(computeTf).toContain('cloudfront.amazonaws.com')
  })

  test('does NOT emit ECS task definition or service for the lambda cell', () => {
    const computeTf = findFile(lambdaPlan, 'compute.tf')
    expect(computeTf).not.toContain('aws_ecs_task_definition" "api"')
    expect(computeTf).not.toContain('aws_ecs_service" "api"')
  })

  test('does NOT emit ECR repo for the lambda cell', () => {
    const ecrTf = findFile(lambdaPlan, 'ecr.tf')
    expect(ecrTf).not.toContain('aws_ecr_repository" "api"')
  })

  test('does NOT emit ALB target group / listener rule for the lambda cell', () => {
    const networkTf = findFile(lambdaPlan, 'network.tf')
    expect(networkTf).not.toContain('aws_lb_target_group" "api"')
    expect(networkTf).not.toContain('aws_lb_listener_rule" "api"')
  })

  test('emits CloudFront distribution fronting the Function URL', () => {
    const networkTf = findFile(lambdaPlan, 'network.tf')
    expect(networkTf).toContain('aws_cloudfront_distribution" "api_lambda"')
    expect(networkTf).toContain('aws_lambda_function_url.api.function_url')
    expect(networkTf).toContain('cache_policy_id') // Managed-CachingDisabled
  })

  test('emits WAFv2 web ACL with rate-based rule', () => {
    const networkTf = findFile(lambdaPlan, 'network.tf')
    expect(networkTf).toContain('aws_wafv2_web_acl" "api"')
    expect(networkTf).toContain('rate_based_statement')
    // Default rate is 100 req per 5 min per IP
    expect(networkTf).toContain('limit = 100')
    expect(networkTf).toContain('aggregate_key_type = "IP"')
  })

  test('declares us_east_1 aliased provider for CloudFront WAF (region != us-east-1)', () => {
    const plan = basePlan({
      providers: [{ name: 'aws', type: 'cloud', region: 'us-west-2' }],
      cells: lambdaPlan.cells,
    })
    const mainTf = findFile(plan, 'main.tf')
    expect(mainTf).toContain('alias = "us_east_1"')
    expect(mainTf).toContain('region = "us-east-1"')
  })

  test('emits a per-lambda IAM execution role with basic + secrets-manager policies', () => {
    const iamTf = findFile(lambdaPlan, 'iam.tf')
    expect(iamTf).toContain('aws_iam_role" "api_lambda"')
    expect(iamTf).toContain('lambda.amazonaws.com')
    expect(iamTf).toContain('AWSLambdaBasicExecutionRole')
    expect(iamTf).toContain('aws_iam_role_policy" "api_lambda_secrets"')
  })

  test('honors per-cell wafRateLimit override', () => {
    const plan = basePlan({
      cells: [
        {
          name: 'api',
          adapterType: 'node/fastify',
          adapterConfig: { compute: 'lambda', wafRateLimit: 500 },
          constructs: [],
          variables: [],
          outputs: [],
          outputDir: '/tmp/none/output/api',
        },
      ],
    })
    const networkTf = findFile(plan, 'network.tf')
    expect(networkTf).toContain('limit = 500')
  })
})

describe('terraform-aws — ECS path is preserved (no regression)', () => {
  const ecsPlan = basePlan({
    cells: [
      {
        name: 'api',
        adapterType: 'node/fastify',
        adapterConfig: { port: 3001 }, // no compute hint → defaults to ECS
        constructs: ['api-runtime'],
        variables: [],
        outputs: [],
        outputDir: '/tmp/none/output/api',
      },
    ],
    constructs: [
      {
        name: 'api-runtime',
        category: 'compute',
        type: 'container',
        provider: 'aws',
        config: { cpu: 256, memory: 512, port: 3001 },
      },
    ],
  })

  test('emits ECS task definition for ECS-default cells', () => {
    const computeTf = findFile(ecsPlan, 'compute.tf')
    expect(computeTf).toContain('aws_ecs_task_definition" "api"')
    expect(computeTf).toContain('aws_ecs_service" "api"')
  })

  test('does NOT emit aws_lambda_function for ECS-default cells', () => {
    const computeTf = findFile(ecsPlan, 'compute.tf')
    expect(computeTf).not.toContain('aws_lambda_function" "api"')
  })

  test('does NOT declare us_east_1 aliased provider when no lambda cells', () => {
    const mainTf = findFile(ecsPlan, 'main.tf')
    expect(mainTf).not.toContain('alias = "us_east_1"')
  })

  test('emits ECR repository for ECS cells', () => {
    const ecrTf = findFile(ecsPlan, 'ecr.tf')
    expect(ecrTf).toContain('aws_ecr_repository" "api"')
  })
})

describe('terraform-aws — RDS Proxy (lambda + db pairing)', () => {
  const lambdaWithDbPlan = basePlan({
    cells: [
      {
        name: 'api',
        adapterType: 'node/fastify',
        adapterConfig: { compute: 'lambda' },
        constructs: [],
        variables: [{ name: 'DATABASE_URL', source: 'secret', required: true } as any],
        outputs: [],
        outputDir: '/tmp/none/output/api',
      },
      {
        name: 'db',
        adapterType: 'postgres',
        adapterConfig: {},
        constructs: ['primary-db'],
        variables: [],
        outputs: [],
        outputDir: '/tmp/none/output/db',
      },
    ],
    constructs: [
      {
        name: 'primary-db',
        category: 'storage',
        type: 'database',
        provider: 'aws',
        config: { engine: 'postgres', version: '15' },
      },
    ],
  })

  test('emits aws_db_proxy when lambda + db both present', () => {
    const storageTf = findFile(lambdaWithDbPlan, 'storage.tf')
    expect(storageTf).toContain('aws_db_proxy" "primary_db_proxy"')
    expect(storageTf).toContain('engine_family = "POSTGRESQL"')
    expect(storageTf).toContain('require_tls = true')
  })

  test('emits aws_db_proxy_target binding the proxy to the RDS instance', () => {
    const storageTf = findFile(lambdaWithDbPlan, 'storage.tf')
    expect(storageTf).toContain('aws_db_proxy_default_target_group" "primary_db_proxy"')
    expect(storageTf).toContain('aws_db_proxy_target" "primary_db_proxy"')
    expect(storageTf).toContain('aws_db_instance.primary_db.identifier')
  })

  test('emits proxy IAM role with Secrets Manager + KMS access', () => {
    const storageTf = findFile(lambdaWithDbPlan, 'storage.tf')
    expect(storageTf).toContain('aws_iam_role" "primary_db_proxy"')
    expect(storageTf).toContain('rds.amazonaws.com')
    expect(storageTf).toContain('secretsmanager:GetSecretValue')
    expect(storageTf).toContain('kms:Decrypt')
  })

  test('DATABASE_URL local routes through proxy.endpoint, not RDS endpoint', () => {
    const localsTf = findFile(lambdaWithDbPlan, 'locals.tf')
    expect(localsTf).toContain('aws_db_proxy.primary_db_proxy.endpoint')
    expect(localsTf).not.toMatch(/aws_db_instance\.primary_db\.endpoint(?!\w)/)
  })

  test('emits Lambda + RDS Proxy security groups', () => {
    const vpcTf = findFile(lambdaWithDbPlan, 'vpc.tf')
    expect(vpcTf).toContain('aws_security_group" "lending_prod_lambda"')
    expect(vpcTf).toContain('aws_security_group" "lending_prod_rds_proxy"')
  })

  test('RDS sg ingress includes the proxy sg when lambda+db present', () => {
    const vpcTf = findFile(lambdaWithDbPlan, 'vpc.tf')
    expect(vpcTf).toContain('aws_security_group.lending_prod_rds_proxy.id')
  })

  test('lambda function declares vpc_config with private subnets + lambda sg', () => {
    const computeTf = findFile(lambdaWithDbPlan, 'compute.tf')
    expect(computeTf).toContain('vpc_config')
    expect(computeTf).toContain('aws_subnet.lending_prod_private_a.id')
    expect(computeTf).toContain('aws_security_group.lending_prod_lambda.id')
  })

  test('lambda execution role attaches AWSLambdaVPCAccessExecutionRole', () => {
    const iamTf = findFile(lambdaWithDbPlan, 'iam.tf')
    expect(iamTf).toContain('AWSLambdaVPCAccessExecutionRole')
  })
})

describe('terraform-aws — ECS + db (no proxy emitted, no regression)', () => {
  const ecsWithDbPlan = basePlan({
    cells: [
      {
        name: 'api',
        adapterType: 'node/fastify',
        adapterConfig: { port: 3001 }, // ECS default
        constructs: ['api-runtime'],
        variables: [{ name: 'DATABASE_URL', source: 'secret', required: true } as any],
        outputs: [],
        outputDir: '/tmp/none/output/api',
      },
      {
        name: 'db',
        adapterType: 'postgres',
        adapterConfig: {},
        constructs: ['primary-db'],
        variables: [],
        outputs: [],
        outputDir: '/tmp/none/output/db',
      },
    ],
    constructs: [
      {
        name: 'api-runtime',
        category: 'compute',
        type: 'container',
        provider: 'aws',
        config: { cpu: 256, memory: 512, port: 3001 },
      },
      {
        name: 'primary-db',
        category: 'storage',
        type: 'database',
        provider: 'aws',
        config: { engine: 'postgres', version: '15' },
      },
    ],
  })

  test('does NOT emit aws_db_proxy in ECS-only plans', () => {
    const storageTf = findFile(ecsWithDbPlan, 'storage.tf')
    expect(storageTf).not.toContain('aws_db_proxy')
  })

  test('DATABASE_URL local points at RDS endpoint directly', () => {
    const localsTf = findFile(ecsWithDbPlan, 'locals.tf')
    expect(localsTf).toContain('aws_db_instance.primary_db.endpoint')
    expect(localsTf).not.toContain('aws_db_proxy')
  })

  test('does NOT emit lambda or rds_proxy security groups', () => {
    const vpcTf = findFile(ecsWithDbPlan, 'vpc.tf')
    expect(vpcTf).not.toContain('"lending_prod_lambda"')
    expect(vpcTf).not.toContain('"lending_prod_rds_proxy"')
  })
})

describe('terraform-aws — mixed plan (lambda api + static UI + db)', () => {
  const mixedPlan = basePlan({
    cells: [
      {
        name: 'api',
        adapterType: 'node/fastify',
        adapterConfig: { compute: 'lambda' },
        constructs: [],
        variables: [],
        outputs: [],
        outputDir: '/tmp/none/output/api',
      },
      {
        name: 'web',
        adapterType: 'vite/react',
        adapterConfig: {},
        constructs: [],
        variables: [],
        outputs: [],
        outputDir: '/tmp/none/output/web',
      },
      {
        name: 'db',
        adapterType: 'postgres',
        adapterConfig: {},
        constructs: [],
        variables: [],
        outputs: [],
        outputDir: '/tmp/none/output/db',
      },
    ],
  })

  test('lambda + static UI cells get separate CloudFront distributions', () => {
    const networkTf = findFile(mixedPlan, 'network.tf')
    expect(networkTf).toContain('aws_cloudfront_distribution" "web"') // static
    expect(networkTf).toContain('aws_cloudfront_distribution" "api_lambda"') // lambda
  })

  test('lambda cell + static UI + db all show up in resources list', () => {
    const result = generateTerraformAws(mixedPlan)
    expect(result.resources).toEqual(expect.arrayContaining(['lambda:api', 'cloudfront:web', 'cloudfront:api', 'waf:api']))
  })
})
