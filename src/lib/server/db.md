**import "server-only";**



**export function throwIfError(**

&#x20; **error: { message: string } | null,**

**): void {**

&#x20; **if (error) {**

&#x20;   **throw new Error(error.message);**

&#x20; **}**

**}**



**export function requireRow<T>(**

&#x20; **row: T | null,**

&#x20; **message = "Record not found",**

**): T {**

&#x20; **if (!row) {**

&#x20;   **throw new Error(message);**

&#x20; **}**



&#x20; **return row;**

**}**

