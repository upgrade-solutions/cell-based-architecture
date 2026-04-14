import { AuthProviderConfig } from '../../../../types'

export function generateApplicationController(authConfig?: AuthProviderConfig): string {
  const domain = authConfig?.domain ?? 'AUTH0_DOMAIN'
  const audience = authConfig?.audience ?? 'AUTH0_AUDIENCE'
  const roleClaim = authConfig?.roleClaim ?? 'roles'

  return `class ApplicationController < ActionController::API
  class AuthenticationError < StandardError; end
  class ForbiddenError < StandardError; end

  rescue_from ActiveRecord::RecordNotFound, with: :not_found
  rescue_from AuthenticationError, with: :unauthorized
  rescue_from ForbiddenError, with: :forbidden

  AUTH_DOMAIN = ENV.fetch('AUTH0_DOMAIN', '${domain}')
  AUTH_AUDIENCE = ENV.fetch('AUTH0_AUDIENCE', '${audience}')
  ROLE_CLAIM = '${roleClaim}'

  # Class-level DSL: authorize_roles! 'admin', 'editor', only: [:create, :update]
  def self.authorize_roles!(*allowed_roles, only: [])
    roles = allowed_roles.flatten
    before_action(only: only) do
      user = request.env['current_user']
      raise AuthenticationError, 'Not authenticated' unless user

      user_roles = Array(user[ROLE_CLAIM])
      raise ForbiddenError, 'Insufficient role' unless (roles & user_roles).any?
    end
  end

  # Class-level DSL: authorize_allow! [{role: 'underwriter', flags: ['new_flow']}, ...], only: [:create]
  #
  # Full allow[] semantics from operational DNA. An entry matches iff:
  #   (no role OR user has the role) AND
  #   (every flag in entry[:flags] is currently enabled)
  # Cross-entry semantics is OR; within-entry is AND.
  def self.authorize_allow!(allow_entries, only: [])
    entries = Array(allow_entries).map { |e| e.transform_keys(&:to_sym) }
    before_action(only: only) do
      user = request.env['current_user']
      raise AuthenticationError, 'Not authenticated' unless user

      user_roles = Array(user[ROLE_CLAIM])
      matched = entries.any? do |entry|
        next false if entry[:role] && !user_roles.include?(entry[:role])
        flags = Array(entry[:flags])
        next false if flags.any? && !flags.all? { |f| flag_enabled?(f) }
        true
      end
      raise ForbiddenError, 'Forbidden' unless matched
    end
  end

  # Default feature-flag source — reads FLAG_<UPPER_SNAKE> env vars.
  # Override by replacing this method (e.g. monkey-patch to call Flipper /
  # LaunchDarkly / Unleash / GrowthBook).
  def self.flag_enabled?(name)
    env_name = "FLAG_\#{name.to_s.upcase.gsub(/[^A-Z0-9_]/, '_')}"
    raw = ENV[env_name]
    raw == '1' || raw == 'true'
  end

  private

  def authenticate!
    token = extract_token
    raise AuthenticationError unless token

    payload = JwtVerifier.verify(token, AUTH_DOMAIN, AUTH_AUDIENCE)
    raise AuthenticationError unless payload

    request.env['current_user'] = payload
  end

  def extract_token
    header = request.headers['Authorization']
    return nil unless header&.start_with?('Bearer ')
    header[7..]
  end

  def not_found
    render json: { error: 'Not found' }, status: :not_found
  end

  def unauthorized
    render json: { error: 'Unauthorized' }, status: :unauthorized
  end

  def forbidden
    render json: { error: 'Forbidden' }, status: :forbidden
  end
end
`
}

export function generateJwtVerifier(): string {
  return `require 'net/http'
require 'json'
require 'openssl'
require 'base64'

# IDP-agnostic JWKS-based JWT verification.
# Fetches the public key set from the provider's well-known endpoint and
# verifies RS256 signatures, audience, and issuer claims.
module JwtVerifier
  JWKS_CACHE = {}
  CACHE_TTL = 600 # seconds

  class << self
    def verify(token, domain, audience)
      header, payload = decode_segments(token)
      return nil unless header && payload

      kid = header['kid']
      return nil unless kid

      public_key = fetch_public_key(domain, kid)
      return nil unless public_key

      # Verify signature
      signing_input = token.split('.')[0..1].join('.')
      signature = base64url_decode(token.split('.')[2])

      unless public_key.verify('SHA256', signature, signing_input)
        return nil
      end

      # Verify claims
      return nil unless payload['aud'] == audience || (payload['aud'].is_a?(Array) && payload['aud'].include?(audience))
      return nil unless payload['iss'] == "https://\#{domain}/"
      return nil if payload['exp'] && Time.at(payload['exp']) < Time.current

      payload
    rescue StandardError
      nil
    end

    private

    def decode_segments(token)
      parts = token.split('.')
      return [nil, nil] unless parts.length == 3

      header = JSON.parse(base64url_decode(parts[0]))
      payload = JSON.parse(base64url_decode(parts[1]))
      [header, payload]
    rescue StandardError
      [nil, nil]
    end

    def fetch_public_key(domain, kid)
      cache_key = "\#{domain}:\#{kid}"
      cached = JWKS_CACHE[cache_key]
      if cached && (Time.current - cached[:fetched_at]) < CACHE_TTL
        return cached[:key]
      end

      uri = URI("https://\#{domain}/.well-known/jwks.json")
      response = Net::HTTP.get(uri)
      jwks = JSON.parse(response)

      key_data = jwks['keys']&.find { |k| k['kid'] == kid }
      return nil unless key_data

      public_key = build_rsa_key(key_data)
      JWKS_CACHE[cache_key] = { key: public_key, fetched_at: Time.current }
      public_key
    rescue StandardError
      nil
    end

    def build_rsa_key(jwk)
      n = OpenSSL::BN.new(base64url_decode(jwk['n']), 2)
      e = OpenSSL::BN.new(base64url_decode(jwk['e']), 2)
      seq = OpenSSL::ASN1::Sequence.new([
        OpenSSL::ASN1::Integer.new(n),
        OpenSSL::ASN1::Integer.new(e),
      ])
      OpenSSL::PKey::RSA.new(OpenSSL::ASN1::Sequence.new([
        OpenSSL::ASN1::Sequence.new([
          OpenSSL::ASN1::ObjectId.new('rsaEncryption'),
          OpenSSL::ASN1::Null.new(nil),
        ]),
        OpenSSL::ASN1::BitString.new(seq.to_der),
      ]).to_der)
    end

    def base64url_decode(str)
      str = str.to_s
      padded = str + '=' * ((4 - str.length % 4) % 4)
      Base64.urlsafe_decode64(padded)
    end
  end
end
`
}
