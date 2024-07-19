TypeScript Authentication Reference Implementations  
# JWT - JSON Web Tokens

This repository contains reference implementations for JWT (JSON Web Tokens) in TypeScript. They are meant to be used as a learning tool to understand how JWT works. They are not fully battle hardened for used in production.

The code in this folder is the final code for the JWT TypeScript tutorial series. If you are following along with the tutorial series and want to check your work, you can find my code as it appears at the end of each step in the corresponding git branch. For example, the code at the end of step 1 of the JWT TypeScript tutorial can be found in the `typescript-jwt-step-1` branch.

## Tutorial Outline
0. [Background: What is a JWT?](tutorial/0-background.md)
1. Prepare the Project
2. Create a JWT
3. Verify a JWT
4. Refresh a JWT
5. Revoke a JWT

## Running the Code
1. Install the dependencies
   ```bash
   npm install
   ```
2. Start the server
   ```bash
   npm run build
   npm start
   ```
3. Use a tool like [Postman](https://www.postman.com/) to interact with the server
