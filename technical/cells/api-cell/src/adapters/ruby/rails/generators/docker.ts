export function generateDockerfile(port = 3000): string {
  return `FROM ruby:3.3-slim AS base
WORKDIR /app
RUN apt-get update -qq && \\
    apt-get install --no-install-recommends -y libpq-dev && \\
    rm -rf /var/lib/apt/lists/*
ENV RAILS_ENV=production

FROM base AS build
RUN apt-get update -qq && \\
    apt-get install --no-install-recommends -y build-essential libyaml-dev && \\
    rm -rf /var/lib/apt/lists/*
COPY Gemfile ./
RUN bundle lock && \\
    bundle install && \\
    rm -rf ~/.bundle/ vendor/bundle/ruby/*/cache

COPY . .

FROM base AS runner
COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /app /app

RUN mkdir -p tmp/pids tmp/cache log && \\
    useradd rails --create-home --shell /bin/bash && \\
    chown -R rails:rails db log tmp
USER rails:rails

EXPOSE ${port}
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
`
}

export function generateDockerIgnore(): string {
  return `.git
log/*
tmp/*
vendor/bundle
node_modules
.env*
*.log
`
}
