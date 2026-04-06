import { Namespace } from '../../../../types'

export function generateGemfile(): string {
  return `source 'https://rubygems.org'

gem 'rails', '~> 7.1'
gem 'pg', '~> 1.5'
gem 'puma', '~> 6.4'
gem 'bootsnap', require: false
`
}

export function generateDatabaseYml(): string {
  return `default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  url: <%= ENV['DATABASE_URL'] %>

development:
  <<: *default
  database: lending_development

test:
  <<: *default
  database: lending_test

production:
  <<: *default
`
}

export function generateApplicationRb(namespace: Namespace): string {
  const appName = namespace.name
  return `require_relative "boot"
require "rails"
require "active_model/railtie"
require "active_record/railtie"
require "action_controller/railtie"

Bundler.require(*Rails.groups)

module ${appName}Api
  class Application < Rails::Application
    config.load_defaults 7.1
    config.api_only = true
    config.eager_load_paths << Rails.root.join("lib")
    config.secret_key_base = ENV.fetch("SECRET_KEY_BASE") { SecureRandom.hex(64) }
  end
end
`
}

export function generateBootRb(): string {
  return `ENV["BUNDLE_GEMFILE"] ||= File.expand_path("../Gemfile", __dir__)
require "bundler/setup"
require "bootsnap/setup"
`
}

export function generateEnvironmentRb(): string {
  return `require_relative "application"
Rails.application.initialize!
`
}

export function generateDevelopmentRb(): string {
  return `require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = true
  config.eager_load = false
  config.consider_all_requests_local = true
  config.cache_classes = false
end
`
}

export function generateProductionRb(): string {
  return `require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = true
  config.consider_all_requests_local = false
  config.force_ssl = false
  config.log_tags = [:request_id]
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info")
  config.active_record.dump_schema_after_migration = false
end
`
}

export function generateTestRb(): string {
  return `require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = false
  config.consider_all_requests_local = true
  config.action_dispatch.show_exceptions = :rescuable
end
`
}

export function generatePumaRb(): string {
  return `max_threads_count = ENV.fetch("RAILS_MAX_THREADS") { 5 }
min_threads_count = ENV.fetch("RAILS_MIN_THREADS") { max_threads_count }
threads min_threads_count, max_threads_count

port ENV.fetch("PORT") { 3000 }
environment ENV.fetch("RAILS_ENV") { "development" }

pidfile ENV.fetch("PIDFILE") { "tmp/pids/server.pid" }
plugin :tmp_restart
`
}

export function generateRakefile(): string {
  return `require_relative "config/application"
Rails.application.load_tasks
`
}

export function generateConfigRu(): string {
  return `require_relative "config/environment"
run Rails.application
Rails.application.load_server
`
}

export function generateEnv(port = 3000): string {
  return `PORT=${port}
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lending
RAILS_ENV=development
`
}

export function generateBinRails(): string {
  return `#!/usr/bin/env ruby
APP_PATH = File.expand_path("../config/application", __dir__)
require_relative "../config/boot"
require "rails/commands"
`
}

export function generateBinRake(): string {
  return `#!/usr/bin/env ruby
require_relative "../config/boot"
require "rake"
Rake.application.run
`
}

export function generateBinSetup(): string {
  return `#!/usr/bin/env ruby
require "fileutils"

APP_ROOT = File.expand_path("..", __dir__)

def system!(*args)
  system(*args, exception: true)
end

FileUtils.chdir APP_ROOT do
  puts "== Installing dependencies =="
  system! "gem install bundler --conservative"
  system("bundle check") || system!("bundle install")

  puts "\\n== Preparing database =="
  system! "bin/rails db:prepare"

  puts "\\n== Removing old logs and tempfiles =="
  system! "bin/rails log:clear tmp:clear"

  puts "\\n== Done! =="
end
`
}
