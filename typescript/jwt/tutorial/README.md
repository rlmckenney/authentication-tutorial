# Handling JWTs in TypeScript

## Functional Overview

You will build a simple JWT (JSON Web Token) authentication system in TypeScript. The system will allow users to authenticate by providing a username and password, and then issue a JWT that can be used to prove their identity when accessing protected resources.

> [!NOTE]
> Determining if the identified user is authorized to access the protected resource is outside the scope of this tutorial. This tutorial will focus on the identity authentication aspect only.

The initial authentication could use `Basic Auth` or `form data` to transmit the user's credentials (typically a username/password pair). There will be an `/authentication/login` endpoint that will accept the user credentials and return a JWT if the credentials are valid. 

There will be a `/protected` endpoint that will require a valid JWT to access. The JWT will be sent in the `Authorization` header as a `Bearer` token.

The JWT will contain the user's username and an expiration date. The expiration date will be used to determine if the token is still valid. The username will allow the protected resource route handler to access the full user information if needed to apply authorization rules.

There will be a `/authentication/refresh` endpoint that will accept a valid or recently expired JWT along with a second refresh token and then return a new JWT with an updated expiration date. This will allow users to refresh their token without having to log in again.

The refresh token will be a separate token that is stored on the client side and used to request a new JWT. The refresh token will have a longer expiration time than the JWT and will be used to mitigate the risk of token theft.

There will be an `/authentication/logout` endpoint that will accept a valid JWT and invalidate it. This will prevent the token from being used to access any  protected resources.

### Supporting Infrastructure
You will typically need a database to store the user profiles and their hashed passwords. This tutorial uses a PostgreSQL database.

You will also need to store the invalidated tokens. Since the tokens are checked on every request, a fast in-memory store like Redis is recommended.

[Step 1: Prepare the Project](./step-1.md) will include instructions to spin up the supporting database services using Docker.

## Background: What is a JWT?

JSON Web Tokens (JWTs) are a popular way to securely transmit information between parties. They are commonly used in web applications to authenticate users and authorize access to resources. JWTs are self-contained, meaning they contain all the information needed to verify the token without needing to communicate with the server. This makes them ideal for use in stateless applications.

### Composition
Encoded JWTs consist of three parts separated by periods (`.`): the header, the payload, and the signature. The header contains metadata about the token, such as the type of token and the algorithm used to sign it. The payload contains the claims, which are statements about an entity (typically the user) and additional data. The signature is used to verify that the sender of the JWT is who it says it is and to ensure that the message wasn't changed along the way.

### Encoding v.s. Encryption
It's important to note that **JWTs are not encrypted**, but rather encoded. This means that the information contained in the token is visible to anyone who has access to it. For this reason, sensitive information should never be stored in the payload of a JWT. If you need to transmit sensitive information, it should be encrypted before being placed in the payload.

### Signing
JWTs are signed using a secret key or a public/private key pair. This allows the recipient to verify that the token was issued by a trusted party and that it hasn't been tampered with. The signature is created by taking the encoded header, the encoded payload, a secret, and the algorithm specified in the header, and then hashing them together.

This verification process ensures that the token is valid and hasn't been tampered with. If the signature doesn't match, the token is considered invalid.

> [!TIP]
> You can manually verify and decode JWTs using online tools like [jwt.io](https://jwt.io/).

### Typical Use Cases
JWTs are commonly used for API authentication. Web or mobile app clients can authenticate themselves by presenting a valid JWT to the server on each request. This allows for stateless authentication, as the server doesn't need to keep track of session information and facilitates horizontal scaling.

### Security Considerations
When using JWTs, it's important to consider security best practices to prevent common vulnerabilities.:
- JWTs should always be transmitted over HTTPS to prevent eavesdropping. 
- They should have a short expiration time to limit the window of opportunity for an attacker to use a stolen token. 
- Sensitive information should never be stored in the payload of a JWT, as it can be easily decoded.
- JWTs should be signed with a strong algorithm and a secret key to prevent tampering.
- Active tokens should be checked against a deny-list to allow for handling revoked tokes and prevent replay attacks.
- Active tokes should not be stored in your database. This would pose a similar risk to storing plain text passwords.

## Next Steps
1. [Prepare the Project](step-1.md)
2. Create a JWT
3. Verify a JWT
4. Refresh a JWT
5. Revoke a JWT
