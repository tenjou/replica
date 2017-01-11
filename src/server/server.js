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

function start(httpPort, wsPort, onReady)
{
	onReadyFunc = onReady;
	
	startHttpServer(httpPort);
	startWsServer(wsPort);
}

function startHttpServer(port)
{
	function respond404(response) {
		response.writeHeader(404, { "Content-Type": "text/plain" });  
		response.write("404 Not Found\n");  
		response.end();  	
	}

	httpServer = http.createServer((request, response) => 
	{
		const uri = url.parse(request.url).pathname;
		let filename = path.join(process.cwd(), uri);

		fs.exists(filename, (exists) => 
		{
			if(!exists) {
				respond404(response);
				return;
			}

			if(fs.statSync(filename).isDirectory()) {
				filename = path.join(filename, indexFilename);
			}

			fs.readFile(filename, "binary", function(error, file) 
			{  
				if(error) {  
					response.writeHeader(500, { "Content-Type": "text/plain" });  
					response.write(error + "\n");  
					response.end();  	
					return;
				}  

				response.writeHead(200, { "Content-Type": mime(filename) });
				response.write(file, "binary");  
				response.end();
			});
		});
	});

	httpServer.on("listening", () => 
	{
		httpServerPort = httpServer.address().port;
		
		numToLoad--;
		if(numToLoad === 0 && onReadyFunc) {
			onReadyFunc();
		}
	});

	httpServer.listen(port || 0);	
}

function startWsServer(port) 
{
	wsServer = new WebSocketServer({ port: 8080 });
	wsServer.on("listening", () => {
		numToLoad--;
		if(numToLoad === 0 && onReadyFunc) {
			onReadyFunc();
		}
	});
}

function reload() 
{
	wsServer.clients.forEach((client) => {
		client.send(JSON.stringify({ type: "reload" }));
	});
}

function getHttpPort() { 
	return httpServerPort; 
}

function getWsPort() {
	return wsServerPort;
}

function setIndexFilename(filename) {
	indexFilename = filename;
}

module.exports = {
	start, reload, getHttpPort, getWsPort, setIndexFilename
};
