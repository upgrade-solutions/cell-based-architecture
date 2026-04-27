## ADDED Requirements

### Requirement: Cell loop branches on `compute` hint

The terraform-aws delivery adapter at `packages/cba/src/deliver/adapters/terraform-aws.ts` SHALL inspect each cell's `compute` hint while iterating. For `compute === 'lambda'` (or any future non-ECS value), the adapter MUST dispatch to the Lambda emission path defined by the `lambda-cloudfront-delivery` capability and skip ECS-only resources for that cell. For unset or `compute === 'ecs'`, the adapter MUST behave exactly as before this change.

#### Scenario: Mixed plan emits Lambda and ECS cells side by side

- **WHEN** the adapter processes a plan containing one api-cell with `compute: 'lambda'` and one api-cell with the default ECS compute
- **THEN** the Lambda cell produces `aws_lambda_function` + Function URL resources only
- **AND** the ECS cell produces `aws_ecs_task_definition` + ALB target group resources only
- **AND** no ECS resources reference the Lambda cell and no Lambda resources reference the ECS cell

### Requirement: Generated Terraform passes `terraform validate`

For every fixture combination of cells that the adapter supports (static UI + lambda api-cell + db-cell, ECS api-cell + db-cell, lambda api-cell only), the generated `.tf` files MUST pass `terraform validate` without errors. The test suite SHALL exercise at least the lambda+UI+db fixture and the ECS+db fixture.

#### Scenario: Lambda + UI + db fixture validates

- **WHEN** the test suite runs the terraform-aws adapter against a fixture containing a static UI cell, a lambda api-cell, and a db-cell
- **THEN** the generated Terraform passes `terraform validate`
- **AND** the expected resources (`aws_lambda_function`, `aws_lambda_function_url`, `aws_cloudfront_distribution`, `aws_wafv2_web_acl`, `aws_db_proxy`, S3+CloudFront for the UI) are all present
