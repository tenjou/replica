const fs = require("fs");
const path = require("path");
const FSEvent = process.binding("fs_event_wrap").FSEvent;
const uglifyJS = require("uglify-js2");

let watching = {};
let flags = {};
let indexFiles = {};
let filesChanged = {};
let inputs = [];
let actionsUpdateIndex = false;
let actionsChanged = false;
let watchingFiles = false;
let updateIndex = 1;
let packageSrc = "./package.js";

function loadFile(input, src)
{
	const dirSrc = path.dirname(src);
	const fileSrc = path.basename(src);

	createSource(input, path.normalize(dirSrc + "/"), fileSrc);
	watchDirectory(input, dirSrc);
}

function loadDirectory(input, src) 
{
	const dirSrc = path.normalize(src + "/");
	const dirContent = fs.readdirSync(src);

	for(let n = 0; n < dirContent.length; n++) 
	{
		let fileSrc = dirContent[n];
		let stats = fs.statSync(dirSrc + fileSrc);

		if(stats.isDirectory()) {
			loadDirectory(input, dirSrc + fileSrc);
		}
		else {
			createSource(input, dirSrc, fileSrc);
		}
	}

	watchDirectory(input, src);
}

function watchDirectory(input, src) 
{
	if(!flags.watch) { return; }
	if(watching[src]) { return; }

	let watchSrc = path.normalize(src + "/");
	let handle = new FSEvent();
	handle.onchange = function(status, eventType, filename) {
		watchDirectoryFunc(input, watchSrc, eventType, filename);
	};

	watching[src] = handle;
	handle.start(src);
}

function watchDirectoryFunc(input, src, eventType, filename)
{
	const fullSrc = src + filename;
	if(fullSrc === packageSrc) { return; } 

	const fileExist = fs.existsSync(fullSrc);

	switch(eventType) 
	{
		case "rename":
		{
			if(fileExist) 
			{
				const isDirectory = fs.statSync(fullSrc).isDirectory();

				if(isDirectory) {
					loadDirectory(input, fullSrc);
				}
				else 
				{
					if(input.staticSources && !input.staticSources[fullSrc]) {
						break;
					}

					createSource(input, src, filename);
				}
			}
			else 
			{
				if(watching[fullSrc]) {
					removeDirectory(input, fullSrc);
				}
				else {
					removeSource(input, fullSrc);
				}
			}
		} break;

		case "change":
		{
			filesChanged[fullSrc] = true;
			actionsChanged = true;
		} break;
	}
}

function unwatchDirectory(src)
{
	var watchFunc = watching[src];
	if(watchFunc) {
		watchFunc.close();
		delete watching[src];
	}
}

function Input(src)
{
	this.src = src;
	this.sources = {};
	this.staticSources = null;
	
	const isDirectory = fs.lstatSync(src).isDirectory();

	if(isDirectory) {
		loadDirectory(this, src);
	}
	else 
	{
		this.staticSources = {};
		this.staticSources[src] = true;
		loadFile(this, src);
	}
}

function SourceFile(path, filename)
{
	this.path = path;
	this.filename = filename;
	this._content = null;
	this.index = 0;
	this.requires = [];
	this.timestamp = "";

	this.bufferLength = 0;
	this.cursor = 0;
	this.currChar = null;

	this.update();
}

SourceFile.prototype = 
{
	nextRequire: function()
	{
		this.currChar = null;

		do {
			this.nextChar();
		} while(isSpace(this.currChar))

		let str = "";

		if(this.currChar === "\"" || this.currChar === "'") 
		{
			let endChar = this.currChar;

			this.nextChar();
			while(this.currChar !== endChar)
			{
				if(this.currChar === "\0") {
					return null;
				}

				str += this.currChar;
				this.nextChar();
			}

			if(str === "use strict") { return null; }
			if(str.indexOf("require ") !== 0) { return null;}

			return str.slice("require ".length);
		}

		return null;
	},

	nextChar: function() 
	{
		if(this.cursor >= this.bufferLength) {
			this.currChar = "\0";
		}
		else {
			this.currChar = this._content.charAt(this.cursor);
		}

		this.cursor++;
	},

	update: function() 
	{
		this.content = fs.readFileSync(this.path + this.filename, "utf8");

		if(flags.timestamp) {
			this.timestamp = "?" + Date.now();
		}

		actionsUpdateIndex = true;
	},

	set content(value)
	{
		this._content = value;
		this.bufferLength = value.length;
		this.requires.length = 0;

		let index = value.indexOf("\"require ");
		if(index === -1) { return; }

		this.cursor = 0;

		let errorCount = 0;

		for(;;)
		{
			let requireFile = this.nextRequire();
			if(!requireFile) 
			{ 
				errorCount++; 

				if(errorCount === 2) { 
					break;
				}
				else {
					continue;
				}
			}
			
			let requirePath = path.resolve(this.path + requireFile + ".js");
			this.requires.push(requirePath);
		}
	},

	get content() {
		return this._content;
	}
}

function IndexFile(path, filename, content)
{
	this.contentStart = null;
	this.contentEnd = null;
	this._content = null;
	this.updating = false;
	this.loaded = false;

	this.path = path;
	this.filename = filename;
	this.timestamp = "";

	this.update();
}

IndexFile.prototype = 
{
	update: function() {
		this.content = fs.readFileSync(this.path + this.filename, "utf8");
		actionsUpdateIndex = true;
	},

	updateScripts: function()
	{
		if(!this.loaded) { return; }

		let content = this.contentStart;

		if(flags.concat) 
		{
			let timestamp = "";
			if(flags.timestamp) {
				timestamp = "?" + Date.now();
			}

			let src = path.relative(this.path + "/", packageSrc);

			content += `<script src="${src}${timestamp}"></script>\n`;
		}
		else
		{
			let self = this;

			iterSources(
				function(source) 
				{
					let src = path.relative(self.path + "/", source.path);
					if(src) {
						src = path.normalize(src + "/");
					}

					content += `<script src="${src}${source.filename}${source.timestamp}"></script>\n`;
				});
		}

		content += this.contentEnd;
		this.updating = true;

		fs.writeFileSync(this.path + this.filename, content);
	},

	set content(content)
	{
		const prefixStart = "<!-- REPLICA_START -->";
		const prefixEnd = "<!-- REPLICA_END -->";

		this.loaded = false;

		const headEndIndex = content.indexOf("</head>");
		if(headEndIndex === -1) {
			return console.error("IndexFile: Could not find <head> ending.")
		}

		let index = content.indexOf(prefixStart);
		if(index === -1)
		{
			this.contentStart = content.slice(0, headEndIndex);
			let newlineIndex = this.contentStart.lastIndexOf("\n");
			let spaces = this.contentStart.slice(newlineIndex);
			this.contentStart = this.contentStart.slice(0, newlineIndex + 1);
			this.contentStart += `${prefixStart}\n`;

			this.contentEnd = prefixEnd + spaces;
			this.contentEnd += content.slice(headEndIndex);
		}
		else
		{
			this.contentStart = content.slice(0, index + prefixStart.length) + "\n";

			index = content.indexOf(prefixEnd);
			if(index === -1)
			{
				let newlineIndex = this.contentStart.lastIndexOf("\n");
				let spaces = this.contentStart.slice(newlineIndex);	

				this.contentEnd = prefixEnd + spaces;
				this.contentEnd += content.slice(headEndIndex);							
			}
			else {
				this.contentEnd = content.slice(index);
			}
		}

		this.loaded = true;
	},

	get content() {
		return this._content;
	}
};

function createSource(input, src, filename)
{
	const fullSrc = src + filename;

	if(fullSrc === packageSrc) { return; }

	let index = filename.lastIndexOf(".");
	if(index === -1) { return; }

	let ext = filename.slice(index + 1);
	if(ext !== "js") { return; }

	input.sources[fullSrc] = new SourceFile(src, filename);

	actionsUpdateIndex = true;
}

function removeSource(input, src)
{
	if(!input.sources[src]) { return; }

	delete input.sources[src];
	actionsUpdateIndex = true;
}

function removeDirectory(input, src)
{
	let watchFunc = watching[src];
	if(!watchFunc) { return; }

	watchFunc.close();
	delete watching[src];

	for(var key in input.sources) 
	{
		if(key.indexOf(src) === 0) {
			removeSource(input, key);
		}
	}
}

function iterSources(cb)
{
	updateIndex++;

	for(let n = 0; n < inputs.length; n++)
	{
		let sources = inputs[n].sources;

		for(let key in sources) {
			iterSource(sources, sources[key], cb);
		}
	}
}

function iterSource(sources, source, cb)
{
	if(source.index === updateIndex) { return; }
	source.index = updateIndex;

	iterSourceIncludes(sources, source, cb);

	cb(source);
}

function iterSourceIncludes(sources, source, cb)
{
	let includes = source.requires;

	for(let n = 0; n < includes.length; n++)
	{
		let src = includes[n];
		let includeSource = sources[src];
		if(!includeSource) {
			console.warn("No such file found: " + src + "\n  Referenced in: " + (source.path + source.filename));
			continue;
		}

		iterSource(sources, includeSource, cb);
	}
}

function concatSources()
{
	console.log("Compiling: " + packageSrc);

	let content = "";

	iterSources(
		function(source) {
			if(source.content) {
				content += source.content + "\n";
			}
		});

	if(flags.uglify) {
		content = uglifySources(content);
	}

	fs.writeFileSync(packageSrc, content);

	console.log("Finished");
}

function uglifySources(content)
{
	console.log("Uglifying package");

	let result = uglifyJS.minify(content, { 
		fromString: true,
		compress: { 
			dead_code: true,
		},
		mangle: true 
	});
	
	return result.code;
}

function updateTick()
{
	if(actionsChanged)
	{
		let contentChanged = false;

		for(let key in filesChanged)
		{
			let index = key.lastIndexOf(".");
			if(index === -1) { continue; }

			let source;
			let ext = key.slice(index + 1);
			if(ext === "js") 
			{
				for(let n = 0; n < inputs.length; n++) 
				{
					source = inputs[n].sources[key];
					if(source) { 
						break; 
					}
				}

				if(!source) { continue; }

				contentChanged = true;
			}
			else 
			{
				source = indexFiles[key];
				if(!source) { continue; }

				if(source.updating) {
					source.updating = false
					continue;
				}
			}

			logYellow("update", "File: " + key);

			source.update();
		}

		filesChanged = {};
		actionsChanged = false;

		if(contentChanged && flags.concat) {
			concatSources();		
		}
	}

	if(actionsUpdateIndex) 
	{
		for(let key in indexFiles) {
			let source = indexFiles[key];
			source.updateScripts();
		}

		actionsUpdateIndex = false;
	}
}

function startWatching()
{
	if(watchingFiles) { return; }
	watchingFiles = true;

	setInterval(function() {
		updateTick();
	}, 100);	
}

function defaultInit(src)
{
	flags.watch = true;
	flags.timestamp = true;

	addInput(src);

	const fileExist = fs.existsSync(src + "/index.html");
	if(fileExist) {
		addIndex(src + "/index.html");
	}	
}

function processArgs() 
{
	const args = process.argv.slice(2);
	const numArgs = args.length;

	if(numArgs === 1) {
		defaultInit(args[0]);
	}
	else if(numArgs === 0) {
		defaultInit("./");
	}
	else
	{
		for(let n = 0; n < numArgs; n++)
		{
			let flag = args[n];
			if(flag.indexOf("--") !== -1) 
			{
				let flagName = flag.slice(2);
				flags[flagName] = true;
			}
		}

		for(let n = 0; n < numArgs; n++)
		{
			let flag = args[n];
			if(flag.indexOf("--") !== -1) 
			{
				let flagArgs = [];
				
				for(n++; n < numArgs; n++) 
				{
					let arg = args[n];

					if(arg.indexOf("--") === -1) {
						flagArgs.push(arg);
					}
					else {
						n--;
						break;
					}
				}

				handleArg(flag, flagArgs);
			}
		}
	}
}

function handleArg(flag, args)
{
	switch(flag)
	{
		case "--input":
			addInput(args[0]);
			break;

		case "--index":
			addIndex(args[0]);
			break;

		case "--concat":
			if(args[0]) {
				packageSrc = args[0];
			}
			break;

		case "--uglify":
			flags.concat = true;
			break;
	}
}

function addInput(src) 
{
	const inputSrc = path.resolve(src);

	if(!fs.existsSync(inputSrc)) {
		return logError("Input not found: " + inputSrc);
	}

	let input = new Input(inputSrc);
	inputs.push(input);

	if(input.staticSources) {
		logGreen("input", "Directory: " + inputSrc);
	}
	else {
		logGreen("input", "File: " + inputSrc);
	}
}

function addIndex(src) 
{
	const fileExist = fs.existsSync(src);
	if(!fileExist) {
		return console.warn("\x1b[91m", "No such index file found at: " + src, "\x1b[0m");
	}

	let slash = path.normalize("/");
	let absoluteSrc = path.resolve(src);
	let index = absoluteSrc.lastIndexOf(slash);
	let filename = absoluteSrc.slice(index + 1);

	let content = fs.readFileSync(absoluteSrc);
	let indexFile = new IndexFile(absoluteSrc.slice(0, index + 1), filename, content);
	indexFiles[absoluteSrc] = indexFile;

	logGreen("output", "Index file: " + absoluteSrc);
}

function logGreen(type, text) {
	console.log(createTimestamp(), "\x1b[92m" + type, "\x1b[0m" + text);	
}

function logYellow(type, text) {
	console.log(createTimestamp(), "\x1b[33m" + type, "\x1b[0m" + text);	
}

function logError(text) {
	console.log(createTimestamp(), "\x1b[91m" + "Error: " + text, "\x1b[0m");	
}

function createTimestamp() 
{
	const date = new Date();
	const hour = date.getHours();
	const minutes = date.getMinutes();
	const seconds = date.getSeconds();
	const milliseconds = date.getMilliseconds();

	return "[" +
		((hour < 10) ? "0" + hour: hour) +
		":" +
		((minutes < 10) ? "0" + minutes: minutes) +
		":" +
		((seconds < 10) ? "0" + seconds: seconds) +
		"]";
}


function isSpace(c) {
	return (c === " " || c === "\t" || c === "\r" || c === "\n" || c === ";");
}

function resolveOutputDir()
{
	packageSrc = path.resolve(packageSrc);

	const slash = path.normalize("/");
	const extIndex = packageSrc.lastIndexOf(".");
	if(extIndex === -1) 
	{
		const lastChar = packageSrc[packageSrc.length - 1];
		if(lastChar !== "/" && lastChar !== "\\") {
			packageSrc += slash;
		}
		
		packageSrc += "package.js";
	}

	const relativeSrc = path.relative("./", packageSrc);
	const index = relativeSrc.lastIndexOf(slash);
	if(index !== -1)
	{
		const packageFolderSrc = relativeSrc.slice(0, index);
		const relativeBuffer = packageFolderSrc.split(slash);

		let currSrc = "";
		for(let n = 0; n < relativeBuffer.length; n++) 
		{
			currSrc += relativeBuffer[n] + slash;
			if(!fs.existsSync(currSrc)) 
			{
				console.log("Creating directories recursively: " + packageFolderSrc);

				fs.mkdirSync(currSrc);

				for(n++; n < relativeBuffer.length; n++)
				{
					currSrc += relativeBuffer[n] + slash;
					fs.mkdirSync(currSrc);
				}
			}
		}
	}	
}

console.log("");
processArgs();

if(inputs.length === 0) {
	process.exit(1);
}

resolveOutputDir();

if(flags.concat) {
	concatSources();
}

if(flags.watch) {
	startWatching();
}
else {
	updateTick();
}
