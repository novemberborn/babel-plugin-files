import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'

import commonPathPrefix from 'common-path-prefix'
import glob from 'glob'
import md5Hex from 'md5-hex'
import mime from 'mime-types'

function assertImportDefaultSpecifier (path, specifiers) {
  let hasError = specifiers.length === 0
  if (!hasError) {
    for (const { type } of specifiers) {
      if (type !== 'ImportDefaultSpecifier') {
        hasError = true
        break
      }
    }
  }

  if (hasError) {
    throw path.buildCodeFrameError('Can only import the default member from a files: pattern')
  }
}

function getPattern (path, source) {
  const pattern = source.value.replace(/^files:/, '').trim()
  if (!pattern) {
    throw path.buildCodeFrameError(`Missing glob pattern '${source.value}'`)
  }
  if (/^\//.test(pattern)) {
    throw path.buildCodeFrameError(`Glob pattern must be relative, was '${pattern}'`)
  }
  return pattern
}

export default function ({ types: t }) {
  return {
    visitor: {
      ImportDeclaration (path, file) {
        const { node: { specifiers, source } } = path
        if (!t.isStringLiteral(source) || !/^files:/.test(source.value)) {
          return
        }

        assertImportDefaultSpecifier(path, specifiers)

        const fromDir = dirname(file.file.opts.filename)
        const matches = glob.sync(getPattern(path, source), {
          // Search relative to the source file, assuming that location is
          // derived correctly.
          cwd: fromDir,
          strict: true
        })

        const prefix = commonPathPrefix(matches)
        const details = Object.create(null)
        const files = []
        for (const filepath of matches) {
          const src = resolve(fromDir, filepath)
          const mimeType = mime.lookup(src) || 'application/octet-stream'
          const contentType = mime.contentType(mimeType)

          const contents = readFileSync(src)
          const contentLength = contents.length
          const tag = md5Hex(contents)

          const relpath = filepath.slice(prefix.length)
          files.push(relpath)
          details[relpath] = {
            contentLength,
            contentType,
            mimeType,
            src,
            tag
          }
        }

        const makeDetail = (detail) => {
          return t.objectExpression([
            t.objectProperty(t.identifier('contentLength'), t.numericLiteral(detail.contentLength)),
            t.objectProperty(t.identifier('contentType'), t.stringLiteral(detail.contentType)),
            t.objectProperty(t.identifier('mimeType'), t.stringLiteral(detail.mimeType)),
            t.objectProperty(t.identifier('src'), t.stringLiteral(detail.src)),
            t.objectProperty(t.identifier('tag'), t.stringLiteral(detail.tag))
          ])
        }

        const [{ local: { name: localName } }] = specifiers
        const output = t.variableDeclaration(
          'const',
          [
            t.variableDeclarator(
              t.identifier(localName),
              t.objectExpression(
                files.map((relpath) => t.objectProperty(t.stringLiteral(relpath), makeDetail(details[relpath])))
              )
            )
          ])
        const freezeOutput = t.expressionStatement(
          t.callExpression(
            t.memberExpression(t.identifier('Object'), t.identifier('freeze')),
            [t.identifier(localName)]))

        path.replaceWithMultiple([output, freezeOutput])
      }
    }
  }
}
