import { join } from 'path'
import { runInNewContext } from 'vm'

import test from 'ava'
import { transform as babelTransform } from 'babel-core'
import proxyquire from 'proxyquire'

import regularPlugin from '../'

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
  return err => {
    if (!(err instanceof SyntaxError)) return false

    const parts = err.message.split('files.js: ')
    return parts[1] === msg
  }
}

const compareResult = (t, { code, sourceRoot, plugin, expected }) => {
  const actual = runInNewContext(transform(code, sourceRoot, plugin))
  t.deepEqual(actual, expected)
  t.true(Object.isFrozen(actual))
}

test('throws when importing members', t => {
  t.throws(
    attempt("import { foo } from 'files:fixtures/*'"),
    check('Can only import the default member from a files: pattern'))
})

test('throws when importing all members', t => {
  t.throws(
    attempt("import * as foo from 'files:fixtures/*'"),
    check('Can only import the default member from a files: pattern'))
})

test('throws when importing for side-effects', t => {
  t.throws(
    attempt("import 'files:fixtures/*'"),
    check('Can only import the default member from a files: pattern'))
})

test('throws if import does not contain a pattern', t => {
  t.throws(
    attempt("import foo from 'files:'"),
    check("Missing glob pattern 'files:'"))
})

test('throws if pattern is absolute', t => {
  t.throws(
    attempt("import foo from 'files:/root'"),
    check("Glob pattern must be relative, was '/root'"))
})

test('generates an object with descriptions of the matched files', compareResult, {
  code: "import foo from 'files:fixtures/rfc3092.*'; foo",
  expected: {
    'rfc3092.html': {
      contentType: 'text/html; charset=utf-8',
      mediaType: 'text/html',
      size: 44585,
      src: 'test/fixtures/rfc3092.html',
      tag: '1b8c719d6a9c0398b7b9b3ff85763413'
    },
    'rfc3092.pdf': {
      contentType: 'application/pdf',
      mediaType: 'application/pdf',
      size: 38334,
      src: 'test/fixtures/rfc3092.pdf',
      tag: '5459e23f9445a65c2bf61eeac5882852'
    },
    'rfc3092.txt': {
      contentType: 'text/plain; charset=utf-8',
      mediaType: 'text/plain',
      size: 29235,
      src: 'test/fixtures/rfc3092.txt',
      tag: 'a9a1b44ecd667818a0c21737bfb0102d'
    }
  }
})

test('ignores matched directories', compareResult, {
  code: "import foo from 'files:fixtures/!(*.html|*.pdf|with-package)'; foo",
  expected: {
    'rfc3092.txt': {
      contentType: 'text/plain; charset=utf-8',
      mediaType: 'text/plain',
      size: 29235,
      src: 'test/fixtures/rfc3092.txt',
      tag: 'a9a1b44ecd667818a0c21737bfb0102d'
    }
  }
})

test('object keys are the file paths without the common path prefix', compareResult, {
  code: "import foo from 'files:fixtures/{*.txt,nested/*.txt}'; foo",
  expected: {
    'nested/foo.txt': {
      contentType: 'text/plain; charset=utf-8',
      mediaType: 'text/plain',
      size: 0,
      src: 'test/fixtures/nested/foo.txt',
      tag: 'd41d8cd98f00b204e9800998ecf8427e'
    },
    'rfc3092.txt': {
      contentType: 'text/plain; charset=utf-8',
      mediaType: 'text/plain',
      size: 29235,
      src: 'test/fixtures/rfc3092.txt',
      tag: 'a9a1b44ecd667818a0c21737bfb0102d'
    }
  }
})

test('file src is relative to the closest package.json', compareResult, {
  code: "import foo from 'files:*.txt'; foo",
  sourceRoot: join(__dirname, 'fixtures', 'with-package'),
  expected: {
    'foo.txt': {
      contentType: 'text/plain; charset=utf-8',
      mediaType: 'text/plain',
      size: 0,
      src: 'foo.txt',
      tag: 'd41d8cd98f00b204e9800998ecf8427e'
    }
  }
})

test('file src is relative to working directory if there is no closest package.json', compareResult, {
  code: "import foo from 'files:*.txt'; foo",
  sourceRoot: join(__dirname, 'fixtures', 'with-package'),
  plugin: pluginWithoutPkgDir,
  expected: {
    'foo.txt': {
      contentType: 'text/plain; charset=utf-8',
      mediaType: 'text/plain',
      size: 0,
      src: 'test/fixtures/with-package/foo.txt',
      tag: 'd41d8cd98f00b204e9800998ecf8427e'
    }
  }
})

test('defaults to application/octet-stream for unknown file types', compareResult, {
  code: "import foo from 'files:fixtures/unknown/*'; foo",
  expected: {
    'foo.💩': {
      contentType: 'application/octet-stream',
      mediaType: 'application/octet-stream',
      size: 5,
      src: 'test/fixtures/unknown/foo.💩',
      tag: '69f8a61d4ae5157ea81fd82ec0e777a9'
    }
  }
})

test('ignores unrelated imports', t => {
  const code = 'import foo from "foo";'
  t.true(transform(code) === code)
})
