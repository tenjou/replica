# REPLICA
> Plug & play building tool for JavaScript.

Replica is intended both for development and building packages for production. 
Replica approaches more classical way of building JavaScript projects by automatic file inclusion in HTML Index file for more speedy development and instantenous build time while developing projects.
Also supports optional custom require syntax to change include order without need to manage files yourself.

## Installation

```
npm install -g build-replica
```

## Usage

### Plug & play
Most simple approach while developing front end projects withs HTML index file. 
By default this option will search for "index.html" file and include all JavaScript files that are inside folder and will watch for file changes.
```
build-replica ./
```
Equivalent to:
```
build-replica --input ./ --index index.html --watch
```

### Customized development build
```
build-replica --input lib --input src --index index.html --watch
```

### Production ready compilation
```
build-replica --input lib --input src --index index.html --uglify
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
  --input <dir>                	Specify an input folder. Order they are defined in also will change order they are included.
  --index <file>           		The path to output index file.
  --watch						Look after file changes in set input folders.
  --concat <file=./package.js>	Specify that files should be concatenated inside one file.
  --uglify						Specify that concatenated file should be minified. Setting this will force --concat flag to true.
```

## License

MIT License

Copyright (c) 2016 

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
