# Handling JWTs in TypeScript

## 9. Improve security on login-credential/controller

### 9.1 Protect routes

### 9.2 Invalidate tokens on password change

### 9.3 Force logout: invalidate all tokens for a user

### 10. Final clean-up

### 10.1 Automated tests

### 10.2 Add better logging

### 10.3 Refactor to expect input data to conform to JSONAPI

e.g.

```json
{"data":
  {
    "type": "users",
    "attributes": {"email": "invalid-email", "password": "password"}
  }
}'
```
