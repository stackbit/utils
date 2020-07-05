const path = require('path');
const yaml = require('js-yaml');
const toml = require('@iarna/toml');
const fse = require('fs-extra');
const _ = require('lodash');


module.exports = {
    forEachPromise,
    mapPromise,
    readDirRecursively,
    getFirst,
    append,
    concat,
    copyIfNotSet,
    copy,
    rename,
    failFunctionWithTag,
    assertFunctionWithFail,
    parseFile,
    parseDataByFilePath,
    parseMarkdownWithFrontMatter,
    outputData,
    stringifyDataByFilePath
};

function forEachPromise(array, callback, thisArg) {
    return new Promise((resolve, reject) => {
        function next(index) {
            if (index < array.length) {
                callback.call(thisArg, array[index], index, array).then(() => {
                    next(index + 1);
                }).catch(error => {
                    reject(error);
                });
            } else {
                resolve();
            }
        }

        next(0);
    });
}

function mapPromise(array, callback, thisArg) {
    return new Promise((resolve, reject) => {
        let results = [];

        function next(index) {
            if (index < array.length) {
                callback.call(thisArg, array[index], index, array).then(result => {
                    results[index] = result;
                    next(index + 1);
                }).catch(error => {
                    reject(error);
                });
            } else {
                resolve(results);
            }
        }

        next(0);
    });
}

async function readDirRecursively(dir, options) {
    const rootDir = _.get(options, 'rootDir', dir);
    const files = await fse.readdir(dir);
    const result = await mapPromise(files, async (file) => {
        const filePath = path.join(dir, file);
        const relFilePath = path.relative(rootDir, filePath);
        const stats = await fse.stat(filePath);
        if (_.has(options, 'filter') && !options.filter(relFilePath, stats)) {
            return Promise.resolve();
        }
        if (stats.isDirectory()) {
            return readDirRecursively(filePath, {...options, rootDir});
        } else if (stats.isFile()) {
            return relFilePath;
        } else {
            return null;
        }
    });
    return _.chain(result).compact().flatten().value();
}

/**
 * Gets the value at the first path of object having non undefined value.
 * If all paths resolve to undefined values, the defaultValue is returned.
 *
 * @param {Object} object The object to query.
 * @param {Array<String | Array<String>>} paths The property paths to search for.
 * @param {*} [defaultValue] The value returned if all paths resolve to undefined values
 * @returns {*}
 */
function getFirst(object, paths, defaultValue) {
    let result = _(object).at(paths).reject(_.isUndefined).first();
    return _.isUndefined(result) ? defaultValue : result;
}

function append(object, path, value) {
    if (!_.has(object, path)) {
        _.set(object, path, []);
    }
    _.get(object, path).push(value);
}

function concat(object, path, value) {
    if (!_.has(object, path)) {
        _.set(object, path, []);
    }
    _.set(object, path, _.get(object, path).concat(value));
}

function copyIfNotSet(sourceObject, sourcePath, targetObject, targetPath, transform) {
    if (!_.has(targetObject, targetPath)) {
        copy(sourceObject, sourcePath, targetObject, targetPath, transform);
    }
}

function copy(sourceObject, sourcePath, targetObject, targetPath, transform) {
    if (_.has(sourceObject, sourcePath)) {
        let value = _.get(sourceObject, sourcePath);
        if (transform) {
            value = transform(value);
        }
        _.set(targetObject, targetPath, value);
    }
}

function rename(object, oldPath, newPath) {
    if (_.has(object, oldPath)) {
        _.set(object, newPath, _.get(object, oldPath));
        oldPath = _.toPath(oldPath);
        if (oldPath.length > 1) {
            object = _.get(object, _.initial(oldPath));
        }
        delete object[_.last(oldPath)];
    }
}

function failFunctionWithTag(tag) {
    return function fail(message) {
        throw new Error(`[${tag}] ${message}`);
    };
}

function assertFunctionWithFail(fail) {
    return function assert(value, message) {
        if (!value) {
            fail(message);
        }
    }
}

async function parseFile(filePath) {
    const data = await fse.readFile(filePath, 'utf8');
    return parseDataByFilePath(data, filePath);
}

function parseDataByFilePath(string, filePath) {
    const extension = path.extname(filePath).substring(1);
    let data;
    switch (extension) {
        case 'yml':
        case 'yaml':
            data = yaml.safeLoad(string, {schema: yaml.JSON_SCHEMA});
            break;
        case 'json':
            data = JSON.parse(string);
            break;
        case 'toml':
            data = toml.parse(string);
            break;
        case 'md':
            data = parseMarkdownWithFrontMatter(string);
            break;
        default:
            throw new Error(`parseDataByFilePath error, extension '${extension}' of file ${filePath} is not supported`);
    }
    return data;
}

function parseMarkdownWithFrontMatter(string) {
    string = string.replace('\r\n', '\n');
    let frontmatter = null;
    let markdown = string;
    let frontMatterTypes = [
        {
            type: 'yaml',
            startDelimiter: '---\n',
            endDelimiter: '\n---',
            parse: (string) => yaml.safeLoad(string, {schema: yaml.JSON_SCHEMA})
        },
        {
            type: 'toml',
            startDelimiter: '+++\n',
            endDelimiter: '\n+++',
            parse: (string) => toml.parse(string)
        },
        {
            type: 'json',
            startDelimiter: '{\n',
            endDelimiter: '\n}',
            parse: (string) => JSON.parse(string)
        }
    ];
    _.forEach(frontMatterTypes, fmType => {
        if (string.startsWith(fmType.startDelimiter)) {
            let index = string.indexOf(fmType.endDelimiter);
            if (index !== -1) {
                // The end delimiter must be followed by EOF or by a new line (possibly preceded with spaces)
                // For example ("." used for spaces):
                //   |---
                //   |title: Title
                //   |---...
                //   |
                //   |Markdown Content
                //   |
                // "index" points to the beginning of the second "---"
                // "endDelimEndIndex" points to the end of the second "---"
                // "afterEndDelim" is everything after the second "---"
                // "afterEndDelimMatch" is the matched "...\n" after the second "---"
                // frontmatter will be: {title: "Title"}
                // markdown will be "\nMarkdown Content\n" (the first \n after end delimiter is discarded)
                const endDelimEndIndex = index + fmType.endDelimiter.length;
                const afterEndDelim = string.substring(endDelimEndIndex);
                const afterEndDelimMatch = afterEndDelim.match(/^\s*?(\n|$)/);
                if (afterEndDelimMatch) {
                    const data = string.substring(fmType.startDelimiter.length, index);
                    frontmatter = fmType.parse(data);
                    markdown = afterEndDelim.substring(afterEndDelimMatch[0].length);
                }
            }
        }
    });
    return {
        frontmatter: frontmatter,
        markdown: markdown
    };
}

function outputData(filePath, data) {
    let res = stringifyDataByFilePath(data, filePath);
    return fse.outputFile(filePath, res);
}

function stringifyDataByFilePath(data, filePath) {
    const extension = path.extname(filePath).substring(1);
    let result;
    switch (extension) {
        case 'yml':
        case 'yaml':
            result = yaml.safeDump(data, {noRefs: true});
            break;
        case 'json':
            result = JSON.stringify(data, null, 4);
            break;
        case 'toml':
            result = toml.stringify(data);
            break;
        case 'md':
            result = '---\n' + yaml.safeDump(data.frontmatter, {noRefs: true}) + '---\n' + data.markdown;
            break;
        default:
            throw new Error(`stringifyDataByFilePath error, extension '${extension}' of file ${filePath} is not supported`);
    }
    return result;
}
