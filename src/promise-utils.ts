export function forEachPromise<T>(array: T[], callback: (value: T, index: number, array: T[]) => Promise<any>, thisArg?: any): Promise<void> {
    return new Promise((resolve, reject) => {
        function next(index: number) {
            if (index < array.length) {
                callback
                    .call(thisArg, array[index] as T, index, array)
                    .then((result) => {
                        if (result === false) {
                            resolve();
                        } else {
                            next(index + 1);
                        }
                    })
                    .catch((error) => {
                        reject(error);
                    });
            } else {
                resolve();
            }
        }
        next(0);
    });
}

export function mapPromise<T, U>(array: T[], callback: (value: T, index: number, array: T[]) => Promise<U>, thisArg?: any): Promise<U[]> {
    return new Promise((resolve, reject) => {
        const results: U[] = [];

        function next(index: number) {
            if (index < array.length) {
                callback
                    .call(thisArg, array[index] as T, index, array)
                    .then((result) => {
                        results[index] = result;
                        next(index + 1);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            } else {
                resolve(results);
            }
        }

        next(0);
    });
}

export function reducePromise<T, U>(
    array: T[],
    callback: (accumulator: U, currentValue: T, currentIndex: number, array: T[]) => Promise<U>,
    initialValue: U,
    thisArg?: any
): Promise<U> {
    return new Promise((resolve, reject) => {
        function next(index: number, accumulator: U) {
            if (index < array.length) {
                callback
                    .call(thisArg, accumulator, array[index] as T, index, array)
                    .then((result) => {
                        next(index + 1, result);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            } else {
                resolve(accumulator);
            }
        }

        next(0, initialValue);
    });
}

export function findPromise<T>(array: T[], callback: (value: T, index: number, array: T[]) => Promise<boolean>, thisArg?: any): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        function next(index: number) {
            if (index < array.length) {
                callback
                    .call(thisArg, array[index] as T, index, array)
                    .then((result) => {
                        if (result) {
                            resolve(array[index]);
                        } else {
                            next(index + 1);
                        }
                    })
                    .catch((error) => {
                        reject(error);
                    });
            } else {
                resolve(undefined);
            }
        }
        next(0);
    });
}
