## ADDED Requirements

### Requirement: terraform-aws emits a Lambda Function URL with response streaming

When a cell in the plan has `compute: 'lambda'`, the terraform-aws delivery adapter SHALL emit `aws_lambda_function` (zip package) and `aws_lambda_function_url` resources. The Function URL MUST set `invoke_mode = 'RESPONSE_STREAM'` and `authorization_type = 'NONE'` (auth is handled inside the function). The adapter MUST NOT emit ECS task definitions, target groups, or ALB listener rules for that cell.

#### Scenario: Lambda cell skips ECS resources

- **WHEN** the terraform-aws adapter processes a plan with a single api-cell flagged `compute: 'lambda'`
- **THEN** the generated Terraform contains `aws_lambda_function` and `aws_lambda_function_url` for that cell
- **AND** no `aws_ecs_task_definition`, `aws_lb_target_group`, or `aws_lb_listener_rule` is emitted for that cell
- **AND** the Function URL block sets `invoke_mode = "RESPONSE_STREAM"` and `authorization_type = "NONE"`

### Requirement: CloudFront fronts the Function URL with caching disabled on the API path

The terraform-aws adapter SHALL extend the existing CloudFront distribution with an origin pointing at the Function URL and an `ordered_cache_behavior` for the API path. The cache behavior MUST set `cache_policy_id` to AWS managed `Managed-CachingDisabled`, allow all HTTP methods, and use viewer protocol policy `redirect-to-https`. An `aws_lambda_permission` resource MUST allow CloudFront to invoke the Function URL.

#### Scenario: API path bypasses CloudFront caching

- **WHEN** the adapter generates Terraform for a plan that includes both a static UI cell and a lambda api-cell
- **THEN** the CloudFront distribution declares an origin for the Function URL
- **AND** an `ordered_cache_behavior` for the API path uses `Managed-CachingDisabled` with all methods allowed
- **AND** an `aws_lambda_permission` resource grants CloudFront principal permission to invoke the Function URL

### Requirement: WAF rate-based rule attaches to the CloudFront distribution

The terraform-aws adapter SHALL emit an `aws_wafv2_web_acl` containing a single rate-based rule attached to the CloudFront distribution when any cell in the plan has `compute: 'lambda'`. Default rate is 100 requests per 5 minutes per IP, configurable via cell config.

#### Scenario: Default rate limit is configurable

- **WHEN** the adapter processes a lambda cell without an override
- **THEN** the emitted WAF rule limits to 100 requests per 5 minutes per IP
- **AND** the WAF ACL is attached to the CloudFront distribution covering the lambda cell's path
- **AND** when the cell config supplies a rate override, the emitted rule reflects that value

### Requirement: RDS Proxy is emitted when Lambda is paired with db-cell

When a plan contains both at least one cell with `compute: 'lambda'` and a db-cell, the terraform-aws adapter SHALL emit an `aws_db_proxy` resource in front of the RDS instance and inject the proxy endpoint into the Lambda's environment variables (`DATABASE_URL` / `DATABASE_HOST`) in place of the direct RDS endpoint. ECS-only plans MUST NOT emit a proxy.

#### Scenario: Lambda + db-cell plan emits proxy and routes Lambda to it

- **WHEN** the adapter processes a plan with a lambda api-cell and a db-cell
- **THEN** the generated Terraform includes `aws_db_proxy` with Secrets Manager-backed auth
- **AND** the lambda's environment variables resolve `DATABASE_URL` to the proxy endpoint, not the direct RDS endpoint

#### Scenario: ECS-only plan retains existing direct-to-RDS behavior

- **WHEN** the adapter processes a plan with only ECS api-cells and a db-cell
- **THEN** no `aws_db_proxy` resource is emitted
- **AND** ECS task environment variables resolve `DATABASE_URL` to the direct RDS endpoint as before
