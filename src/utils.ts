import _ from 'lodash';

export function fieldPathToString(fieldPath: (string | number)[]) {
    return _.reduce(
        fieldPath,
        (accumulator, fieldName, index) => {
            if (_.isString(fieldName) && /\W/.test(fieldName)) {
                // field name is a string with non alphanumeric character
                accumulator += `['${fieldName}']`;
            } else if (_.isNumber(fieldName)) {
                accumulator += `[${fieldName}]`;
            } else {
                if (index > 0) {
                    accumulator += '.';
                }
                accumulator += fieldName;
            }
            return accumulator;
        },
        ''
    );
}

export function failFunctionWithTag(tag: string) {
    return function fail(message: string) {
        throw new Error(`[${tag}] ${message}`);
    };
}

export function assertFunctionWithFail(fail: (message: string) => void) {
    return function assert(value: any, message: string) {
        if (!value) {
            fail(message);
        }
    };
}
