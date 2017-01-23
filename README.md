# REPLICA

[![npm version](https://badge.fury.io/js/build-replica.svg)](https://badge.fury.io/js/build-replica)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Replica is small and very fast ECMA6 JavaScript CLI build tool and supports most common actions you will find while developing JavaScript applications or libraries.

#### Features
* Supports ECMA6 transpiling and import syntax (supports - js, json and text content)
* Realtime watching for added/removed files
* Development server with hot reload
* Pack scripts into one file
* Minify packed files
* Timestamp changed scripts in index html file
* Fast boilerplate project creation from templates

Replica by default only compiles and replaces files that are changed without needing to compile big files for every changes.

## Installation

This package requires at least NodeJS v6.1.0 to be installed.

```
npm install -g build-replica
```

## Usage

#### 1. Simplest development setup
```
build-replica src/main.js -i index.html -s -t
```

#### 2. Simplest production setup
```
build-replica src/main.js -i index.html -u -t
```

## Templates
For a new projects there is an option for creating boilerplate web application:
```
build-replica make <dir>
cd <dir>
npm run dev
```

## Usage

```
Usage:
	build-replica <file> [options]
	build-replica <command>

Options:
	-i, index       	Add output index file
	-t, timestamp   	Add timestamps to output files
	-w, watch       	Look after file changes in set input folders
	-u, uglify      	Specify that concatenated file should be minified, activates --concat
	-c, concat      	Concat all files into one
	-s, server      	Launch development server, activates --watch
	-b, build       	Specify build directory
	-l, library     	Add custom library

Commands:
	make <dir> [template] 	Create and prepare an empty project
	v          		Prints current version
```

## Templates

```
basic - Basic web HTML5 application.
server - Basic NodeJS server application.
```

## TODO

- CSS import
- Download url dependencies inside cache
- Documentation generation
- Support for small configuration files for attacing custom build tools
- To native & webasm compilation

## License

MIT License

Copyright (c) 2017 Arturs Šefers

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
