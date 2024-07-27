# TypeScript Authentication Reference Implementations

> [!NOTE]
>
> \* \* \* \* \* \* WIP \* \* \* \* \* \*
> This is very much a work in progress. The JWT implementation is the most complete at the moment. Other implementations are coming soon.

This repository is meant to be a teaching aid and contains reference implementations for various authentication mechanisms. They are meant to be used as a learning tool to understand how various authentication mechanisms work. They are not fully battle hardened for used in production.

Each authentication mechanism is implemented in TypeScript using Express.js, PostgreSQL and Redis. The repository is organized by authentication mechanism, with each mechanism having its own directory containing a README.md file with instructions on how to run the implementation.

## Prerequisites

- [Node.js](https://nodejs.org/en/download/) -- LTS version (20.x)
- [Docker](https://docs.docker.com/get-docker/)

## Getting Started

1. Clone the repository
2. Navigate to the `typescript` directory
3. Follow the instructions in the README.md file of the specific authentication mechanism directory (e.g. `basic-auth`, `jwt`, etc.)

## Authentication Mechanisms

- [Basic Auth](./basic-auth/README.md) (coming soon)
- [JWT](./jwt/README.md)
- [OAuth2](./oauth2/README.md) (coming soon)
- [OpenID Connect](./openid-connect/README.md) (coming soon)
- [SAML](./saml/README.md) (coming soon)
