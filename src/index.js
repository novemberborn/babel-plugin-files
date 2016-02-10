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

function describeFile (src) {
  const contents = readFileSync(src)
  const contentLength = contents.length
  const tag = md5Hex(contents)

  const mimeType = mime.lookup(src) || 'application/octet-stream'
  const contentType = mime.contentType(mimeType)

  return {
    contentLength,
    contentType,
    mimeType,
    src,
    tag
  }
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
        const descriptions = Object.create(null)
        const files = []
        for (const filepath of matches) {
          const src = resolve(fromDir, filepath)
          const desc = describeFile(src)
          const relpath = filepath.slice(prefix.length)
          files.push(relpath)
          descriptions[relpath] = desc
        }

        const makeDescription = (desc) => {
          return t.objectExpression([
            t.objectProperty(t.identifier('contentLength'), t.numericLiteral(desc.contentLength)),
            t.objectProperty(t.identifier('contentType'), t.stringLiteral(desc.contentType)),
            t.objectProperty(t.identifier('mimeType'), t.stringLiteral(desc.mimeType)),
            t.objectProperty(t.identifier('src'), t.stringLiteral(desc.src)),
            t.objectProperty(t.identifier('tag'), t.stringLiteral(desc.tag))
          ])
        }

        const [{ local: { name: localName } }] = specifiers
        const output = t.variableDeclaration(
          'const',
          [
            t.variableDeclarator(
              t.identifier(localName),
              t.objectExpression(
                files.map((relpath) => t.objectProperty(t.stringLiteral(relpath), makeDescription(descriptions[relpath])))
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
