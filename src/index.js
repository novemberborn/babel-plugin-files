import { readFileSync } from 'fs'
import { dirname, relative, resolve, sep } from 'path'

import commonPathPrefix from 'common-path-prefix'
import glob from 'glob'
import md5Hex from 'md5-hex'
import mime from 'mime-types'
import pkgDir from 'pkg-dir'

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

function describeFile (src, relativeSrc) {
  const contents = readFileSync(src)
  const size = contents.length
  const tag = md5Hex(contents)

  const mediaType = mime.lookup(src) || 'application/octet-stream'
  const contentType = mime.contentType(mediaType)

  // In case the code is running on Windows, normalize the path separator to
  // a POSIX slash.
  const normalizedSrc = relativeSrc.split(sep).join('/')

  return {
    contentType,
    mediaType,
    size,
    src: normalizedSrc,
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
        const relativeTo = pkgDir.sync(fromDir) || process.cwd()
        const matches = glob.sync(getPattern(path, source), {
          // Search relative to the source file, assuming that location is
          // derived correctly.
          cwd: fromDir,
          nodir: true,
          strict: true
        })

        const prefix = commonPathPrefix(matches)
        const descriptions = Object.create(null)
        const files = []
        for (const filepath of matches) {
          const src = resolve(fromDir, filepath)
          const desc = describeFile(src, relative(relativeTo, src))
          const relpath = filepath.slice(prefix.length)
          files.push(relpath)
          descriptions[relpath] = desc
        }

        const makeDescription = desc => {
          return t.objectExpression([
            t.objectProperty(t.identifier('contentType'), t.stringLiteral(desc.contentType)),
            t.objectProperty(t.identifier('mediaType'), t.stringLiteral(desc.mediaType)),
            t.objectProperty(t.identifier('size'), t.numericLiteral(desc.size)),
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
                files.map(relpath => t.objectProperty(t.stringLiteral(relpath), makeDescription(descriptions[relpath])))
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
