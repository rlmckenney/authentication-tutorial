# Authentication Reference Implementations
This repository is meant to be a teaching aid and contains reference implementations for various authentication mechanisms. They are meant to be used as a learning tool to understand how various authentication mechanisms work. They are not fully battle hardened for used in production.

This repository is organized by language and then by authentication mechanism. Each folder contains a README.md file that explains the authentication mechanism and how the code works.

## Languages
- [TypeScript](typescript/README.md)
- [Swift](swift/README.md)
- [PHP](php/README.md)
- [Python](python/README.md)
- [Go](go/README.md)
- [Rust](rust/README.md)

## Authentication Mechanisms
- [Basic Auth](basic-auth/README.md)
- [JWT](jwt/README.md)
- [OAuth2](oauth2/README.md)
- [OpenID Connect](openid-connect/README.md)
- [SAML](saml/README.md)

## Integrations
- [AWS Cognito](aws-cognito/README.md)
- [Azure AD](azure-ad/README.md)
- [Auth0](auth0/README.md)
- [Okta](okta/README.md)
- [Firebase](firebase/README.md)
- [Google Identity Platform](google-identity-platform/README.md)

### Social Logins
- [Login with Apple](apple-login/README.md)
- [Login with GitHub](github-login/README.md)
- [Login with LinkedIn](linkedin-login/README.md)
- [Login with Facebook](facebook-login/README.md)
- [Login with X (Twitter)](twitter-login/README.md)

## Common Infrastructure
Each of the implementations will utilize the following common infrastructure:
- [Docker](docker/README.md)
- [Kubernetes](kubernetes/README.md)
- [Postgres DB](postgres/README.md)
- [Redis](redis/README.md)

## Tutorial Series
For each of the authentication mechanism <=> language pairs, there is a corresponding tutorial that explains how the code works. They will provide some basic background on the authentication mechanism and then walk through building up the reference code step-by-step.

If you are following along with the tutorial series and want to check your work, you can find my code as it appears at the end of each step in the corresponding git branch. For example, the code at the end of step 1 of the JWT TypeScript tutorial can be found in the `typescript-jwt-step-1` branch.
