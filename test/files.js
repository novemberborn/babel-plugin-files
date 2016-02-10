import { resolve } from 'path'

import test from 'ava'
import { transform as babelTransform } from 'babel-core'

function transform (code) {
  return babelTransform(code, {
    babelrc: false,
    filename: 'files.js',
    sourceRoot: __dirname,
    plugins: ['../']
  }).code
}

function attempt (code) {
  return Promise.resolve(code).then(transform)
}

function check (msg) {
  const preface = 'files.js: '
  return (err) => err instanceof SyntaxError && err.message.slice(0, preface.length) === preface && err.message.slice(preface.length) === msg
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
    contentLength: 44585,
    contentType: 'text/html; charset=utf-8',
    mimeType: 'text/html',
    src: '${resolve(__dirname, 'fixtures', 'rfc3092.html')}',
    tag: '1b8c719d6a9c0398b7b9b3ff85763413'
  },
  'rfc3092.pdf': {
    contentLength: 38334,
    contentType: 'application/pdf',
    mimeType: 'application/pdf',
    src: '${resolve(__dirname, 'fixtures', 'rfc3092.pdf')}',
    tag: '5459e23f9445a65c2bf61eeac5882852'
  },
  'rfc3092.txt': {
    contentLength: 29235,
    contentType: 'text/plain; charset=utf-8',
    mimeType: 'text/plain',
    src: '${resolve(__dirname, 'fixtures', 'rfc3092.txt')}',
    tag: 'a9a1b44ecd667818a0c21737bfb0102d'
  }
};
Object.freeze(foo);`)
})

test('ignores matched directories', (t) => {
  t.is(
    transform("import foo from 'files:fixtures/!(*.html|*.pdf)'"),
    `const foo = {
  'rfc3092.txt': {
    contentLength: 29235,
    contentType: 'text/plain; charset=utf-8',
    mimeType: 'text/plain',
    src: '${resolve(__dirname, 'fixtures', 'rfc3092.txt')}',
    tag: 'a9a1b44ecd667818a0c21737bfb0102d'
  }
};
Object.freeze(foo);`)
})

test('object keys are the file paths without the common path prefix', (t) => {
  t.is(
    transform("import foo from 'files:fixtures/**/*.txt'"),
    `const foo = {
  'nested/foo.txt': {
    contentLength: 0,
    contentType: 'text/plain; charset=utf-8',
    mimeType: 'text/plain',
    src: '${resolve(__dirname, 'fixtures', 'nested', 'foo.txt')}',
    tag: 'd41d8cd98f00b204e9800998ecf8427e'
  },
  'rfc3092.txt': {
    contentLength: 29235,
    contentType: 'text/plain; charset=utf-8',
    mimeType: 'text/plain',
    src: '${resolve(__dirname, 'fixtures', 'rfc3092.txt')}',
    tag: 'a9a1b44ecd667818a0c21737bfb0102d'
  }
};
Object.freeze(foo);`)
})
