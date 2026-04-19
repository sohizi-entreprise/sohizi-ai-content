export class FileSystemFunctionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileSystemFunctionError';
    }
}

export class FileSystemConflictError extends FileSystemFunctionError {
    constructor(message: string) {
        super(message);
        this.name = 'FileSystemConflictError';
    }
}

export class FileSystemInputError extends FileSystemFunctionError {
    constructor(message: string) {
        super(message);
        this.name = 'FileSystemInputError';
    }
}

export class FileSystemNotFoundError extends FileSystemFunctionError {
    constructor(message: string) {
        super(message);
        this.name = 'FileSystemNotFoundError';
    }
}

export class FileSystemInvariantError extends FileSystemFunctionError {
    constructor(message: string) {
        super(message);
        this.name = 'FileSystemInvariantError';
    }
}

export class FileSystemOperationError extends FileSystemFunctionError {
    constructor(message: string) {
        super(message);
        this.name = 'FileSystemOperationError';
    }
}
