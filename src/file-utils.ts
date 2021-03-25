import path from 'path';
import fs from 'fs';
import fse from 'fs-extra';
import yaml from 'js-yaml';
import toml from '@iarna/toml';
import _ from 'lodash';

import { findPromise, reducePromise } from './promise-utils';

export interface ReadDirRecursivelyOptionsBase {
    filter?: (filePath: string, stats: fs.Stats) => boolean;
    absoluteFilePaths?: boolean;
    includeDirs?: boolean;
    includeStats?: false;
}

export interface ReadDirRecursivelyOptionsWithStats extends Omit<ReadDirRecursivelyOptionsBase, 'includeStats'> {
    includeStats: true;
}

export type ReadDirRecursivelyOptions = ReadDirRecursivelyOptionsWithStats | ReadDirRecursivelyOptionsBase;

export interface ReadDirResultWithStats {
    filePath: string;
    stats: fs.Stats;
}

export async function readDirRecursively(dir: string, options?: ReadDirRecursivelyOptionsBase): Promise<string[]>;
export async function readDirRecursively(dir: string, options?: ReadDirRecursivelyOptionsWithStats): Promise<ReadDirResultWithStats[]>;
export async function readDirRecursively(dir: string, options?: ReadDirRecursivelyOptions): Promise<string[] | ReadDirResultWithStats[]> {
    const rootDir: string = _.get(options, 'rootDir', dir);
    const includeDirs = options?.includeDirs;
    const includeStats = options?.includeStats;
    const files = await fse.readdir(dir);
    return reducePromise(
        files,
        async (result: any[], file: string) => {
            const absFilePath = path.join(dir, file);
            const relFilePath = options?.absoluteFilePaths ? absFilePath : path.relative(rootDir, absFilePath);
            const stats = await fse.stat(absFilePath);
            if (options?.filter && !options.filter(relFilePath, stats)) {
                return result;
            }
            const resultItem = includeStats ? { filePath: relFilePath, stats: stats } : relFilePath;
            if (stats.isDirectory()) {
                const childOptions = { ...options, rootDir: rootDir };
                const childFiles = await readDirRecursively(absFilePath, childOptions as any);
                return includeDirs ? result.concat(resultItem, childFiles) : result.concat(childFiles);
            } else if (stats.isFile()) {
                return result.concat(resultItem);
            } else {
                return result;
            }
        },
        []
    );
}

export async function parseFirstExistingFile(fileNames: string[], inputDir: string): Promise<any> {
    const filePath = await getFirstExistingFile(fileNames, inputDir);
    if (filePath) {
        return parseFile(filePath);
    } else {
        return null;
    }
}

export function getFirstExistingFile(fileNames: string[], inputDir: string): Promise<string | undefined> {
    const filePaths = _.map(fileNames, (fileName) => path.resolve(inputDir, fileName));
    return findPromise(filePaths, (filePath) => fse.pathExists(filePath));
}

export async function parseFile(filePath: string): Promise<any> {
    const data = await fse.readFile(filePath, 'utf8');
    return parseDataByFilePath(data, filePath);
}

export function parseDataByFilePath(string: string, filePath: string) {
    const extension = path.extname(filePath).substring(1);
    let data: any;
    switch (extension) {
        case 'yml':
        case 'yaml':
            data = yaml.load(string, { schema: yaml.JSON_SCHEMA });
            break;
        case 'json':
            data = JSON.parse(string);
            break;
        case 'toml':
            data = toml.parse(string);
            break;
        case 'md':
        case 'mdx':
        case 'markdown':
            data = parseMarkdownWithFrontMatter(string);
            break;
        default:
            throw new Error(`parseDataByFilePath error, extension '${extension}' of file ${filePath} is not supported`);
    }
    return data;
}

export function parseMarkdownWithFrontMatter(string: string): { frontmatter: any; markdown: string } {
    string = string.replace('\r\n', '\n');
    let frontmatter: any = null;
    let markdown = string;
    let frontMatterTypes = [
        {
            type: 'yaml',
            startDelimiter: '---\n',
            endDelimiter: '\n---',
            parse: (string: string) => yaml.load(string, { schema: yaml.JSON_SCHEMA })
        },
        {
            type: 'toml',
            startDelimiter: '+++\n',
            endDelimiter: '\n+++',
            parse: (string: string) => toml.parse(string)
        },
        {
            type: 'json',
            startDelimiter: '{\n',
            endDelimiter: '\n}',
            parse: (string: string) => JSON.parse(string)
        }
    ];
    _.forEach(frontMatterTypes, (fmType) => {
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
                    const afterEndDelimString = afterEndDelimMatch[0] as string;
                    frontmatter = fmType.parse(data);
                    markdown = afterEndDelim.substring(afterEndDelimString.length);
                }
            }
        }
    });
    return {
        frontmatter: frontmatter,
        markdown: markdown
    };
}

export function outputData(filePath: string, data: any) {
    let res = stringifyDataByFilePath(data, filePath);
    return fse.outputFile(filePath, res);
}

export function stringifyDataByFilePath(data: any, filePath: string) {
    const extension = path.extname(filePath).substring(1);
    let result;
    switch (extension) {
        case 'yml':
        case 'yaml':
            result = yaml.dump(data, { noRefs: true });
            break;
        case 'json':
            result = JSON.stringify(data, null, 4);
            break;
        case 'toml':
            result = toml.stringify(data);
            break;
        case 'md':
        case 'mdx':
        case 'markdown':
            result = '---\n' + yaml.dump(data.frontmatter, { noRefs: true }) + '---\n' + data.markdown;
            break;
        default:
            throw new Error(`stringifyDataByFilePath error, extension '${extension}' of file ${filePath} is not supported`);
    }
    return result;
}
