export class HTTPException extends Error {
  public statusCode: number
  public status: string

  constructor(statusCode: number, status: string, message: string) {
    super(message) // Call the constructor of the base Error class
    this.statusCode = statusCode
    this.status = status

    // Set the prototype explicitly (needed when extending built-in classes)
    Object.setPrototypeOf(this, HTTPException.prototype)

    // Maintain proper stack trace (only in V8 environments like Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ResourceNotFoundException extends HTTPException {
  constructor(resource: string, query: string) {
    const message = `${resource} not found with ${query}`
    super(404, 'Resource Not Found', message)

    // Set the prototype explicitly
    Object.setPrototypeOf(this, ResourceNotFoundException.prototype)
  }
}
