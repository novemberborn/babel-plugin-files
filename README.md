# babel-plugin-files

Babel plugin to enable importing file metadata using a [glob
pattern](https://www.npmjs.com/package/glob#glob-primer). Tested with Node.js
0.10 and above.

## Installation

```
npm install --save-dev babel-plugin-files
```

Then add `files` to your `.babelrc` file, like:

```json
{
  "plugins": ["files"]
}
```

## Usage

This plugin is useful if you need to statically reference files from within your
module. It supports glob patterns to match files at build time.

Let's say you have a directory layout like this:

* `index.js`
* `web/index.html`
* `web/blog/hello-world.html`

In `index.js` you can write the following to reference all HTML files:

```js
import htmlFiles from 'files:web/**/*.html'
```

`htmlFiles` will be an object with keys for each matched file. The values are
metadata objects. The top-level `htmlFiles` object is
[frozen](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze),
though the metadata objects are not.

Note that you **cannot import specific members** or reference the files for
their **side-effects**. The following **won't work** and throws a `SyntaxError`:

```js
import { index } from 'files:web/**/*.html' // This will throw a SyntaxError
import * as htmlFiles from 'files:web/**/*.html' // This will throw a SyntaxError
import 'files:web/**/*.html' // This will throw a SyntaxError
```

### File references and metadata objects

The [common path prefix](https://github.com/novemberborn/common-path-prefix) is
removed from all matched file paths before they're used as the keys. In the
above example the keys are `index.html` and `blog/hello-world.html`, **not**
`web/index.html` and `web/blog/hello-world.html`.

Slashes (`/`) are used as [separator
characters](https://nodejs.org/api/path.html#path_path_sep) irrespective of the
OS.

The metadata objects contain the following properties:

* `contentType`: a [full `content-type`
header](https://www.npmjs.com/package/mime-types#mimecontenttypetype)
* `mediaType`: the [media type](https://en.wikipedia.org/wiki/Media_type)
(without parameters) [associated with the
file](https://www.npmjs.com/package/mime-types#mimelookuppath)
* `size`: the size of the file in bytes
* `src`: a relative location of the file
* `tag`: a [hexadecimal MD5 hash](https://www.npmjs.com/package/md5-hex) of the
file's content

#### File locations

The `src` property provides a relative location of the file. At build time the
plugin searches for the directory containing a `package.json` file that is
closest to the module being built. If none is found the current working
directory is used. The location of the file is relative to this directory.

Slashes (`/`) are used as [separator
characters](https://nodejs.org/api/path.html#path_path_sep) irrespective of the
OS.

### Glob patterns

The plugin uses the `glob` package. Please refer to [its documentation regarding
the pattern syntax](https://www.npmjs.com/package/glob#glob-primer).

The glob pattern must be relative. It may start with `./` or `../`. If you don't
specify either then `./` is assumed. A `SyntaxError` is thrown if you start the
pattern with `/`.

The pattern is resolved relative to the file containing the `import` statement.
