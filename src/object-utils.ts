import _, { PropertyPath } from 'lodash';

/**
 * Gets the value at the first path of object having non undefined value.
 * If all paths resolve to undefined values, the defaultValue is returned.
 *
 * @param object
 * @param paths
 * @param defaultValue
 */
export function getFirst(object: any, paths: PropertyPath, defaultValue?: any): any {
    const result = _(object).at(paths).reject(_.isUndefined).first();
    return _.isUndefined(result) ? defaultValue : result;
}

/**
 * Appends the `value` to the end of an array located at the specified `path` in
 * the provided `object`. If array at the specified `path` doesn't exist, the
 * function creates a new array with single `value` item.
 *
 * @param object
 * @param path
 * @param value
 */
export function append(object: any, path: PropertyPath, value: any): void {
    if (!_.has(object, path)) {
        _.set(object, path, []);
    }
    _.get(object, path).push(value);
}

/**
 * Concatenates the `value` with an array located at the specified `path` in the
 * provided `object`. If array at the specified `path` doesn't exist, the
 * function creates a new array and concatenates it with `value`.
 *
 * @param object
 * @param path
 * @param value
 */
export function concat(object: any, path: PropertyPath, value: any) {
    if (!_.has(object, path)) {
        _.set(object, path, []);
    }
    const result = _.get(object, path).concat(value);
    _.set(object, path, result);
}

/**
 * Copies the value from the `sourceObject` at the specified `sourcePath` to
 * the `targetObject` at the specified `targetPath`, optionally transforming the
 * value using the `transform` function.
 *
 * If `sourcePath` resolves to `undefined`, this method does nothing.
 *
 * @param sourceObject
 * @param sourcePath
 * @param targetObject
 * @param targetPath
 * @param transform
 */
export function copy(sourceObject: any, sourcePath: PropertyPath, targetObject: any, targetPath: PropertyPath, transform?: (value: any) => any) {
    if (_.has(sourceObject, sourcePath)) {
        let value = _.get(sourceObject, sourcePath);
        if (transform) {
            value = transform(value);
        }
        _.set(targetObject, targetPath, value);
    }
}

/**
 * Copies the value from the `sourceObject` at the specified `sourcePath` to
 * the `targetObject` at the specified `targetPath`.
 *
 * If `targetPath` resolves to `undefined`, this method does nothing.
 * If `sourcePath` resolves to `undefined`, this method does nothing.
 *
 * Optionally transform the value using the `transform` function.
 *
 * @param sourceObject
 * @param sourcePath
 * @param targetObject
 * @param targetPath
 * @param transform
 */
export function copyIfNotSet(sourceObject: any, sourcePath: PropertyPath, targetObject: any, targetPath: PropertyPath, transform?: (value: any) => any) {
    if (!_.has(targetObject, targetPath)) {
        copy(sourceObject, sourcePath, targetObject, targetPath, transform);
    }
}

/**
 * Renames `oldPath` to a `newPath`.
 *
 * @param object
 * @param oldPath
 * @param newPath
 */
export function rename(object: any, oldPath: PropertyPath, newPath: PropertyPath) {
    if (_.has(object, oldPath)) {
        _.set(object, newPath, _.get(object, oldPath));
        oldPath = _.toPath(oldPath);
        if (oldPath.length > 1) {
            object = _.get(object, _.initial(oldPath));
        }
        const lastKey = _.last(oldPath);
        if (lastKey) {
            delete object[lastKey];
        }
    }
}

/**
 * Deeply maps the passed `value` by recursively calling the `iteratee` with the
 * original `value` and then its properties if the `value` is an object or its
 * elements if the `value` is an array.
 *
 * The return value of every `iteratee` call will replace the original node.
 *
 * The object tree is traversed in pre-order depth-first-search algorithm.
 * Meaning, the `iteratee` is first called on the parent nodes and only then on
 * their children. Therefore if iteratee maps/replaces the parent node, then the
 * children of the replaced node will be traversed.
 *
 * The iteratee is invoked with three arguments - the `value` being iterated,
 * the `keyPath` of the current `value` relative to the original passed value,
 * and the `stack` of ancestors objects of the current `value`.
 *
 * The first `iterate` call will receive the original `value` and empty arrays
 * for `keyPath` and `stack`.
 *
 * In other words, the `value` passed to every `iteratee` call (except the first
 * call, and assuming objects properties and array indexes not mapped) will be
 * equal to: `_.get(originalValue, keyPath)`
 *
 * @example
 * mapDeep({ prop: 'foo', arr: [ 'bar' , 1, 2 ] }, (value) => {
 *     if (_.isString(value)) return '__' + value;
 *     if (_.isNumber(value)) return value * 10;
 *     return value;
 * })
 * => { prop: '__foo', arr: [ '__bar', 10, 20 ] }
 *
 * mapDeep({ prop: 'foo', arr: [ 'bar' ] }, (value, keyPath) => {
 *     if ((_.isString(value)) return value + '__' + keyPath.join('.');
 *     return value;
 * })
 * => { prop: 'foo__prop', arr: [ 'bar__arr.0' ] }
 *
 * @param {*} value A value to map
 * @param {Function} iteratee Function (value: any, keyPath: Array, stack: Array)
 * @param {object} [options]
 * @param {boolean} [options.context] The context (`this`) that will be used to invoke the `iteratee`
 * @param {boolean} [options.iterateCollections] Call `iteratee` for objects and arrays. Default: true
 * @param {boolean} [options.iteratePrimitives] Call `iteratee` for primitives. Default: true
 * @param {boolean} [options.postOrder] Change the invocation of iteratee from pre-order to post-order depth-first-search. Default: false
 * @returns {*}
 */
export function mapDeep(
    value: any,
    iteratee: (value: string, keyPath: (string | number)[], stack: any[]) => any,
    options: { postOrder?: boolean; iterateCollections?: boolean; iterateScalars?: boolean } = {}
) {
    const context = _.get(options, 'context');
    const iterateCollections = _.get(options, 'iterateCollections', true);
    const iteratePrimitives = _.get(options, 'iteratePrimitives', _.get(options, 'iterateScalars', true));
    const postOrder = _.get(options, 'postOrder', false);

    function _mapDeep(value: any, keyPath: (string | number)[], stack: any[]) {
        const invokeIteratee = _.isPlainObject(value) || _.isArray(value) ? iterateCollections : iteratePrimitives;
        if (invokeIteratee && !postOrder) {
            value = iteratee.call(context, value, keyPath, stack);
        }
        const childrenIterator = (val: any, key: string | number) => {
            return _mapDeep(val, _.concat(keyPath, key), _.concat(stack, [value]));
        };
        if (_.isPlainObject(value)) {
            value = _.mapValues(value, childrenIterator);
        } else if (_.isArray(value)) {
            value = _.map(value, childrenIterator);
        }
        if (invokeIteratee && postOrder) {
            value = iteratee(value, keyPath, stack);
        }
        return value;
    }

    return _mapDeep(value, [], []);
}
