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

  toJSONAPI() {
    const errors: JSONAPIError[] = [
      {
        status: String(this.statusCode),
        title: this.status,
        detail: this.message,
      },
    ]
    return { errors }
  }
}

interface JSONAPIError {
  title: string
  detail: string
  status?: string
  code?: string
  source?: {
    pointer?: string
    parameter?: string
    header?: string
  }
  meta?: Record<string, string | number | boolean>
}

export class ValidationException extends HTTPException {
  constructor(public issues: JSONAPIError[]) {
    super(400, 'Validation Error', 'One or more validation errors occurred')
    this.issues = issues

    // Set the prototype explicitly
    Object.setPrototypeOf(this, ValidationException.prototype)
  }

  override toJSONAPI() {
    return {
      errors: this.issues,
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

export class InternalServerErrorException extends HTTPException {
  constructor(message: string, title: string = 'Internal Server Error') {
    super(500, title, message)

    // Set the prototype explicitly
    Object.setPrototypeOf(this, InternalServerErrorException.prototype)
  }
}

// HTTP status codes and standard messages
// const errorMap = new Map<number, string>([
//   [400, 'Bad Request'],
//   [401, 'Unauthorized'],
//   [403, 'Forbidden'],
//   [404, 'Not Found'],
//   [500, 'Internal Server Error'],
// ])
