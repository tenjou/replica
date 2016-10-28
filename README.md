# REPLICA

[![npm version](https://badge.fury.io/js/build-replica.svg)](https://badge.fury.io/js/build-replica)

Replica is small and configureless build tool for most common actions you will find while developing front end JavaScript applications or libraries.

#### Features
* Include all scripts automatically inside index html file
* Pack scripts into one file
* Minify packed files
* Realtime watching for added/removed files
* Timestamp changed scripts in index html file
* Simple embeded string syntax for requiring files/changing include order - such as "require <name>"

Replica approaches more classical way of building JavaScript projects by automatic file inclusion in HTML Index file for more speedy development and instantenous build time while developing projects.
Also supports optional custom require syntax to change include order without need to manage files yourself.

## Installation

```
npm install -g build-replica
```

## Usage

#### 1. Plug & play
Most simple approach while developing front end projects with HTML index file. 
By default this option will search for "index.html" file and include all JavaScript files that are inside folder and will watch for file changes.
```
build-replica
```
Equivalent to:
```
build-replica --input ./ --index index.html --watch --timestamp
```

#### 2. Customized development build
```
build-replica --input lib --input src --index index.html --watch --timestamp
```

#### 3. Production ready compilation
```
build-replica --input lib --input src --index index.html --uglify --timestamp
```

#### 4. Compile library
```
build-replica --input lib --concat build/my_package.js --uglify
```

## Custom include order
Replica supports optional way of changing file include order by specifying `require <filename_without_extension>` at the top of file content.

#### a.js
```
"require b";
```

Will make b.js to be included before a.js.

## Options

```
  --input <dir|file>                	Specify an input folder. Order they are defined in also will change order they are included.
  --index <file>           		The path to output index file.
  --watch						Look after file changes in set input folders.
  --concat <file=./package.js>	Specify that files should be concatenated inside one file.
  --uglify						Specify that concatenated file should be minified. Setting this will force --concat flag to true.
  --timestamp					Add timestamp to scripts inside index file.
```

## TODO

- Help inside cmd
- Add optional package syntax
- Custom input packages
- Download url dependencies inside cache
- Documentation generation

## License

MIT License

Copyright (c) 2016 Arturs Šefers

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
