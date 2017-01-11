const exec = require("child_process").exec;
const os = require("os");
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");
const uglifyJS = require("uglify-js");
const watcher = require("./watcher");
const lexer = require("./lexer");
const server = require("./server/server");
const package = require("../package.json");
const cli = require("./cli");
const utils = require("./utils");

const needUpdate = {
	indexFile: false,
	files: false
};

const indexFiles = {};
let filesChanged = {};
let packageSrc = "./package.js";
let buildSrc = "./build/";
let entrySourceFile = null;

watcher.setEventListener((type, dir, file) => 
{
	if(type === "update") {
		filesChanged[file.rootPath + file.filename] = file;
		needUpdate.files = true;
	}
});

function setBuildDir(dir) {
	buildSrc = dir;
}

class IndexFile
{
	constructor(rootPath, filename, content) 
	{
		this.contentStart = null;
		this.contentEnd = null;
		this._content = null;
		this.updating = false;
		this.loaded = false;

		this.rootPath = rootPath;
		this.filename = filename;
		this.timestamp = "";

		this.update();
	}

	update() {
		this.content = fs.readFileSync(this.rootPath + this.filename, "utf8");
		needUpdate.indexFile = true;
	}

	updateScripts()
	{
		if(!this.loaded) { return; }

		let content = this.contentStart;

		if(cli.flags.concat) 
		{
			let timestamp = "";
			if(cli.flags.timestamp) {
				timestamp = "?" + Date.now();
			}

			const src = path.relative(this.rootPath + "/", packageSrc);
			content += `<script src="${src}${timestamp}"></script>\n`;

			if(cli.flags.server) {
				content += `<script>window.REPLICA_SERVER_PORT = ${server.getHttpPort()};</script>\n`;
				content += `<script src="${src}replica.js"></script>\n`;
			}			
		}
		else
		{
			const imports = lexer.getImports(entrySourceFile);
			const src = path.relative(this.rootPath, buildSrc) + path.normalize("/");

			if(cli.flags.timestamp)
			{
				let timestamp;

				for(let n = 0; n < imports.length; n++) 
				{
					const file = imports[n];
					if(!file.blockNode) { continue; }

					timestamp = "?" + Date.now();
					content += `<script src="${src}${file.filename}.${file.id}.js${timestamp}"></script>\n`;
				}

				if(file.blockNode) {
					timestamp = "?" + Date.now();
					content += `<script src="${src}${entrySourceFile.filename}.${entrySourceFile.id}.js${timestamp}"></script>\n`;
				}
			}
			else
			{
				for(let n = 0; n < imports.length; n++) 
				{
					const file = imports[n];
					if(!file.blockNode) { continue; }

					content += `<script src="${src}${file.filename}.${file.id}.js"></script>\n`;
				}

				if(entrySourceFile.blockNode) {
					content += `<script src="${src}${entrySourceFile.filename}.${entrySourceFile.id}.js"></script>\n`;
				}
			}

			if(cli.flags.server) {
				content += `<script>window.REPLICA_SERVER_PORT = ${server.getHttpPort()};</script>\n`;
				content += `<script src="${src}replica.js"></script>\n`;
			}			
		}

		content += this.contentEnd;
		this.updating = true;

		fs.writeFile(this.rootPath + this.filename, content);
	}

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
	}

	get content() {
		return this._content;
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
	watcher.watchFile(indexFile);

	utils.logGreen("IndexFile", absoluteSrc);
}

function concatFiles()
{
	utils.logMagenta("Compiling", packageSrc);

	let content = lexer.compileAll(entrySourceFile);

	if(cli.flags.uglify) {
		content = uglifyContent(content);
	}

	fs.writeFileSync(packageSrc, content, "utf8");

	utils.logMagenta("Ready", "");
}

function uglifyContent(content)
{
	utils.logMagenta("Uglifying", "");

	let result = null;

	try 
	{
		result = uglifyJS.minify(content, { 
			fromString: true,
			compress: { 
				dead_code: true,
			},
			mangle: true 
		});
	}
	catch(error)
	{
		console.log(error);
	}
	
	return result ? result.code : 0;
}

function updateTick()
{
	if(needUpdate.files)
	{
		let contentChanged = false;

		const imports = lexer.getImports(entrySourceFile);
		const firstImportFile = (imports && imports.length > 0) ? imports[0] : entrySourceFile;

		for(let key in filesChanged)
		{
			const file = filesChanged[key];
			const ext = path.extname(key);

			if(ext === ".html")
			{
				if(file.updating) {
					file.updating = false
					continue;
				}

				utils.logYellow("Update", "IndexFile: " + key);
				file.update();
				
			}
			else
			{
				utils.logYellow("Update", "File: " + key);
				file.update();

				if(file.blockNode && !cli.flags.concat) {
					fs.writeFileSync(buildSrc + file.filename + "." + file.id + ".js", lexer.compile(file, (file === firstImportFile)), "utf8");
				}

				contentChanged = true;
			}
		}

		filesChanged = {};
		needUpdate.files = false;

		if(contentChanged) 
		{
			if(cli.flags.concat) {
				concatFiles();
			}

			for(const key in indexFiles) {
				const source = indexFiles[key];
				source.updateScripts();
			}
		}

		if(cli.flags.server) {
			server.reload();
		}		
	}
}

function makeProject(dir) 
{
	const exists = fs.existsSync(dir);
	if(exists) 
	{
		if(fs.lstatSync(dir).isDirectory()) {
			return console.warn("Could not make project - directory already exists");
		}
		else {
			return console.warn("Could not make project - there is a file with such name");
		}
	}

	const templatePath = path.normalize(__dirname + "/../templates/basic");

	fs.mkdirSync(dir);

	copyFiles(dir, templatePath, () => 
	{
		console.log("Installing dependencies:\n");
		exec(`cd ${dir} && npm i`, (error, stdout, stderr) => {
			if(error) {
				console.error(error);
			}
			else {
				console.log(stdout);
			}
		});
	});
}

function printVersion() {
	const package = require("../package.json");
	console.log(`${package.name} ${package.version}v`)
}

function resolveBuildDir()
{
	buildSrc = path.resolve(buildSrc) + path.normalize("/");

	removeDir(buildSrc);
	createRelativeDir(buildSrc);

	copyFiles(buildSrc, path.normalize(__dirname + "/../templates/server"));
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

	// createRelativeDir(packageSrc);
}

function createRelativeDir(src)
{
	const slash = path.normalize("/");
	const relativeSrc = path.relative("./", src);
	const relativeBuffer = relativeSrc.split(slash);

	let currSrc = "";
	for(let n = 0; n < relativeBuffer.length; n++) 
	{
		currSrc += relativeBuffer[n] + slash;
		if(!fs.existsSync(currSrc)) 
		{
			fs.mkdirSync(currSrc);

			for(n++; n < relativeBuffer.length; n++)
			{
				currSrc += relativeBuffer[n] + slash;
				fs.mkdirSync(currSrc);
			}
		}
	}	
}

function removeDir(folderPath) 
{
	if(!fs.existsSync(folderPath)) {
		return;
	}

	fs.readdirSync(folderPath).forEach(
		(file, index) => {
			let currPath = folderPath + "/" + file;
			if(fs.lstatSync(currPath).isDirectory()) { 
				removeDir(currPath);
			} 
			else {
				fs.unlinkSync(currPath);
			}
		});

	fs.rmdirSync(folderPath);
}

function copyFiles(targetDir, srcDir, onDone)
{
	const absoluteTargetDir = path.resolve(targetDir);
	const absoluteSrcDir = path.resolve(srcDir);

	let cmd;
	switch(os.platform())
	{
		case "win32":
			cmd = `xcopy ${absoluteSrcDir} ${absoluteTargetDir} /s /e`;
			break;

		case "darwin":
		case "linux":
			cmd = `cp -r ${absoluteTargetDir}/* ${absoluteSrcDir}`;
			break;	
	}

	exec(cmd, (error, stdout, stderr) => {
		if(error) {
			console.error(error);
		}
		else 
		{
			console.log(stdout);
			if(onDone) {
				onDone();
			}
		}
	});
}

function setEntry(src)
{
	const entryPath = path.resolve(src);

	if(!fs.existsSync(entryPath)) {
		return utils.logError("EntryError", "File not found: " + src);
	}

	utils.logGreen("Entry", entryPath);

	entrySourceFile = lexer.parseAll(entryPath);
	if(!entrySourceFile) { return; }

	watcher.watchFile(entrySourceFile);
	filesChanged[entrySourceFile.rootPath + entrySourceFile.filename] = entrySourceFile;

	const imports = lexer.getImports(entrySourceFile);
	for(let n = 0; n < imports.length; n++) {
		const file = imports[n];
		watcher.watchFile(file);
		filesChanged[file.rootPath + file.filename] = file;
	}
}

function run(file) 
{
	setEntry(file);
	
	resolveBuildDir();
	resolveOutputDir();

	needUpdate.files = true;

	if(cli.flags.server) 
	{
		cli.flags.watch = cli.flags.watch || {};
		server.start(cli.flags.server.httpPort, cli.flags.server.wsPort, start);
	}
	else {
		start();
	}
}

function start()
{
	if(cli.flags.watch) 
	{
		if(cli.flags.server) {
			utils.logMagenta("ServerOpened", `http://127.0.0.1:${server.getHttpPort()}`);
			childProcess.spawn("explorer", [ `http://127.0.0.1:${server.getHttpPort()}` ]);
		}

		setInterval(() => {
			updateTick();
		}, 100);
	}
	else {
		updateTick();
	}	
}

console.log();

cli.name(package.name)
   .version(package.version)
   .description(package.description)
   .option("-i, --index <file>", "Add output index file", addIndex)
   .option("-t, --timestamp", "Add timestamps to output files")
   .option("-w, --watch", "Look after file changes in set input folders")
   .option("-u, --uglify", "Specify that concatenated file should be minified, activates --concat")
   .option("-c, --concat [file]", "Concat all files into one")
   .option("-s, --server [httpPort] [wsPort]", "Launch development server, activates --watch")
   .option("-b, --build <dir>", "Specify build directory", setBuildDir)
   .command("make <dir>", "Create and prepare an empty project", makeProject)
   .command("v", "\tPrints current version", printVersion)
   .parse(process.argv, run);

// function removeSource(input, src)
// {
// 	if(!input.sources[src]) { return; }

// 	delete input.sources[src];
// 	needUpdate.indexFile = true;
// }

// function removeDirectory(input, src)
// {
// 	let watchFunc = watching[src];
// 	if(!watchFunc) { return; }

// 	watchFunc.close();
// 	delete watching[src];

// 	for(var key in input.sources) 
// 	{
// 		if(key.indexOf(src) === 0) {
// 			removeSource(input, key);
// 		}
// 	}
// }
