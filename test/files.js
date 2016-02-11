import { join } from 'path'

import test from 'ava'
import { transform as babelTransform } from 'babel-core'
import proxyquire from 'proxyquire'

const regularPlugin = require('../').default
const pluginWithoutPkgDir = proxyquire('../', {
  'pkg-dir': {
    sync () { return null }
  }
}).default

function transform (code, sourceRoot = __dirname, plugin = regularPlugin) {
  return babelTransform(code, {
    babelrc: false,
    filename: join(sourceRoot, 'files.js'),
    sourceRoot,
    plugins: [plugin]
  }).code
}

function attempt (code) {
  return Promise.resolve(code).then(transform)
}

function check (msg, sourceRoot = __dirname) {
  return (err) => {
    if (!(err instanceof SyntaxError)) return false

    const parts = err.message.split('files.js: ')
    return parts[1] === msg
  }
}

test('throws when importing members', (t) => {
  t.throws(
    attempt("import { foo } from 'files:fixtures/*'"),
    check('Can only import the default member from a files: pattern'))
})

test('throws when importing all members', (t) => {
  t.throws(
    attempt("import * as foo from 'files:fixtures/*'"),
    check('Can only import the default member from a files: pattern'))
})

test('throws when importing for side-effects', (t) => {
  t.throws(
    attempt("import 'files:fixtures/*'"),
    check('Can only import the default member from a files: pattern'))
})

test('throws if import does not contain a pattern', (t) => {
  t.throws(
    attempt("import foo from 'files:'"),
    check("Missing glob pattern 'files:'"))
})

test('throws if pattern is absolute', (t) => {
  t.throws(
    attempt("import foo from 'files:/root'"),
    check("Glob pattern must be relative, was '/root'"))
})

test('generates an object with descriptions of the matched files', (t) => {
  t.is(
    transform("import foo from 'files:fixtures/rfc3092.*'"),
    `const foo = {
  'rfc3092.html': {
    contentType: 'text/html; charset=utf-8',
    mimeType: 'text/html',
    size: 44585,
    src: 'test/fixtures/rfc3092.html',
    tag: '1b8c719d6a9c0398b7b9b3ff85763413'
  },
  'rfc3092.pdf': {
    contentType: 'application/pdf',
    mimeType: 'application/pdf',
    size: 38334,
    src: 'test/fixtures/rfc3092.pdf',
    tag: '5459e23f9445a65c2bf61eeac5882852'
  },
  'rfc3092.txt': {
    contentType: 'text/plain; charset=utf-8',
    mimeType: 'text/plain',
    size: 29235,
    src: 'test/fixtures/rfc3092.txt',
    tag: 'a9a1b44ecd667818a0c21737bfb0102d'
  }
};
Object.freeze(foo);`)
})

test('ignores matched directories', (t) => {
  t.is(
    transform("import foo from 'files:fixtures/!(*.html|*.pdf|with-package)'"),
    `const foo = {
  'rfc3092.txt': {
    contentType: 'text/plain; charset=utf-8',
    mimeType: 'text/plain',
    size: 29235,
    src: 'test/fixtures/rfc3092.txt',
    tag: 'a9a1b44ecd667818a0c21737bfb0102d'
  }
};
Object.freeze(foo);`)
})

test('object keys are the file paths without the common path prefix', (t) => {
  t.is(
    transform("import foo from 'files:fixtures/{*.txt,nested/*.txt}'"),
    `const foo = {
  'nested/foo.txt': {
    contentType: 'text/plain; charset=utf-8',
    mimeType: 'text/plain',
    size: 0,
    src: 'test/fixtures/nested/foo.txt',
    tag: 'd41d8cd98f00b204e9800998ecf8427e'
  },
  'rfc3092.txt': {
    contentType: 'text/plain; charset=utf-8',
    mimeType: 'text/plain',
    size: 29235,
    src: 'test/fixtures/rfc3092.txt',
    tag: 'a9a1b44ecd667818a0c21737bfb0102d'
  }
};
Object.freeze(foo);`)
})

test('file src is relative to the closest package.json', (t) => {
  const sourceRoot = join(__dirname, 'fixtures', 'with-package')
  t.is(
    transform("import foo from 'files:*.txt'", sourceRoot),
    `const foo = {
  'foo.txt': {
    contentType: 'text/plain; charset=utf-8',
    mimeType: 'text/plain',
    size: 0,
    src: 'foo.txt',
    tag: 'd41d8cd98f00b204e9800998ecf8427e'
  }
};
Object.freeze(foo);`)
})

test('file src is relative to working directory if there is no closest package.json', (t) => {
  const sourceRoot = join(__dirname, 'fixtures', 'with-package')
  t.is(
    transform("import foo from 'files:*.txt'", sourceRoot, pluginWithoutPkgDir),
    `const foo = {
  'foo.txt': {
    contentType: 'text/plain; charset=utf-8',
    mimeType: 'text/plain',
    size: 0,
    src: 'fixtures/with-package/foo.txt',
    tag: 'd41d8cd98f00b204e9800998ecf8427e'
  }
};
Object.freeze(foo);`)
})
