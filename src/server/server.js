const http = require("http");
const url = require("url");
const path = require("path");
const fs = require("fs");
const WebSocketServer = require("ws").Server;
const mime = require("./mime");

let httpServer = null;
let httpServerPort = -1;
let wsServer = null;
let wsServerPort = -1;
let indexFilename = "index.html";
let onReadyFunc = null;
let numToLoad = 2;

const start = function(httpPort, wsPort, onReady)
{
	onReadyFunc = onReady

	startHttpServer(httpPort)
	tryStartWsServer(wsPort)
}

const startHttpServer = function(port)
{
	const respond404 = function(response) {
		response.writeHeader(404, { "Content-Type": "text/plain" })
		response.write("404 Not Found\n")
		response.end()
	}

	httpServer = http.createServer((request, response) =>
	{
		const uri = url.parse(request.url).pathname
		let filename = path.join(process.cwd(), uri)

		fs.exists(filename, (exists) =>
		{
			if(!exists) {
				respond404(response)
				return
			}

			if(fs.statSync(filename).isDirectory()) {
				filename = path.join(filename, indexFilename)
			}

			fs.readFile(filename, "binary", function(error, file)
			{
				if(error) {
					response.writeHeader(500, { "Content-Type": "text/plain" })
					response.write(error + "\n")
					response.end()
					return
				}

				response.writeHead(200, { "Content-Type": mime(filename) })
				response.write(file, "binary")
				response.end()
			});
		});
	});

	httpServer.on("listening", () =>
	{
		httpServerPort = httpServer.address().port

		numToLoad--;
		if(numToLoad === 0 && onReadyFunc) {
			onReadyFunc();
		}
	});

	httpServer.listen(port || 0);
}

const tryStartWsServer = function(port)
{
	if(!port) {
		getRandomPort((port) => {
			startWsServer(port)
		})
	}
	else {
		startWsServer(port)
	}
}

const startWsServer = function(port)
{
	wsServerPort = port

	wsServer = new WebSocketServer({ port })
	wsServer.on("listening", () => {
		numToLoad--
		if(numToLoad === 0 && onReadyFunc) {
			onReadyFunc()
		}
	})
}

const reload = function()
{
	wsServer.clients.forEach((client) => {
		client.send(JSON.stringify({ type: "reload" }))
	})
}

const getHttpPort = function() {
	return httpServerPort
}

const getWsPort = function() {
	return wsServerPort
}

const setIndexFilename = function(filename) {
	indexFilename = filename;
}

const getRandomPort = function(onDone)
{
	const tempServer = http.createServer()

	tempServer.on("listening", () => {
		const port = tempServer.address().port
		tempServer.close()
		onDone(port)
	})

	tempServer.listen(0)
}

module.exports = {
	start, reload, getHttpPort, getWsPort, setIndexFilename
}
